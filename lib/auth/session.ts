import { createClient } from "@/lib/supabase/server";
import type { User, UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "sb-auth-token";

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

export async function setSessionCookie(token: string): Promise<void> {
  // Gerenciado nativamente pelo Supabase Auth
}

export async function removeSessionCookie(): Promise<void> {
  // Gerenciado nativamente pelo Supabase Auth
}

export async function getSession(): Promise<User | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nome, role, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();

    // Obtém o perfil da base de dados ou aplica a regra de contingência para a conta de administração
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
      role =
        (authUser.email?.toLowerCase() === "brunolpg@gmail.com" || authUser.email?.toLowerCase().includes("admin"))
          ? "administrador"
          : "paciente";
    }

    const name =
      profile?.nome ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.nome ||
      authUser.email?.split("@")[0] ||
      "Usuário";

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

export const PROFISSIONAL_ONLY_ERROR = "Acesso restrito ao profissional de saúde.";

export async function requireAuth(): Promise<User> {
  const user = await getSession();
  if (!user) {
    throw new Error("Não autorizado. Faça login para realizar esta ação.");
  }
  return user;
}

export async function requireProfissionalAccess(): Promise<
  | { authorized: true; user: User; supabase: NonNullable<Awaited<ReturnType<typeof createClient>>> }
  | { authorized: false; message: string }
> {
  const supabase = await createClient();
  if (!supabase) {
    return { authorized: false, message: "Banco de dados não disponível." };
  }

  const user = await getSession();
  if (!user) {
    return {
      authorized: false,
      message: "Acesso não autenticado. Por favor, realize login.",
    };
  }

  if (user.role !== "profissional") {
    return {
      authorized: false,
      message: PROFISSIONAL_ONLY_ERROR,
    };
  }

  return { authorized: true, user, supabase };
}

export async function verifyProfissionalOrOwnPaciente(pacienteId: string): Promise<
  | { authorized: true; user: User; isProfissional: boolean; supabase: NonNullable<Awaited<ReturnType<typeof createClient>>> }
  | { authorized: false; message: string }
> {
  const supabase = await createClient();
  if (!supabase) {
    return { authorized: false, message: "Banco de dados não disponível." };
  }

  const user = await getSession();
  if (!user) {
    return {
      authorized: false,
      message: "Acesso não autenticado. Por favor, realize login.",
    };
  }

  // Bloqueio explícito para perfil administrador
  if (user.role === "administrador" || (user.role as string) === "admin") {
    return {
      authorized: false,
      message: PROFISSIONAL_ONLY_ERROR,
    };
  }

  if (user.role === "profissional") {
    return { authorized: true, user, isProfissional: true, supabase };
  }

  if (user.role === "paciente") {
    const userEmail = (user.email || "").toLowerCase().trim();
    let query = supabase
      .from("pacientes")
      .select("id")
      .eq("id", pacienteId)
      .is("deleted_at", null);

    if (user.id && userEmail) {
      query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
    } else if (user.id) {
      query = query.eq("user_id", user.id);
    } else if (userEmail) {
      query = query.ilike("email", userEmail);
    }

    const { data: ownPatient } = await query.maybeSingle();
    if (ownPatient?.id === pacienteId) {
      return { authorized: true, user, isProfissional: false, supabase };
    }
  }

  return {
    authorized: false,
    message: PROFISSIONAL_ONLY_ERROR,
  };
}

