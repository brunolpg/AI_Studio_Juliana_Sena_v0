"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Search,
  Check,
  CalendarCheck2,
  AlertCircle,
} from "lucide-react";
import { AppointmentCalendarPicker } from "./appointment-calendar-picker";
import { TimeSlotGrid } from "./time-slot-grid";
import { getTimeSlotsForDateAction, createAppointmentAction } from "@/actions/appointment-actions";
import { INITIAL_CLIENTS } from "@/lib/mock-data";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type { TimeSlot, AppointmentInput } from "@/types/appointment";

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availablePatients?: Client[];
  initialPatient?: Client | null;
}

const PROCEDIMENTO_PRESETS = [
  "Consulta Dermatológica Inicial",
  "Retorno Clínico & Avaliação de Exames",
  "Consulta Geral de Rotina",
  "Avaliação Nutricional & Bioimpedância",
  "Procedimento Ambulatorial / Biópsia",
  "Checkup Preventivo Anual",
];

interface FormContentProps {
  onClose: () => void;
  onSuccess: () => void;
  availablePatients: Client[];
  initialPatient: Client | null;
}

function AppointmentFormModalContent({
  onClose,
  onSuccess,
  availablePatients,
  initialPatient,
}: FormContentProps) {
  const { toast } = useToast();

  // Data padrão: hoje formatado
  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  // Estados do formulário
  const [selectedPatient, setSelectedPatient] = useState<Client | null>(initialPatient);
  const [patientSearch, setPatientSearch] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const [procedimento, setProcedimento] = useState(PROCEDIMENTO_PRESETS[0]);
  const [observacoes, setObservacoes] = useState("");
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega slots sempre que a data selecionada mudar
  useEffect(() => {
    let isMounted = true;
    async function loadSlots() {
      setIsLoadingSlots(true);
      setErrorMsg(null);
      try {
        const res = await getTimeSlotsForDateAction(selectedDate);
        if (isMounted && res.success && res.data) {
          const loadedSlots = res.data;
          setSlots(loadedSlots);
          // Se o slot atualmente selecionado estiver ocupado na nova data, limpa a seleção
          setSelectedSlot((prev) => {
            if (!prev) return null;
            const currentSlotObj = loadedSlots.find((s) => s.slot === prev);
            return currentSlotObj?.isOccupied ? null : prev;
          });
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
  }, [selectedDate]);

  // Filtra pacientes no autocomplete
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return availablePatients.slice(0, 6);
    const q = patientSearch.toLowerCase().trim();
    return availablePatients
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          p.cpf.includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.telefone.includes(q)
      )
      .slice(0, 8);
  }, [patientSearch, availablePatients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPatient) {
      setErrorMsg("Selecione um paciente para o agendamento.");
      return;
    }

    if (!selectedDate) {
      setErrorMsg("Selecione a data da consulta.");
      return;
    }

    if (!selectedSlot) {
      setErrorMsg("Selecione um dos horários disponíveis na grade.");
      return;
    }

    if (!procedimento.trim()) {
      setErrorMsg("Informe o procedimento ou especialidade da consulta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: AppointmentInput = {
        client_id: selectedPatient.id,
        client_nome: selectedPatient.nome,
        client_email: selectedPatient.email,
        client_telefone: selectedPatient.telefone,
        data: selectedDate,
        horario_inicio: selectedSlot,
        procedimento: procedimento.trim(),
        observacoes: observacoes.trim() || undefined,
        sync_google: syncGoogle,
      };

      const res = await createAppointmentAction(payload);

      if (res.success && res.data) {
        toast({
          type: "success",
          title: "Consulta Agendada!",
          description: `Horário ${res.data.horario_inicio} reservado para ${res.data.client_nome} no dia ${selectedDate.split("-").reverse().join("/")}.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Não foi possível concluir o agendamento.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocorreu um erro interno de conexão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden my-6">
      {/* Header do Modal */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Novo Agendamento de Consulta
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dra. Juliana Sena • Gestão de Horários & Google Agenda
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mensagem de Erro Geral */}
      {errorMsg && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* 1. SELEÇÃO DE PACIENTE (Autocomplete) */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            <span>Paciente Cadastrado *</span>
            {selectedPatient && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                }}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                Alterar paciente
              </button>
            )}
          </label>

          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-teal-500/40 bg-teal-50/50 dark:bg-teal-950/30 text-slate-900 dark:text-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                  {selectedPatient.nome.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedPatient.nome}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>CPF: {selectedPatient.cpf}</span>
                    <span>•</span>
                    <span>Tel: {selectedPatient.telefone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800">
                <Check className="w-3.5 h-3.5 text-teal-600" />
                <span>Selecionado</span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Digite o nome, CPF ou e-mail do paciente..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setIsPatientDropdownOpen(true);
                  }}
                  onFocus={() => setIsPatientDropdownOpen(true)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>

              {isPatientDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPatients.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500">
                      Nenhum paciente cadastrado com esse termo.
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setIsPatientDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 font-bold text-xs flex items-center justify-center">
                            {p.nome.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              {p.nome}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              CPF: {p.cpf} • {p.cidade}/{p.estado}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                          Selecionar
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. SELEÇÃO DE DATA E HORÁRIOS DISPONÍVEIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Seletor Visual de Calendário */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>Data do Atendimento *</span>
            </label>
            <AppointmentCalendarPicker
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d)}
              minDate={todayStr}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
              Data selecionada:{" "}
              <strong className="text-teal-600 dark:text-teal-400">
                {selectedDate.split("-").reverse().join("/")}
              </strong>
            </p>
          </div>

          {/* Grade de Horários Disponíveis */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Horário Disponível *</span>
            </label>

            <TimeSlotGrid
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(s) => setSelectedSlot(s)}
              isLoading={isLoadingSlots}
            />
          </div>
        </div>

        {/* 3. PROCEDIMENTO & OBSERVAÇÕES */}
        <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1.5">
              Procedimento / Especialidade *
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROCEDIMENTO_PRESETS.slice(0, 4).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setProcedimento(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    procedimento === preset
                      ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-500 font-semibold"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Ex: Consulta Dermatológica, Retorno Clínico..."
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
              Observações Clínicas (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Trazer exames recentes de sangue; paciente possui queixa de dor lombar..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
            />
          </div>
        </div>

        {/* 4. OPÇÃO DE SINCRONIZAÇÃO COM O GOOGLE AGENDA */}
        <div className="p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 flex items-start gap-3">
          <input
            id="sync-google-checkbox"
            type="checkbox"
            checked={syncGoogle}
            onChange={(e) => setSyncGoogle(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-700 cursor-pointer"
          />
          <div className="text-xs">
            <label
              htmlFor="sync-google-checkbox"
              className="font-bold text-teal-900 dark:text-teal-200 cursor-pointer block"
            >
              Criar evento no Google Agenda
            </label>
            <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5 leading-relaxed">
              Gera o registro de agenda com título do atendimento, nome do paciente e link de acesso rápido direto para a sua agenda.
            </p>
          </div>
        </div>

        {/* Ações do Formulário */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Agendando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar Agendamento</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AppointmentFormModal({
  isOpen,
  onClose,
  onSuccess,
  availablePatients = INITIAL_CLIENTS,
  initialPatient = null,
}: AppointmentFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <AppointmentFormModalContent
        key={initialPatient?.id || "new-appointment"}
        onClose={onClose}
        onSuccess={onSuccess}
        availablePatients={availablePatients}
        initialPatient={initialPatient}
      />
    </div>
  );
}
