"use server";

import { createClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validations/auth-schema";

export async function changePasswordAction(newPassword: string): Promise<{ success?: boolean; error?: string }> {
  try {
    // 1. Validar senha contra passwordSchema
    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || "Palavra-passe inválida.";
      return { error: errorMessage };
    }

    // 2. Obter cliente Supabase via server
    const supabase = await createClient();
    if (!supabase) {
      return { error: "Serviço de autenticação indisponível (Supabase não configurado)." };
    }

    // 3. Verificar sessão ativa / utilizador atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "Sessão expirada ou utilizador não autenticado." };
    }

    // 4. Atualizar senha no Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return { error: updateError.message || "Erro ao atualizar a palavra-passe no Supabase." };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Ocorreu um erro inesperado ao alterar a palavra-passe." };
  }
}
