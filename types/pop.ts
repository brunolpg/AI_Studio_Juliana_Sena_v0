export type PopStatus = "Ativo" | "Em Revisão" | "Cancelado";

export interface PopSubtopico {
  id?: string;
  bloco_id?: string;
  ordem: number;
  titulo: string;
  descricao: string;
  created_at?: string;
}

export interface PopBloco {
  id?: string;
  pop_id?: string;
  tipo: "TOPICO" | "FORMULA" | "PRESCRICAO";
  ordem: number;
  topico_titulo?: string;
  topico_descricao?: string;
  subtopicos?: PopSubtopico[];
  formula_id?: string;
  formula?: {
    id: string;
    nome: string;
    via?: string | null;
    veiculo?: string | null;
    dosagem?: string | null;
    posologia?: string | null;
    descricao?: string | null;
    orient_paciente?: string | null;
    orient_farmacia?: string | null;
  } | any;
  prescricao_id?: string;
  prescricao?: any;
  created_at?: string;
}

export interface PopProtocolo {
  id: string;
  protocolo: string;
  finalidade: string;
  data_pop: string;
  status: PopStatus;
  profissional: string;
  payload_canonico?: any;
  payload_hash?: string;
  assinatura?: string;
  algoritmo?: string;
  assinado_em?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PopProtocoloCompleto extends PopProtocolo {
  blocos: PopBloco[];
}

export interface PopFormData {
  id?: string;
  protocolo: string;
  finalidade: string;
  data_pop?: string;
  status: PopStatus;
  profissional?: string;
  blocos: Array<{
    id?: string;
    tipo: "TOPICO" | "FORMULA" | "PRESCRICAO";
    ordem: number;
    topico_titulo?: string;
    topico_descricao?: string;
    formula_id?: string;
    prescricao_id?: string;
    subtopicos?: Array<{
      id?: string;
      ordem: number;
      titulo: string;
      descricao: string;
    }>;
  }>;
}
