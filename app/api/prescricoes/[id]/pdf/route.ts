import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UUID_RE, denyUnlessStaff, jsonError } from "@/lib/prescricoes/access";
import { buildPrescriptionPdf, prescriptionPdfFileName, type PrescriptionPdfInput } from "@/lib/prescricoes/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Baixa o PDF da receita (gerado no servidor), pronto para assinar no VIDaaS. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return jsonError(400, "Identificador de prescrição inválido.");

    const denied = await denyUnlessStaff();
    if (denied) return denied;

    const supabase = await createClient();
    if (!supabase) return jsonError(500, "Falha de conexão com o banco de dados.");

    const { data: prescricao, error } = await supabase
      .from("prescricoes")
      .select(
        `
        id,
        data_prescricao,
        observacoes,
        pacientes ( nome, cpf ),
        prescricao_itens (
          nome_formula, via, veiculo, dosagem, tipo_veiculo, posologia, duracao,
          orient_paciente, orient_farmacia, componentes_snapshot
        )
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !prescricao) return jsonError(404, "Prescrição não encontrada.");

    const paciente = (Array.isArray(prescricao.pacientes) ? prescricao.pacientes[0] : prescricao.pacientes) as
      | { nome?: string | null; cpf?: string | null }
      | null;
    const item = (prescricao.prescricao_itens?.[0] ?? {}) as PrescriptionPdfInput["item"];

    let pdf: Uint8Array;
    try {
      pdf = await buildPrescriptionPdf({
        id: prescricao.id,
        dataPrescricao: prescricao.data_prescricao,
        observacoes: prescricao.observacoes,
        paciente: { nome: paciente?.nome, cpf: paciente?.cpf },
        item,
      });
    } catch (e: any) {
      return jsonError(422, e?.message || "Não foi possível gerar o PDF desta receita.");
    }

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${prescriptionPdfFileName(paciente?.nome, prescricao.data_prescricao)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Erro ao gerar PDF da receita:", err);
    return jsonError(500, "Erro interno ao gerar o PDF.");
  }
}
