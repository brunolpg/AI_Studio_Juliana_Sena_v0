"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validations/auth-schema";
import type { User, AuthResponse, UserRole } from "@/types/auth";

function getRoleLabel(role: UserRole | string): string {
  const normalized = String(role || "").toLowerCase().trim();
  switch (normalized) {
    case "administrador":
    case "admin":
      return "Administrador(a)";
    case "profissional":
      return "Profissional";
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
      .select("id, nome, role, avatar_url")
      .eq("id", data.user.id)
      .maybeSingle();

    let rawRole = profile?.role;
    let role: UserRole;
    if (rawRole) {
      const normalized = String(rawRole).toLowerCase().trim();
      role = normalized === "profissional"
        ? "profissional"
        : normalized === "admin" || normalized === "administrador"
        ? "administrador"
        : "paciente";
    } else {
      role = (email.toLowerCase() === "brunolpg@gmail.com" || email.toLowerCase().includes("admin"))
        ? "administrador"
        : "paciente";
    }

    const name = profile?.nome || data.user.user_metadata?.full_name || email.split("@")[0];

    const user: User = {
      id: data.user.id,
      name,
      email: data.user.email || email,
      role,
      roleLabel: getRoleLabel(role),
      avatar: profile?.avatar_url || data.user.user_metadata?.avatar_url,
      created_at: data.user.created_at,
      profile: profile || {
        id: data.user.id,
        nome: name,
        role,
        avatar_url: profile?.avatar_url || data.user.user_metadata?.avatar_url,
      },
    };

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/clinical");
    revalidatePath("/patients");
    revalidatePath("/appointments");
    revalidatePath("/formulas");
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
    const { name, email, password, role, estado, cidade } = parseResult.data;
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado.",
      };
    }

    const assignedRole: UserRole = "paciente";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role: assignedRole,
          estado: estado || "BA",
          cidade: cidade || "Salvador",
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
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Aviso ao executar signOut no Supabase (token pode estar expirado/inválido):", err);
      }
    }

    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      for (const cookie of allCookies) {
        if (
          cookie.name.startsWith("sb-") ||
          cookie.name.includes("auth") ||
          cookie.name.includes("token") ||
          cookie.name.includes("session")
        ) {
          try {
            cookieStore.delete(cookie.name);
          } catch {
            // Ignora se não puder deletar o cookie
          }
        }
      }
    } catch (cookieErr) {
      console.warn("Aviso ao limpar cookies de sessão:", cookieErr);
    }

    revalidatePath("/");
  } catch (err) {
    console.warn("Exceção capturada em logoutAction (resiliente):", err);
  }

  return {
    success: true,
    message: "Sessão encerrada com sucesso.",
  };
}

export async function getCurrentUserAction(): Promise<User | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nome, role, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();

    // Prioriza o perfil da base de dados; se vier nulo ou pendente, confere o e-mail administrativo
    let rawRole = profile?.role;
    let role: UserRole;
    if (rawRole) {
      const normalized = String(rawRole).toLowerCase().trim();
      role = normalized === "profissional"
        ? "profissional"
        : normalized === "admin" || normalized === "administrador"
        ? "administrador"
        : "paciente";
    } else {
      role = (authUser.email?.toLowerCase() === "brunolpg@gmail.com" || authUser.email?.toLowerCase().includes("admin"))
        ? "administrador" 
        : "paciente";
    }

    const name = profile?.nome || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "Usuário";

    return {
      id: authUser.id,
      name,
      email: authUser.email || "",
      role,
      roleLabel: getRoleLabel(role),
      avatar: profile?.avatar_url || authUser.user_metadata?.avatar_url,
      created_at: authUser.created_at,
      profile: profile || {
        id: authUser.id,
        nome: name,
        role,
        avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url,
      },
    };
  } catch {
    return null;
  }
}

export async function refreshCurrentUserAction(): Promise<User | null> {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/clinical");
  revalidatePath("/patients");
  revalidatePath("/appointments");
  revalidatePath("/formulas");
  return getCurrentUserAction();
}