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

const MOCK_UNIDADES: any[] = [];

const MOCK_COMPONENTES: any[] = [];

const MOCK_FORMULAS: any[] = [];

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
): Promise<ActionResponse<PrescriptionItem>> {
  try {
    if (!clientId) {
      return { success: false, message: "ID do paciente não fornecido." };
    }

    const supabase = await createClient();

    const parseBrFloat = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    };

    const normalizedVia = (input.via?.toLowerCase() === 'oral' ? 'oral' : 'tópico') as 'oral' | 'tópico';
    const validTiposVeiculo = ['dose(s)', 'sachê(s)', 'comprimido(s)', 'g', 'ml', 'un'];
    const sanitizedTipoVeiculo = validTiposVeiculo.includes(input.tipo_veiculo) ? input.tipo_veiculo : (normalizedVia === 'oral' ? 'dose(s)' : 'g');
    const titleCaseFormulaName = toTitleCase(input.nome_formula);
    const titleCaseVeiculo = toTitleCase(input.veiculo);

    // 1. Inserir/Atualizar a Fórmula
    let formulaId = null;

    if (supabase) {
      // Tenta encontrar fórmula existente com o mesmo nome e mesma via (ignora case com ilike)
      const { data: existingFormula } = await supabase
        .from("formulas")
        .select("id")
        .ilike("nome", titleCaseFormulaName)
        .eq("via", normalizedVia)
        .maybeSingle();

      if (existingFormula) {
        formulaId = existingFormula.id;
      } else {
        const numDosagem = parseBrFloat(input.dosagem_valor);

        const { data: newFormula, error: formulaErr } = await supabase
          .from('formulas')
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
          .select('id')
          .single();

        if (formulaErr) {
          console.error('Erro ao inserir formula:', formulaErr.message);
        } else if (newFormula) {
          formulaId = newFormula.id;
        }
      }
    }

    // Busca a lista de unidades cadastradas no banco para obter um id válido
    const { data: dbUnidades } = await supabase ? await supabase.from('unidades').select('id, unidade') : { data: [] };
    const getValidUnidadeId = (sigla?: string) => {
      if (!dbUnidades || dbUnidades.length === 0) return null;
      const match = dbUnidades.find((u: any) => u.unidade.toLowerCase() === (sigla || '%').toLowerCase());
      return match ? match.id : dbUnidades[0].id;
    };

    // 2. Garantir os Componentes (Ativos)
    const processedComponentes = [];
    for (const comp of input.componentes) {
      let compId = comp.componente_id;
      const titleCaseName = toTitleCase(comp.nome);
      const validUniId = comp.unidade_id || getValidUnidadeId(comp.unidade_sigla);

      if (supabase && titleCaseName) {
        // Verifique se o ativo já existe pelo nome (ilike)
        const { data: existingComp } = await supabase
          .from("componentes")
          .select("id")
          .ilike("nome", titleCaseName)
          .maybeSingle();

        if (existingComp) {
          compId = existingComp.id;
        } else {
          // Insere novo componente garantindo unidade_id válida
          const { data: newComp, error: insertErr } = await supabase
            .from('componentes')
            .insert({
              nome: titleCaseName,
              unidade_id: validUniId || (dbUnidades?.[0]?.id),
            })
            .select('id')
            .single();

          if (insertErr) {
            console.error('Erro ao inserir componente:', insertErr.message);
          } else if (newComp) {
            compId = newComp.id;
          }
        }
      }

      processedComponentes.push({
        ...comp,
        componente_id: compId,
        nome: titleCaseName,
        quantidade: parseBrFloat(comp.quantidade) || 0,
        unidade_id: validUniId,
      });
    }

    // 3. Vincular na Tabela Associativa (formula_componentes)
    const relPayloads = processedComponentes.map((c) => ({
      formula_id: formulaId,
      componente_id: c.componente_id,
      quantidade: c.quantidade,
    })).filter(r => r.formula_id && r.componente_id);

    if (formulaId && relPayloads.length > 0 && supabase) {
      await supabase.from('formula_componentes').delete().eq('formula_id', formulaId);
      const { error: relErr } = await supabase.from('formula_componentes').insert(relPayloads);
      if (relErr) console.error('Erro ao vincular componentes:', relErr.message);
    }

    // 4. Salvar a Prescrição (Inserir registros finais em prescricoes e prescricao_itens)
    let dbPrescricaoId = null;
    if (supabase) {
      const { data: prescricao, error: errPresc } = await supabase
        .from("prescricoes")
        .insert({
          paciente_id: clientId,
          data_prescricao: new Date().toISOString().split("T")[0],
          status: "Ativo",
          observacoes: input.descricao || null,
        })
        .select()
        .single();

      if (errPresc || !prescricao) {
        console.error("Erro ao registrar cabeçalho de prescrição no Supabase:", errPresc?.message);
      } else {
        dbPrescricaoId = prescricao.id;

        const componentsSnapshot = processedComponentes.map((r) => ({
          nome: r.nome,
          quantidade: r.quantidade,
          unidade: r.unidade_sigla,
        }));

        const numTotalVeiculo = parseBrFloat(input.total_veiculo) || 0;

        const { error: errItem } = await supabase
          .from("prescricao_itens")
          .insert({
            prescricao_id: prescricao.id,
            formula_id: formulaId,
            nome_formula: titleCaseFormulaName,
            via: normalizedVia,
            veiculo: titleCaseVeiculo,
            dosagem: String(parseBrFloat(input.dosagem_valor) || input.dosagem_valor),
            tipo_veiculo: sanitizedTipoVeiculo,
            posologia: input.posologia.trim(),
            duracao: String(numTotalVeiculo),
            orient_paciente: input.orient_paciente || null,
            orient_farmacia: input.orient_farmacia || null,
            componentes_snapshot: componentsSnapshot,
          });

        if (errItem) {
          console.error("Erro ao registrar itens estruturados de prescrição no Supabase:", errItem.message);
        }
      }
    }

    // 5. Gerar strings formatadas para os campos do prontuário tradicional (PrescriptionItem)
    const listAtivos = processedComponentes
      .map((c) => `${c.nome}: ${c.quantidade}${c.unidade_sigla}`)
      .join(" + ");

    const formattedDosagem = normalizedVia === "oral"
      ? `${listAtivos} em ${titleCaseVeiculo} (Dose: ${input.dosagem_valor} | Total: ${input.total_veiculo} ${sanitizedTipoVeiculo})`
      : `${listAtivos} em ${titleCaseVeiculo} q.s.p. ${input.dosagem_valor}${input.dosagem_unidade || "g"} (Total: ${input.total_veiculo}${sanitizedTipoVeiculo || "un"})`;

    const combinedInstrucoes = [
      input.orient_paciente ? `[Orientações ao Paciente]\n${input.orient_paciente}` : "",
      input.orient_farmacia ? `[Observações à Farmácia Magistral]\n${input.orient_farmacia}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const record = ensurePatientRecord(clientId);
    const newPrescription: PrescriptionItem = {
      id: dbPrescricaoId || `rx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      client_id: clientId,
      data: new Date().toISOString().split("T")[0],
      medicamento: titleCaseFormulaName,
      dosagem: formattedDosagem,
      via: normalizedVia === "oral" ? "Oral" : "Tópico",
      posologia: input.posologia.trim(),
      duracao: normalizedVia === "oral" ? `${input.total_veiculo} ${sanitizedTipoVeiculo}` : "Uso recomendado",
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
