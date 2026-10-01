"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isAllowedAppointmentDay,
  getAllowedSlotsForDate,
  getAllowedStartTimesForDate,
  getDayScheduleDescription,
  getTodaySaoPauloDateString,
  type Appointment,
  type AppointmentInput,
  type AppointmentFilter,
  type TimeSlot,
} from "@/types/appointment";
import { appointmentSchema, appointmentUpdateSchema } from "@/lib/validations/appointment-schema";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  listGoogleCalendarEventsForDate,
  generateGoogleCalendarTemplateUrl,
  getGoogleCalendarCredentials,
} from "@/lib/google-calendar/calendar-service";
import type { ActionResponse, PaginatedResult } from "@/types/client";

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface RawAppointmentRow {
  id: string;
  client_id: string;
  data: string;
  horario_inicio: string;
  horario_fim: string;
  procedimento: string;
  observacoes: string | null;
  status: string;
  google_event_id: string | null;
  google_html_link: string | null;
  synced_with_google: boolean | null;
  created_at: string;
  updated_at: string;
  pacientes?: {
    id?: string;
    nome?: string;
    email?: string;
    telefone?: string;
  } | Array<{
    id?: string;
    nome?: string;
    email?: string;
    telefone?: string;
  }> | null;
}

function mapRowToAppointment(row: RawAppointmentRow): Appointment {
  const patientData = Array.isArray(row.pacientes)
    ? row.pacientes[0]
    : row.pacientes;

  return {
    id: row.id,
    client_id: row.client_id,
    client_nome: patientData?.nome || "Paciente Cadastrado",
    client_email: patientData?.email || "",
    client_telefone: patientData?.telefone || "",
    data: row.data,
    horario_inicio: row.horario_inicio,
    horario_fim: row.horario_fim,
    procedimento: row.procedimento,
    observacoes: row.observacoes || null,
    status: row.status as Appointment["status"],
    google_event_id: row.google_event_id || null,
    google_html_link: row.google_html_link || null,
    synced_with_google: Boolean(row.synced_with_google),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * 1. LISTAGEM COM BUSCA, FILTROS POR ABA E PAGINAÇÃO NO SUPABASE
 */
export async function getAppointmentsAction(
  filter: AppointmentFilter = {}
): Promise<ActionResponse<PaginatedResult<Appointment>>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Cliente Supabase não configurado. Verifique as credenciais no .env.local.",
      };
    }

    const {
      search = "",
      tab = "proximos",
      page = 1,
      pageSize = 10,
      data: dateFilter,
    } = filter;

    const todayStr = getTodayString();

    let query = supabase.from("appointments").select(
      `
        id,
        client_id,
        data,
        horario_inicio,
        horario_fim,
        procedimento,
        observacoes,
        status,
        google_event_id,
        google_html_link,
        synced_with_google,
        created_at,
        updated_at,
        pacientes (
          id,
          nome,
          email,
          telefone
        )
      `,
      { count: "exact" }
    );

    // 1. Filtros por Tab
    if (tab === "hoje") {
      query = query.eq("data", todayStr).neq("status", "Cancelado");
    } else if (tab === "proximos") {
      query = query
        .gte("data", todayStr)
        .not("status", "in", '("Cancelado","Concluído")');
    } else if (tab === "concluidos") {
      query = query.eq("status", "Concluído");
    } else if (tab === "cancelados") {
      query = query.eq("status", "Cancelado");
    }

    // 2. Filtro de data específica
    if (dateFilter) {
      query = query.eq("data", dateFilter);
    }

    // 3. Busca textual inteligente (procedimento, data ou nome/contato do paciente)
    if (search.trim()) {
      const term = search.trim();

      // Busca IDs de pacientes correspondentes para busca ampla
      const { data: matchedPatients } = await supabase
        .from("pacientes")
        .select("id")
        .or(`nome.ilike.%${term}%,email.ilike.%${term}%,telefone.ilike.%${term}%,cpf.ilike.%${term}%`);

      const patientIds = matchedPatients?.map((p) => p.id) || [];

      if (patientIds.length > 0) {
        query = query.or(
          `procedimento.ilike.%${term}%,data.ilike.%${term}%,client_id.in.(${patientIds.join(",")})`
        );
      } else {
        query = query.or(`procedimento.ilike.%${term}%,data.ilike.%${term}%`);
      }
    }

    // 4. Ordenação
    if (tab === "proximos" || tab === "hoje") {
      query = query
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true });
    } else {
      query = query
        .order("data", { ascending: false })
        .order("horario_inicio", { ascending: false });
    }

    // 5. Paginação via Range
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro Supabase getAppointmentsAction:", error);
      const isMissingTable =
        error.message?.includes("relation") || error.code === "42P01";

      return {
        success: false,
        message: isMissingTable
          ? "A tabela 'appointments' ainda não existe no seu banco de dados Supabase. Execute a migration SQL disponível na aba 'Entregáveis' no SQL Editor do Supabase."
          : `Falha ao consultar agendamentos no Supabase: ${error.message}`,
      };
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const appointments = ((data as unknown as RawAppointmentRow[]) || []).map(mapRowToAppointment);

    return {
      success: true,
      data: {
        data: appointments,
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasMore: currentPage < totalPages,
      },
    };
  } catch (error) {
    console.error("Erro inesperado ao listar agendamentos:", error);
    return {
      success: false,
      message: "Erro de conexão ao consultar a lista de agendamentos no banco de dados.",
    };
  }
}

export interface PatientSummary {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
}

/**
 * Busca pacientes ativos diretamente na tabela 'pacientes' do Supabase para agendamento.
 * Sem dados mockados: se a tabela estiver vazia, retorna lista vazia.
 */
export async function getActivePatientsForSchedulingAction(): Promise<ActionResponse<PatientSummary[]>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: true,
        data: [],
      };
    }

    const { data, error } = await supabase
      .from("pacientes")
      .select("id, nome, cpf, email, telefone")
      .is("deleted_at", null)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro ao buscar pacientes no Supabase:", error.message);
      return {
        success: false,
        message: `Falha ao carregar pacientes: ${error.message}`,
        data: [],
      };
    }

    return {
      success: true,
      data: (data as PatientSummary[]) || [],
    };
  } catch (err) {
    console.error("Erro interno ao buscar pacientes no Supabase:", err);
    return {
      success: false,
      message: "Falha ao consultar pacientes no banco de dados.",
      data: [],
    };
  }
}

/**
 * 2. CONSULTA HORÁRIOS DISPONÍVEIS NA GRADE CONFORME O DIA DA SEMANA
 * - Segundas e Quintas: 09:00 às 16:00 (último atendimento 15:00-16:00)
 * - Sábados: 13:00 às 18:00 (último atendimento 17:00-18:00)
 * - Demais dias: Sem expediente (retorna lista vazia de horários)
 */
export async function getTimeSlotsForDateAction(
  dateStr: string
): Promise<ActionResponse<TimeSlot[]>> {
  try {
    if (!dateStr || !isAllowedAppointmentDay(dateStr)) {
      const schedule = getDayScheduleDescription(dateStr);
      return {
        success: true,
        data: [],
        message: `Sem expediente na ${schedule.dayName}. Atendimentos ocorrem exclusivamente às segundas, quintas (09h às 16h) e sábados (13h às 18h).`,
      };
    }

    const standardDaySlots = getAllowedSlotsForDate(dateStr);

    const supabase = await createClient();
    let activeDbList: RawAppointmentRow[] = [];

    if (supabase) {
      // Consulta no Supabase todos os agendamentos ativos na data especificada
      const { data: dbAppointments, error } = await supabase
        .from("appointments")
        .select(
          `
            id,
            horario_inicio,
            horario_fim,
            status,
            client_id,
            pacientes (
              nome
            )
          `
        )
        .eq("data", dateStr)
        .neq("status", "Cancelado");

      if (error) {
        console.warn("Aviso ao buscar slots no Supabase:", error.message);
      } else if (dbAppointments) {
        activeDbList = dbAppointments as unknown as RawAppointmentRow[];
      }
    }

    // Consulta paralela na Google Calendar API se configurada
    const { events: googleEvents } = await listGoogleCalendarEventsForDate(dateStr);

    const timeSlots: TimeSlot[] = standardDaySlots.map(({ slot, endSlot, label }) => {
      // 1. Verifica colisão com o banco de dados Supabase
      const dbMatch = activeDbList.find((apt) => apt.horario_inicio === slot);
      if (dbMatch) {
        const patientData = Array.isArray(dbMatch.pacientes)
          ? dbMatch.pacientes[0]
          : dbMatch.pacientes;

        return {
          slot,
          endSlot,
          label,
          isOccupied: true,
          occupiedPatientName: patientData?.nome || "Consulta Agendada",
        };
      }

      // 2. Verifica colisão com eventos da Google Calendar API
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
    // Em caso de erro transitório, devolve a grade padrão desocupada para não bloquear a UI
    const fallbackSlots = getAllowedSlotsForDate(dateStr).map((s) => ({
      ...s,
      isOccupied: false,
    }));
    return {
      success: true,
      data: fallbackSlots,
      message: "Horários carregados em modo de contingência.",
    };
  }
}

/**
 * 3. CRIAÇÃO DE AGENDAMENTO COM PERSISTÊNCIA NO SUPABASE E BLOQUEIO RÍGIDO DE CONFLITO
 */
export async function createAppointmentAction(
  input: AppointmentInput
): Promise<ActionResponse<Appointment>> {
  try {
    // 0. Validação estrita via Zod Schema
    const validationResult = appointmentSchema.safeParse(input);
    if (!validationResult.success) {
      const firstErrorMessage =
        validationResult.error.issues[0]?.message ||
        "Por favor, verifique os dados informados.";
      return {
        success: false,
        message: firstErrorMessage,
      };
    }

    // Validação estrita de antecedência mínima de 2 dias corridos (considerando o fuso de America/Sao_Paulo)
    const todayStr = getTodaySaoPauloDateString();
    const partsToday = todayStr.split("-").map(Number);
    const partsTarget = input.data.split("-").map(Number);
    
    const dToday = new Date(partsToday[0], partsToday[1] - 1, partsToday[2]);
    const dTarget = new Date(partsTarget[0], partsTarget[1] - 1, partsTarget[2]);
    
    const diffTime = dTarget.getTime() - dToday.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 2) {
      return {
        success: false,
        message: "Os agendamentos devem ser solicitados com no mínimo 2 dias de antecedência.",
      };
    }

    // 1. Validação rígida do dia da semana (Segunda, Quinta ou Sábado)
    if (!isAllowedAppointmentDay(input.data)) {
      return {
        success: false,
        message: "Atendimentos disponíveis apenas às segundas-feiras, quintas-feiras e sábados.",
      };
    }

    // 2. Validação rígida do horário conforme o dia
    const allowedTimes = getAllowedStartTimesForDate(input.data);
    if (!allowedTimes.includes(input.horario_inicio)) {
      return {
        success: false,
        message: "Horário fora da grade de atendimento permitida para este dia.",
      };
    }

    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado. Verifique as credenciais no .env.local.",
      };
    }

    // Calcula horário fim (1 hora após o início)
    const startHour = Number(input.horario_inicio.split(":")[0]);
    const endHour = String(startHour + 1).padStart(2, "0");
    const horario_fim = `${endHour}:00`;

    // 3. Verificação de conflito no Supabase (horário já reservado na data com status != Cancelado)
    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("data", input.data)
      .eq("horario_inicio", input.horario_inicio)
      .neq("status", "Cancelado")
      .maybeSingle();

    if (conflict) {
      return {
        success: false,
        message: `O horário ${input.horario_inicio} já está reservado para outro atendimento nesta data.`,
      };
    }

    let googleEventId: string | null = null;
    let googleHtmlLink: string | null = null;
    let syncedWithGoogle = false;

    // 4. Integração com a Google Calendar API
    if (input.sync_google) {
      const gcalRes = await createGoogleCalendarEvent({
        patientName: input.client_nome,
        patientEmail: input.client_email || "",
        patientPhone: input.client_telefone || "",
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
        patientEmail: input.client_email || "",
        patientPhone: input.client_telefone || "",
        procedimento: input.procedimento,
        date: input.data,
        startTime: input.horario_inicio,
        endTime: horario_fim,
        observacoes: input.observacoes,
      });
    }

    // 5. Inserção definitiva na tabela appointments do Supabase
    const { data: inserted, error: insertError } = await supabase
      .from("appointments")
      .insert({
        client_id: input.client_id,
        data: input.data,
        horario_inicio: input.horario_inicio,
        horario_fim,
        procedimento: input.procedimento,
        observacoes: input.observacoes || null,
        status: "Confirmado",
        google_event_id: googleEventId,
        google_html_link: googleHtmlLink,
        synced_with_google: syncedWithGoogle,
      })
      .select(
        `
          id,
          client_id,
          data,
          horario_inicio,
          horario_fim,
          procedimento,
          observacoes,
          status,
          google_event_id,
          google_html_link,
          synced_with_google,
          created_at,
          updated_at,
          pacientes (
            id,
            nome,
            email,
            telefone
          )
        `
      )
      .single();

    if (insertError) {
      console.error("Erro Supabase createAppointmentAction:", insertError);
      return {
        success: false,
        message: `Erro ao gravar agendamento no Supabase: ${insertError.message}. Certifique-se de aplicar a migration em sql/supabase-appointments-schema.sql.`,
      };
    }

    const newAppointment = mapRowToAppointment(inserted as unknown as RawAppointmentRow);

    revalidatePath("/");

    return {
      success: true,
      message: "Consulta agendada e persistida no Supabase com sucesso!",
      data: newAppointment,
    };
  } catch (error) {
    console.error("Erro inesperado ao criar agendamento:", error);
    return {
      success: false,
      message: "Ocorreu um erro interno de conexão ao salvar o agendamento.",
    };
  }
}

/**
 * 4. CANCELAMENTO DE AGENDAMENTO NO SUPABASE E GOOGLE CALENDAR
 */
export async function cancelAppointmentAction(
  appointmentId: string
): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado.",
      };
    }

    // 1. Busca dados do agendamento para verificar existência e ID do evento Google
    const { data: current, error: getError } = await supabase
      .from("appointments")
      .select("id, status, google_event_id")
      .eq("id", appointmentId)
      .single();

    if (getError || !current) {
      return {
        success: false,
        message: "Agendamento não encontrado no banco de dados.",
      };
    }

    // 2. Atualiza o status para Cancelado diretamente no Supabase
    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        status: "Cancelado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    if (updateError) {
      console.error("Erro ao cancelar agendamento no Supabase:", updateError);
      return {
        success: false,
        message: `Falha ao cancelar agendamento: ${updateError.message}`,
      };
    }

    // 3. Sincroniza cancelamento na Google Calendar API se houver evento registrado
    if (current.google_event_id) {
      await deleteGoogleCalendarEvent(current.google_event_id);
    }

    revalidatePath("/");

    return {
      success: true,
      message: "Agendamento cancelado com sucesso no Supabase.",
    };
  } catch (error) {
    console.error("Erro inesperado ao cancelar agendamento:", error);
    return {
      success: false,
      message: "Falha de conexão ao cancelar o agendamento.",
    };
  }
}

/**
 * 5. ATUALIZAR HORÁRIO OU DADOS DO AGENDAMENTO NO SUPABASE E GOOGLE CALENDAR
 */
export async function updateAppointmentAction(
  appointmentId: string,
  updates: Partial<Pick<Appointment, "data" | "horario_inicio" | "procedimento" | "observacoes" | "status">>
): Promise<ActionResponse<Appointment>> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return {
        success: false,
        message: "Banco de dados Supabase não configurado.",
      };
    }

    // 1. Busca registro atual
    const { data: current, error: getError } = await supabase
      .from("appointments")
      .select(
        `
          id,
          client_id,
          data,
          horario_inicio,
          horario_fim,
          procedimento,
          observacoes,
          status,
          google_event_id,
          google_html_link,
          synced_with_google,
          created_at,
          updated_at,
          pacientes (
            id,
            nome,
            email,
            telefone
          )
        `
      )
      .eq("id", appointmentId)
      .single();

    if (getError || !current) {
      return {
        success: false,
        message: "Agendamento não encontrado no banco de dados.",
      };
    }

    const targetDate = updates.data || current.data;
    const targetStart = updates.horario_inicio || current.horario_inicio;

    // Validação estrita de antecedência mínima de 2 dias corridos para reagendamentos (alteração de data)
    if (updates.data && updates.data !== current.data) {
      const todayStr = getTodaySaoPauloDateString();
      const partsToday = todayStr.split("-").map(Number);
      const partsTarget = updates.data.split("-").map(Number);
      
      const dToday = new Date(partsToday[0], partsToday[1] - 1, partsToday[2]);
      const dTarget = new Date(partsTarget[0], partsTarget[1] - 1, partsTarget[2]);
      
      const diffTime = dTarget.getTime() - dToday.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 2) {
        return {
          success: false,
          message: "Os agendamentos devem ser solicitados com no mínimo 2 dias de antecedência.",
        };
      }
    }

    // Validação rígida de dia permitido na edição/reagendamento
    if (updates.data && !isAllowedAppointmentDay(targetDate)) {
      return {
        success: false,
        message: "Atendimentos disponíveis apenas às segundas-feiras, quintas-feiras e sábados.",
      };
    }

    // Validação rígida de horário permitido na edição/reagendamento
    if ((updates.data || updates.horario_inicio) && !getAllowedStartTimesForDate(targetDate).includes(targetStart)) {
      return {
        success: false,
        message: "Horário fora da grade de atendimento permitida para este dia.",
      };
    }

    // 2. Se mudou data ou horário, verifica colisão no Supabase
    if (targetDate !== current.data || targetStart !== current.horario_inicio) {
      const { data: conflict } = await supabase
        .from("appointments")
        .select("id")
        .neq("id", appointmentId)
        .eq("data", targetDate)
        .eq("horario_inicio", targetStart)
        .neq("status", "Cancelado")
        .maybeSingle();

      if (conflict) {
        return {
          success: false,
          message: `O horário ${targetStart} no dia ${targetDate} já está ocupado.`,
        };
      }
    }

    let targetEnd = current.horario_fim;
    if (updates.horario_inicio) {
      const startHour = Number(updates.horario_inicio.split(":")[0]);
      targetEnd = `${String(startHour + 1).padStart(2, "0")}:00`;
    }

    const payloadToUpdate: Record<string, unknown> = {
      ...updates,
      horario_fim: targetEnd,
      updated_at: new Date().toISOString(),
    };

    // 3. Atualiza no Supabase
    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update(payloadToUpdate)
      .eq("id", appointmentId)
      .select(
        `
          id,
          client_id,
          data,
          horario_inicio,
          horario_fim,
          procedimento,
          observacoes,
          status,
          google_event_id,
          google_html_link,
          synced_with_google,
          created_at,
          updated_at,
          pacientes (
            id,
            nome,
            email,
            telefone
          )
        `
      )
      .single();

    if (updateError) {
      console.error("Erro ao atualizar agendamento no Supabase:", updateError);
      return {
        success: false,
        message: `Falha ao atualizar agendamento: ${updateError.message}`,
      };
    }

    const mapped = mapRowToAppointment(updated as unknown as RawAppointmentRow);

    // 4. Sincroniza atualização no Google Calendar se houver evento vinculado
    if (current.google_event_id) {
      const patientData = Array.isArray(current.pacientes)
        ? current.pacientes[0]
        : current.pacientes;

      const syncResult = await updateGoogleCalendarEvent(current.google_event_id, {
        patientName: patientData?.nome || "Paciente",
        patientEmail: patientData?.email || "",
        patientPhone: patientData?.telefone || "",
        procedimento: updates.procedimento || current.procedimento,
        date: targetDate,
        startTime: targetStart,
        endTime: targetEnd,
        observacoes: updates.observacoes !== undefined ? updates.observacoes : current.observacoes,
      });

      // Atualiza o status de sincronização com base no resultado da API do Google Calendar
      if (syncResult.synced !== current.synced_with_google) {
        console.log(`[Google Calendar Sync] Atualizando synced_with_google para ${syncResult.synced} no Supabase após alteração.`);
        await supabase
          .from("appointments")
          .update({ synced_with_google: syncResult.synced })
          .eq("id", appointmentId);
        
        // Atualiza a resposta de retorno para refletir o estado de sincronização correto
        mapped.synced_with_google = syncResult.synced;
      }
    }

    revalidatePath("/");

    return {
      success: true,
      message: "Agendamento atualizado com sucesso no Supabase.",
      data: mapped,
    };
  } catch (error) {
    console.error("Erro inesperado ao atualizar agendamento:", error);
    return {
      success: false,
      message: "Falha ao atualizar o agendamento no banco de dados.",
    };
  }
}

/**
 * 6. INFORMAÇÕES DO STATUS DE INTEGRAÇÃO COM O GOOGLE CALENDAR
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
