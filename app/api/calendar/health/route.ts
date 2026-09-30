import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedOAuthClient } from "@/lib/google-calendar/oauth-sync-service";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
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
    .select("role, email, nome")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = profile?.role || (user.email === "brunolpg@gmail.com" ? "administrador" : user.email?.includes("juliana") ? "profissional" : "paciente");
  const canManageCalendar = userRole === "administrador" || userRole === "profissional";

  const { client, status, message } = await getAuthenticatedOAuthClient(user.id);
  if (!client) {
    return NextResponse.json({
      healthy: false,
      status: status || "not_connected",
      message: message || "Google Agenda não conectado.",
      canManageCalendar,
      userRole,
      userEmail: user.email,
    });
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const calendarMeta = await calendar.calendars.get({ calendarId: "primary" });
    
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email || calendarMeta.data.id || user.email;

    return NextResponse.json({
      healthy: true,
      status: "connected",
      googleEmail,
      calendarSummary: calendarMeta.data.summary || "Primary Calendar",
      timeZone: calendarMeta.data.timeZone || "America/Sao_Paulo",
      canManageCalendar,
      userRole,
      message: `Conectado como ${googleEmail}`,
    });
  } catch (err) {
    return NextResponse.json({
      healthy: false,
      status: "error",
      googleEmail: user.email,
      canManageCalendar,
      userRole,
      message: `Erro ao verificar token do Google: ${(err as Error).message}`,
    });
  }
}
