"use client";

import React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  CalendarDays,
  FileText,
  AlertCircle,
  XCircle,
  Share2,
} from "lucide-react";
import type { Appointment } from "@/types/appointment";

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
}

export function AppointmentDetailsModal({
  isOpen,
  appointment,
  onClose,
  onEdit,
}: AppointmentDetailsModalProps) {
  if (!isOpen || !appointment) return null;

  const dateFormatted = new Date(appointment.data + "T12:00:00").toLocaleDateString(
    "pt-BR",
    { weekday: "long", day: "2-digit", month: "long", year: "numeric" }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
              {appointment.client_nome.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Detalhes do Atendimento
              </h3>
              <p className="text-xs text-slate-500 capitalize">{dateFormatted}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Card Paciente */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Paciente
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {appointment.client_nome}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-600" />
                <span>{appointment.client_telefone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-600" />
                <span className="truncate">{appointment.client_email}</span>
              </div>
            </div>
          </div>

          {/* Dados do Horário e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                Horário Agendado
              </span>
              <div className="flex items-center gap-1.5 font-bold text-teal-700 dark:text-teal-400 text-sm font-mono">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>
                  {appointment.horario_inicio} - {appointment.horario_fim}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80">
              <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                Status da Consulta
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                  appointment.status === "Confirmado"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
                    : appointment.status === "Pendente"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                    : appointment.status === "Concluído"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                }`}
              >
                {appointment.status}
              </span>
            </div>
          </div>

          {/* Procedimento & Observações */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Procedimento / Especialidade
              </span>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-medium text-slate-900 dark:text-slate-100">
                {appointment.procedimento}
              </div>
            </div>

            {appointment.observacoes && (
              <div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Observações Clínicas
                </span>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {appointment.observacoes}
                </div>
              </div>
            )}
          </div>

          {/* Integração Google Agenda */}
          <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-teal-950 dark:text-teal-100">
                  Google Agenda
                </div>
                <div className="text-[11px] text-teal-700 dark:text-teal-300">
                  {appointment.synced_with_google
                    ? "Evento configurado para o Google Calendar"
                    : "Agendamento local"}
                </div>
              </div>
            </div>

            {appointment.google_html_link && (
              <a
                href={appointment.google_html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-2xs transition-all shrink-0 cursor-pointer"
              >
                <span>Abrir no Google Agenda</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(appointment);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors cursor-pointer"
            >
              Editar Horário / Status
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
