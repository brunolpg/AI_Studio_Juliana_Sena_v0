import type { AppointmentInput } from "@/types/appointment";
import crypto from "crypto";

export interface GoogleCalendarApiEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  startTimeLocal?: string;
  endTimeLocal?: string;
}

import {
  generateGoogleCalendarTemplateUrl,
  type GoogleCalendarEventInput,
} from "./calendar-url";

export {
  generateGoogleCalendarTemplateUrl,
  type GoogleCalendarEventInput,
};

export interface GoogleCalendarEventResult {
  success: boolean;
  eventId: string | null;
  htmlLink: string | null;
  synced: boolean;
  isFallback: boolean;
  message: string;
}

export function getGoogleCalendarCredentials() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID || "";
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY || "";
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN || "";
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

  return {
    calendarId,
    apiKey,
    clientId,
    refreshToken,
    serviceAccountEmail,
    privateKey,
    isConfigured: Boolean(calendarId && (apiKey || clientId || (serviceAccountEmail && privateKey))),
  };
}

function toIsoDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00-03:00`;
}

function formatToBrasiliaTime(dateTimeStr?: string, dateStr?: string, defaultTime: string = "00:00"): string {
  if (dateTimeStr) {
    try {
      const date = new Date(dateTimeStr);
      const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      return formatter.format(date);
    } catch (e) {
      console.error("Error formatting date-time:", e);
    }
  }
  return defaultTime;
}


async function refreshGoogleOAuthToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.warn("[Google Calendar] Falha ao renovar token OAuth: GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET ausentes.");
      return null;
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    }
    const errText = await res.text().catch(() => res.statusText);
    console.error(`[Google Calendar] Falha na renovação do refresh token: ${res.status}. Motivo: ${errText}`);
    return null;
  } catch (err) {
    console.error("[Google Calendar] Erro ao renovar token OAuth:", err);
    return null;
  }
}

/**
 * Gera um token de acesso para a conta de serviço Google assinado com RSA-SHA256
 */
async function getServiceAccountToken(email: string, privateKey: string): Promise<string | null> {
  try {
    const formattedKey = privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
    
    // Header
    const header = {
      alg: "RS256",
      typ: "JWT"
    };
    
    // Claim set
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };
    
    const base64UrlEncode = (str: string) => {
      return Buffer.from(str)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
    };
    
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
    
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
    
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signatureInput);
    const signature = signer.sign(formattedKey, "base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
      
    const jwt = `${signatureInput}.${signature}`;
    
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    } else {
      const errorText = await res.text().catch(() => res.statusText);
      console.error("[Google Calendar] Falha na troca do token de Conta de Serviço:", res.status, errorText);
      return null;
    }
  } catch (err) {
    console.error("[Google Calendar] Exceção na geração do token da Conta de Serviço:", err);
    return null;
  }
}

/**
 * Obtém um token de acesso ativo (por Conta de Serviço ou Refresh Token OAuth)
 */
export async function getGoogleCalendarAccessToken(): Promise<string | null> {
  const creds = getGoogleCalendarCredentials();
  
  if (creds.serviceAccountEmail && creds.privateKey) {
    console.log("[Google Calendar] Usando conta de serviço para autenticação...");
    return await getServiceAccountToken(creds.serviceAccountEmail, creds.privateKey);
  }
  
  if (creds.refreshToken) {
    console.log("[Google Calendar] Usando refresh token para autenticação...");
    return await refreshGoogleOAuthToken(creds.refreshToken);
  }

  // Consulta tokens OAuth na tabela google_tokens do Supabase
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    if (supabase) {
      const { data: tokenRow } = await supabase
        .from("google_tokens")
        .select("access_token, refresh_token, expiry_date, calendar_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenRow) {
        if (tokenRow.access_token && tokenRow.expiry_date && Number(tokenRow.expiry_date) > Date.now() + 60000) {
          return tokenRow.access_token;
        }
        if (tokenRow.refresh_token) {
          const refreshed = await refreshGoogleOAuthToken(tokenRow.refresh_token);
          if (refreshed) {
            await supabase
              .from("google_tokens")
              .update({
                access_token: refreshed,
                expiry_date: Date.now() + 3600 * 1000,
                updated_at: new Date().toISOString(),
              })
              .eq("refresh_token", tokenRow.refresh_token);
            return refreshed;
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Google Calendar] Aviso ao consultar google_tokens:", err);
  }
  
  return null;
}

export async function listGoogleCalendarEventsForDate(
  dateStr: string
): Promise<{ events: GoogleCalendarApiEvent[]; isConfigured: boolean }> {
  const creds = getGoogleCalendarCredentials();
  const accessToken = await getGoogleCalendarAccessToken();
  const calendarId = creds.calendarId || "primary";

  if (!creds.isConfigured && !accessToken) {
    return { events: [], isConfigured: false };
  }
  try {
    const timeMin = `${dateStr}T00:00:00-03:00`;
    const timeMax = `${dateStr}T23:59:59-03:00`;
    
    let res: Response;

    if (accessToken) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      );
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
      
      res = await fetch(url.toString(), {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        next: { revalidate: 30 },
      });
    } else {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events`
      );
      url.searchParams.set("key", creds.apiKey);
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");

      res = await fetch(url.toString(), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 30 },
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      console.warn(`[Google Calendar] Falha na consulta de eventos (Status ${res.status}): ${errorText}`);
      return { events: [], isConfigured: true };
    }
    const data = await res.json();
    const items: GoogleCalendarApiEvent[] = data.items || [];

    const processedEvents = items.map((evt) => {
      let startTimeLocal = "00:00";
      let endTimeLocal = "23:59";

      if (evt.start?.dateTime) {
        startTimeLocal = formatToBrasiliaTime(evt.start.dateTime, undefined, "00:00");
      } else if (evt.start?.date) {
        startTimeLocal = "00:00";
      }

      if (evt.end?.dateTime) {
        endTimeLocal = formatToBrasiliaTime(evt.end.dateTime, undefined, "23:59");
      } else if (evt.end?.date) {
        endTimeLocal = "23:59";
      }

      return {
        ...evt,
        startTimeLocal,
        endTimeLocal,
      };
    });

    return { events: processedEvents, isConfigured: true };
  } catch (error) {
    console.error("[Google Calendar] Erro ao consultar eventos:", error);
    return { events: [], isConfigured: true };
  }
}

/**
 * Criação de evento na Google Calendar API.
 * Correção crítica: synced é TRUE APENAS se a API retornar status 200/201 E um event.id válido.
 * Se houver falha, erro de rede ou token expirado, synced permanece FALSE e o erro é registrado detalhadamente.
 */
export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const creds = getGoogleCalendarCredentials();
  let directLink: string | null = null;
  try {
    directLink = generateGoogleCalendarTemplateUrl(input);
  } catch (urlErr) {
    console.warn("[Google Calendar] Falha não-bloqueante ao gerar directLink de template:", urlErr);
  }

  if (!creds.isConfigured) {
    console.warn("[Google Calendar] API não configurada. Sincronização automática não realizada (synced: false).");
    return {
      success: true,
      eventId: null,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: "Agendamento registrado. Google Calendar não configurado para sincronização automática.",
    };
  }

  try {
    const summary = `Consulta: ${input.procedimento} - ${input.patientName}`;
    const description = [
      `Paciente: ${input.patientName}`,
      `Telefone: ${input.patientPhone || "Não informado"}`,
      `E-mail: ${input.patientEmail || "Não informado"}`,
      `Procedimento: ${input.procedimento}`,
      input.observacoes ? `Observações: ${input.observacoes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const eventPayload: any = {
      summary,
      description,
      start: {
        dateTime: toIsoDateTime(input.date, input.startTime),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: toIsoDateTime(input.date, input.endTime),
        timeZone: "America/Sao_Paulo",
      },
    };

    // Obter token de acesso válido (Service Account ou Refresh Token OAuth)
    const accessToken = await getGoogleCalendarAccessToken();
    
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      creds.calendarId
    )}/events`;
    if (!accessToken) {
      url += `?key=${creds.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        console.log(`[Google Calendar] Evento criado com sucesso. ID: ${data.id}`);
        return {
          success: true,
          eventId: data.id,
          htmlLink: data.htmlLink || directLink,
          synced: true, // Confirmado sucesso na API
          isFallback: false,
          message: "Evento sincronizado com sucesso na Google Calendar API.",
        };
      }
    }

    const errorDetails = await res.text().catch(() => res.statusText);
    console.error(`[Google Calendar] FALHA NA SINCRONIZAÇÃO. Status: ${res.status}. Motivo: ${errorDetails}`);
    return {
      success: false,
      eventId: null,
      htmlLink: directLink,
      synced: false, // Mantido estritamente false na falha
      isFallback: true,
      message: `Falha na API do Google Calendar (Status ${res.status}): ${errorDetails}`,
    };
  } catch (error) {
    console.error("[Google Calendar] EXCEÇÃO CRÍTICA AO CRIAR EVENTO:", error);
    return {
      success: false,
      eventId: null,
      htmlLink: directLink,
      synced: false, // Mantido estritamente false na exceção
      isFallback: true,
      message: `Erro de rede ou exceção ao sincronizar: ${(error as Error).message}`,
    };
  }
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const creds = getGoogleCalendarCredentials();
  if (!creds.isConfigured || !eventId || eventId.startsWith("cal_")) {
    return true;
  }
  try {
    const accessToken = await getGoogleCalendarAccessToken();
    let res: Response;

    if (accessToken) {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        creds.calendarId
      )}/events/${encodeURIComponent(eventId)}`;
      res = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } else {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        creds.calendarId
      )}/events/${encodeURIComponent(eventId)}?key=${creds.apiKey}`;
      res = await fetch(url, { method: "DELETE" });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      console.warn(`[Google Calendar] Falha ao excluir evento no Google Agenda (Status ${res.status}): ${errorText}`);
    }
    return res.ok || res.status === 404;
  } catch (error) {
    console.warn("[Google Calendar] Exceção ao excluir evento no Google Agenda:", error);
    return false;
  }
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const creds = getGoogleCalendarCredentials();
  let directLink: string | null = null;
  try {
    directLink = generateGoogleCalendarTemplateUrl(input);
  } catch (urlErr) {
    console.warn("[Google Calendar] Falha não-bloqueante ao gerar directLink de template em update:", urlErr);
  }

  if (!creds.isConfigured || !eventId || eventId.startsWith("cal_")) {
    return {
      success: true,
      eventId: eventId || null,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: "Atualização registrada sem sincronização automática com API.",
    };
  }

  try {
    const summary = `Consulta: ${input.procedimento} - ${input.patientName}`;
    const description = [
      `Paciente: ${input.patientName}`,
      `Telefone: ${input.patientPhone || "Não informado"}`,
      `E-mail: ${input.patientEmail || "Não informado"}`,
      `Procedimento: ${input.procedimento}`,
      input.observacoes ? `Observações: ${input.observacoes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const eventPayload: any = {
      summary,
      description,
      start: {
        dateTime: toIsoDateTime(input.date, input.startTime),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: toIsoDateTime(input.date, input.endTime),
        timeZone: "America/Sao_Paulo",
      },
    };

    const accessToken = await getGoogleCalendarAccessToken();
    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      creds.calendarId
    )}/events/${encodeURIComponent(eventId)}`;
    if (!accessToken) {
      url += `?key=${creds.apiKey}`;
    }

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(eventPayload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return {
          success: true,
          eventId: data.id,
          htmlLink: data.htmlLink || directLink,
          synced: true,
          isFallback: false,
          message: "Evento atualizado com sucesso no Google Agenda.",
        };
      }
    }

    const errorDetails = await res.text().catch(() => res.statusText);
    console.error(`[Google Calendar] FALHA NA ATUALIZAÇÃO DO EVENTO. Status: ${res.status}. Motivo: ${errorDetails}`);
    return {
      success: false,
      eventId,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: `Falha ao atualizar no Google Calendar: ${errorDetails}`,
    };
  } catch (error) {
    console.error("[Google Calendar] EXCEÇÃO AO ATUALIZAR EVENTO:", error);
    return {
      success: false,
      eventId,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: `Erro ao atualizar evento: ${(error as Error).message}`,
    };
  }
}
