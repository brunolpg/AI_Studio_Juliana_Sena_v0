import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { performFullSync } from "@/lib/google-calendar/calendar-sync-service";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Supabase não configurado." }, { status: 500 });
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = profile?.role || (user.email === "brunolpg@gmail.com" ? "administrador" : user.email?.includes("juliana") ? "profissional" : "paciente");
  if (userRole !== "administrador" && userRole !== "profissional") {
    return NextResponse.json({
      success: false,
      message: "Apenas administradores e profissionais podem sincronizar o Google Agenda.",
    }, { status: 403 });
  }

  try {
    const result = await performFullSync();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      success: false,
      sent: 0,
      imported: 0,
      errors: 1,
      message: (err as Error).message || "Erro interno na sincronização",
    }, { status: 500 });
  }
}
