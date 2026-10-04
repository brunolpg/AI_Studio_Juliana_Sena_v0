"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { INITIAL_CLINICAL_RECORDS, DEFAULT_MEDICAL_HISTORY } from "@/lib/clinical-mock-data";
import type {
  PatientClinicalRecord,
  MedicalHistory,
  ClinicalEvolution,
  PrescriptionItem,
} from "@/types/clinical-record";
import type { ActionResponse } from "@/types/client";

// Armazenamento em memória para demonstração / runtime
let memoryClinicalRecords: Record<string, PatientClinicalRecord> = {
  ...INITIAL_CLINICAL_RECORDS,
};

function ensurePatientRecord(clientId: string): PatientClinicalRecord {
  if (!memoryClinicalRecords[clientId]) {
    memoryClinicalRecords[clientId] = {
      client_id: clientId,
      medicalHistory: {
        ...DEFAULT_MEDICAL_HISTORY,
        updated_at: new Date().toISOString(),
      },
      evolutions: [],
      prescriptions: [],
    };
  }
  return memoryClinicalRecords[clientId];
}

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

    const record = ensurePatientRecord(clientId);

    // Tenta carregar dados da tabela historico_clinico do Supabase
    try {
      const supabase = await createClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("historico_clinico")
          .select("*")
          .eq("paciente_id", clientId)
          .maybeSingle();

        if (!error && data) {
          record.medicalHistory = {
            alergias: data.alergias || [],
            comorbidades: data.comorbidades || [],
            medicamentosUsoContinuo: data.medicamentos_uso_continuo || data.medicamentosUsoContinuo || [],
            acompanhamentoMedico: data.acompanhamento_medico || [],
            isotretinoina6Meses: Boolean(data.isotretinoina_6_meses),
            lesoesDetalhes: data.lesoes_detalhes || "",
            implantesDispositivos: data.implantes_dispositivos || [],
            ingestaoAgua: data.ingestao_agua || "",
            qualidadeSono: data.qualidade_sono || "",
            funcionamentoIntestino: data.funcionamento_intestino || "",
            fotosAreaTratada: data.fotos_area_tratada || [],
            tipoSanguineo: data.tipo_sanguineo || data.tipoSanguineo || "Não informado",
            historicoCirurgico: data.historico_cirurgico || data.historicoCirurgico || "",
            historicoFamiliar: data.historico_familiar || data.historicoFamiliar || "",
            habitosVida: data.habitos_vida || data.habitosVida || {
              tabagismo: "Não fuma",
              etilismo: "Não consome",
              atividadeFisica: "Sedentário",
            },
            observacoesGerais: data.observacoes_gerais || data.observacoesGerais || "",
            updated_at: data.updated_at,
          };
        }
      }
    } catch (dbErr) {
      console.warn("Aviso ao buscar historico_clinico no Supabase:", dbErr);
    }

    return {
      success: true,
      data: record,
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

    const record = ensurePatientRecord(clientId);

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

    record.evolutions.unshift(newEvolution);

    // Se houver um agendamento vinculado, atualiza seu status para 'Realizado' no Supabase
    if (input.appointment_id) {
      try {
        const supabase = await createClient();
        if (supabase) {
          const { error } = await supabase
            .from("appointments")
            .update({ status: "Realizado", updated_at: new Date().toISOString() })
            .eq("id", input.appointment_id);
          if (error) {
            console.warn(`[addClinicalEvolutionAction] Erro ao atualizar status do agendamento ${input.appointment_id}:`, error.message);
          } else {
            console.log(`[addClinicalEvolutionAction] Agendamento ${input.appointment_id} atualizado para 'Realizado' com sucesso.`);
          }
        }
      } catch (err) {
        console.error(`[addClinicalEvolutionAction] Exceção ao atualizar agendamento ${input.appointment_id}:`, err);
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

    const record = ensurePatientRecord(clientId);

    record.medicalHistory = {
      ...history,
      updated_at: new Date().toISOString(),
    };

    // Tenta gravar na tabela historico_clinico do Supabase (upsert)
    try {
      const supabase = await createClient();
      if (supabase) {
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
        }
      }
    } catch (dbErr) {
      console.warn("Exceção ao salvar historico_clinico no Supabase:", dbErr);
    }

    revalidatePath("/");

    return {
      success: true,
      message: "Histórico clínico atualizado com sucesso!",
      data: record.medicalHistory,
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
 * Adiciona uma Nova Prescrição / Medicamento
 */
export async function addPrescriptionAction(
  clientId: string,
  prescription: Omit<PrescriptionItem, "id">
): Promise<ActionResponse<PrescriptionItem>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não informado." };
    }

    const record = ensurePatientRecord(clientId);

    const newPrescription: PrescriptionItem = {
      ...prescription,
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      client_id: clientId,
      data: prescription.data || new Date().toISOString().split("T")[0],
    };

    record.prescriptions.unshift(newPrescription);

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
    const record = ensurePatientRecord(clientId);
    const item = record.prescriptions.find((p) => p.id === prescriptionId);

    if (!item) {
      return { success: false, message: "Prescrição não encontrada." };
    }

    item.ativo = !item.ativo;
    revalidatePath("/");

    return {
      success: true,
      message: item.ativo ? "Prescrição reativada." : "Medicamento suspenso com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao alterar status da prescrição:", error);
    return { success: false, message: "Erro ao modificar prescrição." };
  }
}

// =========================================================================
// INTEGRAÇÃO DE FÓRMULAS, COMPONENTES E UNIDADES (SUPABASE COM RESILIÊNCIA)
// =========================================================================

export const MOCK_UNIDADES = [
  { id: "u1", sigla: "%" },
  { id: "u2", sigla: "g" },
  { id: "u3", sigla: "ml" },
  { id: "u4", sigla: "mg" },
  { id: "u5", sigla: "ui" },
];

export const MOCK_COMPONENTES = [
  { id: "c1", nome: "Ácido Glicólico", unidade_id: "u1" },
  { id: "c2", nome: "Ácido Hialurônico", unidade_id: "u1" },
  { id: "c3", nome: "Niacinamida", unidade_id: "u1" },
  { id: "c4", nome: "Vitamina C", unidade_id: "u1" },
  { id: "c5", nome: "Coenzima Q10", unidade_id: "u4" },
  { id: "c6", nome: "Vitamina E", unidade_id: "u4" },
  { id: "c7", nome: "Ácido Kójico", unidade_id: "u1" },
  { id: "c8", nome: "Trans-resveratrol", unidade_id: "u4" },
];

export const MOCK_FORMULAS = [
  {
    id: "f1",
    nome: "Fórmula Facial Anti-Idade e Clareadora",
    descricao: "Fórmula rejuvenescedora facial diária com ativos clareadores e hidratantes.",
    via: "tópico",
    dosagem: "30",
    veiculo: "Gel creme toque seco",
    tipo_veiculo: "g",
    orient_paciente: "Aplicar no rosto à noite após higienização. Evitar área dos olhos. Usar protetor solar FPS 50+ pela manhã.",
    orient_farmacia: "Manipular em embalagem airless fosca para preservar os ativos antioxidantes. Ajustar pH para 4.5.",
    componentes: [
      { id: "c1", nome: "Ácido Glicólico", quantidade: 5, unidade_id: "u1" },
      { id: "c3", nome: "Niacinamida", quantidade: 4, unidade_id: "u1" },
      { id: "c2", nome: "Ácido Hialurônico", quantidade: 1.5, unidade_id: "u1" }
    ]
  },
  {
    id: "f2",
    nome: "Fórmula Antioxidante Oral de Alta Performance",
    descricao: "Pool de antioxidantes orais para fotoproteção e combate aos radicais livres.",
    via: "oral",
    dosagem: "1",
    veiculo: "Cápsula vegetal",
    tipo_veiculo: "dose(s)",
    orient_paciente: "Tomar 1 dose por via oral pela manhã, logo após o café da manhã.",
    orient_farmacia: "Acondicionar em frasco âmbar bem vedado com sílica gel. Cápsulas incolores livres de corantes.",
    componentes: [
      { id: "c4", nome: "Vitamina C", quantidade: 500, unidade_id: "u4" },
      { id: "c5", nome: "Coenzima Q10", quantidade: 100, unidade_id: "u4" },
      { id: "c8", nome: "Trans-resveratrol", quantidade: 150, unidade_id: "u4" }
    ]
  }
];

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
      return { success: true, message: "Modo de contingência ativo.", data: MOCK_FORMULAS };
    }

    // Busca fórmulas
    const { data: dbFormulas, error: formulasErr } = await supabase
      .from("formulas")
      .select("*")
      .order("nome", { ascending: true });

    if (formulasErr || !dbFormulas) {
      return { success: true, message: "Modo de contingência ativo.", data: MOCK_FORMULAS };
    }

    // Busca relações e componentes de forma a juntar tudo
    const formulasCompletas = [];
    for (const f of dbFormulas) {
      const { data: relations } = await supabase
        .from("formula_componentes")
        .select(`
          quantidade,
          componente_id,
          componentes (
            nome,
            unidade_id
          )
        `)
        .eq("formula_id", f.id);

      const componentesFormatados = (relations || []).map((rel: any) => ({
        id: rel.componente_id,
        nome: rel.componentes?.nome || "Ativo",
        quantidade: rel.quantidade,
        unidade_id: rel.componentes?.unidade_id,
      }));

      formulasCompletas.push({
        ...f,
        via: f.via || f.tipo || "tópico",
        componentes: componentesFormatados,
      });
    }

    return {
      success: true,
      data: formulasCompletas.length > 0 ? formulasCompletas : MOCK_FORMULAS,
    };
  } catch (err) {
    console.error("Erro em getFormulasAction:", err);
    return { success: true, message: "Erro de conexão, usando fallback.", data: MOCK_FORMULAS };
  }
}

/**
 * Consulta de Componentes/Ativos
 */
export async function getComponentesAction(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: true, data: MOCK_COMPONENTES };
    }

    const { data, error } = await supabase
      .from("componentes")
      .select("*")
      .order("nome", { ascending: true });

    if (error || !data) {
      return { success: true, data: MOCK_COMPONENTES };
    }

    return { success: true, data };
  } catch (err) {
    return { success: true, data: MOCK_COMPONENTES };
  }
}

/**
 * Consulta de Unidades
 */
export async function getUnidadesAction(): Promise<ActionResponse<any[]>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: true, data: MOCK_UNIDADES };
    }

    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .order("sigla", { ascending: true });

    if (error || !data) {
      return { success: true, data: MOCK_UNIDADES };
    }

    return { success: true, data };
  } catch (err) {
    return { success: true, data: MOCK_UNIDADES };
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
): Promise<ActionResponse<PrescriptionItem>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não fornecido." };
    }

    const supabase = await createClient();

    // 1. Sanitizar componentes e garantir inserção na tabela 'componentes' do Supabase
    const processedComponentes = [];
    for (const comp of input.componentes) {
      let compId = comp.componente_id;
      const titleCaseName = toTitleCase(comp.nome);

      if (supabase && (!compId || compId.startsWith("new_"))) {
        // Tenta encontrar componente existente pelo nome em Title Case
        const { data: existingComp } = await supabase
          .from("componentes")
          .select("id")
          .eq("nome", titleCaseName)
          .maybeSingle();

        if (existingComp) {
          compId = existingComp.id;
        } else {
          // Insere novo componente
          const { data: newComp, error: insertErr } = await supabase
            .from("componentes")
            .insert({
              nome: titleCaseName,
              unidade_id: comp.unidade_id && !comp.unidade_id.startsWith("new_") ? comp.unidade_id : null,
            })
            .select("id")
            .single();

          if (!insertErr && newComp) {
            compId = newComp.id;
          }
        }
      }

      processedComponentes.push({
        ...comp,
        componente_id: compId,
        nome: titleCaseName,
      });
    }

    // 2. Salvar como modelo de Fórmula se selecionado
    if (input.save_as_formula && supabase) {
      try {
        const titleCaseFormulaName = toTitleCase(input.nome_formula);
        const titleCaseVeiculo = toTitleCase(input.veiculo);

        // Insere a fórmula
        const { data: newFormula, error: formulaErr } = await supabase
          .from("formulas")
          .insert({
            nome: titleCaseFormulaName,
            descricao: input.descricao || null,
            via: input.via,
            dosagem: input.dosagem_valor,
            veiculo: titleCaseVeiculo,
            tipo_veiculo: input.tipo_veiculo || null,
            total_veiculo: input.total_veiculo || null,
            orient_paciente: input.orient_paciente || null,
            orient_farmacia: input.orient_farmacia || null,
          })
          .select("id")
          .single();

        if (!formulaErr && newFormula) {
          // Insere as relações em formula_componentes
          const relPayloads = processedComponentes.map((c) => ({
            formula_id: newFormula.id,
            componente_id: c.componente_id,
            quantidade: c.quantidade,
          })).filter(r => r.componente_id);

          if (relPayloads.length > 0) {
            await supabase.from("formula_componentes").insert(relPayloads);
          }
        }
      } catch (fErr) {
        console.error("Erro ao salvar fórmula de modelo no Supabase:", fErr);
      }
    }

    // 3. Gerar strings formatadas para os campos do prontuário tradicional (PrescriptionItem)
    const formulaName = toTitleCase(input.nome_formula);
    const veiculoTitle = toTitleCase(input.veiculo);

    // Formata a dosagem detalhada mostrando ativos e veículo
    const listAtivos = processedComponentes
      .map((c) => `${c.nome}: ${c.quantidade}${c.unidade_sigla}`)
      .join(" + ");

    const formattedDosagem = input.via === "oral"
      ? `${listAtivos} em ${veiculoTitle} (Dose: ${input.dosagem_valor} | Total: ${input.total_veiculo} ${input.tipo_veiculo})`
      : `${listAtivos} em ${veiculoTitle} q.s.p. ${input.dosagem_valor}${input.dosagem_unidade || "g"} (Total: ${input.total_veiculo}g)`;

    // Une as instruções ao paciente e farmácia em uma string de instruções elegível
    const combinedInstrucoes = [
      input.orient_paciente ? `[Orientações ao Paciente]\n${input.orient_paciente}` : "",
      input.orient_farmacia ? `[Observações à Farmácia Magistral]\n${input.orient_farmacia}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // 4. Salva a prescrição no prontuário do paciente
    const record = ensurePatientRecord(clientId);
    const newPrescription: PrescriptionItem = {
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      client_id: clientId,
      data: new Date().toISOString().split("T")[0],
      medicamento: formulaName,
      dosagem: formattedDosagem,
      via: input.via === "oral" ? "Oral" : "Tópico",
      posologia: input.posologia.trim(),
      duracao: input.via === "oral" ? `${input.total_veiculo} ${input.tipo_veiculo}` : "Uso recomendado",
      ativo: true,
      instrucoes: combinedInstrucoes || undefined,
    };

    record.prescriptions.unshift(newPrescription);
    revalidatePath("/");

    return {
      success: true,
      message: "Prescrição magistral adicionada com sucesso!",
      data: newPrescription,
    };
  } catch (error) {
    console.error("Erro inesperado em addStructuredPrescriptionAction:", error);
    return {
      success: false,
      message: "Falha de conexão ao gravar a nova prescrição.",
    };
  }
}
