"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  PatientClinicalRecord,
  MedicalHistory,
  ClinicalEvolution,
  PrescriptionItem,
} from "@/types/clinical-record";
import type { ActionResponse } from "@/types/client";

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
            .map((c: any) => `${c.nome}: ${c.quantidade}${c.unidade || "%"}`)
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

    // 3. Evoluções
    let mappedEvolutions: ClinicalEvolution[] = [];
    try {
      const { data: evDb, error: evErr } = await supabase
        .from("evolucoes_clinicas")
        .select("*")
        .eq("paciente_id", clientId)
        .order("created_at", { ascending: false });

      if (!evErr && evDb) {
        mappedEvolutions = evDb.map((e: any) => ({
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
          created_at: e.created_at,
        }));
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
 * Adiciona uma Nova Evolução Clínica / Registro de Consulta (SOAP)
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

    const newEvolution: ClinicalEvolution = {
      id: `evo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      client_id: clientId,
      data: input.data || new Date().toISOString().split("T")[0],
      horario:
        input.horario ||
        new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      tipo: input.tipo || "Consulta",
      tipo_atendimento: input.tipo_atendimento || input.tipo,
      procedimento_id: input.procedimento_id,
      appointment_id: input.appointment_id || null,
      exames_anexos: input.exames_anexos || [],
      fotos_paciente: input.fotos_paciente || [],
      profissional: input.profissional || "Dra. Juliana Sena",
      especialidade: input.especialidade || "Clínica Geral",
      subjetivo: input.subjetivo || "Sem queixas ativas registradas.",
      objetivo: input.objetivo || "Exame físico sumário preservado.",
      sinaisVitais: input.sinaisVitais
        ? {
            ...input.sinaisVitais,
            imc: calculatedImc,
          }
        : undefined,
      avaliacao: input.avaliacao || "Condição estável.",
      plano: input.plano || "Orientações gerais de saúde.",
      created_at: new Date().toISOString(),
    };

    const supabase = await createClient();
    if (supabase) {
      // Tenta gravar na tabela evolucoes_clinicas
      try {
        await supabase.from("evolucoes_clinicas").insert({
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
        });
      } catch (e) {
        console.warn("Aviso ao salvar evolucoes_clinicas no Supabase:", e);
      }

      // Se houver um agendamento vinculado, atualiza seu status para 'Realizado' no Supabase
      if (input.appointment_id) {
        try {
          const { error } = await supabase
            .from("appointments")
            .update({ status: "Realizado", updated_at: new Date().toISOString() })
            .eq("id", input.appointment_id);
          if (error) {
            console.warn(`[addClinicalEvolutionAction] Erro ao atualizar status do agendamento ${input.appointment_id}:`, error.message);
          }
        } catch (err) {
          console.error(`[addClinicalEvolutionAction] Exceção ao atualizar agendamento ${input.appointment_id}:`, err);
        }
      }
    }

    revalidatePath("/");

    return {
      success: true,
      message: "Evolução clínica registrada no prontuário!",
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
    const supabase = await createClient();
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
        nome: rel.componentes?.nome || "Ativo",
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
    const supabase = await createClient();
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

    return { success: true, data: data || [] };
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
    const supabase = await createClient();
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

      const titleCaseName = toTitleCase(comp.nome);
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
        .ilike("nome", titleCaseName)
        .maybeSingle();

      if (findCompErr) {
        return {
          success: false,
          message: `Erro ao buscar componente [${titleCaseName}]: ${findCompErr.message}`,
        };
      }

      if (existingComp) {
        compId = existingComp.id;
      } else {
        const { data: newComp, error: insertErr } = await supabase
          .from("componentes")
          .insert({
            nome: titleCaseName,
            unidade_id: matchedUnidadeId,
          })
          .select("id")
          .single();

        if (insertErr) {
          return {
            success: false,
            message: `Erro ao criar componente [${titleCaseName}]: ${insertErr.message}`,
          };
        }
        if (newComp) {
          compId = newComp.id;
        }
      }

      if (compId) {
        processedComponentes.push({
          componente_id: compId,
          nome: titleCaseName,
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
      nome: r.nome,
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
      .map((c) => `${toTitleCase(c.nome)}: ${c.quantidade}${c.unidade_sigla || "%"}`)
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
