import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import {
  getGoogleCalendarCredentials,
  listGoogleCalendarEventsForDate,
  createGoogleCalendarEvent,
} from "@/lib/google-calendar/calendar-service";
import { deleteAppointmentFromGoogle } from "@/lib/google-calendar/calendar-sync-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const creds = getGoogleCalendarCredentials();

  if (date) {
    const result = await listGoogleCalendarEventsForDate(date);
    return NextResponse.json({
      configured: creds.isConfigured,
      hasServiceAccount: creds.hasServiceAccount,
      calendarId: creds.calendarId,
      events: result.events,
      error: result.error,
    });
  }

  return NextResponse.json({
    configured: creds.isConfigured,
    hasServiceAccount: creds.hasServiceAccount,
    serviceAccountEmail: creds.maskedEmail,
    calendarId: creds.calendarId,
    hasClientId: Boolean(creds.clientId),
    hasApiKey: Boolean(creds.apiKey),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createGoogleCalendarEvent(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API Calendar POST Server Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Erro ao processar integração com Google Agenda.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) {
      return NextResponse.json(
        { success: false, message: "Parâmetro eventId ausente." },
        { status: 400 }
      );
    }
    const result = await deleteAppointmentFromGoogle(eventId);
    if (!result.success) {
      console.warn(`[Google Calendar API DELETE] Aviso ao excluir evento ${eventId}:`, result.message);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.warn("[Google Calendar API DELETE] Erro 404 ou falha ao excluir evento:", error);
    return NextResponse.json({ success: true, message: "Fluxo prosseguido apesar do aviso no Google Agenda." });
  }
}
