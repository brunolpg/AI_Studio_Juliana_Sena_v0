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

    console.info(`[PDF Route] Buscando prescrição para download com ID: '${id}'`);

    let { data: prescricao, error } = await supabase
      .from("prescricoes")
      .select(
        `
        id,
        paciente_id,
        data_prescricao,
        observacoes,
        pacientes ( id, nome, cpf ),
        prescricao_itens (*)
      `
      )
      .eq("id", id)
      .maybeSingle();

    // Contingência: se não encontrar diretamente por id na tabela prescricoes,
    // verifica se o id recebido é da tabela prescricao_itens
    if (!prescricao) {
      console.warn(`[PDF Route] Prescrição não encontrada diretamente por id='${id}'. Verificando na tabela prescricao_itens...`);
      const { data: itemData, error: itemErr } = await supabase
        .from("prescricao_itens")
        .select("prescricao_id")
        .eq("id", id)
        .maybeSingle();

      if (itemData?.prescricao_id) {
        console.info(`[PDF Route] Item localizado! Redirecionando busca para a prescrição pai id='${itemData.prescricao_id}'`);
        const { data: parentPresc, error: parentErr } = await supabase
          .from("prescricoes")
          .select(
            `
            id,
            paciente_id,
            data_prescricao,
            observacoes,
            pacientes ( id, nome, cpf ),
            prescricao_itens (*)
          `
          )
          .eq("id", itemData.prescricao_id)
          .maybeSingle();

        if (parentPresc) {
          prescricao = parentPresc;
          error = null;
        } else if (parentErr) {
          error = parentErr;
        }
      } else if (itemErr) {
        console.warn(`[PDF Route] Erro ao consultar prescricao_itens para id='${id}':`, itemErr.message);
      }
    }

    if (error || !prescricao) {
      console.error(`[PDF Route] Prescrição não encontrada no Supabase. ID consultado: '${id}', Erro DB:`, error);
      return jsonError(404, "Prescrição não encontrada.");
    }

    // Garante recuperação do paciente, seja pelo join ou por consulta direta via paciente_id
    let paciente = (Array.isArray(prescricao.pacientes) ? prescricao.pacientes[0] : prescricao.pacientes) as
      | { id?: string; nome?: string | null; cpf?: string | null }
      | null;

    if (!paciente && prescricao.paciente_id) {
      console.info(`[PDF Route] Paciente não veio no join. Buscando diretamente por paciente_id='${prescricao.paciente_id}'...`);
      const { data: pData } = await supabase
        .from("pacientes")
        .select("id, nome, cpf")
        .eq("id", prescricao.paciente_id)
        .maybeSingle();
      if (pData) {
        paciente = pData;
      }
    }

    // Garante recuperação dos itens, seja pelo join ou por consulta direta
    let itens = prescricao.prescricao_itens;
    if (!itens || itens.length === 0) {
      console.info(`[PDF Route] Itens não vieram no join. Buscando diretamente na tabela prescricao_itens...`);
      const { data: itensData } = await supabase
        .from("prescricao_itens")
        .select("*")
        .eq("prescricao_id", prescricao.id);
      if (itensData && itensData.length > 0) {
        itens = itensData;
      }
    }

    const item = (itens?.[0] ?? {}) as PrescriptionPdfInput["item"];

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
      console.error(`[PDF Route] Falha ao construir o PDF para prescrição '${prescricao.id}':`, e);
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
    console.error("[PDF Route] Erro interno não tratado ao gerar PDF da receita:", err);
    return jsonError(500, "Erro interno ao gerar o PDF.");
  }
}
