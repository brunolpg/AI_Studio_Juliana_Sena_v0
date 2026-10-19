export type HomeCareGrupo = "CUIDADOS" | "RECOMENDACOES" | "ATENCAO_CRITICA";
export type HomeCareStatus = "Ativo" | "Concluído" | "Cancelado";

export interface HomeCareTopico {
  id: string;
  grupo: HomeCareGrupo;
  titulo: string;
  texto: string;
  created_at?: string;
  updated_at?: string;
}

export interface HomeCareTopicoItem {
  id?: string;
  topico_id?: string;
  grupo: HomeCareGrupo;
  ordem: number;
  titulo: string;
  texto: string;
  isCustom?: boolean;
}

export interface HomeCareCronogramaItem {
  id?: string;
  ficha_id?: string;
  ordem: number;
  dia_inicio: number;
  dia_fim: number;
  fase_titulo?: string | null;
  formula_id?: string | null;
  nome_formula: string;
  posologia: string;
  objetivo_clinico: string;
}

export interface HomeCareFicha {
  id: string;
  paciente_id: string;
  appointment_id?: string | null;
  titulo_protocolo: string;
  data_home_care: string; // YYYY-MM-DD
  incluir_atencao_critica?: boolean;
  atencao_critica_titulo?: string | null;
  atencao_critica_texto?: string | null;
  incluir_recomendacoes: boolean;
  status: HomeCareStatus;
  profissional: string;
  payload_canonico?: any;
  payload_hash?: string;
  assinatura?: string;
  algoritmo?: string;
  assinado_em?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HomeCareFichaCompleta extends HomeCareFicha {
  cuidados: HomeCareTopicoItem[];
  cronograma: HomeCareCronogramaItem[];
  recomendacoes: HomeCareTopicoItem[];
  paciente?: {
    id: string;
    nome: string;
    cpf?: string | null;
    data_nascimento?: string | null;
    email?: string | null;
    telefone?: string | null;
  };
  appointment?: {
    id: string;
    data: string;
    horario_inicio: string;
    horario_fim: string;
    procedimento: string;
  } | null;
}

export interface SaveHomeCareFichaInput {
  id?: string;
  paciente_id: string;
  appointment_id?: string | null;
  titulo_protocolo: string;
  data_home_care: string;
  incluir_atencao_critica?: boolean;
  atencao_critica_titulo?: string | null;
  atencao_critica_texto?: string | null;
  incluir_recomendacoes: boolean;
  status?: HomeCareStatus;
  profissional?: string;
  cuidados: Array<{
    topico_id?: string;
    titulo: string;
    texto: string;
    ordem?: number;
  }>;
  cronograma: Array<{
    ordem?: number;
    dia_inicio: number;
    dia_fim: number;
    fase_titulo?: string | null;
    formula_id?: string | null;
    nome_formula: string;
    posologia: string;
    objetivo_clinico: string;
  }>;
  recomendacoes?: Array<{
    topico_id?: string;
    titulo: string;
    texto: string;
    ordem?: number;
  }>;
}
