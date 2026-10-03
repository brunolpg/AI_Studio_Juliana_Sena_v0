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
  getProcedimentosAction,
  type PatientSummary,
} from "@/actions/appointment-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
import type { Client } from "@/types/client";
import type { TimeSlot, AppointmentInput, Appointment } from "@/types/appointment";
import { generateGoogleCalendarTemplateUrl } from "@/lib/google-calendar/calendar-service";
import { PROCEDIMENTO_CATEGORIES, PROCEDIMENTOS_CADASTRAIS, type Procedimento } from "@/lib/procedimentos-mock";
import {
  getNextAllowedAppointmentDate,
  isAllowedAppointmentDay,
  getAllowedStartTimesForDate,
  getDayScheduleDescription,
  getMinSelectableAppointmentDateString,
  getTodaySaoPauloDateString,
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
  const { user } = useAuth();
  const isPatient = user?.role === "paciente";
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Data mínima selecionável (hoje + 2 dias se paciente, hoje caso contrário)
  const minDate = useMemo(() => {
    return isPatient ? getMinSelectableAppointmentDateString() : getTodaySaoPauloDateString();
  }, [isPatient]);

  // Data padrão: próximo dia de atendimento permitido a partir da data mínima
  const defaultDate = useMemo(() => {
    return getNextAllowedAppointmentDate(minDate);
  }, [minDate]);

  useEffect(() => {
    if (defaultDate) {
      setSelectedDate(defaultDate);
    }
  }, [defaultDate]);

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

  // Estados de procedimentos dinâmicos
  const [procedimentosList, setProcedimentosList] = useState<Procedimento[]>(PROCEDIMENTOS_CADASTRAIS);
  const [isLoadingProcedimentos, setIsLoadingProcedimentos] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState("Consulta");
  const [procedimentoSearch, setProcedimentoSearch] = useState("");

  // Estados dos demais campos
  const [procedimento, setProcedimento] = useState("Consulta Estética");
  const [observacoes, setObservacoes] = useState("");
  const [syncGoogle, setSyncGoogle] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadProcedimentos() {
      setIsLoadingProcedimentos(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("procedimentos")
            .select("id, procedimento, categoria, descricao, duracao, valor")
            .order("categoria", { ascending: true })
            .order("procedimento", { ascending: true });
          
          if (!error && data && data.length > 0) {
            setProcedimentosList(data as Procedimento[]);
            return;
          }
        }
      } catch (err) {
        console.error("Erro ao carregar procedimentos:", err);
      } finally {
        setIsLoadingProcedimentos(false);
      }
    }
    loadProcedimentos();
  }, []);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);
  const [hasAddedToCalendar, setHasAddedToCalendar] = useState<boolean>(false);

  const selectedDuration = useMemo(() => {
    const matched = procedimentosList.find((p) => p.procedimento === procedimento);
    return matched ? Number(matched.duracao) : 1;
  }, [procedimento, procedimentosList]);

  const selectedEndTime = useMemo(() => {
    if (!selectedSlot) return "";
    const startHour = Number(selectedSlot.split(":")[0]);
    const endHour = String(startHour + selectedDuration).padStart(2, "0");
    return `${endHour}:00`;
  }, [selectedSlot, selectedDuration]);

  // Categorias extraídas dinamicamente dos procedimentos
  const categoriesList = useMemo(() => {
    if (procedimentosList.length === 0) return PROCEDIMENTO_CATEGORIES;
    const uniq = Array.from(new Set(procedimentosList.map((p) => p.categoria)));
    return uniq;
  }, [procedimentosList, PROCEDIMENTO_CATEGORIES]);

  // Revalidação imediata do slot selecionado se a duração do procedimento ou slots mudar
  useEffect(() => {
    if (!selectedSlot || slots.length === 0) return;

    const selectedIndex = slots.findIndex((s) => s.slot === selectedSlot);
    if (selectedIndex === -1) {
      setSelectedSlot(null);
      return;
    }

    if (slots[selectedIndex].isOccupied) {
      setSelectedSlot(null);
      toast({
        type: "error",
        title: "Horário Indisponível",
        description: "O horário selecionado não está mais disponível.",
      });
      return;
    }

    // 1. Limite do expediente do dia
    const lastSlot = slots[slots.length - 1];
    const H_f = lastSlot ? Number(lastSlot.endSlot.split(":")[0]) : 16;
    const startHour = Number(selectedSlot.split(":")[0]);
    if (startHour + selectedDuration > H_f) {
      setSelectedSlot(null);
      toast({
        type: "error",
        title: "Horário Inválido",
        description: "A duração do novo procedimento excede o fim do expediente para o horário selecionado. Selecione um novo horário.",
      });
      return;
    }

    // 2. Slots consecutivos livres
    let hasOverlap = false;
    for (let offset = 0; offset < selectedDuration; offset++) {
      const checkIndex = selectedIndex + offset;
      if (checkIndex >= slots.length || slots[checkIndex].isOccupied) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      setSelectedSlot(null);
      toast({
        type: "error",
        title: "Horário Inválido",
        description: "Os horários consecutivos necessários para este procedimento não estão totalmente livres. Selecione um novo horário.",
      });
    }
  }, [selectedDuration, slots, selectedSlot]);

  const calendarUrl = useMemo(() => {
    if (!confirmedAppointment) return "";
    return generateGoogleCalendarTemplateUrl({
      patientName: confirmedAppointment.client_nome,
      patientEmail: confirmedAppointment.client_email || undefined,
      patientPhone: confirmedAppointment.client_telefone || undefined,
      procedimento: confirmedAppointment.procedimento,
      date: confirmedAppointment.data,
      startTime: confirmedAppointment.horario_inicio,
      endTime: confirmedAppointment.horario_fim,
      observacoes: confirmedAppointment.observacoes,
    });
  }, [confirmedAppointment]);

  const handleAddToCalendar = () => {
    setHasAddedToCalendar(true);
    if (calendarUrl) {
      window.open(calendarUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleSendWhatsApp = () => {
    if (!confirmedAppointment) return;
    const phoneDigits = confirmedAppointment.client_telefone ? confirmedAppointment.client_telefone.replace(/\D/g, "") : "";
    const formattedDate = confirmedAppointment.data.split("-").reverse().join("/");
    const text = encodeURIComponent(
      `Olá ${confirmedAppointment.client_nome}! Seu agendamento na Clínica Dra. Juliana Sena para *${confirmedAppointment.procedimento}* foi confirmado para o dia *${formattedDate}* às *${confirmedAppointment.horario_inicio}*.\n\nAdicionar ao Google Agenda:\n${calendarUrl}`
    );
    const waUrl = phoneDigits ? `https://wa.me/55${phoneDigits}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleCloseSuccess = async () => {
    if (confirmedAppointment && !hasAddedToCalendar && confirmedAppointment.client_email) {
      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: confirmedAppointment.client_nome,
            patientEmail: confirmedAppointment.client_email,
            date: confirmedAppointment.data,
            startTime: confirmedAppointment.horario_inicio,
            endTime: confirmedAppointment.horario_fim,
            procedimento: confirmedAppointment.procedimento,
            observacoes: confirmedAppointment.observacoes,
          }),
        });
      } catch (err) {
        console.error("Erro ao enviar e-mail de contingência:", err);
      }
    }
    onSuccess();
    onClose();
  };

  const scheduleInfo = useMemo(() => {
    return selectedDate ? getDayScheduleDescription(selectedDate) : null;
  }, [selectedDate]);

  // Garante que o scroll comece no topo ao abrir o modal
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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

        // Fallback seguro via Server Action
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

            // Mantém horário se ainda disponível
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

  // 3. BUSCA DINÂMICA E RESPONSIVA DE PACIENTES
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

  // 4. SUBMISSÃO DO AGENDAMENTO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPatient || !selectedPatient.id) {
      setErrorMsg("Selecione um paciente cadastrado para o agendamento.");
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!selectedDate) {
      setErrorMsg("Selecione a data da consulta.");
      return;
    }

    // Validação de antecedência mínima de 2 dias corridos apenas para pacientes
    if (isPatient) {
      const minAllowedDate = getMinSelectableAppointmentDateString();
      if (selectedDate < minAllowedDate) {
        setErrorMsg("Os agendamentos por pacientes devem ser feitos com no mínimo 2 dias de antecedência.");
        return;
      }
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
      const matchedProc = procedimentosList.find((p) => p.procedimento === procedimento);
      const payload: AppointmentInput = {
        client_id: selectedPatient.id,
        client_nome: selectedPatient.nome,
        client_email: selectedPatient.email || undefined,
        client_telefone: selectedPatient.telefone || undefined,
        data: selectedDate,
        horario_inicio: selectedSlot,
        horario_fim: selectedEndTime,
        procedimento: procedimento.trim(),
        procedimento_id: matchedProc?.id || undefined,
        observacoes: observacoes.trim() || undefined,
        sync_google: true,
      };

      const res = await createAppointmentAction(payload);

      if (res.success && res.data) {
        setConfirmedAppointment(res.data);
        toast({
          type: "success",
          title: "Consulta Agendada com Sucesso!",
          description: `Horário ${res.data.horario_inicio} reservado para ${res.data.client_nome}.`,
        });
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

  if (confirmedAppointment) {
    const formattedDate = confirmedAppointment.data.split("-").reverse().join("/");
    return (
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto flex flex-col p-6 text-center">
        <div className="w-14 h-14 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <CalendarCheck2 className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Agendamento Confirmado!
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Olá, <strong>{confirmedAppointment.client_nome}</strong>! Sua consulta foi registrada com sucesso.
        </p>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 text-left text-xs space-y-2 mb-6 border border-slate-100 dark:border-slate-800">
          <p className="text-slate-700 dark:text-slate-300">
            <strong>Procedimento:</strong> {confirmedAppointment.procedimento}
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            <strong>Data:</strong> {formattedDate} às {confirmedAppointment.horario_inicio} - {confirmedAppointment.horario_fim}
          </p>
          {confirmedAppointment.observacoes && (
            <p className="text-slate-700 dark:text-slate-300">
              <strong>Observações:</strong> {confirmedAppointment.observacoes}
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleAddToCalendar}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            📅 Adicionar ao Google Agenda
          </button>
          
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all cursor-pointer"
          >
            📲 Enviar detalhes para meu WhatsApp
          </button>

          <button
            type="button"
            onClick={handleCloseSuccess}
            className="w-full py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col">
      {/* Header Fixo do Modal */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="truncate">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
              Novo Agendamento de Consulta
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Dra. Juliana Sena • Gestão de Horários & Consultas
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Formulário com Container Interno de Rolagem Vertical e Rodapé Fixo */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Mensagem de Erro Geral */}
        {errorMsg && (
          <div className="shrink-0 mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Corpo Rolável do Formulário */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 overscroll-contain"
        >
          {/* 1. SELEÇÃO DE PACIENTE (GARANTIDO NO TOPO PARA MOBILE E DESKTOP) */}
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-600" />
                <span>1. Paciente Cadastrado *</span>
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
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar paciente por nome, CPF ou e-mail..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setIsPatientDropdownOpen(true);
                    }}
                    onFocus={() => setIsPatientDropdownOpen(true)}
                    className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
                  />
                  {patientSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPatientSearch("");
                        setIsPatientDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isPatientDropdownOpen && (
                  <div className="absolute z-40 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800">
                    {isLoadingPatients ? (
                      <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando pacientes cadastrados...</span>
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
                            ? "Cadastre o paciente na aba 'Pacientes' antes de agendar a consulta."
                            : "Verifique a digitação ou limpe a busca para ver a lista."}
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
                          className="w-full text-left p-3 hover:bg-teal-50/70 dark:hover:bg-teal-950/40 flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0">
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
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 shrink-0 ml-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Seletor Visual de Calendário */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
                  <span>2. Data do Atendimento *</span>
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
                minDate={minDate}
                isAdminOrProfessional={!isPatient}
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

            {/* Grade de Horários Disponíveis */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  <span>3. Horários Disponíveis *</span>
                </div>
                {selectedSlot && (
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-2.5 py-0.5 rounded-full border border-teal-300 dark:border-teal-700">
                    {selectedSlot} às {selectedEndTime} ({selectedDuration}h)
                  </span>
                )}
              </label>

              <TimeSlotGrid
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={(s) => setSelectedSlot(s)}
                isLoading={isLoadingSlots}
                dateStr={selectedDate}
                duracao={selectedDuration}
              />
            </div>
          </div>

          {/* 3. PROCEDIMENTO / ESPECIALIDADE & OBSERVAÇÕES */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                4. Procedimento / Especialidade *
              </label>

              {/* Campo de Busca de Procedimentos */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquise o procedimento desejado..."
                  value={procedimentoSearch}
                  onChange={(e) => setProcedimentoSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              {/* Abas de Categorias */}
              <div className="flex flex-wrap gap-1.5 py-1">
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategoria(cat);
                      setProcedimentoSearch("");
                    }}
                    className={`text-[10px] sm:text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      selectedCategoria === cat && !procedimentoSearch
                        ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Lista Dinâmica de Procedimentos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {isLoadingProcedimentos ? (
                  <div className="col-span-full py-4 text-center text-xs text-slate-400">
                    <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-1.5" />
                    <span>Carregando procedimentos...</span>
                  </div>
                ) : (() => {
                  const query = procedimentoSearch.toLowerCase().trim();
                  const filteredList = procedimentosList.filter((p) => {
                    const matchesSearch = p.procedimento.toLowerCase().includes(query) || p.categoria.toLowerCase().includes(query);
                    const matchesCategory = p.categoria === selectedCategoria;
                    return query ? matchesSearch : matchesCategory;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="col-span-full py-4 text-center text-xs text-slate-500">
                        Nenhum procedimento encontrado.
                      </div>
                    );
                  }

                  return filteredList.map((p) => {
                    const isSelected = procedimento === p.procedimento;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProcedimento(p.procedimento)}
                        className={`text-left p-2.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? "bg-teal-500/10 border-teal-500 text-teal-950 dark:text-teal-200 font-semibold"
                            : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70"
                        }`}
                      >
                        <div className="text-xs font-semibold truncate w-full">
                          {p.procedimento}
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500 dark:text-slate-400 w-full">
                          <span>Duração: <strong className="font-semibold text-slate-700 dark:text-slate-200">{p.duracao}h</strong></span>
                          <span className="font-bold text-teal-600 dark:text-teal-400">
                            R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Campo Selecionado / Customizado */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">Procedimento Selecionado:</span>
                {(() => {
                  const matched = procedimentosList.find((p) => p.procedimento === procedimento);
                  if (matched) {
                    return (
                      <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-500/5 dark:bg-teal-950/20 flex items-center justify-between gap-3 shadow-xs">
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {matched.procedimento}
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Duração: <strong className="font-semibold text-slate-700 dark:text-slate-300">{matched.duracao}h</strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400">
                            R$ {Number(matched.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <input
                      type="text"
                      required
                      readOnly
                      value={procedimento}
                      placeholder="Selecione um dos procedimentos listados acima"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none font-semibold text-teal-700 dark:text-teal-300 cursor-not-allowed select-none"
                    />
                  );
                })()}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Observações Clínicas (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Trazer exames recentes de sangue; queixa de dor lombar..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Rodapé Fixo com Ações */}
        <div className="shrink-0 flex items-center justify-end gap-2.5 px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs z-10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <AppointmentFormModalContent
        key={initialPatient?.id || "new-appointment"}
        onClose={onClose}
        onSuccess={onSuccess}
        initialPatient={initialPatient}
      />
    </div>
  );
}
