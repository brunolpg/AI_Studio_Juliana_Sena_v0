"use server";

import { revalidatePath } from "next/cache";
import { loginSchema, registerSchema } from "@/lib/validations/auth-schema";
import { findUserByEmail, comparePassword, createUserRecord } from "@/lib/auth/users-store";
import { createAuthToken } from "@/lib/auth/jwt";
import { setSessionCookie, removeSessionCookie, getSession } from "@/lib/auth/session";
import type { User, AuthResponse } from "@/types/auth";

/**
 * Normaliza erros do Zod em mapa chave/valor
 */
function formatZodErrors(errors: unknown): Record<string, string[]> {
  if (typeof errors === "object" && errors !== null && "issues" in errors) {
    const issues = (errors as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const formatted: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "geral";
      if (!formatted[key]) {
        formatted[key] = [];
      }
      formatted[key].push(issue.message);
    }
    return formatted;
  }
  return { geral: ["Erro de validação dos dados informados."] };
}

/**
 * 1. LOGIN DE USUÁRIO (Autenticação via Credenciais e Emissão de JWT)
 */
export async function loginAction(rawInput: unknown): Promise<AuthResponse> {
  try {
    const parseResult = loginSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Por favor, corrija os erros nos campos informados.",
        errors: formatZodErrors(parseResult.error),
      };
    }

    const { email, password } = parseResult.data;
    const userWithHash = await findUserByEmail(email);

    if (!userWithHash) {
      return {
        success: false,
        message: "E-mail ou senha incorretos. Verifique suas credenciais.",
        errors: { email: ["Nenhuma conta encontrada com este e-mail."] },
      };
    }

    const passwordMatches = await comparePassword(password, userWithHash.passwordHash);
    if (!passwordMatches) {
      return {
        success: false,
        message: "E-mail ou senha incorretos. Verifique suas credenciais.",
        errors: { password: ["Senha incorreta."] },
      };
    }

    const sanitizedUser: User = {
      id: userWithHash.id,
      name: userWithHash.name,
      email: userWithHash.email,
      role: userWithHash.role,
      roleLabel: userWithHash.roleLabel,
      created_at: userWithHash.created_at,
    };

    // Emite o token JWT assinado
    const token = await createAuthToken(sanitizedUser);

    // Grava no cookie HTTP-only seguro
    await setSessionCookie(token);

    revalidatePath("/");

    return {
      success: true,
      message: `Bem-vindo(a) de volta, ${sanitizedUser.name}!`,
      user: sanitizedUser,
      token,
    };
  } catch (error) {
    console.error("Erro no loginAction:", error);
    return {
      success: false,
      message: `Erro ao processar login: ${(error as Error).message}`,
    };
  }
}

/**
 * 2. REGISTRO DE NOVO USUÁRIO
 */
export async function registerAction(rawInput: unknown): Promise<AuthResponse> {
  try {
    const parseResult = registerSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Preencha todos os campos obrigatórios corretamente.",
        errors: formatZodErrors(parseResult.error),
      };
    }

    const { name, email, password, role } = parseResult.data;

    // Verifica duplicidade de e-mail
    const existing = await findUserByEmail(email);
    if (existing) {
      return {
        success: false,
        message: "Este endereço de e-mail já está cadastrado no sistema.",
        errors: { email: ["E-mail já registrado. Faça login ou use outro e-mail."] },
      };
    }

    // Cria registro com senha criptografada via bcrypt
    const newUser = await createUserRecord({
      name,
      email,
      password,
      role,
    });

    // Emite o JWT para início imediato da sessão
    const token = await createAuthToken(newUser);
    await setSessionCookie(token);

    revalidatePath("/");

    return {
      success: true,
      message: `Conta criada com sucesso! Bem-vindo(a), ${newUser.name}.`,
      user: newUser,
      token,
    };
  } catch (error) {
    console.error("Erro no registerAction:", error);
    return {
      success: false,
      message: `Erro ao criar conta: ${(error as Error).message}`,
    };
  }
}

/**
 * 3. LOGOUT (Encerramento de Sessão e Limpeza de Cookies)
 */
export async function logoutAction(): Promise<{ success: boolean; message: string }> {
  try {
    await removeSessionCookie();
    revalidatePath("/");
    return {
      success: true,
      message: "Sessão encerrada com sucesso.",
    };
  } catch (error) {
    return {
      success: false,
      message: "Falha ao encerrar sessão.",
    };
  }
}

/**
 * 4. CONSULTA DO USUÁRIO DA SESSÃO ATUAL
 */
export async function getCurrentUserAction(): Promise<User | null> {
  try {
    return await getSession();
  } catch (error) {
    return null;
  }
}
