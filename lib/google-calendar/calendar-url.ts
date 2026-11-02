/**
 * Utilitário client-safe para geração de links e templates do Google Agenda.
 * Não contém nenhuma dependência de servidor (crypto, next/headers, supabase/server).
 */

export interface GoogleCalendarEventInput {
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  procedimento: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  observacoes?: string | null;
}

export function generateGoogleCalendarTemplateUrl(input: GoogleCalendarEventInput): string {
  // Converte a data e hora local de Brasília/Bahia (GMT-3) para o objeto Date UTC real
  const startDateTime = new Date(`${input.date}T${input.startTime}:00-03:00`);
  const endDateTime = new Date(`${input.date}T${input.endTime}:00-03:00`);

  // Formata para o padrão UTC (YYYYMMDDTHHMMSSZ) somando o offset correto para UTC
  const formatToUtcCompact = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };

  const startCompact = formatToUtcCompact(startDateTime);
  const endCompact = formatToUtcCompact(endDateTime);

  const summary = `Consulta: ${input.procedimento} - Dra. Juliana Sena`;
  const details = [
    `Paciente: ${input.patientName}`,
    `Telefone: ${input.patientPhone || "Não informado"}`,
    `E-mail: ${input.patientEmail || "Não informado"}`,
    `Procedimento: ${input.procedimento}`,
    input.observacoes ? `Observações: ${input.observacoes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const location = "Clínica Dra. Juliana Sena - Salvador/BA";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    summary
  )}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    location
  )}&ctz=America/Sao_Paulo`;
}
