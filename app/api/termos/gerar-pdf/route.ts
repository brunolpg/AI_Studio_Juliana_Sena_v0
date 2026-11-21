import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireProfissionalAccess } from "@/lib/auth/session";
import { generateTermoConsentimentoPdf } from "@/lib/termos/pdf";
import { termoSnapshotSchema } from "@/lib/validations/termo";
import type { TermoConsentimento } from "@/types/termo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMOS_BUCKET = "termos-consentimento";
const SIGNED_URL_EXPIRES_IN = 300;
const DEFAULT_PROFISSIONAL = "Dra. Juliana Sena";

const gerarTermoPdfBodySchema = z.object({
  paciente_id: z.string().uuid("Identificador do paciente inválido."),
  modelo_id: z
    .string()
    .uuid("Identificador do modelo inválido.")
    .nullable()
    .optional(),
  procedimento_nome: z
    .string()
    .trim()
    .min(1, "O nome do procedimento é obrigatório."),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.")
    .optional(),
  conteudo_snapshot: termoSnapshotSchema,
  signature_data_url: z
    .string()
    .trim()
    .min(20, "A assinatura do paciente é obrigatória."),
  profissional: z.string().trim().optional(),
});

function getTodaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (request.headers.get("x-requested-with")) return true;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = (request.headers.get("x-forwarded-host") || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const host = (request.headers.get("host") || "").trim().toLowerCase();
    return Boolean(
      (forwardedHost && originHost === forwardedHost) ||
        (host && originHost === host)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isTrustedOrigin(request)) {
      return jsonError(403, "Origem da requisição não autorizada.");
    }

    // 1. Autenticação estrita de profissional / administrador
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      const status = auth.message.toLowerCase().includes("não autenticado")
        ? 401
        : 403;
      return jsonError(status, auth.message);
    }

    // 2. Parse e validação estrita do payload JSON
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, "Corpo da requisição JSON inválido.");
    }

    const parsed = gerarTermoPdfBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonError(
        400,
        parsed.error.issues[0]?.message ||
          "Dados inválidos para geração do termo de consentimento."
      );
    }

    const {
      paciente_id,
      modelo_id,
      procedimento_nome,
      data,
      conteudo_snapshot,
      signature_data_url,
      profissional,
    } = parsed.data;

    const supabase = auth.supabase;

    // 3. Busca dados completos do paciente ativo (soft delete: deleted_at IS NULL)
    const { data: paciente, error: pacError } = await supabase
      .from("pacientes")
      .select("id, nome, telefone, data_nascimento, cpf, email")
      .eq("id", paciente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return jsonError(404, "Paciente não encontrado ou inativo.");
    }

    // 4. Gera o PDF do termo assinado
    const termoId = randomUUID();
    const assinadoEmIso = new Date().toISOString();
    const dataFinal = data || getTodaySaoPaulo();
    const profissionalFinal = profissional || DEFAULT_PROFISSIONAL;

    let pdfBytes: Uint8Array;
    try {
      pdfBytes = await generateTermoConsentimentoPdf({
        termoId,
        procedimentoNome: procedimento_nome,
        data: dataFinal,
        assinadoEm: assinadoEmIso,
        profissional: profissionalFinal,
        paciente: {
          nome: paciente.nome,
          telefone: paciente.telefone,
          data_nascimento: paciente.data_nascimento,
          cpf: paciente.cpf,
          email: paciente.email,
        },
        conteudoSnapshot: conteudo_snapshot,
        signatureDataUrl: signature_data_url,
      });
    } catch (pdfErr: unknown) {
      const msg =
        pdfErr instanceof Error
          ? pdfErr.message
          : "Não foi possível gerar o PDF do termo de consentimento.";
      return jsonError(422, msg);
    }

    // 5. Upload no bucket privado `termos-consentimento` em `{paciente_id}/{termo_id}.pdf`
    const pdfPath = `${paciente_id}/${termoId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .upload(pdfPath, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      return jsonError(
        502,
        uploadError.message || "Falha ao salvar o PDF no armazenamento."
      );
    }

    // 6. Insere registro na tabela `termos` com rollback do arquivo se o insert falhar
    const { data: insertedTermo, error: insertError } = await supabase
      .from("termos")
      .insert({
        id: termoId,
        paciente_id,
        modelo_id: modelo_id ?? null,
        procedimento_nome,
        data: dataFinal,
        conteudo_snapshot,
        assinado: true,
        origem_pdf: "gerado",
        pdf_path: pdfPath,
        assinado_em: assinadoEmIso,
        profissional: profissionalFinal,
        created_at: assinadoEmIso,
        updated_at: assinadoEmIso,
      })
      .select("*")
      .single();

    if (insertError || !insertedTermo) {
      await supabase.storage.from(TERMOS_BUCKET).remove([pdfPath]);
      return jsonError(
        502,
        insertError?.message || "Erro ao registrar termo de consentimento no banco de dados."
      );
    }

    // 7. Gera Signed URL temporária (300s) para visualização imediata
    const { data: signedData, error: signedError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .createSignedUrl(pdfPath, SIGNED_URL_EXPIRES_IN);

    if (signedError || !signedData?.signedUrl) {
      return jsonError(
        502,
        signedError?.message ||
          "Termo salvo, mas não foi possível gerar a URL temporária do PDF."
      );
    }

    try {
      revalidatePath("/clinical");
      revalidatePath("/patients");
      revalidatePath("/dashboard");
      revalidatePath(`/pacientes/${paciente_id}`);
    } catch {
      // Revalidação segura
    }

    return NextResponse.json(
      {
        success: true,
        termo: insertedTermo as TermoConsentimento,
        signedUrl: signedData.signedUrl,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[API /api/termos/gerar-pdf] Erro interno:", err);
    return jsonError(500, "Erro interno ao gerar o PDF do termo de consentimento.");
  }
}
