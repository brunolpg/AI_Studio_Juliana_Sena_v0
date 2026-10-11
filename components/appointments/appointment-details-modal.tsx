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
  Paperclip,
  ImageIcon,
  UploadCloud,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
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

  const [attachments, setAttachments] = React.useState<string[]>(appointment.anexos_clinicos || []);
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    setAttachments(appointment.anexos_clinicos || []);
  }, [appointment]);

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

          {/* SEÇÃO: ARQUIVOS NO PRONTUÁRIO (EXAMES E FOTOS) */}
          <div className="space-y-3 pt-2">
            {/* Barra de Contagem */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-teal-50/50 dark:bg-slate-800/60 border border-teal-200/70 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Total de arquivos anexados
              </span>
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                {attachments.length} de 3 arquivos
              </span>
            </div>

            {/* Lista de Arquivos */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider block">
                ARQUIVOS NO PRONTUÁRIO
              </span>

              {attachments.length === 0 ? (
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center text-xs text-slate-400 italic">
                  Nenhum exame ou foto clínica anexado a esta consulta ainda.
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
                          <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-rose-600 shrink-0" />
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

            {/* Caixa Tracejada de Upload */}
            {attachments.length < 3 && (
              <label className="flex flex-col items-center justify-center p-4 border border-dashed border-teal-300/80 dark:border-teal-700/60 rounded-2xl bg-teal-50/20 dark:bg-slate-800/30 hover:bg-teal-50/50 dark:hover:bg-slate-800 transition-all cursor-pointer">
                <UploadCloud className="w-6 h-6 text-teal-600 mb-1" />
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200">
                  {isUploading ? "Enviando arquivo..." : "Clique para adicionar fotos ou exames"}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Selecione até {3 - attachments.length} arquivo(s) (PDF, PNG, JPG até 10MB)
                </span>
                <input
                  type="file"
                  disabled={isUploading}
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      alert("O arquivo não pode ultrapassar 10MB.");
                      return;
                    }
                    setIsUploading(true);
                    try {
                      const supabase = getSupabaseClient();
                      if (!supabase) return;
                      const fileExt = file.name.split(".").pop() || "png";
                      const filePath = `consultas/${appointment.id}_${Date.now()}.${fileExt}`;
                      const { error: uploadErr } = await supabase.storage
                        .from("anexos-consultas")
                        .upload(filePath, file, { upsert: true });
                      if (uploadErr) throw uploadErr;

                      const { data: publicData } = supabase.storage
                        .from("anexos-consultas")
                        .getPublicUrl(filePath);

                      const updated = [...attachments, publicData.publicUrl];
                      setAttachments(updated);

                      // Sincroniza diretamente no banco de dados Supabase
                      await supabase
                        .from("appointments")
                        .update({ anexos_clinicos: updated, updated_at: new Date().toISOString() })
                        .eq("id", appointment.id);
                    } catch (err: any) {
                      alert("Falha ao salvar anexo: " + err.message);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Integração Google Agenda */}
          <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                appointment.synced_with_google
                  ? "bg-emerald-600 text-white"
                  : "bg-teal-600 text-white"
              }`}>
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-950 dark:text-teal-100">
                    Google Agenda
                  </span>
                  {appointment.synced_with_google ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                      Sincronizado na Agenda Oficial
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-800">
                      Link Direto Disponível
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5">
                  {appointment.synced_with_google
                    ? "Evento criado diretamente na agenda profissional da médica"
                    : "Agendamento registrado no sistema com link de inclusão no Google Agenda"}
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
                <span>{appointment.synced_with_google ? "Ver no Google Agenda" : "Abrir no Google Agenda"}</span>
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
