"use server";

import { revalidatePath } from "next/cache";
import { INITIAL_APPOINTMENTS, STANDARD_TIME_SLOTS } from "@/lib/appointment-mock-data";
import {
  createGoogleCalendarEvent,
  listGoogleCalendarEventsForDate,
  generateGoogleCalendarTemplateUrl,
  getGoogleCalendarCredentials,
} from "@/lib/google-calendar/calendar-service";
import type {
  Appointment,
  AppointmentInput,
  AppointmentFilter,
  AppointmentFilterTab,
  TimeSlot,
} from "@/types/appointment";
import type { ActionResponse, PaginatedResult } from "@/types/client";

// Armazenamento em memória para demonstração / runtime
let memoryAppointments: Appointment[] = [...INITIAL_APPOINTMENTS];

function getTodayString(): string {
  // Retorna YYYY-MM-DD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Consulta de Agendamentos com Busca, Filtros por Tab e Paginação
 */
export async function getAppointmentsAction(
  filter: AppointmentFilter = {}
): Promise<ActionResponse<PaginatedResult<Appointment>>> {
  try {
    const {
      search = "",
      tab = "todos",
      page = 1,
      pageSize = 10,
      data: dateFilter,
    } = filter;

    const todayStr = getTodayString();
    let filtered = [...memoryAppointments];

    // 1. Filtro por Abas Rápidas
    if (tab === "hoje") {
      filtered = filtered.filter((apt) => apt.data === todayStr && apt.status !== "Cancelado");
    } else if (tab === "proximos") {
      filtered = filtered.filter(
        (apt) => apt.data >= todayStr && apt.status !== "Cancelado" && apt.status !== "Concluído"
      );
    } else if (tab === "concluidos") {
      filtered = filtered.filter((apt) => apt.status === "Concluído");
    } else if (tab === "cancelados") {
      filtered = filtered.filter((apt) => apt.status === "Cancelado");
    }

    // 2. Filtro específico por data se fornecido
    if (dateFilter) {
      filtered = filtered.filter((apt) => apt.data === dateFilter);
    }

    // 3. Busca textual
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (apt) =>
          apt.client_nome.toLowerCase().includes(q) ||
          apt.client_email.toLowerCase().includes(q) ||
          apt.client_telefone.includes(q) ||
          apt.procedimento.toLowerCase().includes(q) ||
          apt.data.includes(q) ||
          apt.horario_inicio.includes(q)
      );
    }

    // 4. Ordenação: datas mais próximas primeiro
    filtered.sort((a, b) => {
      const dateTimeA = `${a.data}T${a.horario_inicio}`;
      const dateTimeB = `${b.data}T${b.horario_inicio}`;
      return dateTimeB.localeCompare(dateTimeA);
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const offset = (currentPage - 1) * pageSize;
    const paginatedData = filtered.slice(offset, offset + pageSize);

    return {
      success: true,
      data: {
        data: paginatedData,
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasMore: currentPage < totalPages,
      },
    };
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return {
      success: false,
      message: "Erro ao consultar a lista de agendamentos.",
    };
  }
}

/**
 * Consulta horários disponíveis para uma data específica (08:00 às 17:00 em intervalos de 1h)
 */
export async function getTimeSlotsForDateAction(
  dateStr: string
): Promise<ActionResponse<TimeSlot[]>> {
  try {
    // Horários ocupados no banco/memória local
    const activeAppointments = memoryAppointments.filter(
      (apt) => apt.data === dateStr && apt.status !== "Cancelado"
    );

    // Consulta na Google Calendar API se configurada
    const { events: googleEvents } = await listGoogleCalendarEventsForDate(dateStr);

    const timeSlots: TimeSlot[] = STANDARD_TIME_SLOTS.map(({ slot, endSlot, label }) => {
      // Verifica se há consulta local ativa
      const localMatch = activeAppointments.find((apt) => apt.horario_inicio === slot);
      if (localMatch) {
        return {
          slot,
          endSlot,
          label,
          isOccupied: true,
          occupiedPatientName: localMatch.client_nome,
        };
      }

      // Verifica se há evento do Google Calendar colidindo
      const slotHour = Number(slot.split(":")[0]);
      const googleMatch = googleEvents.find((evt) => {
        if (!evt.start?.dateTime) return false;
        const evtStart = new Date(evt.start.dateTime);
        const evtHour = evtStart.getHours();
        return evtHour === slotHour;
      });

      if (googleMatch) {
        return {
          slot,
          endSlot,
          label,
          isOccupied: true,
          occupiedPatientName: googleMatch.summary || "Google Agenda",
        };
      }

      return {
        slot,
        endSlot,
        label,
        isOccupied: false,
      };
    });

    return {
      success: true,
      data: timeSlots,
    };
  } catch (error) {
    console.error("Erro ao calcular time slots:", error);
    return {
      success: false,
      message: "Falha ao verificar horários disponíveis.",
    };
  }
}

/**
 * Criação de Agendamento com Conflito Check e Sincronização Google Calendar
 */
export async function createAppointmentAction(
  input: AppointmentInput
): Promise<ActionResponse<Appointment>> {
  try {
    if (!input.client_id || !input.data || !input.horario_inicio || !input.procedimento) {
      return {
        success: false,
        message: "Todos os campos obrigatórios devem ser preenchidos.",
      };
    }

    // Calcula horário fim (1 hora após o início)
    const startHour = Number(input.horario_inicio.split(":")[0]);
    const endHour = String(startHour + 1).padStart(2, "0");
    const horario_fim = `${endHour}:00`;

    // Validação de conflito de horário
    const hasConflict = memoryAppointments.some(
      (apt) =>
        apt.data === input.data &&
        apt.horario_inicio === input.horario_inicio &&
        apt.status !== "Cancelado"
    );

    if (hasConflict) {
      return {
        success: false,
        message: `O horário ${input.horario_inicio} já está reservado para outro atendimento nesta data.`,
      };
    }

    const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    let googleEventId: string | null = null;
    let googleHtmlLink: string | null = null;
    let syncedWithGoogle = false;

    // Sincronização com Google Agenda
    if (input.sync_google) {
      const gcalRes = await createGoogleCalendarEvent({
        patientName: input.client_nome,
        patientEmail: input.client_email,
        patientPhone: input.client_telefone,
        procedimento: input.procedimento,
        date: input.data,
        startTime: input.horario_inicio,
        endTime: horario_fim,
        observacoes: input.observacoes,
      });

      googleEventId = gcalRes.eventId;
      googleHtmlLink = gcalRes.htmlLink;
      syncedWithGoogle = gcalRes.synced;
    } else {
      googleHtmlLink = generateGoogleCalendarTemplateUrl({
        patientName: input.client_nome,
        patientEmail: input.client_email,
        patientPhone: input.client_telefone,
        procedimento: input.procedimento,
        date: input.data,
        startTime: input.horario_inicio,
        endTime: horario_fim,
        observacoes: input.observacoes,
      });
    }

    const newAppointment: Appointment = {
      id: appointmentId,
      client_id: input.client_id,
      client_nome: input.client_nome,
      client_email: input.client_email,
      client_telefone: input.client_telefone,
      data: input.data,
      horario_inicio: input.horario_inicio,
      horario_fim,
      procedimento: input.procedimento,
      observacoes: input.observacoes || null,
      status: "Confirmado",
      google_event_id: googleEventId,
      google_html_link: googleHtmlLink,
      synced_with_google: syncedWithGoogle,
      created_at: nowIso,
      updated_at: nowIso,
    };

    memoryAppointments.unshift(newAppointment);

    revalidatePath("/");

    return {
      success: true,
      message: "Consulta agendada com sucesso!",
      data: newAppointment,
    };
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return {
      success: false,
      message: "Ocorreu um erro interno ao salvar o agendamento.",
    };
  }
}

/**
 * Cancelar Agendamento
 */
export async function cancelAppointmentAction(
  appointmentId: string
): Promise<ActionResponse<void>> {
  try {
    const idx = memoryAppointments.findIndex((a) => a.id === appointmentId);
    if (idx === -1) {
      return {
        success: false,
        message: "Agendamento não encontrado.",
      };
    }

    memoryAppointments[idx] = {
      ...memoryAppointments[idx],
      status: "Cancelado",
      updated_at: new Date().toISOString(),
    };

    revalidatePath("/");

    return {
      success: true,
      message: "Agendamento cancelado com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao cancelar agendamento:", error);
    return {
      success: false,
      message: "Falha ao cancelar o agendamento.",
    };
  }
}

/**
 * Atualizar Horário ou Dados do Agendamento
 */
export async function updateAppointmentAction(
  appointmentId: string,
  updates: Partial<Pick<Appointment, "data" | "horario_inicio" | "procedimento" | "observacoes" | "status">>
): Promise<ActionResponse<Appointment>> {
  try {
    const idx = memoryAppointments.findIndex((a) => a.id === appointmentId);
    if (idx === -1) {
      return {
        success: false,
        message: "Agendamento não encontrado.",
      };
    }

    const current = memoryAppointments[idx];
    const targetDate = updates.data || current.data;
    const targetStart = updates.horario_inicio || current.horario_inicio;

    // Se mudou data ou hora, verifica colisão
    if (targetDate !== current.data || targetStart !== current.horario_inicio) {
      const conflict = memoryAppointments.some(
        (a) =>
          a.id !== appointmentId &&
          a.data === targetDate &&
          a.horario_inicio === targetStart &&
          a.status !== "Cancelado"
      );

      if (conflict) {
        return {
          success: false,
          message: `O horário ${targetStart} nesta data já está ocupado.`,
        };
      }
    }

    let targetEnd = current.horario_fim;
    if (updates.horario_inicio) {
      const startHour = Number(updates.horario_inicio.split(":")[0]);
      targetEnd = `${String(startHour + 1).padStart(2, "0")}:00`;
    }

    const updated: Appointment = {
      ...current,
      ...updates,
      horario_fim: targetEnd,
      updated_at: new Date().toISOString(),
    };

    memoryAppointments[idx] = updated;

    revalidatePath("/");

    return {
      success: true,
      message: "Agendamento atualizado com sucesso.",
      data: updated,
    };
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return {
      success: false,
      message: "Falha ao atualizar o agendamento.",
    };
  }
}

/**
 * Informações do status de integração com o Google Calendar
 */
export async function getCalendarIntegrationStatusAction() {
  const creds = getGoogleCalendarCredentials();
  return {
    isConfigured: creds.isConfigured,
    calendarId: creds.calendarId,
    hasApiKey: Boolean(creds.apiKey),
    hasClientId: Boolean(creds.clientId),
  };
}
