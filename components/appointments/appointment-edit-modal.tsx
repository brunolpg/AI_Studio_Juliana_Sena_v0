"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Check,
  AlertCircle,
  Paperclip,
  ImageIcon,
  FileText,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AppointmentCalendarPicker } from "./appointment-calendar-picker";
import { TimeSlotGrid } from "./time-slot-grid";
import { getTimeSlotsForDateAction, updateAppointmentAction } from "@/actions/appointment-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
import type { Appointment, AppointmentStatus, TimeSlot } from "@/types/appointment";
import {
  isAllowedAppointmentDay,
  getAllowedStartTimesForDate,
  getDayScheduleDescription,
  getMinSelectableAppointmentDateString,
} from "@/types/appointment";

interface AppointmentEditModalProps {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: AppointmentStatus[] = ["Confirmado", "Pendente", "Concluído", "Cancelado"];
const PAYMENT_STATUS_OPTIONS = ["Pendente", "Em Análise", "Pago", "Cancelado"] as const;
type PaymentStatusOption = typeof PAYMENT_STATUS_OPTIONS[number];

interface EditContentProps {
  appointment: Appointment;
  onClose: () => void;
  onSuccess: () => void;
}

function AppointmentEditModalContent({ appointment, onClose, onSuccess }: EditContentProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPatient = user?.role === "paciente";

  const availableStatusOptions = isPatient
    ? STATUS_OPTIONS.filter((opt) => opt !== "Cancelado")
    : STATUS_OPTIONS;

  const [date, setDate] = useState<string>(appointment.data);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(appointment.horario_inicio);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [procedimento, setProcedimento] = useState(appointment.procedimento);
  const [observacoes, setObservacoes] = useState(appointment.observacoes || "");
  const [status, setStatus] = useState<AppointmentStatus>(appointment.status);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusOption>(
    (appointment.status_pagamento as PaymentStatusOption) || "Pendente"
  );
  const [clinicalAttachments, setClinicalAttachments] = useState<string[]>(
    appointment.anexos_clinicos || []
  );
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSlots() {
      if (!date) return;
      setIsLoadingSlots(true);
      try {
        const res = await getTimeSlotsForDateAction(date);
        if (isMounted && res.success && res.data) {
          const adjusted = res.data.map((s) => {
            if (s.slot === appointment.horario_inicio && date === appointment.data) {
              return { ...s, isOccupied: false };
            }
            return s;
          });
          setSlots(adjusted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setIsLoadingSlots(false);
      }
    }

    loadSlots();

    return () => {
      isMounted = false;
    };
  }, [date, appointment.horario_inicio, appointment.data]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (clinicalAttachments.length >= 3) {
      toast({ type: "error", title: "Limite atingido", description: "Máximo de 3 anexos por agendamento." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ type: "error", title: "Arquivo muito grande", description: "O arquivo deve ter até 10MB." });
      return;
    }

    setIsUploadingAttachment(true);
    try {
      const supabase = getSupabaseClient();
      const fileExt = file.name.split(".").pop() || "png";
      const filePath = `consultas/${appointment.id}_${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("anexos-consultas")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from("anexos-consultas")
        .getPublicUrl(filePath);

      const updated = [...clinicalAttachments, publicUrlData.publicUrl];
      setClinicalAttachments(updated);

      // Persiste imediatamente no banco de dados para evitar perda ao fechar o modal
      await supabase
        .from("appointments")
        .update({ anexos_clinicos: updated, updated_at: new Date().toISOString() })
        .eq("id", appointment.id);

      toast({ type: "success", title: "Anexo salvo!", description: "Arquivo anexado e sincronizado." });
    } catch (err: any) {
      toast({ type: "error", title: "Erro no envio", description: err.message || "Falha ao enviar arquivo." });
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (indexToRemove: number) => {
    const updated = clinicalAttachments.filter((_, idx) => idx !== indexToRemove);
    setClinicalAttachments(updated);
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from("appointments")
        .update({ anexos_clinicos: updated, updated_at: new Date().toISOString() })
        .eq("id", appointment.id);
      toast({ type: "success", title: "Anexo removido", description: "Arquivo removido do atendimento." });
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setErrorMsg("Selecione a data do agendamento.");
      return;
    }

    if (isPatient && status === "Cancelado") {
      setErrorMsg("Pacientes não têm permissão para cancelar agendamentos pelo portal. Favor entrar em contato diretamente com a clínica.");
      return;
    }

    // Validação de antecedência mínima de 2 dias corridos apenas para pacientes ao reagendar
    if (isPatient && date !== appointment.data) {
      const minAllowedDate = getMinSelectableAppointmentDateString();
      if (date < minAllowedDate) {
        setErrorMsg("Os agendamentos por pacientes devem ser feitos com no mínimo 2 dias de antecedência.");
        return;
      }
    }

    if (!isAllowedAppointmentDay(date)) {
      setErrorMsg("Atendimentos disponíveis apenas às segundas-feiras, quintas-feiras e sábados.");
      return;
    }

    if (!selectedSlot) {
      setErrorMsg("Selecione um horário.");
      return;
    }

    if (!getAllowedStartTimesForDate(date).includes(selectedSlot)) {
      setErrorMsg("Horário fora da grade de atendimento permitida para este dia.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await updateAppointmentAction(appointment.id, {
        data: date,
        horario_inicio: selectedSlot,
        procedimento,
        observacoes,
        status,
        status_pagamento: paymentStatus,
        anexos_clinicos: clinicalAttachments,
      });

      if (res.success) {
        toast({
          type: "success",
          title: "Agendamento atualizado",
          description: "Os dados do atendimento foram salvos com sucesso.",
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao atualizar.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao salvar alterações.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs z-10">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Editar Agendamento
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Paciente: <strong>{appointment.client_nome}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {errorMsg && (
        <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
        {/* Orientação informativa para Pacientes */}
        {isPatient && (
          <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Para cancelamentos ou reagendamentos, entre em contato diretamente com a clínica.</span>
          </div>
        )}

        {/* Status */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
            Status do Atendimento
          </label>
          <div className={`grid grid-cols-${availableStatusOptions.length} gap-2`}>
            {availableStatusOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
                className={`py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  status === opt
                    ? opt === "Confirmado"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : opt === "Pendente"
                      ? "bg-amber-500 text-white border-amber-500"
                      : opt === "Concluído"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-rose-600 text-white border-rose-600"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Status do Pagamento */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
            Status do Pagamento
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setPaymentStatus(opt)}
                className={`py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  paymentStatus === opt
                    ? opt === "Pago"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : opt === "Pendente"
                      ? "bg-amber-500 text-white border-amber-500"
                      : opt === "Em Análise"
                      ? "bg-sky-600 text-white border-sky-600"
                      : "bg-rose-600 text-white border-rose-600"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Data e Grade de Horários */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>Data</span>
            </label>
            <AppointmentCalendarPicker
              selectedDate={date}
              onSelectDate={(d) => setDate(d)}
              minDate={getMinSelectableAppointmentDateString()}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Horário</span>
            </label>
            <TimeSlotGrid
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(s) => setSelectedSlot(s)}
              isLoading={isLoadingSlots}
              dateStr={date}
            />
          </div>
        </div>

        {/* Procedimento */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
            Procedimento
          </label>
          <input
            type="text"
            value={procedimento}
            onChange={(e) => setProcedimento(e.target.value)}
            required
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Observações */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
            Observações
          </label>
          <textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
          />
        </div>

        {/* Exames e Fotos da Região */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-teal-600" />
              <span>Exames e Fotos da Região</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              {clinicalAttachments.length}/3 arquivos anexados
            </span>
          </div>

          {/* Lista de anexos existentes */}
          {clinicalAttachments.length > 0 && (
            <div className="space-y-1.5">
              {clinicalAttachments.map((url, idx) => {
                const isImage = url.match(/\.(jpeg|jpg|png|webp)($|\?)/i);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isImage ? (
                        <ImageIcon className="w-4 h-4 text-sky-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-teal-700 dark:text-teal-300 hover:underline font-medium"
                      >
                        Anexo {idx + 1} ({isImage ? "Foto" : "Documento"})
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Excluir anexo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Botão de Upload se restarem vagas */}
          {clinicalAttachments.length < 3 && (
            <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-teal-300 dark:border-teal-700 rounded-xl bg-teal-50/30 dark:bg-slate-800/40 hover:bg-teal-50/60 dark:hover:bg-slate-800 transition-all cursor-pointer">
              <UploadCloud className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                {isUploadingAttachment
                  ? "Enviando arquivo..."
                  : `Adicionar arquivo (PDF, PNG ou JPG) - Restam ${3 - clinicalAttachments.length}`}
              </span>
              <input
                type="file"
                disabled={isUploadingAttachment}
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleUploadFile}
              />
            </label>
          )}
        </div>

        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export function AppointmentEditModal({
  isOpen,
  appointment,
  onClose,
  onSuccess,
}: AppointmentEditModalProps) {
  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <AppointmentEditModalContent
        key={appointment.id}
        appointment={appointment}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
