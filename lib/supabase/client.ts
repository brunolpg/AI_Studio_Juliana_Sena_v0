import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton do Supabase Client para uso no Client-side e Server-side
 */
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project")) {
    // Retorna null quando as variáveis ainda não foram configuradas no .env.local
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

/**
 * Cliente Supabase com Service Role para Server Actions com privilégios administrativos
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("your-project")) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
