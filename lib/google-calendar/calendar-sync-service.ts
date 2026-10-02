import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getGoogleCalendarCredentials } from "@/lib/google-calendar/calendar-service";

/**
 * Sincronização com a agenda ESPECÍFICA da Dra. Juliana Sena, usando uma
 * Conta de Serviço (sem login pessoal de ninguém).
 *
 * Variáveis de ambiente necessárias:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL (client_email do JSON da conta de serviço)
 * - GOOGLE_PRIVATE_KEY           (private_key do JSON da conta de serviço)
 * - GOOGLE_CALENDAR_ID           (ID da agenda, termina em @group.calendar.google.com)
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
 * Inclui o e-mail do paciente nos convidados (attendees) e envia notificação.
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
  const patientEmail = apt.pacientes?.email;
  const summary = `Consulta: ${patientName} - ${apt.procedimento}`;
  const description = `Paciente: ${patientName}\nTelefone: ${apt.pacientes?.telefone || "N/A"}\nE-mail: ${patientEmail || "N/A"}\nProcedimento: ${apt.procedimento}\nObservações: ${apt.observacoes || "Nenhuma"}`;

  const eventBody: any = {
    summary,
    description,
    start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
    end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
  };

  // Inclui o paciente como convidado do evento caso possua e-mail cadastrado
  if (patientEmail) {
    eventBody.attendees = [{ email: patientEmail, displayName: patientName }];
  }

  try {
    let googleEventId = apt.google_event_id;
    let htmlLink = apt.google_html_link;

    const callInsertOrUpdate = async (body: any) => {
      if (googleEventId) {
        try {
          const res = await calendar.events.update({
            calendarId,
            eventId: googleEventId,
            requestBody: body,
            sendUpdates: "all",
          });
          return { eventId: googleEventId, htmlLink: res.data.htmlLink || null };
        } catch (updateErr: any) {
          // Se o evento não existir mais no Google, tenta inserir novo
          const isNotFound = updateErr?.code === 404 || updateErr?.status === 404 || updateErr?.message?.includes("Not Found");
          if (isNotFound) {
            const res = await calendar.events.insert({
              calendarId,
              requestBody: body,
              sendUpdates: "all",
            });
            return { eventId: res.data.id || null, htmlLink: res.data.htmlLink || null };
          }
          throw updateErr;
        }
      } else {
        const res = await calendar.events.insert({
          calendarId,
          requestBody: body,
          sendUpdates: "all",
        });
        return { eventId: res.data.id || null, htmlLink: res.data.htmlLink || null };
      }
    };

    try {
      const result = await callInsertOrUpdate(eventBody);
      googleEventId = result.eventId;
      htmlLink = result.htmlLink;
    } catch (apiErr: any) {
      const errMessage = apiErr?.message || String(apiErr);
      const errCode = apiErr?.code || apiErr?.status;
      const isForbiddenServiceAccount =
        errCode === 403 ||
        errMessage.includes("forbiddenForServiceAccounts") ||
        errMessage.includes("403") ||
        errMessage.includes("Forbidden");

      if (eventBody.attendees && isForbiddenServiceAccount) {
        console.warn("[Google Calendar] Conta de serviço sem permissão para adicionar attendees (403 forbiddenForServiceAccounts). Tentando sem attendees...");
        const fallbackBody = { ...eventBody };
        delete fallbackBody.attendees;
        const fallbackResult = await callInsertOrUpdate(fallbackBody);
        googleEventId = fallbackResult.eventId;
        htmlLink = fallbackResult.htmlLink;
      } else {
        throw apiErr;
      }
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
 * Realiza a sincronização bidirecional completa:
 * 1. Envia agendamentos locais para a agenda.
 * 2. Importa eventos da agenda para o Supabase SOMENTE se a descrição contiver o nome
 *    de um paciente já cadastrado no banco de dados.
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
  let cancelled = 0;
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

    // 2. Importa eventos novos e verifica cancelamentos/exclusões da agenda da Dra. Juliana para o Supabase
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // últimos 30 dias
    const eventsRes = await calendar.events.list({
      calendarId,
      timeMin,
      singleEvents: true,
      showDeleted: true,
      orderBy: "startTime",
    });

    const googleEvents = eventsRes.data.items || [];
    const activeGoogleEventIds = new Set<string>();

    // Busca todos os pacientes existentes para construir o índice de comparação por nome
    const { data: clients } = await supabase.from("pacientes").select("id, nome");

    const patientMap = new Map<string, string>();
    if (clients) {
      clients.forEach((client) => {
        // Normaliza removendo acentos e espaços extras para garantir a correspondência
        const normalizedName = client.nome
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
        patientMap.set(normalizedName, client.id);
      });
    }

    for (const ev of googleEvents) {
      if (!ev.id) continue;

      // Se o evento foi cancelado/excluído no Google Calendar
      if (ev.status === "cancelled") {
        const { error: cancelErr } = await supabase
          .from("appointments")
          .update({
            status: "Cancelado",
            updated_at: new Date().toISOString(),
          })
          .eq("google_event_id", ev.id)
          .neq("status", "Cancelado");

        if (!cancelErr) {
          cancelled++;
          console.log(`[Google Sync] Evento ${ev.id} marcado como 'Cancelado' no Supabase (cancelado no Google Calendar).`);
        }
        continue;
      }

      // Registra ID como evento ativo
      activeGoogleEventIds.add(ev.id);

      if (!ev.start?.dateTime || !ev.summary) continue;

      // Verifica se o evento já existe registrado no banco
      const { data: existingApt } = await supabase
        .from("appointments")
        .select("id")
        .eq("google_event_id", ev.id)
        .maybeSingle();

      if (!existingApt) {
        let foundClientId: string | null = null;

        // Procura pelo padrão "Paciente: [Nome]" na descrição do evento
        if (ev.description) {
          const match = ev.description.match(/Paciente:\s*(.+?)(?:\r?\n|$)/i);
          if (match && match[1]) {
            const extractedName = match[1]
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .trim()
              .toLowerCase();
            foundClientId = patientMap.get(extractedName) || null;
          }
        }

        // Importa apenas se o paciente foi identificado e existe no banco de dados
        if (foundClientId) {
          const startDt = new Date(ev.start.dateTime);
          const endDt = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(startDt.getTime() + 3600000);

          // Data e horários preservando o fuso de São Paulo
          const dataStr = startDt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
          const startHorario = startDt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
          const endHorario = endDt.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });

          const { error: insErr } = await supabase.from("appointments").insert({
            client_id: foundClientId,
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
    }

    // 3. Tratamento de agendamentos futuros no Supabase com google_event_id preenchido cujo ID não consta mais na lista ativa do Google Calendar
    const { data: localSyncedApts } = await supabase
      .from("appointments")
      .select("id, google_event_id, status, data")
      .not("google_event_id", "is", null)
      .neq("status", "Cancelado")
      .gte("data", timeMin.split("T")[0]);

    if (localSyncedApts && localSyncedApts.length > 0) {
      for (const apt of localSyncedApts) {
        if (apt.google_event_id && !activeGoogleEventIds.has(apt.google_event_id)) {
          const { error: missingErr } = await supabase
            .from("appointments")
            .update({
              status: "Cancelado",
              updated_at: new Date().toISOString(),
            })
            .eq("id", apt.id);

          if (!missingErr) {
            cancelled++;
            console.log(`[Google Sync] Agendamento local ${apt.id} (Google ID: ${apt.google_event_id}) marcado como 'Cancelado' por ausência na agenda ativa do Google.`);
          }
        }
      }
    }

    return {
      success: true,
      sent,
      imported,
      cancelled,
      errors,
      message: `Sincronização concluída: ${sent} enviados, ${imported} importados, ${cancelled} cancelados, ${errors} erros.`,
    };
  } catch (error) {
    console.error("Erro na sincronização bidirecional:", error);
    return {
      success: false,
      sent,
      imported,
      cancelled,
      errors: errors + 1,
      message: (error as Error).message || "Erro na sincronização",
    };
  }
}