import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getGoogleCalendarCredentials } from "@/lib/google-calendar/calendar-service";

/**
 * Sincronização com a agenda ESPECÍFICA da Dra. Juliana Sena, usando uma
 * Conta de Serviço (sem login pessoal de ninguém).
 *
 * Variáveis de ambiente necessárias:
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL  (client_email do JSON da conta de serviço)
 *  - GOOGLE_PRIVATE_KEY            (private_key do JSON da conta de serviço)
 *  - GOOGLE_CALENDAR_ID            (ID da agenda, termina em @group.calendar.google.com)
 *
 * A agenda precisa estar compartilhada com o e-mail da conta de serviço com a
 * permissão "Fazer alterações nos eventos".
 */

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];

export type CalendarConnectionStatus = "connected" | "not_configured";

export function getServiceAccountCalendar() {
  const { calendarId, serviceAccountEmail, privateKey } = getGoogleCalendarCredentials();

  if (!calendarId || !serviceAccountEmail || !privateKey) {
    return {
      calendar: null,
      calendarId,
      status: "not_configured" as const,
      message:
        "Google Agenda não configurado: defina GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY.",
    };
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, ""),
    scopes: CALENDAR_SCOPES,
  });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    calendarId,
    status: "connected" as const,
    message: "Sincronizado",
  };
}

/**
 * Sincroniza um agendamento individual para a agenda da Dra. Juliana (criação ou atualização)
 */
export async function syncSingleAppointmentToGoogle(appointmentId: string) {
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

  const { calendar, calendarId, message: configMsg } = getServiceAccountCalendar();
  if (!calendar) {
    await supabase.from("appointments").update({ synced_with_google: false }).eq("id", appointmentId);
    return { success: false, message: configMsg };
  }

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
        const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
        googleEventId = res.data.id || null;
        htmlLink = res.data.htmlLink || null;
      }
    } else {
      const res = await calendar.events.insert({ calendarId, requestBody: eventBody });
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
 * Remove um evento da agenda da Dra. Juliana quando o agendamento é excluído
 */
export async function deleteAppointmentFromGoogle(googleEventId: string) {
  if (!googleEventId) return { success: true };
  const { calendar, calendarId, message } = getServiceAccountCalendar();
  if (!calendar) return { success: false, message };

  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
    return { success: true };
  } catch (error) {
    console.error("Erro ao excluir evento do Google Calendar:", error);
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Realiza a sincronização bidirecional completa (envia locais e importa novos da agenda)
 */
export async function performFullSync() {
  const supabase = await createClient();
  if (!supabase) return { success: false, sent: 0, imported: 0, errors: 1, message: "Supabase indisponível" };

  const { calendar, calendarId, message: configMsg } = getServiceAccountCalendar();
  if (!calendar) {
    return { success: false, sent: 0, imported: 0, errors: 1, message: configMsg };
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
        const res = await syncSingleAppointmentToGoogle(item.id);
        if (res.success) sent++;
        else errors++;
      }
    }

    // 2. Importa eventos novos da agenda da Dra. Juliana para o Supabase
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // últimos 30 dias
    const eventsRes = await calendar.events.list({
      calendarId,
      timeMin,
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
        const startDt = new Date(ev.start.dateTime);
        const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startDt.getTime() + 3600000);

        // Data no fuso de São Paulo (evita virar o dia por causa do UTC)
        const dataStr = startDt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const startHorario = startDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const endHorario = endDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

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
