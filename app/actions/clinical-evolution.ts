"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ClinicalEvolution } from "@/types/clinical-record";
import type { ActionResponse } from "@/types/client";
import { assinarPayloadSOAP } from "@/lib/crypto-payload";

async function getSupabaseClients() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  const adminDb = adminClient || serverClient;
  return { serverClient, adminClient, adminDb };
}

/**
 * Atualiza uma evolução clínica existente no Supabase com assinatura digital e sincronização de fotos/prescrições
 */
export async function updateClinicalEvolutionAction(
  id: string,
  clientId: string,
  input: Partial<ClinicalEvolution> & { status?: string }
): Promise<ActionResponse<ClinicalEvolution>> {
  try {
    if (!id || !clientId) {
      return { success: false, message: "Identificador da evolução ou do paciente ausente." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id) || !uuidRegex.test(clientId)) {
      return { success: false, message: "ID de formato inválido." };
    }

    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) {
      return { success: false, message: "Banco de dados indisponível no momento." };
    }

    const { data: { user }, error: authErr } = await serverClient.auth.getUser();
    if (authErr || !user) {
      return { success: false, message: "Acesso não autorizado. Por favor, realize login novamente." };
    }

    // Calcula IMC se peso e altura foram fornecidos
    let calculatedImc = input.sinaisVitais?.imc;
    if (
      !calculatedImc &&
      (input.sinaisVitais as any)?.peso &&
      (input.sinaisVitais as any)?.altura &&
      (input.sinaisVitais as any).altura > 0
    ) {
      const alt = (input.sinaisVitais as any).altura;
      const alturaMetros = alt > 3 ? alt / 100 : alt;
      calculatedImc = Number(((input.sinaisVitais as any).peso / (alturaMetros * alturaMetros)).toFixed(1));
    }

    // Sanitiza procedimento_id
    let sanitizedProcedimentoId: string | null = null;
    if (input.procedimento_id && uuidRegex.test(input.procedimento_id)) {
      sanitizedProcedimentoId = input.procedimento_id;
    } else if (input.tipo) {
      try {
        const { data: procDb } = await adminDb
          .from("procedimentos")
          .select("id")
          .ilike("procedimento", input.tipo.trim())
          .maybeSingle();

        if (procDb?.id && uuidRegex.test(procDb.id)) {
          sanitizedProcedimentoId = procDb.id;
        }
      } catch (procErr) {
        console.warn("Aviso ao buscar procedimento por nome no Supabase:", procErr);
      }
    }

    // Sanitiza appointment_id
    let sanitizedAppointmentId: string | null = null;
    if (input.appointment_id && uuidRegex.test(input.appointment_id)) {
      sanitizedAppointmentId = input.appointment_id;
    }

    const assinadoEmServer = new Date().toISOString();
    const prescricoesIds = input.prescricoes_ids || [];
    const homeCareFichaId = input.home_care_ficha_id || null;
    const finalStatus = input.status || "Ativo";

    // Assina payload canônico SOAP
    const rawPayloadToSign = {
      paciente_id: clientId,
      procedimento_id: sanitizedProcedimentoId,
      appointment_id: sanitizedAppointmentId,
      data: input.data || new Date().toISOString().split("T")[0],
      horario:
        input.horario ||
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      subjetivo: input.subjetivo || "Sem queixas ativas registradas.",
      objetivo: input.objetivo || "Exame físico sumário preservado.",
      avaliacao: input.avaliacao || "Condição estável.",
      plano: input.plano || "Orientações gerais de saúde.",
      status: finalStatus,
      prescricoes_ids: prescricoesIds,
      home_care_ficha_id: homeCareFichaId,
      sinais_vitais: input.sinaisVitais
        ? {
            ...input.sinaisVitais,
            imc: calculatedImc,
          }
        : null,
      exames_anexos: input.exames_anexos || [],
      fotos_paciente: input.fotos_paciente || [],
      profissional: input.profissional || "Dra. Juliana Sena",
      especialidade: input.especialidade || "Clínica Geral",
      assinado_em: assinadoEmServer,
    };

    const signatureResult = assinarPayloadSOAP(rawPayloadToSign);

    const updatePayload: Record<string, any> = {
      data: rawPayloadToSign.data,
      horario: rawPayloadToSign.horario,
      tipo: input.tipo || "Consulta",
      tipo_atendimento: input.tipo_atendimento || input.tipo || "Consulta",
      status: finalStatus,
      procedimento_id: sanitizedProcedimentoId,
      appointment_id: sanitizedAppointmentId,
      exames_anexos: rawPayloadToSign.exames_anexos,
      fotos_paciente: rawPayloadToSign.fotos_paciente,
      profissional: rawPayloadToSign.profissional,
      especialidade: rawPayloadToSign.especialidade,
      subjetivo: rawPayloadToSign.subjetivo,
      objetivo: rawPayloadToSign.objetivo,
      sinais_vitais: rawPayloadToSign.sinais_vitais,
      avaliacao: rawPayloadToSign.avaliacao,
      plano: rawPayloadToSign.plano,
      prescricoes_ids: prescricoesIds,
      home_care_ficha_id: homeCareFichaId,
      payload_canonico: signatureResult.payloadCanonicoStr,
      payload_hash: signatureResult.payloadHash,
      assinatura: signatureResult.assinatura,
      algoritmo: signatureResult.algoritmo,
      assinado_em: signatureResult.assinadoEm,
    };

    let { data: updatedRecord, error: updateErr } = await adminDb
      .from("evolucoes_clinicas")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.warn("Aviso: tentativa completa de update em evolucoes_clinicas falhou, tentando payload base:", updateErr.message);
      // Fallback sem campos opcionais de assinatura caso o schema ainda não os possua
      const fallbackPayload: Record<string, any> = {
        data: rawPayloadToSign.data,
        horario: rawPayloadToSign.horario,
        tipo: input.tipo || "Consulta",
        tipo_atendimento: input.tipo_atendimento || input.tipo || "Consulta",
        status: finalStatus,
        procedimento_id: sanitizedProcedimentoId,
        appointment_id: sanitizedAppointmentId,
        exames_anexos: rawPayloadToSign.exames_anexos,
        fotos_paciente: rawPayloadToSign.fotos_paciente,
        profissional: rawPayloadToSign.profissional,
        especialidade: rawPayloadToSign.especialidade,
        subjetivo: rawPayloadToSign.subjetivo,
        objetivo: rawPayloadToSign.objetivo,
        sinais_vitais: rawPayloadToSign.sinais_vitais,
        avaliacao: rawPayloadToSign.avaliacao,
        plano: rawPayloadToSign.plano,
        prescricoes_ids: prescricoesIds,
        home_care_ficha_id: homeCareFichaId,
      };

      const fallbackRes = await adminDb
        .from("evolucoes_clinicas")
        .update(fallbackPayload)
        .eq("id", id)
        .select()
        .single();

      if (!fallbackRes.error && fallbackRes.data) {
        updatedRecord = fallbackRes.data;
        updateErr = null;
      } else {
        console.error("Erro ao atualizar evolução clínica no Supabase:", updateErr.message);
        return {
          success: false,
          message: `Erro ao atualizar evolução no banco: ${updateErr.message}`,
        };
      }
    }

    // Sincroniza vínculos na tabela associativa public.evolucao_prescricoes
    try {
      await adminDb.from("evolucao_prescricoes").delete().eq("evolucao_id", id);
      if (prescricoesIds.length > 0) {
        const associacoes = prescricoesIds.map((rxId: string) => ({
          evolucao_id: id,
          prescricao_id: rxId,
        }));
        await adminDb.from("evolucao_prescricoes").insert(associacoes);
      }
    } catch (assocErr) {
      console.warn("Aviso ao atualizar tabela de associação de prescrições:", assocErr);
    }

    try {
      revalidatePath("/dashboard");
    } catch {}

    const resultEvolution: ClinicalEvolution = {
      id: updatedRecord.id,
      client_id: clientId,
      data: updatedRecord.data,
      horario: updatedRecord.horario,
      tipo: updatedRecord.tipo,
      tipo_atendimento: updatedRecord.tipo_atendimento,
      status: updatedRecord.status || finalStatus,
      procedimento_id: updatedRecord.procedimento_id,
      appointment_id: updatedRecord.appointment_id,
      exames_anexos: updatedRecord.exames_anexos || [],
      fotos_paciente: updatedRecord.fotos_paciente || [],
      profissional: updatedRecord.profissional,
      especialidade: updatedRecord.especialidade,
      subjetivo: updatedRecord.subjetivo,
      objetivo: updatedRecord.objetivo,
      sinaisVitais: updatedRecord.sinais_vitais || undefined,
      avaliacao: updatedRecord.avaliacao,
      plano: updatedRecord.plano,
      prescricoes_ids: prescricoesIds,
      home_care_ficha_id: homeCareFichaId,
      payload_canonico: updatedRecord.payload_canonico,
      payload_hash: updatedRecord.payload_hash,
      assinatura: updatedRecord.assinatura,
      algoritmo: updatedRecord.algoritmo,
      assinado_em: updatedRecord.assinado_em,
      created_at: updatedRecord.created_at,
    };

    return {
      success: true,
      message: "Evolução clínica atualizada com sucesso!",
      data: resultEvolution,
    };
  } catch (err: any) {
    console.error("Exceção em updateClinicalEvolutionAction:", err);
    return {
      success: false,
      message: err?.message || "Falha inesperada ao atualizar evolução clínica.",
    };
  }
}

/**
 * Exclui uma evolução clínica e suas associações dependentes
 */
export async function deleteClinicalEvolutionAction(
  id: string,
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!id) {
      return { success: false, error: "Identificador da evolução ausente." };
    }

    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) {
      return { success: false, error: "Banco de dados indisponível." };
    }

    const { data: { user }, error: authErr } = await serverClient.auth.getUser();
    if (authErr || !user) {
      return { success: false, error: "Usuário não autenticado." };
    }

    // 1. Limpa vínculos dependentes na tabela associativa
    await adminDb.from("evolucao_prescricoes").delete().eq("evolucao_id", id);

    // 2. Remove registro da evolução
    const { error: delErr } = await adminDb
      .from("evolucoes_clinicas")
      .delete()
      .eq("id", id);

    if (delErr) {
      console.error("Erro ao deletar evolução clínica:", delErr.message);
      return { success: false, error: delErr.message };
    }

    try {
      revalidatePath("/dashboard");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("Exceção em deleteClinicalEvolutionAction:", err);
    return { success: false, error: err?.message || "Falha ao excluir evolução clínica." };
  }
}
