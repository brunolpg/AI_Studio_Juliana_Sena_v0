"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Search,
  Check,
  CalendarCheck2,
  AlertCircle,
  UserX,
  UserCheck,
  Users,
} from "lucide-react";
import { AppointmentCalendarPicker } from "./appointment-calendar-picker";
import { TimeSlotGrid } from "./time-slot-grid";
import {
  getTimeSlotsForDateAction,
  createAppointmentAction,
  getActivePatientsForSchedulingAction,
  type PatientSummary,
} from "@/actions/appointment-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type { TimeSlot, AppointmentInput } from "@/types/appointment";
import {
  getNextAllowedAppointmentDate,
  isAllowedAppointmentDay,
  getAllowedStartTimesForDate,
  getDayScheduleDescription,
} from "@/types/appointment";

export type SelectablePatient = PatientSummary | Client;

interface AppointmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatient?: SelectablePatient | null;
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
  initialPatient: SelectablePatient | null;
}

function AppointmentFormModalContent({
  onClose,
  onSuccess,
  initialPatient,
}: FormContentProps) {
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data padrão: próximo dia de atendimento permitido (Segunda, Quinta ou Sábado)
  const defaultDate = useMemo(() => {
    return getNextAllowedAppointmentDate();
  }, []);

  // Estados dos pacientes reais via Supabase (SEM MOCK DATA)
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<SelectablePatient | null>(initialPatient);
  const [patientSearch, setPatientSearch] = useState("");
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // Estados de data e grade de horários
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Estados dos demais campos
  const [procedimento, setProcedimento] = useState(PROCEDIMENTO_PRESETS[0]);
  const [observacoes, setObservacoes] = useState("");
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scheduleInfo = useMemo(() => {
    return selectedDate ? getDayScheduleDescription(selectedDate) : null;
  }, [selectedDate]);

  // Fecha o dropdown se o usuário clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPatientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 1. CARREGAMENTO REAL DE PACIENTES DO SUPABASE (Sem dados mockados)
  useEffect(() => {
    let isMounted = true;

    async function fetchPatientsFromSupabase() {
      setIsLoadingPatients(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Consulta direta no Supabase conforme especificação:
          // supabase.from('pacientes').select('id, nome, cpf, email, telefone').is('deleted_at', null).order('nome', { ascending: true })
          const { data, error } = await supabase
            .from("pacientes")
            .select("id, nome, cpf, email, telefone")
            .is("deleted_at", null)
            .order("nome", { ascending: true });

          if (!error && data && isMounted) {
            setPatients(data as PatientSummary[]);
            return;
          }
        }

        // Fallback seguro via Server Action (com service role caso anon key do browser precise)
        const res = await getActivePatientsForSchedulingAction();
        if (isMounted) {
          if (res.success && res.data) {
            setPatients(res.data);
          } else {
            setPatients([]);
          }
        }
      } catch (err) {
        console.error("Erro ao consultar pacientes no Supabase:", err);
        if (isMounted) setPatients([]);
      } finally {
        if (isMounted) setIsLoadingPatients(false);
      }
    }

    fetchPatientsFromSupabase();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. CARREGAMENTO DE SLOTS DA GRADE
  useEffect(() => {
    let isMounted = true;
    async function loadSlots() {
      if (!selectedDate) return;
      setIsLoadingSlots(true);
      setErrorMsg(null);
      try {
        const res = await getTimeSlotsForDateAction(selectedDate);
        if (isMounted) {
          if (res.success && res.data) {
            const loadedSlots = res.data;
            setSlots(loadedSlots);
            // Se o slot atualmente selecionado estiver ocupado na nova data, limpa a seleção
            setSelectedSlot((prev) => {
              if (!prev) return null;
              const currentSlotObj = loadedSlots.find((s) => s.slot === prev);
              return currentSlotObj?.isOccupied ? null : prev;
            });
          } else {
            setSlots([]);
            if (res.message) {
              setErrorMsg(res.message);
            }
          }
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

  // 3. BUSCA DINÂMICA E RESPONSIVA (Case-insensitive em nome, CPF ou e-mail nos dados reais do Supabase)
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 8);
    const q = patientSearch.toLowerCase().trim();
    const digitsOnly = q.replace(/\D/g, "");

    return patients.filter((p) => {
      const nomeMatch = p.nome ? p.nome.toLowerCase().includes(q) : false;
      const emailMatch = p.email ? p.email.toLowerCase().includes(q) : false;
      const cpfRaw = p.cpf ? p.cpf.toLowerCase() : "";
      const cpfDigits = p.cpf ? p.cpf.replace(/\D/g, "") : "";
      const cpfMatch = cpfRaw.includes(q) || (digitsOnly.length > 0 && cpfDigits.includes(digitsOnly));
      const telDigits = p.telefone ? p.telefone.replace(/\D/g, "") : "";
      const telMatch = (p.telefone && p.telefone.includes(q)) || (digitsOnly.length > 0 && telDigits.includes(digitsOnly));

      return nomeMatch || emailMatch || cpfMatch || telMatch;
    });
  }, [patientSearch, patients]);

  // 4. SUBMISSÃO DO AGENDAMENTO (Garante integridade com appointments_client_id_fkey)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPatient || !selectedPatient.id) {
      setErrorMsg("Selecione um paciente cadastrado para o agendamento.");
      return;
    }

    if (!selectedDate) {
      setErrorMsg("Selecione a data da consulta.");
      return;
    }

    // Validação de dias permitidos (Segunda, Quinta ou Sábado)
    if (!isAllowedAppointmentDay(selectedDate)) {
      setErrorMsg("A Dra. Juliana atende apenas às segundas, quintas (09h-16h) e sábados (13h-18h).");
      return;
    }

    if (!selectedSlot) {
      setErrorMsg("Selecione um dos horários disponíveis na grade.");
      return;
    }

    // Validação de horário permitido para o dia
    const allowedTimes = getAllowedStartTimesForDate(selectedDate);
    if (!allowedTimes.includes(selectedSlot)) {
      setErrorMsg("Horário fora da grade de atendimento permitida para este dia.");
      return;
    }

    if (!procedimento.trim()) {
      setErrorMsg("Informe o procedimento ou especialidade da consulta.");
      return;
    }

    setIsSubmitting(true);
    try {
      // client_id recebe obrigatoriamente o UUID real do paciente da tabela pacientes
      const payload: AppointmentInput = {
        client_id: selectedPatient.id,
        client_nome: selectedPatient.nome,
        client_email: selectedPatient.email || undefined,
        client_telefone: selectedPatient.telefone || undefined,
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
          title: "Consulta Agendada com Sucesso!",
          description: `Horário ${res.data.horario_inicio} reservado para ${res.data.client_nome} no dia ${selectedDate.split("-").reverse().join("/")}.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Não foi possível concluir o agendamento.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocorreu um erro interno de conexão ao salvar o agendamento.");
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
              Dra. Juliana Sena • Gestão de Horários & Integração Supabase
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
        {/* 1. SELEÇÃO DE PACIENTE (Consulta Real Supabase + Autocomplete) */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Paciente Cadastrado *</span>
            </span>
            {selectedPatient && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setPatientSearch("");
                  setIsPatientDropdownOpen(true);
                }}
                className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer font-medium"
              >
                Alterar paciente
              </button>
            )}
          </label>

          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-teal-500/40 bg-teal-50/50 dark:bg-teal-950/30 text-slate-900 dark:text-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {selectedPatient.nome ? selectedPatient.nome.charAt(0).toUpperCase() : "P"}
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {selectedPatient.nome}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    <span>CPF: {selectedPatient.cpf || "Não informado"}</span>
                    {selectedPatient.email && (
                      <>
                        <span>•</span>
                        <span className="truncate">{selectedPatient.email}</span>
                      </>
                    )}
                    {selectedPatient.telefone && (
                      <>
                        <span>•</span>
                        <span>{selectedPatient.telefone}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 shrink-0 ml-2">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
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
                <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingPatients ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando pacientes cadastrados no Supabase...</span>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="p-4 text-center space-y-1.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                        <UserX className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {patients.length === 0
                          ? "Nenhum paciente cadastrado encontrado."
                          : "Nenhum paciente encontrado para esta busca."}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        {patients.length === 0
                          ? "Nenhum paciente cadastrado encontrado. Cadastre o paciente na aba Pacientes antes de agendar."
                          : "Verifique se digitou o nome, CPF ou e-mail corretamente."}
                      </p>
                    </div>
                  ) : (
                    filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setIsPatientDropdownOpen(false);
                          setPatientSearch("");
                        }}
                        className="w-full text-left p-2.5 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {p.nome ? p.nome.charAt(0).toUpperCase() : "P"}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {p.nome}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              CPF: {p.cpf || "Sem CPF"} {p.email ? `• ${p.email}` : ""} {p.telefone ? `• ${p.telefone}` : ""}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 shrink-0 ml-2">
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
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
                <span>Data do Atendimento *</span>
              </span>
              {scheduleInfo?.isOpen && (
                <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
                  {scheduleInfo.dayName}
                </span>
              )}
            </label>

            <AppointmentCalendarPicker
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d)}
              minDate={defaultDate}
            />

            <div className="flex items-center justify-between text-[11px] px-1">
              <p className="text-slate-500 dark:text-slate-400">
                Data selecionada:{" "}
                <strong className="text-teal-600 dark:text-teal-400 font-bold">
                  {selectedDate ? selectedDate.split("-").reverse().join("/") : "Nenhuma"}
                </strong>
                {scheduleInfo?.dayName ? ` (${scheduleInfo.dayName})` : ""}
              </p>
            </div>
          </div>

          {/* Grade de Horários Disponíveis em Chips (Início de Sessão de 1 em 1 hora) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>Horários Disponíveis (Início da Sessão) *</span>
              </div>
              {selectedSlot && (
                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-2 py-0.5 rounded-full border border-teal-300 dark:border-teal-700">
                  {selectedSlot} selecionado
                </span>
              )}
            </label>

            <TimeSlotGrid
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(s) => setSelectedSlot(s)}
              isLoading={isLoadingSlots}
              dateStr={selectedDate}
            />
          </div>
        </div>

        {/* 3. PROCEDIMENTO / ESPECIALIDADE & OBSERVAÇÕES */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Procedimento / Especialidade *
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PROCEDIMENTO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setProcedimento(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    procedimento === preset
                      ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/40 font-semibold"
                      : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={procedimento}
              onChange={(e) => setProcedimento(e.target.value)}
              placeholder="Ex: Consulta Dermatológica Inicial"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
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
  initialPatient = null,
}: AppointmentFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <AppointmentFormModalContent
        key={initialPatient?.id || "new-appointment"}
        onClose={onClose}
        onSuccess={onSuccess}
        initialPatient={initialPatient}
      />
    </div>
  );
}
