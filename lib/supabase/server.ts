import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Cria uma instância do cliente Supabase para execução segura no servidor (Server Actions / Server Components).
 * Utiliza SUPABASE_SERVICE_ROLE_KEY com fallback para NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("your-project")) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
