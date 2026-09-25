import { z } from "zod";

export const RoleEnum = z.enum(["admin", "medico", "recepcionista", "usuario"]);

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "O e-mail é obrigatório." })
    .email({ message: "Informe um endereço de e-mail válido." }),
  password: z
    .string()
    .min(1, { message: "A senha é obrigatória." })
    .min(6, { message: "A senha deve ter no mínimo 6 caracteres." }),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "O nome completo é obrigatório." })
      .min(3, { message: "O nome deve ter no mínimo 3 caracteres." })
      .max(100, { message: "O nome não pode exceder 100 caracteres." }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { message: "O e-mail é obrigatório." })
      .email({ message: "Informe um endereço de e-mail válido." })
      .max(150, { message: "O e-mail não pode exceder 150 caracteres." }),
    password: z
      .string()
      .min(1, { message: "A senha é obrigatória." })
      .min(6, { message: "A senha deve ter no mínimo 6 caracteres." })
      .max(72, { message: "A senha não pode exceder 72 caracteres." }),
    confirmPassword: z
      .string()
      .min(1, { message: "A confirmação de senha é obrigatória." }),
    role: RoleEnum.default("medico"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem. Digite novamente.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
