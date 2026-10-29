"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PatientClinicalRecord,
  MedicalHistory,
  ClinicalEvolution,
  PrescriptionItem,
} from "@/types/clinical-record";
import type { ActionResponse } from "@/types/client";
import { assinarPayloadSOAP } from "@/lib/crypto-payload";
import { toSentenceCase } from "@/lib/utils";

/**
 * Consulta Prontuário e Histórico Clínico do Paciente
 */
export async function getPatientClinicalRecordAction(
  clientId: string
): Promise<ActionResponse<PatientClinicalRecord>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não informado." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, message: "Banco de dados não disponível." };
    }

    // 1. Carrega histórico clínico
    const defaultHistory: MedicalHistory = {
      alergias: [],
      comorbidades: [],
      medicamentosUsoContinuo: [],
      acompanhamentoMedico: [],
      isotretinoina6Meses: false,
      lesoesDetalhes: "",
      implantesDispositivos: [],
      ingestaoAgua: "",
      qualidadeSono: "",
      funcionamentoIntestino: "",
      fotosAreaTratada: [],
      tipoSanguineo: "Não informado",
      historicoCirurgico: "",
      historicoFamiliar: "",
      habitosVida: {
        tabagismo: "Não fuma",
        etilismo: "Não consome",
        atividadeFisica: "Sedentário",
      },
      observacoesGerais: "",
    };

    let medicalHistory = { ...defaultHistory };

    const { data: dbHistory, error: dbErr } = await supabase
      .from("historico_clinico")
      .select("*")
      .eq("paciente_id", clientId)
      .maybeSingle();

    if (!dbErr && dbHistory) {
      medicalHistory = {
        alergias: dbHistory.alergias || [],
        comorbidades: dbHistory.comorbidades || [],
        medicamentosUsoContinuo: dbHistory.medicamentos_uso_continuo || dbHistory.medicamentosUsoContinuo || [],
        acompanhamentoMedico: dbHistory.acompanhamento_medico || [],
        isotretinoina6Meses: Boolean(dbHistory.isotretinoina_6_meses),
        lesoesDetalhes: dbHistory.lesoes_detalhes || "",
        implantesDispositivos: dbHistory.implantes_dispositivos || [],
        ingestaoAgua: dbHistory.ingestao_agua || "",
        qualidadeSono: dbHistory.qualidade_sono || "",
        funcionamentoIntestino: dbHistory.funcionamento_intestino || "",
        fotosAreaTratada: dbHistory.fotos_area_tratada || [],
        tipoSanguineo: dbHistory.tipo_sanguineo || dbHistory.tipoSanguineo || "Não informado",
        historicoCirurgico: dbHistory.historico_cirurgico || dbHistory.historicoCirurgico || "",
        historicoFamiliar: dbHistory.historico_familiar || dbHistory.historicoFamiliar || "",
        habitosVida: dbHistory.habitos_vida || dbHistory.habitosVida || defaultHistory.habitosVida,
        observacoesGerais: dbHistory.observacoes_gerais || dbHistory.observacoesGerais || "",
        updated_at: dbHistory.updated_at,
      };
    }

    // 2. Carrega prescrições reais do Supabase
    const { data: prescricoesDb, error: rxErr } = await supabase
      .from("prescricoes")
      .select(`
        id,
        data_prescricao,
        status,
        observacoes,
        prescricao_itens (
          id,
          nome_formula,
          via,
          veiculo,
          dosagem,
          tipo_veiculo,
          posologia,
          duracao,
          orient_paciente,
          orient_farmacia,
          componentes_snapshot
        )
      `)
      .eq("paciente_id", clientId)
      .order("data_prescricao", { ascending: false });

    const mappedPrescriptions: PrescriptionItem[] = [];

    if (!rxErr && prescricoesDb && prescricoesDb.length > 0) {
      for (const p of prescricoesDb) {
        const items = p.prescricao_itens || [];
        for (const item of items) {
          const snap = (item.componentes_snapshot as any[]) || [];
          const listAtivos = snap
            .map((c: any) => `${toSentenceCase(c.nome)}: ${c.quantidade}${c.unidade || "%"}`)
            .join(" + ");

          const sanitizedTipoVeiculo = item.tipo_veiculo;
          const formattedDosagem = item.via === "oral"
            ? `${listAtivos} em ${item.veiculo} (Dose: ${item.dosagem} | Total: ${item.duracao} ${sanitizedTipoVeiculo || "un"})`
            : `${listAtivos} em ${item.veiculo} q.s.p. ${item.dosagem}g (Total: ${item.duracao} un)`;

          const combinedInstrucoes = [
            item.orient_paciente ? `[Orientações ao Paciente]\n${item.orient_paciente}` : "",
            item.orient_farmacia ? `[Observações à Farmácia Magistral]\n${item.orient_farmacia}` : "",
          ].filter(Boolean).join("\n\n");

          mappedPrescriptions.push({
            id: item.id || p.id,
            client_id: clientId,
            data: p.data_prescricao || new Date().toISOString().split("T")[0],
            medicamento: item.nome_formula,
            dosagem: formattedDosagem,
            via: item.via === "oral" ? "Oral" : "Tópico",
            posologia: item.posologia || "",
            duracao: item.via === "oral" ? `${item.duracao} ${sanitizedTipoVeiculo || "un"}` : "Uso recomendado",
            ativo: p.status === "Ativo",
            instrucoes: combinedInstrucoes || undefined,
          });
        }
      }
    }

    // 3. Evoluções com relacionamentos
    let mappedEvolutions: ClinicalEvolution[] = [];
    try {
      const { data: evDb, error: evErr } = await supabase
        .from("evolucoes_clinicas")
        .select(`
          *,
          home_care_ficha:home_care_fichas (
            id,
            titulo_protocolo,
            data_home_care,
            status,
            payload_hash,
            incluir_atencao_critica,
            atencao_critica_titulo,
            atencao_critica_texto
          )
        `)
        .eq("paciente_id", clientId)
        .order("created_at", { ascending: false });

      if (!evErr && evDb) {
        mappedEvolutions = evDb.map((e: any) => {
          const linkedPrescs = (prescricoesDb || [])
            .filter((p: any) => (e.prescricoes_ids || []).includes(p.id))
            .map((p: any) => ({
              id: p.id,
              data_prescricao: p.data_prescricao,
              status: p.status,
              formulas: (p.prescricao_itens || []).map((it: any) => it.nome_formula),
            }));

          return {
            id: e.id,
            client_id: e.paciente_id,
            data: e.data,
            horario: e.horario,
            tipo: e.tipo,
            tipo_atendimento: e.tipo_atendimento,
            procedimento_id: e.procedimento_id,
            appointment_id: e.appointment_id,
            exames_anexos: e.exames_anexos || [],
            fotos_paciente: e.fotos_paciente || [],
            profissional: e.profissional,
            especialidade: e.especialidade,
            subjetivo: e.subjetivo,
            objetivo: e.objetivo,
            sinaisVitais: e.sinais_vitais || undefined,
            avaliacao: e.avaliacao,
            plano: e.plano,
            prescricoes_ids: e.prescricoes_ids || [],
            home_care_ficha_id: e.home_care_ficha_id || null,
            home_care_ficha: e.home_care_ficha || null,
            prescricoes_detalhes: linkedPrescs,
            payload_canonico: e.payload_canonico || undefined,
            payload_hash: e.payload_hash || undefined,
            assinatura: e.assinatura || undefined,
            algoritmo: e.algoritmo || undefined,
            assinado_em: e.assinado_em || undefined,
            created_at: e.created_at,
          };
        });
      }
    } catch {
      // Falha silenciosa caso a tabela não exista, mantendo array vazio
    }

    return {
      success: true,
      data: {
        client_id: clientId,
        medicalHistory,
        evolutions: mappedEvolutions,
        prescriptions: mappedPrescriptions,
      },
    };
  } catch (error) {
    console.error("Erro ao obter prontuário clínico:", error);
    return {
      success: false,
      message: "Falha ao carregar o prontuário do paciente.",
    };
  }
}

/**
 * Adiciona uma Nova Evolução Clínica / Registro de Consulta (SOAP) com Assinatura Digital de Payload
 */
export async function addClinicalEvolutionAction(
  clientId: string,
  input: Omit<ClinicalEvolution, "id" | "created_at">
): Promise<ActionResponse<ClinicalEvolution>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não fornecido." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    // Calcula IMC se peso e altura foram fornecidos
    let calculatedImc = input.sinaisVitais?.imc;
    if (
      !calculatedImc &&
      input.sinaisVitais?.peso &&
      input.sinaisVitais?.altura &&
      input.sinaisVitais.altura > 0
    ) {
      const alturaMetros = input.sinaisVitais.altura > 3 ? input.sinaisVitais.altura / 100 : input.sinaisVitais.altura;
      calculatedImc = Number((input.sinaisVitais.peso / (alturaMetros * alturaMetros)).toFixed(1));
    }

    const assinadoEmServer = new Date().toISOString();
    const prescricoesIds = input.prescricoes_ids || [];
    const homeCareFichaId = input.home_care_ficha_id || null;

    const rawPayloadToSign = {
      paciente_id: clientId,
      appointment_id: input.appointment_id || null,
      data: input.data || new Date().toISOString().split("T")[0],
      horario:
        input.horario ||
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      subjetivo: input.subjetivo || "Sem queixas ativas registradas.",
      objetivo: input.objetivo || "Exame físico sumário preservado.",
      avaliacao: input.avaliacao || "Condição estável.",
      plano: input.plano || "Orientações gerais de saúde.",
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

    const newEvolution: ClinicalEvolution = {
      id: "",
      client_id: clientId,
      data: rawPayloadToSign.data,
      horario: rawPayloadToSign.horario,
      tipo: input.tipo || "Consulta",
      tipo_atendimento: input.tipo_atendimento || input.tipo,
      procedimento_id: input.procedimento_id,
      appointment_id: input.appointment_id || null,
      exames_anexos: rawPayloadToSign.exames_anexos,
      fotos_paciente: rawPayloadToSign.fotos_paciente,
      profissional: rawPayloadToSign.profissional,
      especialidade: rawPayloadToSign.especialidade,
      subjetivo: rawPayloadToSign.subjetivo,
      objetivo: rawPayloadToSign.objetivo,
      sinaisVitais: rawPayloadToSign.sinais_vitais || undefined,
      avaliacao: rawPayloadToSign.avaliacao,
      plano: rawPayloadToSign.plano,
      prescricoes_ids: prescricoesIds,
      home_care_ficha_id: homeCareFichaId,
      payload_canonico: signatureResult.payloadCanonicoStr,
      payload_hash: signatureResult.payloadHash,
      assinatura: signatureResult.assinatura,
      algoritmo: signatureResult.algoritmo,
      assinado_em: signatureResult.assinadoEm,
      created_at: new Date().toISOString(),
    };

    // Validação de autenticação via server client e escrita via admin client
    const serverClient = await createClient();
    if (!serverClient) {
      return { success: false, message: "Banco de dados não disponível." };
    }

    const { data: { user }, error: authErr } = await serverClient.auth.getUser();
    if (authErr || !user) {
      return { success: false, message: "Acesso não autorizado. Por favor, realize login novamente." };
    }

    const supabase = getSupabaseAdminClient() || serverClient;
    if (supabase) {
      let savedEvolutionId = "";

      // Grava na tabela evolucoes_clinicas com assinatura digital e vínculos (UUID nativo gerado pelo PostgreSQL)
      try {
        const { data: insertedRecord, error: insertErr } = await supabase
          .from("evolucoes_clinicas")
          .insert({
            paciente_id: clientId,
            data: newEvolution.data,
            horario: newEvolution.horario,
            tipo: newEvolution.tipo,
            tipo_atendimento: newEvolution.tipo_atendimento,
            procedimento_id: newEvolution.procedimento_id,
            appointment_id: newEvolution.appointment_id,
            exames_anexos: newEvolution.exames_anexos,
            fotos_paciente: newEvolution.fotos_paciente,
            profissional: newEvolution.profissional,
            especialidade: newEvolution.especialidade,
            subjetivo: newEvolution.subjetivo,
            objetivo: newEvolution.objetivo,
            sinais_vitais: newEvolution.sinaisVitais,
            avaliacao: newEvolution.avaliacao,
            plano: newEvolution.plano,
            prescricoes_ids: newEvolution.prescricoes_ids,
            home_care_ficha_id: newEvolution.home_care_ficha_id,
            payload_canonico: signatureResult.payloadCanonicoStr,
            payload_hash: signatureResult.payloadHash,
            assinatura: signatureResult.assinatura,
            algoritmo: signatureResult.algoritmo,
            assinado_em: signatureResult.assinadoEm,
          })
          .select()
          .single();

        if (insertedRecord?.id) {
          savedEvolutionId = insertedRecord.id;
          newEvolution.id = insertedRecord.id;
          if (insertedRecord.created_at) {
            newEvolution.created_at = insertedRecord.created_at;
          }
        } else if (insertErr) {
          console.error("Erro ao salvar evolução clínica na tabela evolucoes_clinicas:", insertErr.message);
          // Fallback de salvamento
          const { data: fallbackRecord, error: fallbackErr } = await supabase
            .from("evolucoes_clinicas")
            .insert({
              paciente_id: clientId,
              data: newEvolution.data,
              horario: newEvolution.horario,
              tipo: newEvolution.tipo,
              tipo_atendimento: newEvolution.tipo_atendimento,
              procedimento_id: newEvolution.procedimento_id,
              appointment_id: newEvolution.appointment_id,
              exames_anexos: newEvolution.exames_anexos,
              fotos_paciente: newEvolution.fotos_paciente,
              profissional: newEvolution.profissional,
              especialidade: newEvolution.especialidade,
              subjetivo: newEvolution.subjetivo,
              objetivo: newEvolution.objetivo,
              sinais_vitais: newEvolution.sinaisVitais,
              avaliacao: newEvolution.avaliacao,
              plano: newEvolution.plano,
              prescricoes_ids: newEvolution.prescricoes_ids,
              home_care_ficha_id: newEvolution.home_care_ficha_id,
            })
            .select()
            .single();

          if (fallbackRecord?.id) {
            savedEvolutionId = fallbackRecord.id;
            newEvolution.id = fallbackRecord.id;
            if (fallbackRecord.created_at) {
              newEvolution.created_at = fallbackRecord.created_at;
            }
          }

          if (fallbackErr) {
            console.error("Erro crítico ao salvar evolução no Supabase:", fallbackErr.message);
            return {
              success: false,
              message: `Erro ao gravar evolução no banco: ${fallbackErr.message}`,
            };
          }
        }
      } catch (e: any) {
        console.error("Exceção no registro da evolução clínica no Supabase:", e?.message || e);
      }

      // 1. Sincroniza vínculos na tabela associativa public.evolucao_prescricoes
      if (savedEvolutionId && prescricoesIds.length > 0) {
        try {
          const associacoes = prescricoesIds.map((rxId: string) => ({
            evolucao_id: savedEvolutionId,
            prescricao_id: rxId,
          }));

          const { error: assocErr } = await supabase
            .from("evolucao_prescricoes")
            .upsert(associacoes, { onConflict: "evolucao_id,prescricao_id", ignoreDuplicates: true });

          if (assocErr) {
            // Tentativa alternativa com insert simples se não houver constraint de upsert
            await supabase.from("evolucao_prescricoes").insert(associacoes);
          }
        } catch (assocEx: any) {
          console.warn("[addClinicalEvolutionAction] Aviso ao gravar tabela evolucao_prescricoes:", assocEx?.message || assocEx);
        }
      }

      // 2. Vínculo automático ao Atendimento selecionado (appointment_id)
      if (input.appointment_id) {
        const aptId = input.appointment_id;

        // Atualiza appointment_id nas prescrições selecionadas que ainda não tenham esse vínculo
        if (prescricoesIds.length > 0) {
          try {
            const { error: rxAptErr } = await supabase
              .from("prescricoes")
              .update({ appointment_id: aptId, updated_at: new Date().toISOString() })
              .in("id", prescricoesIds)
              .is("appointment_id", null);

            if (rxAptErr) {
              console.warn(`[addClinicalEvolutionAction] Erro ao associar appointment_id em prescricoes:`, rxAptErr.message);
            }
          } catch (rxEx: any) {
            console.warn("[addClinicalEvolutionAction] Exceção ao associar appointment_id em prescricoes:", rxEx);
          }
        }

        // Atualiza appointment_id na ficha de Home Care selecionada que ainda não tenha esse vínculo
        if (homeCareFichaId) {
          try {
            const { error: hcAptErr } = await supabase
              .from("home_care_fichas")
              .update({ appointment_id: aptId, updated_at: new Date().toISOString() })
              .eq("id", homeCareFichaId)
              .is("appointment_id", null);

            if (hcAptErr) {
              console.warn(`[addClinicalEvolutionAction] Erro ao associar appointment_id em home_care_fichas:`, hcAptErr.message);
            }
          } catch (hcEx: any) {
            console.warn("[addClinicalEvolutionAction] Exceção ao associar appointment_id em home_care_fichas:", hcEx);
          }
        }

        // Atualiza status do agendamento para 'Realizado' no Supabase
        try {
          const { error: aptUpdErr } = await supabase
            .from("appointments")
            .update({ status: "Realizado", updated_at: new Date().toISOString() })
            .eq("id", aptId);

          if (aptUpdErr) {
            console.warn(`[addClinicalEvolutionAction] Erro ao atualizar status do agendamento ${aptId}:`, aptUpdErr.message);
          }
        } catch (err) {
          console.error(`[addClinicalEvolutionAction] Exceção ao atualizar agendamento ${aptId}:`, err);
        }
      }
    }

    revalidatePath("/prontuario");
    revalidatePath("/dashboard");
    revalidatePath("/");

    return {
      success: true,
      message: "Evolução clínica registrada no prontuário com assinatura digital de payload!",
      data: newEvolution,
    };
  } catch (error) {
    console.error("Erro ao adicionar evolução clínica:", error);
    return {
      success: false,
      message: "Ocorreu um erro ao salvar a evolução clínica.",
    };
  }
}

/**
 * Atualiza o Histórico Clínico & Anamnese do Paciente
 */
export async function updateMedicalHistoryAction(
  clientId: string,
  history: MedicalHistory
): Promise<ActionResponse<MedicalHistory>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não informado." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, message: "Banco de dados não disponível." };
    }

    // Gravar na tabela historico_clinico do Supabase (upsert)
    const { error } = await supabase.from("historico_clinico").upsert(
      {
        paciente_id: clientId,
        alergias: history.alergias,
        comorbidades: history.comorbidades,
        medicamentos_uso_continuo: history.medicamentosUsoContinuo,
        acompanhamento_medico: history.acompanhamentoMedico || [],
        isotretinoina_6_meses: Boolean(history.isotretinoina6Meses),
        lesoes_detalhes: history.lesoesDetalhes || "",
        implantes_dispositivos: history.implantesDispositivos || [],
        ingestao_agua: history.ingestaoAgua || "",
        qualidade_sono: history.qualidadeSono || "",
        funcionamento_intestino: history.funcionamentoIntestino || "",
        fotos_area_tratada: history.fotosAreaTratada || [],
        tipo_sanguineo: history.tipoSanguineo,
        historico_cirurgico: history.historicoCirurgico,
        historico_familiar: history.historicoFamiliar,
        habitos_vida: history.habitosVida,
        observacoes_gerais: history.observacoesGerais || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paciente_id" }
    );

    if (error) {
      console.warn("Aviso ao salvar historico_clinico no Supabase:", error.message);
      return { success: false, message: `Erro ao salvar histórico clínico: ${error.message}` };
    }

    revalidatePath("/");

    return {
      success: true,
      message: "Histórico clínico atualizado com sucesso!",
      data: history,
    };
  } catch (error) {
    console.error("Erro ao atualizar histórico clínico:", error);
    return {
      success: false,
      message: "Falha ao salvar as alterações do histórico clínico.",
    };
  }
}

/**
 * Adiciona uma Nova Prescrição / Medicamento simples
 */
export async function addPrescriptionAction(
  clientId: string,
  prescription: Omit<PrescriptionItem, "id">
): Promise<ActionResponse<PrescriptionItem>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não informado." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, message: "Banco de dados não disponível." };
    }

    // Registra como prescrição simples
    const { data: prescricao, error: errPresc } = await supabase
      .from("prescricoes")
      .insert({
        paciente_id: clientId,
        data_prescricao: prescription.data || new Date().toISOString().split("T")[0],
        status: prescription.ativo ? "Ativo" : "Suspenso",
        observacoes: prescription.instrucoes || null,
      })
      .select("id")
      .single();

    if (errPresc || !prescricao) {
      return { success: false, message: `Erro ao salvar cabeçalho de prescrição: ${errPresc?.message}` };
    }

    const { data: item, error: errItem } = await supabase
      .from("prescricao_itens")
      .insert({
        prescricao_id: prescricao.id,
        nome_formula: prescription.medicamento,
        via: prescription.via?.toLowerCase() === "oral" ? "oral" : "tópico",
        dosagem: parseFloat(prescription.dosagem) || null,
        posologia: prescription.posologia,
        duracao: prescription.duracao,
        orient_paciente: prescription.instrucoes || null,
      })
      .select("id")
      .single();

    if (errItem) {
      return { success: false, message: `Erro ao salvar itens de prescrição: ${errItem.message}` };
    }

    const newPrescription: PrescriptionItem = {
      ...prescription,
      id: item.id || prescricao.id,
      client_id: clientId,
    };

    revalidatePath("/");

    return {
      success: true,
      message: "Prescrição adicionada com sucesso!",
      data: newPrescription,
    };
  } catch (error) {
    console.error("Erro ao adicionar prescrição:", error);
    return {
      success: false,
      message: "Falha ao salvar a nova prescrição.",
    };
  }
}

/**
 * Ativa / Suspende um medicamento da lista de prescrições
 */
export async function togglePrescriptionStatusAction(
  clientId: string,
  prescriptionId: string
): Promise<ActionResponse<void>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não fornecido." };
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, message: "Banco de dados não disponível." };
    }

    // Busca a prescrição para ver o status atual
    const { data: prescricao, error: fetchErr } = await supabase
      .from("prescricoes")
      .select("status")
      .eq("id", prescriptionId)
      .eq("paciente_id", clientId)
      .maybeSingle();

    if (fetchErr || !prescricao) {
      return { success: false, message: "Prescrição não encontrada." };
    }

    const newStatus = prescricao.status === "Ativo" ? "Suspenso" : "Ativo";

    const { error: updateErr } = await supabase
      .from("prescricoes")
      .update({ status: newStatus })
      .eq("id", prescriptionId)
      .eq("paciente_id", clientId);

    if (updateErr) {
      return { success: false, message: `Erro ao alterar status: ${updateErr.message}` };
    }

    revalidatePath("/");

    return {
      success: true,
      message: newStatus === "Ativo" ? "Prescrição reativada." : "Medicamento suspenso com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao alterar status da prescrição:", error);
    return { success: false, message: "Erro ao modificar prescrição." };
  }
}

// =========================================================================
// INTEGRAÇÃO DE FÓRMULAS, COMPONENTES E UNIDADES (SUPABASE COM RESILIÊNCIA)
// =========================================================================

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Consulta de Fórmulas com Componentes e Unidades no Supabase
 */
export async function getFormulasAction(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("formulas")
      .select(`
        *,
        formula_componentes (
          id,
          quantidade,
          componente_id,
          componentes (
            id,
            nome,
            unidade_id
          )
        )
      `)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao buscar fórmulas no Supabase:", error.message);
      return { success: true, data: [] };
    }

    const mappedFormulas = (data || []).map((f: any) => {
      const componentesFormatados = (f.formula_componentes || []).map((rel: any) => ({
        id: rel.componente_id,
        nome: toSentenceCase(rel.componentes?.nome || "Ativo"),
        quantidade: rel.quantidade,
        unidade_id: rel.componentes?.unidade_id,
      }));

      return {
        ...f,
        via: f.via || f.tipo || "tópico",
        componentes: componentesFormatados,
      };
    });

    return { success: true, data: mappedFormulas };
  } catch (err) {
    console.error("Erro em getFormulasAction:", err);
    return { success: true, data: [] };
  }
}

/**
 * Consulta de Componentes/Ativos
 */
export async function getComponentesAction(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("componentes")
      .select(`
        id,
        nome,
        unidade_id,
        unidades (
          id,
          unidade
        )
      `)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao buscar componentes no Supabase:", error.message);
      return { success: true, data: [] };
    }

    const mappedComponentes = (data || []).map((c: any) => ({
      ...c,
      nome: toSentenceCase(c.nome),
    }));

    return { success: true, data: mappedComponentes };
  } catch (err) {
    console.error("Exceção em getComponentesAction:", err);
    return { success: true, data: [] };
  }
}

/**
 * Consulta de Unidades
 */
export async function getUnidadesAction(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from("unidades")
      .select("id, unidade")
      .order("unidade", { ascending: true });

    if (error) {
      console.error("Erro ao buscar unidades no Supabase:", error.message);
      return { success: true, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error("Exceção em getUnidadesAction:", err);
    return { success: true, data: [] };
  }
}

export interface StructuredPrescriptionPayload {
  nome_formula: string;
  descricao?: string;
  via: "oral" | "tópico";
  componentes: {
    componente_id?: string;
    nome: string;
    quantidade: number;
    unidade_id: string;
    unidade_sigla: string;
  }[];
  veiculo: string;
  dosagem_valor: string; // Dose / Q.S.P.
  dosagem_unidade?: string; // g ou ml (apenas tópico)
  total_veiculo: number; // Quantidade Total
  tipo_veiculo: string; // dose(s), sachê(s) etc.
  posologia: string;
  orient_paciente?: string;
  orient_farmacia?: string;
  save_as_formula?: boolean;
}

/**
 * Adiciona uma Nova Prescrição Estruturada
 */
export async function addStructuredPrescriptionAction(
  clientId: string,
  input: StructuredPrescriptionPayload
): Promise<ActionResponse<any>> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!clientId || !uuidRegex.test(clientId)) {
      return { success: false, message: "ID do paciente inválido. Acesso ao banco recusado." };
    }

    const supabase = await createClient();
    if (!supabase) return { success: false, message: "Erro de conexão com o Supabase." };

    const parseNum = (val: any): number | null => {
      if (val === undefined || val === null || val === "") return null;
      const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", ".").replace(/[^0-9.]/g, ""));
      return isNaN(n) ? null : n;
    };

    const titleCaseFormulaName = toTitleCase(input.nome_formula);
    const titleCaseVeiculo = toTitleCase(input.veiculo);
    const normalizedVia = (input.via?.toLowerCase() === "oral" ? "oral" : "tópico") as "oral" | "tópico";

    const validTiposVeiculo = ["dose(s)", "sachê(s)", "comprimido(s)"];
    const sanitizedTipoVeiculo = validTiposVeiculo.includes(input.tipo_veiculo) ? input.tipo_veiculo : null;
    const numDosagem = parseNum(input.dosagem_valor);

    let formulaId = null;

    // 1. Inserir ou buscar a fórmula
    const { data: existingFormula, error: findFormulaErr } = await supabase
      .from("formulas")
      .select("id")
      .ilike("nome", titleCaseFormulaName)
      .eq("via", normalizedVia)
      .maybeSingle();

    if (findFormulaErr) {
      return { success: false, message: `Erro ao localizar fórmula: ${findFormulaErr.message}` };
    }

    if (existingFormula) {
      formulaId = existingFormula.id;
    } else {
      const { data: newFormula, error: formulaErr } = await supabase
        .from("formulas")
        .insert({
          nome: titleCaseFormulaName,
          descricao: input.descricao || null,
          via: normalizedVia,
          veiculo: titleCaseVeiculo || null,
          dosagem: numDosagem,
          tipo_veiculo: sanitizedTipoVeiculo,
          posologia: input.posologia?.trim() || null,
          orient_paciente: input.orient_paciente || null,
          orient_farmacia: input.orient_farmacia || null,
        })
        .select("id")
        .single();

      if (formulaErr) {
        return { success: false, message: `Falha crítica ao cadastrar fórmula: ${formulaErr.message}` };
      }
      if (!newFormula) {
        return { success: false, message: "A fórmula não pôde ser criada." };
      }
      formulaId = newFormula.id;
    }

    // 2. UNIDADES e COMPONENTES
    const { data: dbUnidades, error: unitErr } = await supabase.from("unidades").select("id, unidade");
    if (unitErr) return { success: false, message: "Erro (Buscar Unidades): " + unitErr.message };

    let fallbackUnidadeId = dbUnidades && dbUnidades.length > 0 ? dbUnidades[0].id : null;
    const processedComponentes = [];

    // Regex para validar se a string é efetivamente um formato UUID
    const isValidUUID = (id: string) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    };

    for (const comp of input.componentes) {
      if (!comp.nome || !comp.nome.trim()) continue;

      const sentenceCaseName = toSentenceCase(comp.nome);
      let matchedUnidadeId = null;
      let sigla = comp.unidade_sigla || "%";

      if (comp.unidade_id && isValidUUID(comp.unidade_id)) {
        matchedUnidadeId = comp.unidade_id;
      } else if (comp.unidade_id && comp.unidade_id.trim() && !comp.unidade_id.startsWith("new_")) {
        sigla = comp.unidade_id;
      }

      // Se não temos matchedUnidadeId válida, tentamos buscar pelo texto da sigla
      if (!matchedUnidadeId) {
        const foundUnit = dbUnidades?.find(
          (u: any) => u.unidade.toLowerCase() === sigla.toLowerCase()
        );
        if (foundUnit) {
          matchedUnidadeId = foundUnit.id;
        }
      }

      // Se mesmo assim não encontramos, tentamos criar a unidade com a sigla informada
      if (!matchedUnidadeId) {
        const { data: newUnit, error: newUnitErr } = await supabase
          .from("unidades")
          .insert({ unidade: sigla })
          .select("id")
          .single();

        if (newUnitErr) {
          return {
            success: false,
            message: `Erro ao criar nova unidade de medida [${sigla}]: ${newUnitErr.message}`,
          };
        }
        if (newUnit) {
          matchedUnidadeId = newUnit.id;
          fallbackUnidadeId = newUnit.id;
        } else {
          matchedUnidadeId = fallbackUnidadeId;
        }
      }

      let compId = null;
      const { data: existingComp, error: findCompErr } = await supabase
        .from("componentes")
        .select("id")
        .ilike("nome", sentenceCaseName)
        .maybeSingle();

      if (findCompErr) {
        return {
          success: false,
          message: `Erro ao buscar componente [${sentenceCaseName}]: ${findCompErr.message}`,
        };
      }

      if (existingComp) {
        compId = existingComp.id;
      } else {
        const { data: newComp, error: insertErr } = await supabase
          .from("componentes")
          .insert({
            nome: sentenceCaseName,
            unidade_id: matchedUnidadeId,
          })
          .select("id")
          .single();

        if (insertErr) {
          return {
            success: false,
            message: `Erro ao criar componente [${sentenceCaseName}]: ${insertErr.message}`,
          };
        }
        if (newComp) {
          compId = newComp.id;
        }
      }

      if (compId) {
        processedComponentes.push({
          componente_id: compId,
          nome: sentenceCaseName,
          quantidade: parseNum(comp.quantidade) || 0,
          unidade_sigla: sigla,
        });
      }
    }

    // 3. Vincular componentes à fórmula
    if (formulaId && processedComponentes.length > 0) {
      const { error: deleteRelErr } = await supabase.from("formula_componentes").delete().eq("formula_id", formulaId);
      if (deleteRelErr) {
        return { success: false, message: `Erro ao limpar vínculos de ativos da fórmula: ${deleteRelErr.message}` };
      }

      const relPayloads = processedComponentes.map((c) => ({
        formula_id: formulaId,
        componente_id: c.componente_id,
        quantidade: c.quantidade,
      }));

      const { error: relErr } = await supabase.from("formula_componentes").insert(relPayloads);
      if (relErr) {
        return { success: false, message: `Erro ao vincular componentes à fórmula: ${relErr.message}` };
      }
    }

    // 4. Salvar Cabeçalho da Prescrição
    const { data: prescricao, error: errPresc } = await supabase
      .from("prescricoes")
      .insert({
        paciente_id: clientId,
        data_prescricao: new Date().toISOString().split("T")[0],
        status: "Ativo",
        observacoes: input.descricao || null,
      })
      .select("id")
      .single();

    if (errPresc || !prescricao) {
      return { success: false, message: `Erro ao salvar prescrição no prontuário: ${errPresc?.message || "Registro vazio"}` };
    }

    // 5. Salvar Item da Prescrição
    const componentsSnapshot = processedComponentes.map((r) => ({
      nome: toSentenceCase(r.nome),
      quantidade: r.quantidade,
      unidade: r.unidade_sigla,
    }));

    const numTotalVeiculo = parseNum(input.total_veiculo) || 0;

    const { data: newItem, error: errItem } = await supabase
      .from("prescricao_itens")
      .insert({
        prescricao_id: prescricao.id,
        formula_id: formulaId,
        nome_formula: titleCaseFormulaName,
        via: normalizedVia,
        veiculo: titleCaseVeiculo || null,
        dosagem: numDosagem,
        tipo_veiculo: sanitizedTipoVeiculo,
        posologia: input.posologia.trim(),
        duracao: String(numTotalVeiculo),
        orient_paciente: input.orient_paciente || null,
        orient_farmacia: input.orient_farmacia || null,
        componentes_snapshot: componentsSnapshot,
      })
      .select("id")
      .single();

    if (errItem || !newItem) {
      return { success: false, message: `Erro ao salvar item formulado na prescrição: ${errItem?.message || "Registro vazio"}` };
    }

    // 6. Preparar apresentação para a UI e revalidar
    const listAtivos = (input.componentes || [])
      .filter((c) => c.nome?.trim())
      .map((c) => `${toSentenceCase(c.nome)}: ${c.quantidade}${c.unidade_sigla || "%"}`)
      .join(" + ");

    const formattedDosagem =
      normalizedVia === "oral"
        ? `${listAtivos} em ${titleCaseVeiculo} (Dose: ${input.dosagem_valor} | Total: ${input.total_veiculo} ${sanitizedTipoVeiculo || "un"})`
        : `${listAtivos} em ${titleCaseVeiculo} q.s.p. ${input.dosagem_valor}${input.dosagem_unidade || "g"} (Total: ${input.total_veiculo} un)`;

    const combinedInstrucoes = [
      input.orient_paciente ? `[Orientações ao Paciente]\n${input.orient_paciente}` : "",
      input.orient_farmacia ? `[Observações à Farmácia Magistral]\n${input.orient_farmacia}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const newPrescription: PrescriptionItem = {
      id: newItem.id, // ID real inserido no banco
      client_id: clientId,
      data: new Date().toISOString().split("T")[0],
      medicamento: titleCaseFormulaName,
      dosagem: formattedDosagem,
      via: normalizedVia === "oral" ? "Oral" : "Tópico",
      posologia: input.posologia.trim(),
      duracao: normalizedVia === "oral" ? `${input.total_veiculo} ${sanitizedTipoVeiculo || "un"}` : "Uso recomendado",
      ativo: true,
      instrucoes: combinedInstrucoes || undefined,
    };

    (newPrescription as any).prescricao_id = prescricao.id;

    revalidatePath("/");

    return {
      success: true,
      message: "Prescrição magistral adicionada com sucesso!",
      data: newPrescription,
    };
  } catch (error: any) {
    console.error("Erro inesperado em addStructuredPrescriptionAction:", error);
    return {
      success: false,
      message: `Erro interno no servidor: ${error.message || error}`,
    };
  }
}

/**
 * Consulta Prescrições do Paciente com itens para vínculos em Evoluções
 */
export async function getPatientPrescriptionsWithItemsAction(
  clientId: string
): Promise<ActionResponse<any[]>> {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase || !clientId) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("prescricoes")
      .select(`
        id,
        paciente_id,
        data_prescricao,
        status,
        observacoes,
        prescricao_itens (
          id,
          nome_formula,
          via,
          veiculo,
          dosagem,
          tipo_veiculo,
          posologia,
          duracao
        )
      `)
      .eq("paciente_id", clientId)
      .order("data_prescricao", { ascending: false });

    if (error) {
      console.warn("Aviso ao buscar prescrições do paciente:", error.message);
      return { success: true, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Erro em getPatientPrescriptionsWithItemsAction:", err);
    return { success: true, data: [] };
  }
}

export async function getAestheticEvaluationAction(patientId: string): Promise<ActionResponse<{ facial: any; corporal: any }>> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!patientId || !uuidRegex.test(patientId)) {
      return { success: false, message: 'ID do paciente inválido.' };
    }

    const supabase = await createClient();
    if (!supabase) return { success: false, message: 'Falha de conexão com o banco de dados.' };

    const { data: facialData, error: facialErr } = await supabase
      .from('avaliacoes_faciais')
      .select('*')
      .eq('paciente_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (facialErr) {
      console.error('Erro ao buscar avaliação facial:', facialErr.message);
    }

    const { data: corporalData, error: corporalErr } = await supabase
      .from('avaliacoes_corporais')
      .select('*')
      .eq('paciente_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (corporalErr) {
      console.error('Erro ao buscar avaliação corporal:', corporalErr.message);
    }

    return {
      success: true,
      data: {
        facial: facialData || null,
        corporal: corporalData || null,
      },
    };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Erro inesperado ao consultar avaliação estética.' };
  }
}

export async function saveAestheticEvaluationAction(
  patientId: string,
  payload: { facial: any; corporal: any }
): Promise<ActionResponse<boolean>> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!patientId || !uuidRegex.test(patientId)) {
      return { success: false, message: 'ID do paciente inválido.' };
    }

    const supabase = await createClient();
    if (!supabase) return { success: false, message: 'Falha de conexão com o banco de dados.' };

    // 1. Salvar ou Atualizar Avaliação Facial
    if (payload.facial) {
      const { data: existingFacial } = await supabase
        .from('avaliacoes_faciais')
        .select('id')
        .eq('paciente_id', patientId)
        .maybeSingle();

      const facialRecord = {
        paciente_id: patientId,
        tipo_pele: payload.facial.tipo_pele || null,
        textura: payload.facial.textura || null,
        fototipo: payload.facial.fototipo || null,
        hidratacao: payload.facial.hidratacao !== undefined && payload.facial.hidratacao !== '' ? parseFloat(String(payload.facial.hidratacao)) : null,
        oleosidade: payload.facial.oleosidade !== undefined && payload.facial.oleosidade !== '' ? parseFloat(String(payload.facial.oleosidade)) : null,
        escala_glogau: payload.facial.escala_glogau || null,
        acne_grau: payload.facial.acne_grau || null,
        discromias: Array.isArray(payload.facial.discromias) ? payload.facial.discromias : [],
        textura_relevo: Array.isArray(payload.facial.textura_relevo) ? payload.facial.textura_relevo : [],
        vascularizacao: Array.isArray(payload.facial.vascularizacao) ? payload.facial.vascularizacao : [],
        outras_alteracoes: Array.isArray(payload.facial.outras_alteracoes) ? payload.facial.outras_alteracoes : [],
        avaliacao_lupa: payload.facial.avaliacao_lupa?.trim() || null,
        exames_laboratoriais: payload.facial.exames_laboratoriais?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existingFacial?.id) {
        const { error: updErr } = await supabase
          .from('avaliacoes_faciais')
          .update(facialRecord)
          .eq('id', existingFacial.id);
        if (updErr) return { success: false, message: 'Erro ao atualizar avaliação facial: ' + updErr.message };
      } else {
        const { error: insErr } = await supabase
          .from('avaliacoes_faciais')
          .insert(facialRecord);
        if (insErr) return { success: false, message: 'Erro ao registrar avaliação facial: ' + insErr.message };
      }
    }

    // 2. Salvar ou Atualizar Avaliação Corporal
    if (payload.corporal) {
      const { data: existingCorporal } = await supabase
        .from('avaliacoes_corporais')
        .select('id')
        .eq('paciente_id', patientId)
        .maybeSingle();

      const corporalRecord = {
        paciente_id: patientId,
        fototipo: payload.corporal.fototipo || null,
        hidratacao_pele: payload.corporal.hidratacao_pele || null,
        estrias_localizacao: Array.isArray(payload.corporal.estrias_localizacao) ? payload.corporal.estrias_localizacao : [],
        estrias_localizacao_outros: payload.corporal.estrias_localizacao_outros?.trim() || null,
        estrias_tipo_coloracao: Array.isArray(payload.corporal.estrias_tipo_coloracao) ? payload.corporal.estrias_tipo_coloracao : [],
        estrias_espessura: Array.isArray(payload.corporal.estrias_espessura) ? payload.corporal.estrias_espessura : [],
        tempo_estimado_surgimento: payload.corporal.tempo_estimado_surgimento?.trim() || null,
        fatores_desencadeantes: Array.isArray(payload.corporal.fatores_desencadeantes) ? payload.corporal.fatores_desencadeantes : [],
        alteracoes_associadas: Array.isArray(payload.corporal.alteracoes_associadas) ? payload.corporal.alteracoes_associadas : [],
        updated_at: new Date().toISOString(),
      };

      if (existingCorporal?.id) {
        const { error: updCorpErr } = await supabase
          .from('avaliacoes_corporais')
          .update(corporalRecord)
          .eq('id', existingCorporal.id);
        if (updCorpErr) return { success: false, message: 'Erro ao atualizar avaliação corporal: ' + updCorpErr.message };
      } else {
        const { error: insCorpErr } = await supabase
          .from('avaliacoes_corporais')
          .insert(corporalRecord);
        if (insCorpErr) return { success: false, message: 'Erro ao registrar avaliação corporal: ' + insCorpErr.message };
      }
    }

    revalidatePath('/');
    return {
      success: true,
      message: 'Avaliação estética registrada com sucesso!',
      data: true,
    };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Falha ao salvar avaliação estética.' };
  }
}

export interface PrescricaoItemParaEvolucao {
  id: string;
  nome_formula: string;
  via: string;
  dosagem?: string | number | null;
  posologia?: string | null;
  duracao?: string | null;
}

export interface PrescricaoParaEvolucao {
  id: string;
  data_prescricao: string;
  status: string;
  observacoes?: string | null;
  formulas: string[];
  itens: PrescricaoItemParaEvolucao[];
}

/**
 * Busca todas as prescrições do paciente com suas fórmulas associadas
 * para seleção/vínculo no modal de Nova Evolução Clínica.
 */
export async function getPatientPrescriptionsForEvolutionAction(
  clientId: string
): Promise<PrescricaoParaEvolucao[]> {
  try {
    if (!clientId) return [];
    const serverClient = await createClient();
    const adminClient = getSupabaseAdminClient();
    const supabase = adminClient || serverClient;
    if (!supabase) return [];

    const { data: prescricoesDb, error } = await supabase
      .from("prescricoes")
      .select(`
        id,
        data_prescricao,
        status,
        observacoes,
        prescricao_itens (
          id,
          nome_formula,
          via,
          dosagem,
          posologia,
          duracao
        )
      `)
      .eq("paciente_id", clientId)
      .order("data_prescricao", { ascending: false });

    if (error || !prescricoesDb) {
      console.warn("Aviso ao buscar prescrições para evolução:", error?.message);
      return [];
    }

    return prescricoesDb.map((p: any) => ({
      id: p.id,
      data_prescricao: p.data_prescricao,
      status: p.status || "Ativo",
      observacoes: p.observacoes,
      formulas: (p.prescricao_itens || []).map((it: any) => it.nome_formula).filter(Boolean),
      itens: (p.prescricao_itens || []).map((it: any) => ({
        id: it.id,
        nome_formula: it.nome_formula,
        via: it.via,
        dosagem: it.dosagem,
        posologia: it.posologia,
        duracao: it.duracao,
      })),
    }));
  } catch (err) {
    console.error("Erro em getPatientPrescriptionsForEvolutionAction:", err);
    return [];
  }
}
