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
  client_email: string;
  client_telefone: string;
  data: string;
  horario_inicio: string;
  procedimento: string;
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
  slot: string; // "08:00"
  endSlot: string; // "09:00"
  label: string; // "08:00 - 09:00"
  isOccupied: boolean;
  occupiedPatientName?: string;
}

/**
 * Grade padrão de atendimentos clínicos (08:00 às 17:00, intervalos de 1h)
 */
export const STANDARD_TIME_SLOTS: Array<{ slot: string; endSlot: string; label: string }> = [
  { slot: "08:00", endSlot: "09:00", label: "08:00 - 09:00" },
  { slot: "09:00", endSlot: "10:00", label: "09:00 - 10:00" },
  { slot: "10:00", endSlot: "11:00", label: "10:00 - 11:00" },
  { slot: "11:00", endSlot: "12:00", label: "11:00 - 12:00" },
  { slot: "12:00", endSlot: "13:00", label: "12:00 - 13:00" },
  { slot: "13:00", endSlot: "14:00", label: "13:00 - 14:00" },
  { slot: "14:00", endSlot: "15:00", label: "14:00 - 15:00" },
  { slot: "15:00", endSlot: "16:00", label: "15:00 - 16:00" },
  { slot: "16:00", endSlot: "17:00", label: "16:00 - 17:00" },
];

export interface GoogleCalendarConfig {
  hasCredentials: boolean;
  calendarId: string;
  hasClientId: boolean;
  hasApiKey: boolean;
}
