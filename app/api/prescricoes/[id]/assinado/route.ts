import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, denyUnlessStaff, jsonError } from "@/lib/prescricoes/access";
import { attachSignedPrescription } from "@/lib/prescricoes/attach-signed";
import { MAX_SIGNED_PDF_BYTES } from "@/lib/prescricoes/signed-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recebe o PDF assinado (multipart, campo "file"), confere se é um PDF com
 * assinatura digital desta receita e o vincula ao prontuário.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError(400, "Identificador de prescrição inválido.");

    const denied = await denyUnlessStaff();
    if (denied) return denied;

    const supabase = await createClient();
    if (!supabase) return jsonError(500, "Falha de conexão com o banco de dados.");

    let file: FormDataEntryValue | null = null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      return jsonError(400, "Envio inválido. Selecione o arquivo PDF assinado.");
    }
    if (!file || typeof file === "string") return jsonError(400, "Selecione o arquivo PDF assinado.");
    if (file.size > MAX_SIGNED_PDF_BYTES) return jsonError(413, "O arquivo é maior que 10 MB.");

    const result = await attachSignedPrescription(supabase, id, new Uint8Array(await file.arrayBuffer()));

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message, errors: result.errors },
        { status: result.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { success: true, url: result.url, warnings: result.warnings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Erro ao anexar receita assinada:", err);
    return jsonError(500, "Erro interno ao anexar a receita assinada.");
  }
}
