/**
 * Serviço de Integração com a Google Calendar API (v3)
 * Executado estritamente no lado do servidor (Node.js / Server Actions / Route Handlers)
 * utilizando a biblioteca oficial 'googleapis' e autenticação via Service Account (JWT).
 * 
 * Inclui sanitização robusta de chaves privadas (quebras de linha \n, aspas, base64),
 * tratamento de erros com feedback visual amigável e contingência graciosa.
 */

import { google } from "googleapis";

export interface GoogleCalendarEventInput {
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  procedimento: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "14:00"
  endTime: string; // "15:00"
  observacoes?: string | null;
}

export interface GoogleCalendarEventResult {
  success: boolean;
  eventId: string | null;
  htmlLink: string | null;
  synced: boolean;
  isFallback: boolean;
  message: string;
  errorDetails?: string;
}

export interface GoogleCalendarApiEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Sanitiza a chave privada da Service Account do Google, tratando:
 * - Quebras de linha literais (\n escapados em string)
 * - Aspas simples ou duplas ao redor do valor
 * - Chaves codificadas em base64
 * - Espaços e caracteres invisíveis nas extremidades
 */
export function sanitizePrivateKey(rawKey?: string): string {
  if (!rawKey) return "";
  let key = rawKey.trim();

  // 1. Remove aspas simples ou duplas que envolvem a string
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.substring(1, key.length - 1).trim();
  }

  // 2. Se a chave estiver codificada em base64 (sem marcadores BEGIN/END), decodifica
  if (
    !key.includes("BEGIN") &&
    (key.startsWith("LS0t") || key.length > 200)
  ) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf-8");
      if (decoded.includes("PRIVATE KEY")) {
        key = decoded.trim();
      }
    } catch {
      // Se falhar a decodificação base64, segue com a chave original
    }
  }

  // 3. Converte \n literais para quebras de linha reais
  key = key.replace(/\\n/g, "\n");

  // 4. Garante que termine com nova linha para parsing estrito do OpenSSL
  if (!key.endsWith("\n")) {
    key += "\n";
  }

  return key;
}

/**
 * Mascara strings sensíveis como e-mail de service account para logs e status público
 */
function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "";
  const [user, domain] = email.split("@");
  const visible = user.length > 3 ? user.substring(0, 3) + "***" : user + "***";
  return `${visible}@${domain}`;
}

/**
 * Retorna as credenciais configuradas e sanitizadas no ambiente do servidor
 */
export function getGoogleCalendarCredentials() {
  const serviceAccountEmail = (
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT ||
    ""
  ).trim();

  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const privateKey = sanitizePrivateKey(rawPrivateKey);

  let calendarId = (
    process.env.GOOGLE_CALENDAR_ID ||
    process.env.GOOGLE_CALENDAR_EMAIL ||
    "primary"
  ).trim();

  // Remove aspas se houver
  if (
    (calendarId.startsWith('"') && calendarId.endsWith('"')) ||
    (calendarId.startsWith("'") && calendarId.endsWith("'"))
  ) {
    calendarId = calendarId.substring(1, calendarId.length - 1).trim();
  }
  if (!calendarId) {
    calendarId = "primary";
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const apiKey = (process.env.GOOGLE_API_KEY || "").trim();

  const hasServiceAccount = Boolean(
    serviceAccountEmail &&
    serviceAccountEmail.includes("@") &&
    privateKey &&
    privateKey.includes("PRIVATE KEY")
  );

  const isConfigured = hasServiceAccount || Boolean(apiKey && apiKey.length > 5);

  return {
    serviceAccountEmail,
    maskedEmail: maskEmail(serviceAccountEmail),
    privateKey,
    calendarId,
    clientId,
    apiKey,
    hasServiceAccount,
    isConfigured,
  };
}

/**
 * Instancia o cliente oficial da Google Calendar API (v3) autenticado via JWT de Service Account
 */
function getCalendarClient() {
  const creds = getGoogleCalendarCredentials();
  if (!creds.hasServiceAccount) {
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email: creds.serviceAccountEmail,
      key: creds.privateKey,
      scopes: [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    });

    return google.calendar({ version: "v3", auth });
  } catch (error) {
    console.error("[Google Calendar Server Error] Falha ao instanciar google.auth.JWT:", error);
    return null;
  }
}

/**
 * Converte data e hora para formato ISO 8601 com timezone de Brasília (-03:00)
 */
function toIsoDateTime(date: string, time: string): string {
  return `${date}T${time}:00-03:00`;
}

/**
 * Converte data e hora para o formato compacto do Google Calendar Template URL: YYYYMMDDTHHMMSSZ
 */
function toCompactUtcFormat(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  // UTC = Brasília + 3 horas
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours + 3, minutes, 0));
  return utcDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Gera um link universal direto para adicionar/abrir no Google Agenda (Web)
 * Funciona imediatamente sem depender de autenticação do servidor
 */
export function generateGoogleCalendarTemplateUrl(input: GoogleCalendarEventInput): string {
  const summary = `Consulta: ${input.procedimento} - ${input.patientName}`;
  const startCompact = toCompactUtcFormat(input.date, input.startTime);
  const endCompact = toCompactUtcFormat(input.date, input.endTime);
  const details = [
    `Paciente: ${input.patientName}`,
    `Procedimento: ${input.procedimento}`,
    input.patientPhone ? `Telefone / WhatsApp: ${input.patientPhone}` : "",
    input.patientEmail ? `E-mail: ${input.patientEmail}` : "",
    input.observacoes ? `Observações Clínicas: ${input.observacoes}` : "",
    "",
    "Agendado pelo Sistema Dra. Juliana Sena - Gestão de Pacientes",
  ]
    .filter(Boolean)
    .join("\n");

  const location = "Consultório Dra. Juliana Sena - São Paulo/SP";

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    summary
  )}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    location
  )}`;
}

/**
 * Consulta eventos do Google Agenda para uma data específica (para detecção de conflitos de horário na grade)
 */
export async function listGoogleCalendarEventsForDate(
  dateStr: string
): Promise<{ events: GoogleCalendarApiEvent[]; isConfigured: boolean; error?: string }> {
  const creds = getGoogleCalendarCredentials();

  if (!creds.hasServiceAccount) {
    return { events: [], isConfigured: false };
  }

  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      return { events: [], isConfigured: false };
    }

    const timeMin = `${dateStr}T00:00:00-03:00`;
    const timeMax = `${dateStr}T23:59:59-03:00`;

    const response = await calendar.events.list({
      calendarId: creds.calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items: GoogleCalendarApiEvent[] = (response.data.items || []).map((item) => ({
      id: item.id || "",
      summary: item.summary || "Google Agenda",
      start: {
        dateTime: item.start?.dateTime || undefined,
        date: item.start?.date || undefined,
      },
      end: {
        dateTime: item.end?.dateTime || undefined,
        date: item.end?.date || undefined,
      },
    }));

    return { events: items, isConfigured: true };
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: unknown; status?: number } };
    console.error("[Google Calendar Server Error] Erro ao consultar eventos da agenda:", {
      dateStr,
      calendarId: creds.calendarId,
      message: err?.message,
      status: err?.response?.status,
    });
    return { events: [], isConfigured: true, error: err?.message };
  }
}

/**
 * Cria um evento diretamente na Google Calendar API (v3) da profissional através de Service Account.
 * Se a API for bem-sucedida, retorna o google_event_id e htmlLink com status sincronizado.
 * Se ocorrer erro de autenticação ou permissão, registra no console do servidor e gera contingência
 * com link direto amigável sem travar o cadastro.
 */
export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const creds = getGoogleCalendarCredentials();
  const directLink = generateGoogleCalendarTemplateUrl(input);

  // 1. Se a Service Account não estiver configurada no .env
  if (!creds.hasServiceAccount) {
    console.warn(
      "[Google Calendar Server] GOOGLE_SERVICE_ACCOUNT_EMAIL e/ou GOOGLE_PRIVATE_KEY não configuradas. Gerando link de agendamento resiliente."
    );
    return {
      success: true,
      eventId: null,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message:
        "Agendamento registrado no sistema. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY no ambiente para sincronização direta na agenda.",
    };
  }

  // 2. Executa a criação oficial via Service Account
  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      throw new Error("Cliente oficial do Google Calendar não pôde ser instanciado.");
    }

    const summary = `Consulta: ${input.procedimento} - ${input.patientName}`;
    const description = [
      `Paciente: ${input.patientName}`,
      input.patientPhone ? `Telefone / WhatsApp: ${input.patientPhone}` : "",
      input.patientEmail ? `E-mail: ${input.patientEmail}` : "",
      `Procedimento: ${input.procedimento}`,
      input.observacoes ? `Observações Clínicas: ${input.observacoes}` : "",
      "",
      "--------------------------------------------------",
      "Agendamento criado via Sistema Dra. Juliana Sena - Gestão de Pacientes",
    ]
      .filter(Boolean)
      .join("\n");

    const startDateTime = toIsoDateTime(input.date, input.startTime);
    const endDateTime = toIsoDateTime(input.date, input.endTime);

    const attendees = input.patientEmail
      ? [{ email: input.patientEmail, displayName: input.patientName }]
      : undefined;

    const response = await calendar.events.insert({
      calendarId: creds.calendarId,
      sendUpdates: attendees ? "all" : "none",
      requestBody: {
        summary,
        description,
        location: "Consultório Dra. Juliana Sena - São Paulo/SP",
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 }, // Alerta por e-mail 24h antes
            { method: "popup", minutes: 60 },      // Alerta na tela 1h antes
          ],
        },
      },
    });

    const event = response.data;
    if (event.id) {
      console.log(`[Google Calendar] Evento sincronizado com sucesso na agenda (${creds.calendarId})! ID: ${event.id}`);
      return {
        success: true,
        eventId: event.id,
        htmlLink: event.htmlLink || directLink,
        synced: true,
        isFallback: false,
        message: "Evento criado e sincronizado diretamente na Google Agenda da profissional!",
      };
    }

    throw new Error("A API do Google Calendar respondeu sem ID de evento.");
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      code?: number;
      response?: { data?: { error?: { message?: string } }; status?: number };
    };

    const status = err?.response?.status;
    const apiErrMsg = err?.response?.data?.error?.message || err?.message || "Erro desconhecido";

    // Log detalhado e auditável no console do servidor
    console.error("[Google Calendar Server Error] Falha na sincronização direta:", {
      calendarId: creds.calendarId,
      serviceAccount: creds.maskedEmail,
      httpStatus: status,
      apiErrorMessage: apiErrMsg,
    });

    let friendlyMessage = "Erro ao sincronizar com o Google Calendar.";
    if (status === 404 || apiErrMsg.toLowerCase().includes("not found")) {
      friendlyMessage = `Agenda "${creds.calendarId}" não encontrada. Verifique se o ID está correto e compartilhado com a Service Account (${creds.serviceAccountEmail}).`;
    } else if (status === 403 || apiErrMsg.toLowerCase().includes("permission") || apiErrMsg.toLowerCase().includes("forbidden")) {
      friendlyMessage = `Permissão negada na agenda "${creds.calendarId}". Adicione o e-mail da Service Account (${creds.serviceAccountEmail}) nas configurações da agenda do Google com permissão de "Fazer alterações nos eventos".`;
    } else if (status === 401 || apiErrMsg.toLowerCase().includes("invalid_grant") || apiErrMsg.toLowerCase().includes("key")) {
      friendlyMessage = "Falha de autenticação da Service Account. Verifique se GOOGLE_PRIVATE_KEY está configurada corretamente no .env.local.";
    } else {
      friendlyMessage = `Falha na Google Calendar API (${apiErrMsg}). O agendamento foi salvo no sistema e um link direto foi preparado.`;
    }

    // Retorna fallback resiliente sem quebrar a operação do banco de dados
    return {
      success: true,
      eventId: null,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: friendlyMessage,
      errorDetails: friendlyMessage,
    };
  }
}

/**
 * Remove um evento na Google Calendar API (v3) ao cancelar um agendamento
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const creds = getGoogleCalendarCredentials();
  if (!creds.hasServiceAccount || !eventId || eventId.startsWith("cal_")) {
    return true;
  }

  try {
    const calendar = getCalendarClient();
    if (!calendar) return false;

    await calendar.events.delete({
      calendarId: creds.calendarId,
      eventId,
      sendUpdates: "all",
    });

    console.log(`[Google Calendar] Evento ${eventId} cancelado/removido na agenda.`);
    return true;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: unknown }; message?: string };
    // Se o evento já foi removido (404 ou 410 Gone), considera cancelamento concluído
    if (err?.response?.status === 404 || err?.response?.status === 410) {
      return true;
    }
    console.error("[Google Calendar Server Error] Erro ao excluir evento:", {
      eventId,
      status: err?.response?.status,
      message: err?.message,
    });
    return false;
  }
}

/**
 * Atualiza horário ou dados de um evento na Google Calendar API (v3)
 */
export async function updateGoogleCalendarEvent(
  eventId: string,
  input: GoogleCalendarEventInput
): Promise<GoogleCalendarEventResult> {
  const creds = getGoogleCalendarCredentials();
  const directLink = generateGoogleCalendarTemplateUrl(input);

  if (!creds.hasServiceAccount || !eventId || eventId.startsWith("cal_")) {
    return {
      success: true,
      eventId: null,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: "Horário atualizado no sistema local.",
    };
  }

  try {
    const calendar = getCalendarClient();
    if (!calendar) {
      throw new Error("Cliente Google Calendar indisponível.");
    }

    const summary = `Consulta: ${input.procedimento} - ${input.patientName}`;
    const description = [
      `Paciente: ${input.patientName}`,
      input.patientPhone ? `Telefone / WhatsApp: ${input.patientPhone}` : "",
      input.patientEmail ? `E-mail: ${input.patientEmail}` : "",
      `Procedimento: ${input.procedimento}`,
      input.observacoes ? `Observações Clínicas: ${input.observacoes}` : "",
      "",
      "--------------------------------------------------",
      "Agendamento atualizado via Sistema Dra. Juliana Sena - Gestão de Pacientes",
    ]
      .filter(Boolean)
      .join("\n");

    const startDateTime = toIsoDateTime(input.date, input.startTime);
    const endDateTime = toIsoDateTime(input.date, input.endTime);

    const response = await calendar.events.patch({
      calendarId: creds.calendarId,
      eventId,
      sendUpdates: "all",
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startDateTime,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "America/Sao_Paulo",
        },
      },
    });

    const updated = response.data;
    console.log(`[Google Calendar] Evento ${eventId} atualizado com sucesso na agenda.`);

    return {
      success: true,
      eventId: updated.id || eventId,
      htmlLink: updated.htmlLink || directLink,
      synced: true,
      isFallback: false,
      message: "Evento atualizado com sucesso no Google Agenda!",
    };
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: unknown; status?: number } };
    console.error("[Google Calendar Server Error] Erro ao atualizar evento na agenda:", {
      eventId,
      message: err?.message,
      status: err?.response?.status,
    });

    return {
      success: true,
      eventId,
      htmlLink: directLink,
      synced: false,
      isFallback: true,
      message: "Atualização salva no banco. Não foi possível sincronizar com o Google Agenda.",
      errorDetails: err?.message,
    };
  }
}
