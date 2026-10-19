import { z } from "zod";

export const homeCareGrupoEnum = z.enum(["CUIDADOS", "RECOMENDACOES", "ATENCAO_CRITICA"]);
export const homeCareStatusEnum = z.enum(["Ativo", "Concluído", "Cancelado"]);

export const topicoItemSchema = z.object({
  topico_id: z.string().uuid().optional().nullable(),
  titulo: z.string().trim().min(2, "Título deve conter ao menos 2 caracteres"),
  texto: z.string().trim().min(3, "Texto explicativo deve conter ao menos 3 caracteres"),
  ordem: z.number().int().optional(),
});

export const cronogramaItemSchema = z
  .object({
    ordem: z.number().int().optional(),
    dia_inicio: z
      .number({ invalid_type_error: "Dia de início deve ser um número" })
      .int()
      .min(1, "O dia inicial deve ser >= 1"),
    dia_fim: z
      .number({ invalid_type_error: "Dia final deve ser um número" })
      .int()
      .min(1, "O dia final deve ser >= 1"),
    fase_titulo: z.string().trim().optional().nullable(),
    formula_id: z.string().uuid().optional().nullable(),
    nome_formula: z.string().trim().min(1, "O nome do produto/fórmula é obrigatório"),
    posologia: z.string().trim().min(1, "A posologia e frequência são obrigatórias"),
    objetivo_clinico: z.string().trim().min(1, "O objetivo clínico é obrigatório"),
  })
  .refine((data) => data.dia_fim >= data.dia_inicio, {
    message: "O dia final deve ser maior ou igual ao dia inicial",
    path: ["dia_fim"],
  });

export const homeCareFichaSchema = z.object({
  id: z.string().uuid().optional(),
  paciente_id: z.string().uuid("Paciente é obrigatório"),
  appointment_id: z.string().uuid().optional().nullable(),
  titulo_protocolo: z
    .string()
    .trim()
    .min(3, "O título do protocolo deve ter pelo menos 3 caracteres"),
  data_home_care: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD"),
  incluir_atencao_critica: z.boolean().default(true),
  atencao_critica_titulo: z.string().trim().optional().nullable(),
  atencao_critica_texto: z.string().trim().optional().nullable(),
  incluir_recomendacoes: z.boolean().default(false),
  status: homeCareStatusEnum.default("Ativo"),
  profissional: z.string().optional().default("Dra. Juliana Sena"),
  cuidados: z
    .array(topicoItemSchema)
    .min(1, "É obrigatório incluir ao menos 1 item no grupo de Cuidados"),
  cronograma: z
    .array(cronogramaItemSchema)
    .min(1, "É obrigatório incluir ao menos 1 linha no Cronograma de Tratamento"),
  recomendacoes: z.array(topicoItemSchema).optional().default([]),
});

export type TopicoItemInput = z.infer<typeof topicoItemSchema>;
export type CronogramaItemInput = z.infer<typeof cronogramaItemSchema>;
export type HomeCareFichaInput = z.infer<typeof homeCareFichaSchema>;
