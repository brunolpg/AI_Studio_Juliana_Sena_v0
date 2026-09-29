"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth-schema";
import type { User, AuthResponse, UserRole } from "@/types/auth";

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "administrador":
      return "Administrador(a)";
    case "profissional":
      return "Profissional / Especialista";
    case "paciente":
    default:
      return "Paciente";
  }
}

export async function loginAction(rawInput: unknown): Promise<AuthResponse> {
  try {
    const parseResult = loginSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Por favor, verifique os dados informados.",
      };
    }
    const { email, password } = parseResult.data;
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado.",
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        message: error?.message || "E-mail ou senha incorretos.",
      };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, role, avatar_url")
      .eq("id", data.user.id)
      .maybeSingle();

    const role: UserRole = (profile?.role as UserRole) || (email.includes("admin") ? "administrador" : "paciente");
    const name = profile?.nome || data.user.user_metadata?.full_name || email.split("@")[0];

    const user: User = {
      id: data.user.id,
      name,
      email: data.user.email || email,
      role,
      roleLabel: getRoleLabel(role),
      avatar: profile?.avatar_url || data.user.user_metadata?.avatar_url,
      created_at: data.user.created_at,
    };

    revalidatePath("/");
    return {
      success: true,
      message: `Bem-vindo(a), ${name}!`,
      user,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erro ao realizar login: ${(err as Error).message}`,
    };
  }
}

export async function registerAction(rawInput: unknown): Promise<AuthResponse> {
  try {
    const parseResult = registerSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        message: "Por favor, preencha todos os campos corretamente.",
      };
    }
    const { name, email, password, role } = parseResult.data;
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado.",
      };
    }

    const assignedRole: UserRole = role;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: assignedRole,
        },
      },
    });

    if (error || !data.user) {
      return {
        success: false,
        message: error?.message || "Falha ao criar conta.",
      };
    }

    const user: User = {
      id: data.user.id,
      name,
      email,
      role: assignedRole,
      roleLabel: getRoleLabel(assignedRole),
      created_at: data.user.created_at,
    };

    revalidatePath("/");
    return {
      success: true,
      message: "Conta criada com sucesso!",
      user,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erro no cadastro: ${(err as Error).message}`,
    };
  }
}

export async function logoutAction(): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    revalidatePath("/");
    return {
      success: true,
      message: "Sessão encerrada com sucesso.",
    };
  } catch {
    return {
      success: false,
      message: "Falha ao encerrar sessão.",
    };
  }
}

export async function getCurrentUserAction(): Promise<User | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, role, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();

    const role: UserRole = (profile?.role as UserRole) || "paciente";
    const name = profile?.nome || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Usuário";

    return {
      id: authUser.id,
      name,
      email: authUser.email || "",
      role,
      roleLabel: getRoleLabel(role),
      avatar: profile?.avatar_url || authUser.user_metadata?.avatar_url,
      created_at: authUser.created_at,
    };
  } catch {
    return null;
  }
}
