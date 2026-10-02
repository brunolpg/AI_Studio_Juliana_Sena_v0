"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar as CalendarIcon, Clock, Check, AlertCircle } from "lucide-react";
import { AppointmentCalendarPicker } from "./appointment-calendar-picker";
import { TimeSlotGrid } from "./time-slot-grid";
import { getTimeSlotsForDateAction, updateAppointmentAction } from "@/actions/appointment-actions";
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
