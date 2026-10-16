import { z } from "zod";

export const formulaComponenteSchema = z.object({
  componente_id: z.string().min(1, "Selecione o componente."),
  quantidade: z.coerce.number().positive("A quantidade deve ser maior que zero."),
});

export const formulaFormSchema = z.object({
  nome: z.string().min(2, "O nome da fórmula é obrigatório."),
  descricao: z.string().optional().nullable(),
  via: z.enum(["oral", "tópico"], { required_error: "Selecione a via de administração." }),
  veiculo: z.string().optional().nullable(),
  dosagem: z.coerce.number().optional().nullable(),
  tipo_veiculo: z.enum(["dose(s)", "sachê(s)", "comprimido(s)"]).optional().nullable(),
  posologia: z.string().optional().nullable(),
  orient_paciente: z.string().optional().nullable(),
  orient_farmacia: z.string().optional().nullable(),
  componentes: z.array(formulaComponenteSchema).min(1, "Adicione ao menos um componente à fórmula."),
});

export type FormulaFormValues = z.infer<typeof formulaFormSchema>;
