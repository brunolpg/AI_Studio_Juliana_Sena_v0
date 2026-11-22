export type TermoOrigemPdf = "gerado" | "upload";

export interface TermoTopico {
  id?: string;
  modelo_id?: string;
  ordem: number;
  titulo: string;
  texto_topico: string;
  linhas_checkbox: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TermoDeclaracao {
  id?: string;
  modelo_id?: string;
  titulo: string;
  texto_topico: string;
  linhas_checkbox: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TermoProcedimento {
  id: string;
  procedimento: string;
}

export interface TermoModelo {
  id: string;
  procedimento_id: string;
  titulo: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  procedimento?: TermoProcedimento;
  topicos: TermoTopico[];
  declaracao: TermoDeclaracao | null;
}

export interface TermoSnapshotCheckbox {
  texto: string;
  marcado: boolean;
}

export interface TermoSnapshotTopico {
  ordem: number;
  titulo: string;
  texto_topico: string;
  linhas_checkbox: TermoSnapshotCheckbox[];
}

export interface TermoSnapshotDeclaracao {
  titulo: string;
  texto_topico: string;
  linhas_checkbox: TermoSnapshotCheckbox[];
}

export interface TermoSnapshot {
  titulo: string;
  procedimento: string;
  topicos: TermoSnapshotTopico[];
  declaracao: TermoSnapshotDeclaracao | null;
  assinatura_apenas_no_pdf?: boolean;
}

export interface UploadTermoAssinadoMeta {
  paciente_id: string;
  modelo_id?: string | null;
  procedimento_nome?: string;
  data?: string;
  profissional?: string;
  assinatura_apenas_no_pdf?: boolean;
  origem_pdf?: "upload";
}

export interface TermoConsentimento {
  id: string;
  paciente_id: string;
  modelo_id: string | null;
  procedimento_nome: string;
  data: string;
  conteudo_snapshot: TermoSnapshot | null;
  assinado: boolean;
  origem_pdf: TermoOrigemPdf | null;
  pdf_path: string | null;
  assinado_em: string | null;
  profissional: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TermoActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
