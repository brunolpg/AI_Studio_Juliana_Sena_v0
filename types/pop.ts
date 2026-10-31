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
  tipo: "TOPICO" | "PRESCRICAO";
  ordem: number;
  topico_titulo?: string;
  topico_descricao?: string;
  subtopicos?: PopSubtopico[];
  prescricao_id?: string;
  prescricao?: {
    id: string;
    data_prescricao: string;
    status?: string;
    observacoes?: string | null;
    prescricao_itens?: Array<{
      id: string;
      nome_formula: string;
      via?: string | null;
      veiculo?: string | null;
      dosagem?: string | null;
      posologia?: string | null;
      duracao?: string | null;
      orient_paciente?: string | null;
      orient_farmacia?: string | null;
      componentes_snapshot?: any;
    }>;
  } | any;
  created_at?: string;
}

export interface PopProtocolo {
  id: string;
  paciente_id: string;
  appointment_id?: string | null;
  protocolo: string;
  finalidade: string;
  data_pop: string;
  status?: string;
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
  paciente?: {
    id: string;
    nome: string;
    cpf?: string | null;
    data_nascimento?: string | null;
    email?: string | null;
    telefone?: string | null;
    idade?: number;
  };
  appointment?: {
    id: string;
    data: string;
    horario_inicio: string;
    horario_fim: string;
    procedimento: string;
  } | null;
}

export interface PopFormData {
  id?: string;
  paciente_id: string;
  appointment_id?: string | null;
  protocolo: string;
  finalidade: string;
  data_pop?: string;
  status?: string;
  profissional?: string;
  blocos: Array<{
    id?: string;
    tipo: "TOPICO" | "PRESCRICAO";
    ordem: number;
    topico_titulo?: string;
    topico_descricao?: string;
    prescricao_id?: string;
    subtopicos?: Array<{
      id?: string;
      ordem: number;
      titulo: string;
      descricao: string;
    }>;
  }>;
}
