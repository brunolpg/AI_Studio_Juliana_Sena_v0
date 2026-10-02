export type EvolutionType = string;

export interface VitalSigns {
  pressaoArterial?: string; // ex: "120/80"
  frequenciaCardiaca?: number; // bpm
  temperatura?: number; // °C
  peso?: number; // kg
  altura?: number; // cm
  glicemia?: number; // mg/dL
  imc?: number;
}

export interface ClinicalEvolution {
  id: string;
  client_id: string;
  data: string; // YYYY-MM-DD ou ISO
  horario: string; // "14:30"
  tipo: EvolutionType;
  tipo_atendimento?: string;
  procedimento_id?: string;
  profissional: string;
  especialidade: string;
  subjetivo: string; // Queixas, sintomas relatados pelo paciente
  objetivo: string; // Exame físico e achados clínicos
  sinaisVitais?: VitalSigns;
  avaliacao: string; // Hipótese diagnóstica, diagnóstico fechado
  plano: string; // Conduta terapêutica, prescrições, orientações
  created_at: string;
}

export interface MedicalHistory {
  alergias: string[];
  comorbidades: string[];
  medicamentosUsoContinuo: string[];
  tipoSanguineo: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "Não informado";
  historicoCirurgico: string;
  historicoFamiliar: string;
  habitosVida: {
    tabagismo: "Não fuma" | "Fumante" | "Ex-fumante";
    etilismo: "Não consome" | "Consumo social" | "Consumo frequente";
    atividadeFisica: "Sedentário" | "Moderada (1-3x/sem)" | "Intensa (4-7x/sem)";
  };
  observacoesGerais?: string;
  updated_at?: string;
}

export interface PrescriptionItem {
  id: string;
  client_id: string;
  data: string;
  medicamento: string;
  dosagem: string;
  via: "Oral" | "Tópico" | "Inalatório" | "Injetável" | "Oftálmico";
  posologia: string;
  duracao: string;
  ativo: boolean;
  instrucoes?: string;
}

export interface PatientClinicalRecord {
  client_id: string;
  medicalHistory: MedicalHistory;
  evolutions: ClinicalEvolution[];
  prescriptions: PrescriptionItem[];
}
