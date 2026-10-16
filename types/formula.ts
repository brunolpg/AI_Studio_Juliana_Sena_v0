export interface Unidade {
  id: string;
  unidade: string;
}

export interface Componente {
  id: string;
  nome: string;
  unidade_id: string;
  unidades?: Unidade;
}

export interface FormulaComponente {
  id?: string;
  formula_id?: string;
  componente_id: string;
  quantidade: number;
  componentes?: Componente;
}

export type ViaType = "oral" | "tópico";
export type TipoVeiculoType = "dose(s)" | "sachê(s)" | "comprimido(s)";

export interface Formula {
  id: string;
  nome: string;
  descricao?: string | null;
  via: ViaType;
  veiculo?: string | null;
  dosagem?: number | null;
  tipo_veiculo?: TipoVeiculoType | null;
  posologia?: string | null;
  orient_paciente?: string | null;
  orient_farmacia?: string | null;
  created_at?: string;
  updated_at?: string;
  formula_componentes?: FormulaComponente[];
}
