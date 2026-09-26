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

export interface GoogleCalendarConfig {
  hasCredentials: boolean;
  calendarId: string;
  hasClientId: boolean;
  hasApiKey: boolean;
}
