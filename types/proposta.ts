export interface ProcedimentoProposta {
  procedimento_id: string; // UUID
  nome_procedimento: string;
  num_sessoes: number;
  valor_sessao: number;
  total: number;
}

export interface FormaPagamentoProposta {
  tipo: "a_vista" | "parcelado";
  num_parcelas?: number; // 1 a 12
  desconto?: number; // percentual sobre o total
}

export interface OpcaoProposta {
  id: string; // UUID
  titulo: string; // formato 'Opção #1: [Nome personalizado]'
  descricao: string;
  beneficios?: string;
  procedimentos: ProcedimentoProposta[];
  formas_pagamento: FormaPagamentoProposta[];
}

export interface EtapaCronograma {
  id: string; // UUID
  tipo_data: "unica" | "periodo";
  data?: string;
  data_inicio?: string;
  data_fim?: string;
  desc_etapa: string;
}

export interface CronogramaProposta {
  titulo: string; // padrão 'Cronograma Clínico Inicial'
  etapas: EtapaCronograma[];
}

export interface TopicoProposta {
  id: string; // UUID
  titulo: string;
  texto: string;
}

export interface Proposta {
  id: string;
  paciente_id: string;
  titulo: string;
  objetivo: string;
  opcoes: OpcaoProposta[];
  cronograma: CronogramaProposta;
  topicos: TopicoProposta[];
  status: "Ativo" | "Suspenso" | "Cancelado";
  justificativa_suspensao?: string | null;
  data_suspensao?: string | null;
  profissional: string;
  payload_canonico: Record<string, unknown>;
  payload_hash: string;
  assinatura: string;
  algoritmo: string;
  assinado_em: string;
  created_at: string;
  updated_at: string;
}

export type PropostaInput = Omit<
  Proposta,
  | "id"
  | "created_at"
  | "updated_at"
  | "payload_canonico"
  | "payload_hash"
  | "assinatura"
  | "assinado_em"
>;

export interface PropostaActionResult<T = Proposta> {
  success: boolean;
  data?: T;
  error?: string;
}
