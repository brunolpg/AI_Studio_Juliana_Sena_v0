import { z } from "zod";
import { isValidCPF, calculateAge } from "@/lib/brazil-data";

/**
 * Enums de domínio para Sexo e Status
 */
export const GenderEnum = z.enum(["Masculino", "Feminino", "Outros"]);

export const StatusEnum = z.enum(["Ativo", "Inativo"]);

/**
 * Schema Zod principal para validação de Pacientes
 * Contém mensagens amigáveis em português e regras de negócio estritas.
 */
const clientBaseSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, { message: "O nome completo deve ter no mínimo 3 caracteres." })
      .max(120, { message: "O nome não pode exceder 120 caracteres." }),

    data_nascimento: z
      .string()
      .min(1, { message: "Informe uma data de nascimento válida." })
      .refine(
        (val: string) => {
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        { message: "Formato de data inválido." }
      )
      .refine(
        (val: string) => {
          const birthDate = new Date(val);
          const today = new Date();
          return birthDate <= today;
        },
        { message: "A data de nascimento não pode ser futura." }
      )
      .refine(
        (val: string) => {
          const age = calculateAge(val);
          return age !== null && age <= 130;
        },
        { message: "A idade calculada excede o limite biológico plausível (130 anos)." }
      ),

    // Idade é calculada automaticamente a partir da data de nascimento
    // e não deve ser editável manualmente pelo usuário.
    idade: z
      .number()
      .int({ message: "A idade deve ser um número inteiro." })
      .min(0, { message: "A idade não pode ser negativa." }),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: "Insira um endereço de e-mail válido." })
      .max(150, { message: "O e-mail não pode exceder 150 caracteres." }),

    sexo: GenderEnum,

    telefone: z
      .string()
      .trim()
      .refine(
        (val: string) => {
          const digits = val.replace(/\D/g, "");
          return digits.length === 10 || digits.length === 11;
        },
        { message: "Telefone inválido. Deve conter DDD + 8 ou 9 dígitos." }
      ),

    cpf: z
      .string()
      .trim()
      .refine((val: string) => isValidCPF(val), {
        message: "CPF inválido. Verifique os dígitos digitados.",
      }),

    cep: z
      .string()
      .trim()
      .refine(
        (val: string) => {
          if (!val) return true;
          const digits = val.replace(/\D/g, "");
          return digits.length === 8;
        },
        { message: "CEP inválido. Deve conter 8 dígitos (ex: 01310-100)." }
      )
      .optional()
      .nullable()
      .transform((val: string | null | undefined) => (val && val.length > 0 ? val : null)),

    logradouro: z
      .string()
      .trim()
      .min(3, { message: "O logradouro deve ter no mínimo 3 caracteres." })
      .max(150, { message: "O logradouro não pode exceder 150 caracteres." }),

    numero: z
      .string()
      .trim()
      .min(1, { message: "O número do endereço é obrigatório (use S/N se não houver)." })
      .max(20, { message: "O número não pode exceder 20 caracteres." }),

    complemento: z
      .string()
      .trim()
      .max(100, { message: "O complemento não pode exceder 100 caracteres." })
      .optional()
      .nullable()
      .transform((val: string | null | undefined) => (val && val.length > 0 ? val : null)),

    estado: z
      .string()
      .length(2, { message: "O estado deve ter a sigla de 2 letras (UF)." }),

    cidade: z
      .string()
      .trim()
      .min(2, { message: "A cidade deve ter no mínimo 2 caracteres." })
      .max(100, { message: "A cidade não pode exceder 100 caracteres." }),

    profissao: z
      .string()
      .trim()
      .max(100, { message: "A profissão não pode exceder 100 caracteres." })
      .optional()
      .nullable()
      .transform((val: string | null | undefined) => (val && val.length > 0 ? val : null)),

    status: StatusEnum.default("Ativo"),

    observacoes: z
      .string()
      .trim()
      .max(1000, { message: "As observações não podem exceder 1000 caracteres." })
      .optional()
      .nullable()
      .transform((val: string | null | undefined) => (val && val.length > 0 ? val : null)),

    foto_perfil: z.string().nullable().optional(),
  });

export const clientSchema = clientBaseSchema.refine(
  (data) => {
    // Regra de integridade: a idade informada deve corresponder à data de nascimento
    const calculated = calculateAge(data.data_nascimento);
    return calculated !== null && calculated === data.idade;
  },
  {
    message: "A idade calculada não confere com a data de nascimento informada.",
    path: ["idade"],
  }
);

/**
 * Schema para busca e filtros de listagem
 */
export const clientFilterSchema = z.object({
  search: z.string().optional().default(""),
  status: z.enum(["todos", "Ativo", "Inativo", "excluidos"]).optional().default("todos"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  sortBy: z.enum(["nome", "created_at", "idade", "cidade"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
