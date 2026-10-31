import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PopsView } from "@/components/pops/pops-view";
import type { Client } from "@/types/client";

export const dynamic = "force-dynamic";

export default async function PopsPage() {
  const supabase = await createClient();

  if (!supabase) {
    redirect("/");
  }

  // 1. Verificação de sessão
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  const adminClient = getSupabaseAdminClient();
  const adminDb = adminClient || supabase;

  // 2. Verificação de papel no banco public.profiles
  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const rawRole = (profile?.role || (user as any).user_metadata?.role || "")
    .toLowerCase()
    .trim();

  const isEmailAdmin =
    user.email?.toLowerCase() === "brunolpg@gmail.com" ||
    user.email?.toLowerCase().includes("admin");

  // Se for 'paciente', efetua redirect imediato para a página inicial
  if (rawRole === "paciente" && !isEmailAdmin) {
    redirect("/");
  }

  // 3. Busca lista de pacientes ativos para o seletor inicial
  const { data: pacientes, error: pacError } = await adminDb
    .from("pacientes")
    .select("*")
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  if (pacError) {
    console.warn("Aviso ao carregar pacientes na rota /pops:", pacError.message);
  }

  return <PopsView initialPatients={(pacientes as Client[]) || []} />;
}
