import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/google/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getStoredTokenForUser(userId: string) {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function saveTokenForUser(userId: string, tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
}) {
  const supabase = await createClient();
  if (!supabase) return false;

  // Busca token existente para preservar refresh_token caso o Google não envie um novo na renovação
  const existing = await getStoredTokenForUser(userId);
  const refreshToken = tokens.refresh_token || existing?.refresh_token || null;
  const accessToken = tokens.access_token || existing?.access_token;

  if (!accessToken) return false;

  const { error } = await supabase
    .from("google_tokens")
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: tokens.expiry_date || existing?.expiry_date,
      scope: tokens.scope || existing?.scope,
      token_type: tokens.token_type || existing?.token_type,
      calendar_id: existing?.calendar_id || "primary",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  return !error;
}

/**
 * Retorna um cliente OAuth2 autenticado e com token renovado para o usuário
 */
export async function getAuthenticatedOAuthClient(userId: string) {
  const tokenRecord = await getStoredTokenForUser(userId);
  if (!tokenRecord || !tokenRecord.refresh_token) {
    return { client: null, status: "needs_reconnect", message: "Reconectar Google Agenda" };
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: tokenRecord.access_token,
    refresh_token: tokenRecord.refresh_token,
    expiry_date: tokenRecord.expiry_date,
    token_type: tokenRecord.token_type || "Bearer",
    scope: tokenRecord.scope,
  });

  // Verifica se o token expirou e tenta renovar
  try {
    const now = Date.now();
    if (tokenRecord.expiry_date && tokenRecord.expiry_date <= now + 60000) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await saveTokenForUser(userId, credentials);
      oauth2Client.setCredentials(credentials);
    }
    return { client: oauth2Client, status: "connected", message: "Sincronizado" };
  } catch (error) {
    console.error("Erro ao renovar token do Google:", error);
    return { client: null, status: "error", message: "Reconectar Google Agenda" };
  }
}

/**
 * Sincroniza um agendamento individual para o Google Calendar (Criação ou Atualização)
 */
export async function syncSingleAppointmentToGoogle(userId: string, appointmentId: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, message: "Supabase não configurado" };

  const { data: apt, error: aptError } = await supabase
    .from("appointments")
    .select("*, pacientes(nome, email, telefone)")
    .eq("id", appointmentId)
    .single();

  if (aptError || !apt) {
    return { success: false, message: "Agendamento não encontrado" };
  }

  const { client, status } = await getAuthenticatedOAuthClient(userId);
  if (!client) {
    await supabase.from("appointments").update({ synced_with_google: false }).eq("id", appointmentId);
    return { success: false, message: status === "needs_reconnect" ? "Reconectar Google Agenda" : "Erro de Autenticação Google" };
  }

  const calendar = google.calendar({ version: "v3", auth: client });
  const calendarId = "primary";

  // Monta horário no fuso America/Sao_Paulo
  const startDateTime = `${apt.data}T${apt.horario_inicio}:00-03:00`;
  const endDateTime = `${apt.data}T${apt.horario_fim}:00-03:00`;

  const patientName = apt.pacientes?.nome || "Paciente";
  const summary = `Consulta: ${patientName} - ${apt.procedimento}`;
  const description = `Paciente: ${patientName}\nTelefone: ${apt.pacientes?.telefone || "N/A"}\nProcedimento: ${apt.procedimento}\nObservações: ${apt.observacoes || "Nenhuma"}`;

  const eventBody = {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
    end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
  };

  try {
    let googleEventId = apt.google_event_id;
    let htmlLink = apt.google_html_link;

    if (googleEventId) {
      try {
        const res = await calendar.events.update({
          calendarId,
          eventId: googleEventId,
          requestBody: eventBody,
        });
        htmlLink = res.data.htmlLink || null;
      } catch {
        // Se o evento não existir mais no Google, cria um novo
        const res = await calendar.events.insert({
          calendarId,
          requestBody: eventBody,
        });
        googleEventId = res.data.id || null;
        htmlLink = res.data.htmlLink || null;
      }
    } else {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      });
      googleEventId = res.data.id || null;
      htmlLink = res.data.htmlLink || null;
    }

    await supabase
      .from("appointments")
      .update({
        google_event_id: googleEventId,
        google_html_link: htmlLink,
        synced_with_google: true,
      })
      .eq("id", appointmentId);

    return { success: true, message: "Sincronizado com sucesso" };
  } catch (error) {
    console.error("Erro ao sincronizar agendamento com Google Calendar:", error);
    await supabase.from("appointments").update({ synced_with_google: false }).eq("id", appointmentId);
    return { success: false, message: (error as Error).message || "Erro na API do Google" };
  }
}

/**
 * Remove um evento do Google Calendar quando o agendamento é excluído
 */
export async function deleteAppointmentFromGoogle(userId: string, googleEventId: string) {
  if (!googleEventId) return { success: true };
  const { client } = await getAuthenticatedOAuthClient(userId);
  if (!client) return { success: false, message: "Google não conectado" };

  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir evento do Google Calendar:", error);
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Realiza a sincronização bidirecional completa (envia locais e importa novos do Google)
 */
export async function performFullSync(userId: string) {
  const supabase = await createClient();
  if (!supabase) return { success: false, sent: 0, imported: 0, errors: 1, message: "Supabase indisponível" };

  const { client, status, message: authMsg } = await getAuthenticatedOAuthClient(userId);
  if (!client) {
    return { success: false, sent: 0, imported: 0, errors: 1, message: authMsg };
  }

  let sent = 0;
  let imported = 0;
  let errors = 0;

  try {
    // 1. Envia agendamentos locais não sincronizados
    const { data: localUnsynced } = await supabase
      .from("appointments")
      .select("id")
      .or("synced_with_google.is.null,synced_with_google.eq.false");

    if (localUnsynced && localUnsynced.length > 0) {
      for (const item of localUnsynced) {
        const res = await syncSingleAppointmentToGoogle(userId, item.id);
        if (res.success) sent++;
        else errors++;
      }
    }

    // 2. Importa eventos novos do Google Calendar ("primary") para o Supabase
    const calendar = google.calendar({ version: "v3", auth: client });
    const nowISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // últimos 30 dias
    const eventsRes = await calendar.events.list({
      calendarId: "primary",
      timeMin: nowISO,
      singleEvents: true,
      orderBy: "startTime",
    });

    const googleEvents = eventsRes.data.items || [];
    
    // Busca clientes existentes para fazer o match pelo nome se necessário
    const { data: clients } = await supabase.from("pacientes").select("id, nome");
    const defaultClientId = clients && clients.length > 0 ? clients[0].id : null;

    for (const ev of googleEvents) {
      if (!ev.id || !ev.start?.dateTime || !ev.summary) continue;

      // Verifica se já existe no Supabase por google_event_id
      const { data: existingApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("google_event_id", ev.id)
        .maybeSingle();

      if (!existingApt && defaultClientId) {
        // Extrai data e horário
        const startDt = new Date(ev.start.dateTime);
        const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startDt.getTime() + 3600000);

        const dataStr = startDt.toISOString().split("T")[0];
        const startHorario = startDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const endHorario = endDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        // Insere no Supabase como evento importado
        const { error: insErr } = await supabase.from("appointments").insert({
          client_id: defaultClientId,
          data: dataStr,
          horario_inicio: startHorario,
          horario_fim: endHorario,
          procedimento: ev.summary,
          observacoes: ev.description || "Importado do Google Calendar",
          status: "Confirmado",
          google_event_id: ev.id,
          google_html_link: ev.htmlLink || null,
          synced_with_google: true,
        });

        if (!insErr) imported++;
        else errors++;
      }
    }

    return {
      success: true,
      sent,
      imported,
      errors,
      message: `Sincronização concluída: ${sent} enviados, ${imported} importados, ${errors} erros.`,
    };
  } catch (error) {
    console.error("Erro na sincronização bidirecional:", error);
    return { success: false, sent, imported, errors: errors + 1, message: (error as Error).message || "Erro na sincronização" };
  }
}
