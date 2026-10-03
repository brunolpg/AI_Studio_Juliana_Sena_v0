export type AppointmentStatus = "Confirmado" | "Pendente" | "Concluído" | "Cancelado";

export interface Appointment {
  id: string;
  client_id: string;
  client_nome: string;
  client_email: string;
  client_telefone: string;
  data: string; // YYYY-MM-DD
  horario_inicio: string; // "08:00"
  horario_fim: string; // "09:00"
  procedimento: string;
  procedimento_id?: string | null;
  observacoes?: string | null;
  status: AppointmentStatus;
  google_event_id?: string | null;
  google_html_link?: string | null;
  synced_with_google: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInput {
  client_id: string;
  client_nome: string;
  client_email?: string;
  client_telefone?: string;
  data: string;
  horario_inicio: string;
  horario_fim?: string;
  procedimento: string;
  procedimento_id?: string;
  observacoes?: string;
  sync_google: boolean;
}

export type AppointmentFilterTab = "todos" | "hoje" | "proximos" | "concluidos" | "cancelados";

export interface AppointmentFilter {
  search?: string;
  tab?: AppointmentFilterTab;
  page?: number;
  pageSize?: number;
  data?: string;
}

export interface TimeSlot {
  slot: string; // "09:00"
  endSlot: string; // "10:00"
  label: string; // "09:00 - 10:00"
  isOccupied: boolean;
  occupiedPatientName?: string;
}

/**
 * Dias da semana permitidos para agendamento com a Dra. Juliana Sena:
 * 1 = Segunda-feira (09:00 às 16:00, sessões de 1h)
 * 4 = Quinta-feira  (09:00 às 16:00, sessões de 1h)
 * 6 = Sábado        (13:00 às 18:00, sessões de 1h)
 */
export const ALLOWED_APPOINTMENT_DAYS = [1, 4, 6] as const;
export type AllowedDayOfWeek = typeof ALLOWED_APPOINTMENT_DAYS[number];

/**
 * Grade de Segundas e Quintas-feiras: 09:00 às 16:00 (intervalos de 1h, último às 15:00)
 */
export const MONDAY_THURSDAY_SLOTS: Array<{ slot: string; endSlot: string; label: string }> = [
  { slot: "09:00", endSlot: "10:00", label: "09:00 - 10:00" },
  { slot: "10:00", endSlot: "11:00", label: "10:00 - 11:00" },
  { slot: "11:00", endSlot: "12:00", label: "11:00 - 12:00" },
  { slot: "13:00", endSlot: "14:00", label: "13:00 - 14:00" },
  { slot: "14:00", endSlot: "15:00", label: "14:00 - 15:00" },
  { slot: "15:00", endSlot: "16:00", label: "15:00 - 16:00" },
];

/**
 * Grade de Sábados: 13:00 às 18:00 (intervalos de 1h, último às 17:00)
 */
export const SATURDAY_SLOTS: Array<{ slot: string; endSlot: string; label: string }> = [
  { slot: "13:00", endSlot: "14:00", label: "13:00 - 14:00" },
  { slot: "14:00", endSlot: "15:00", label: "14:00 - 15:00" },
  { slot: "15:00", endSlot: "16:00", label: "15:00 - 16:00" },
  { slot: "16:00", endSlot: "17:00", label: "16:00 - 17:00" },
  { slot: "17:00", endSlot: "18:00", label: "17:00 - 18:00" },
];

/**
 * Fallback para compatibilidade geral
 */
export const STANDARD_TIME_SLOTS = MONDAY_THURSDAY_SLOTS;

export function getTodaySaoPauloDateString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function getMinSelectableAppointmentDateString(): string {
  const todayStr = getTodaySaoPauloDateString();
  const [year, month, day] = todayStr.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);
  dateObj.setDate(dateObj.getDate() + 2);
  
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Mapeia o dia da semana a partir de uma data YYYY-MM-DD com proteção estrita contra desvios de fuso horário UTC.
 * 0 = Domingo, 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado.
 */
export function getDayOfWeekFromDateString(dateStr: string): number {
  if (!dateStr) return -1;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return -1;
  const [year, month, day] = parts;
  // Meio-dia (12:00) previne qualquer deslocamento causado por horário de verão ou timezones UTC
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return d.getDay();
}

/**
 * Verifica se a data informada cai em um dia de atendimento permitido (Segunda, Quinta ou Sábado)
 */
export function isAllowedAppointmentDay(dateStr: string): boolean {
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  return ALLOWED_APPOINTMENT_DAYS.includes(dayOfWeek as AllowedDayOfWeek);
}

/**
 * Retorna a grade de slots configurada para o dia da semana
 */
export function getTimeSlotsForDayOfWeek(
  dayOfWeek: number
): Array<{ slot: string; endSlot: string; label: string }> {
  if (dayOfWeek === 1 || dayOfWeek === 4) {
    return MONDAY_THURSDAY_SLOTS;
  }
  if (dayOfWeek === 6) {
    return SATURDAY_SLOTS;
  }
  return [];
}

/**
 * Retorna os slots padrão permitidos para uma data específica YYYY-MM-DD
 */
export function getAllowedSlotsForDate(
  dateStr: string
): Array<{ slot: string; endSlot: string; label: string }> {
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  return getTimeSlotsForDayOfWeek(dayOfWeek);
}

/**
 * Retorna a lista de horários de início válidos para a data (ex: ["09:00", "10:00", ...])
 */
export function getAllowedStartTimesForDate(dateStr: string): string[] {
  return getAllowedSlotsForDate(dateStr).map((s) => s.slot);
}

/**
 * Retorna a próxima data válida (Segunda, Quinta ou Sábado) a partir de uma data de referência
 */
export function getNextAllowedAppointmentDate(startDateStr?: string): string {
  const now = startDateStr ? new Date(startDateStr + "T12:00:00") : new Date();
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  for (let i = 0; i < 14; i++) {
    const dayOfWeek = cursor.getDay();
    if (ALLOWED_APPOINTMENT_DAYS.includes(dayOfWeek as AllowedDayOfWeek)) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return startDateStr || "";
}

/**
 * Fornece metadados informativos para a interface sobre o expediente do dia
 */
export function getDayScheduleDescription(dateStr: string): {
  isOpen: boolean;
  dayName: string;
  hoursDescription: string;
} {
  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  switch (dayOfWeek) {
    case 1:
      return {
        isOpen: true,
        dayName: "Segunda-feira",
        hoursDescription: "09:00 às 16:00 (sessões de 1 em 1 hora)",
      };
    case 4:
      return {
        isOpen: true,
        dayName: "Quinta-feira",
        hoursDescription: "09:00 às 16:00 (sessões de 1 em 1 hora)",
      };
    case 6:
      return {
        isOpen: true,
        dayName: "Sábado",
        hoursDescription: "13:00 às 18:00 (sessões de 1 em 1 hora)",
      };
    default:
      return {
        isOpen: false,
        dayName: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][dayOfWeek] || "Dia",
        hoursDescription: "Sem expediente. Atendimentos apenas segundas, quintas e sábados.",
      };
  }
}

export interface GoogleCalendarConfig {
  hasCredentials: boolean;
  calendarId: string;
  hasClientId: boolean;
  hasApiKey: boolean;
}
