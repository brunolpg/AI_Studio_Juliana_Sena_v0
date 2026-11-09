export type PrescricaoExameStatus =
  | "Ativo"
  | "Suspenso"
  | "Concluído"
  | "Cancelado";

export interface GrupoExameItem {
  id?: string;
  nome_grupo: string;
  exames: string[];
}

export interface PrescricaoExame {
  id: string;
  paciente_id: string;
  titulo: string;
  data: string;
  descricao?: string | null;
  grupos_exames: GrupoExameItem[];
  orientacoes: string[];
  status: PrescricaoExameStatus;
  justificativa_suspensao?: string | null;
  data_suspensao?: string | null;
  profissional: string;
  payload_canonico?: Record<string, unknown> | null;
  payload_hash?: string | null;
  assinatura?: string | null;
  algoritmo?: string | null;
  assinado_em?: string | null;
  created_at: string;
  updated_at: string;
  paciente?: {
    id: string;
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
  };
}

export interface PrescricaoExameInput {
  paciente_id: string;
  titulo: string;
  data?: string;
  descricao: string;
  grupos_exames: GrupoExameItem[];
  orientacoes: string[];
  status?: PrescricaoExameStatus;
  profissional?: string;
}

export interface PrescricaoExameActionResult<T = PrescricaoExame> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CatalogoExamesPreCadastrados {
  gruposSugeridos: string[];
  examesSugeridos: string[];
  orientacoesSugeridas: string[];
  grupoItensMap?: Record<string, string[]>;
}
