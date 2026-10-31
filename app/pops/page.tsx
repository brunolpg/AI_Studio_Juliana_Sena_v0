import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PatientDashboard } from "@/components/clients/patient-dashboard";

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

  return <PatientDashboard initialTab="pops" />;
}
