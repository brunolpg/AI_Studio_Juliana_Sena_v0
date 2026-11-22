import { z } from "zod";
import type { TermoDeclaracaoBloco } from "@/types/termo";

export const DEFAULT_DECLARACAO_ORDEM: TermoDeclaracaoBloco[] = [
  "texto",
  "confirmacoes",
];

export function normalizeDeclaracaoOrdem(
  ordem?: readonly string[] | null
): TermoDeclaracaoBloco[] {
  if (!Array.isArray(ordem)) return [...DEFAULT_DECLARACAO_ORDEM];
  const valid = ordem.filter(
    (item): item is TermoDeclaracaoBloco =>
      item === "texto" || item === "confirmacoes"
  );
  if (valid.length >= 2 && valid[0] !== valid[1]) {
    return [valid[0], valid[1]];
  }
  if (valid.length >= 1) {
    return valid[0] === "confirmacoes"
      ? ["confirmacoes", "texto"]
      : ["texto", "confirmacoes"];
  }
  return [...DEFAULT_DECLARACAO_ORDEM];
}

export const termoDeclaracaoBlocoSchema = z.enum(["texto", "confirmacoes"]);

const declaracaoOrdemSchema = z
  .array(termoDeclaracaoBlocoSchema)
  .optional()
  .transform((items) => normalizeDeclaracaoOrdem(items));

const checkboxListSchema = z
  .array(z.string().trim())
  .default([])
  .transform((items) => items.filter((item) => item.length > 0));

export const termoTopicoSchema = z.object({
  id: z.string().uuid().optional(),
  ordem: z.number().int().min(1).optional(),
  titulo: z.string().trim().min(1, "O título do tópico é obrigatório."),
  texto_topico: z.string().trim().min(1, "O texto do tópico é obrigatório."),
  linhas_checkbox: checkboxListSchema,
});

export const termoDeclaracaoSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1, "O título da declaração é obrigatório."),
  texto_topico: z.string().trim().optional().default(""),
  linhas_checkbox: checkboxListSchema,
  ordem_blocos: declaracaoOrdemSchema,
});

export const termoModeloSchema = z.object({
  id: z
    .string()
    .uuid("Identificador do modelo inválido.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  procedimento_id: z.string().uuid("Selecione um procedimento válido."),
  titulo: z.string().trim().optional(),
  topicos: z
    .array(termoTopicoSchema)
    .min(1, "Adicione ao menos um tópico ao modelo de termo."),
  declaracao: termoDeclaracaoSchema,
});

export const termoSnapshotCheckboxSchema = z.object({
  texto: z.string().trim().min(1, "O texto do item de confirmação é obrigatório."),
  marcado: z.boolean(),
});

export const termoSnapshotTopicoSchema = z.object({
  ordem: z.number().int().min(1),
  titulo: z.string().trim().min(1, "O título do tópico é obrigatório."),
  texto_topico: z.string().trim().min(1, "O texto do tópico é obrigatório."),
  linhas_checkbox: z.array(termoSnapshotCheckboxSchema).default([]),
});

export const termoSnapshotDeclaracaoSchema = z.object({
  titulo: z.string().trim().min(1, "O título da declaração é obrigatório."),
  texto_topico: z.string().trim().optional().default(""),
  linhas_checkbox: z.array(termoSnapshotCheckboxSchema).default([]),
  ordem_blocos: declaracaoOrdemSchema,
});

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Informe uma data válida.");

export const termoSnapshotSchema = z.object({
  titulo: z.string().trim().min(1, "O título do termo é obrigatório."),
  procedimento: z.string().trim().min(1, "O procedimento é obrigatório."),
  topicos: z
    .array(termoSnapshotTopicoSchema)
    .min(1, "O termo deve possuir ao menos um tópico."),
  declaracao: termoSnapshotDeclaracaoSchema.nullable(),
  assinatura_apenas_no_pdf: z.boolean().optional(),
});

export const criarTermoSchema = z.object({
  paciente_id: z.string().uuid("Identificador do paciente inválido."),
  modelo_id: z.string().uuid("Identificador do modelo inválido."),
  procedimento_nome: z
    .string()
    .trim()
    .min(1, "O nome do procedimento é obrigatório."),
  data: isoDateSchema.optional(),
  conteudo_snapshot: termoSnapshotSchema,
});

export const uploadTermoAssinadoSchema = z.object({
  paciente_id: z.string().uuid("Identificador do paciente inválido."),
  modelo_id: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val ? val : null))
    .refine(
      (val) => val === null || z.string().uuid().safeParse(val).success,
      "Identificador do modelo de termo inválido."
    ),
  procedimento_nome: z
    .string()
    .trim()
    .max(200, "O nome do procedimento deve ter no máximo 200 caracteres.")
    .optional()
    .default(""),
  data: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val : undefined))
    .pipe(isoDateSchema.optional()),
  profissional: z
    .string()
    .trim()
    .max(150, "O nome do profissional deve ter no máximo 150 caracteres.")
    .optional()
    .default(""),
  assinatura_apenas_no_pdf: z.boolean().optional().default(false),
  origem_pdf: z.literal("upload").optional().default("upload"),
});

export type TermoModeloInput = z.input<typeof termoModeloSchema>;
export type CriarTermoInput = z.input<typeof criarTermoSchema>;
export type UploadTermoAssinadoInput = z.input<typeof uploadTermoAssinadoSchema>;
