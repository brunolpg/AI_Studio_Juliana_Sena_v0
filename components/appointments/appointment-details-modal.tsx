"use client";

import React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { Appointment } from "@/types/appointment";

interface AppointmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onEdit?: (appointment: Appointment) => void;
}

export function AppointmentDetailsModal({
  isOpen,
  onClose,
  appointment,
  onEdit,
}: AppointmentDetailsModalProps) {
  if (!isOpen || !appointment) return null;

  const attachments = appointment.anexos_clinicos || [];

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs font-['Plus_Jakarta_Sans',sans-serif] overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] transition-all">
        {/* Handle indicador para Bottom Sheet no Mobile Vertical */}
        <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2 shrink-0" />

        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 shadow-2xs">
              {(appointment.client_nome || "P")[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Detalhes do Atendimento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateBR(appointment.data)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md-state-layer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Card do Paciente */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              PACIENTE
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {appointment.client_nome}
            </p>
            <div className="space-y-1 pt-1 text-xs text-slate-600 dark:text-slate-300">
              {appointment.client_telefone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>{appointment.client_telefone}</span>
                </p>
              )}
              {appointment.client_email && (
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>{appointment.client_email}</span>
                </p>
              )}
            </div>
          </div>

          {/* Grid Horário e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Horário Agendado
              </span>
              <p className="text-sm font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span>
                  {appointment.horario_inicio} - {appointment.horario_fim}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Status da Consulta
              </span>
              <div className="mt-1">
                <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {appointment.status}
                </span>
              </div>
            </div>
          </div>

          {/* Procedimento */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Procedimento / Especialidade
            </span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {appointment.procedimento}
            </p>
            {appointment.observacoes && (
              <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 mt-2">
                {appointment.observacoes}
              </p>
            )}
          </div>

          {/* Anexos Clínicos (Apenas leitura/consulta) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-teal-50/50 dark:bg-slate-800/60 border border-teal-200/70 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                Total de ficheiros anexados
              </span>
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                {attachments.length} de 3 ficheiros
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                FICHEIROS NO PRONTUÁRIO
              </span>

              {attachments.length === 0 ? (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center text-xs text-slate-400 dark:text-slate-400 italic">
                  Nenhum exame ou foto clínica anexada a esta consulta.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((url, idx) => {
                    const isImage = url.match(/\.(jpeg|jpg|png|webp)($|\?)/i);
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-slate-700/60 text-xs text-slate-700 dark:text-slate-200 transition-colors group cursor-pointer"
                      >
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        )}
                        <span className="truncate flex-1 font-medium group-hover:text-teal-700 dark:group-hover:text-teal-300">
                          Anexo {idx + 1} ({isImage ? "Foto" : "Documento"})
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Integração Google Agenda */}
          {appointment.google_html_link && (
            <div className="p-4 rounded-2xl bg-teal-50/40 dark:bg-slate-800/40 border border-teal-200/60 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-teal-800 dark:text-teal-300">
                <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Sincronizado na Agenda Oficial</span>
              </div>
              <a
                href={appointment.google_html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors cursor-pointer"
              >
                <span>Ver no Google Agenda</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(appointment);
              }}
              className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
            >
              Editar Horário / Status
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors cursor-pointer md-state-layer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
