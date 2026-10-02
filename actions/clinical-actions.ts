"use server";

import { revalidatePath } from "next/cache";
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
