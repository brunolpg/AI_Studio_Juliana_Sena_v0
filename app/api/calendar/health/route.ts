import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceAccountCalendar } from "@/lib/google-calendar/calendar-sync-service";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ healthy: false, message: "Supabase não configurado." }, { status: 500 });
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ healthy: false, message: "Usuário não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = profile?.role || (user.email === "brunolpg@gmail.com" ? "administrador" : user.email?.includes("juliana") ? "profissional" : "paciente");
  const canManageCalendar = userRole === "administrador" || userRole === "profissional";

  const { calendar, calendarId, status, message } = getServiceAccountCalendar();
  if (!calendar) {
    return NextResponse.json({
      healthy: false,
      status,
      message,
      canManageCalendar,
      userRole,
    });
  }

  try {
    const meta = await calendar.calendars.get({ calendarId });
    const summary = meta.data.summary || "Agenda da Dra. Juliana";

    return NextResponse.json({
      healthy: true,
      status: "connected",
      calendarSummary: summary,
      timeZone: meta.data.timeZone || "America/Sao_Paulo",
      canManageCalendar,
      userRole,
      message: `Conectado à agenda ${summary}`,
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    const noAccess = code === 403 || code === 404;
    return NextResponse.json({
      healthy: false,
      status: noAccess ? "no_access" : "error",
      canManageCalendar,
      userRole,
      message: noAccess
        ? "A conta de serviço não tem acesso a esta agenda. Compartilhe a agenda com ela (permissão: Fazer alterações nos eventos) e confira o GOOGLE_CALENDAR_ID."
        : `Erro ao acessar a agenda: ${(err as Error).message}`,
    });
  }
}
