import { z } from "zod";

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
  texto_topico: z.string().trim().min(1, "O texto da declaração é obrigatório."),
  linhas_checkbox: checkboxListSchema,
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
  texto_topico: z.string().trim().min(1, "O texto da declaração é obrigatório."),
  linhas_checkbox: z.array(termoSnapshotCheckboxSchema).default([]),
});

export const termoSnapshotSchema = z.object({
  titulo: z.string().trim().min(1, "O título do termo é obrigatório."),
  procedimento: z.string().trim().min(1, "O procedimento é obrigatório."),
  topicos: z
    .array(termoSnapshotTopicoSchema)
    .min(1, "O termo deve possuir ao menos um tópico."),
  declaracao: termoSnapshotDeclaracaoSchema.nullable(),
});

export const criarTermoSchema = z.object({
  paciente_id: z.string().uuid("Identificador do paciente inválido."),
  modelo_id: z.string().uuid("Identificador do modelo inválido."),
  procedimento_nome: z
    .string()
    .trim()
    .min(1, "O nome do procedimento é obrigatório."),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.")
    .optional(),
  conteudo_snapshot: termoSnapshotSchema,
});

export type TermoModeloInput = z.input<typeof termoModeloSchema>;
export type CriarTermoInput = z.input<typeof criarTermoSchema>;
