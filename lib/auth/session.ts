import { createClient } from "@/lib/supabase/server";
import type { User, UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "sb-auth-token";

function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "administrador":
      return "Administrador(a)";
    case "profissional":
      return "Profissional / Médico(a)";
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

export async function requireAuth(): Promise<User> {
  const user = await getSession();
  if (!user) {
    throw new Error("Não autorizado. Faça login para realizar esta ação.");
  }
  return user;
}
