"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Search,
  Plus,
  Calendar,
  CalendarCheck2,
  Clock,
  ExternalLink,
  Edit2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Cloud,
  CloudOff,
  CalendarDays,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  getAppointmentsAction,
  cancelAppointmentAction,
  getCalendarIntegrationStatusAction,
} from "@/actions/appointment-actions";
import { AppointmentFormModal } from "./appointment-form-modal";
import { AppointmentEditModal } from "./appointment-edit-modal";
import { AppointmentDetailsModal } from "./appointment-details-modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
import type { Appointment, AppointmentFilterTab } from "@/types/appointment";
import type { PaginatedResult } from "@/types/client";

export function AppointmentTableView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPatient = user?.role === "paciente";
  const [isPending, startTransition] = useTransition();

  // Estados de busca e filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilterTab, setActiveFilterTab] = useState<AppointmentFilterTab>("proximos");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dados paginados
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Appointment>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    hasMore: false,
  });

  // Status da integração Google Calendar
  const [calendarStatus, setCalendarStatus] = useState<{
    isConfigured: boolean;
    calendarId: string;
  }>({
    isConfigured: false,
    calendarId: "primary",
  });

  // Saúde da integração Google Calendar
  const [calendarHealth, setCalendarHealth] = useState<{
    healthy: boolean;
    status?: string;
    calendarSummary?: string;
    canManageCalendar?: boolean;
    message?: string;
  }>({ healthy: false, status: "checking", canManageCalendar: false });

  const [isSyncing, setIsSyncing] = useState(false);

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Debounce busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Carrega status da API e saúde do Google Calendar
  useEffect(() => {
    async function loadStatus() {
      try {
        const status = await getCalendarIntegrationStatusAction();
        setCalendarStatus(status);
      } catch (err) {
        console.error(err);
      }
    }

    async function checkHealth() {
      try {
        const res = await fetch("/api/calendar/health");
        const data = await res.json();
        setCalendarHealth(data);
      } catch {
        setCalendarHealth({ healthy: false, message: "Não conectado" });
      }
    }

    loadStatus();
    checkHealth();
  }, []);

  const handleTriggerSync = async () => {
    if (!calendarHealth.canManageCalendar) {
      toast({
        type: "error",
        title: "Acesso Restrito",
        description: "Apenas administradores e profissionais podem sincronizar o Google Agenda.",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({
          type: "success",
          title: "Sincronização Concluída",
          description: data.message,
        });
        loadAppointments();
      } else {
        toast({
          type: "error",
          title: "Aviso de Sincronização",
          description: data.message || "Erro durante a sincronização.",
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Erro de Conexão",
        description: "Não foi possível sincronizar com o Google Calendar.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Carregar agendamentos
  const loadAppointments = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await getAppointmentsAction({
          search: debouncedSearch,
          tab: activeFilterTab,
          page: currentPage,
          pageSize,
        });

        if (res.success && res.data) {
          setPaginatedData(res.data);
        } else {
          toast({
            type: "error",
            title: "Erro ao buscar agendamentos",
            description: res.message,
          });
        }
      } catch (err) {
        console.error(err);
        toast({
          type: "error",
          title: "Erro de conexão",
          description: "Falha ao sincronizar agenda de consultas.",
        });
      }
    });
  }, [debouncedSearch, activeFilterTab, currentPage, pageSize, toast]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Ação de Cancelamento
  const handleCancelAppointment = (appointment: Appointment) => {
    setAppointmentToCancel(appointment);
  };

  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    setIsCancelling(true);
    try {
      const res = await cancelAppointmentAction(appointmentToCancel.id);
      if (res.success) {
        toast({
          type: "success",
          title: "Agendamento Cancelado",
          description: `O horário de ${appointmentToCancel.client_nome} foi liberado.`,
        });
        setAppointmentToCancel(null);
        loadAppointments();
      } else {
        toast({
          type: "error",
          title: "Erro ao cancelar",
          description: res.message,
        });
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Erro interno",
        description: "Não foi possível cancelar o agendamento.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenEdit = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsEditModalOpen(true);
  };

  const handleOpenDetails = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Banner Resiliente / Status do Google Calendar */}
      <div className="p-3.5 px-4 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              calendarHealth.healthy
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
            }`}
          >
            <CalendarCheck2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                Google Agenda (Calendar v3)
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  calendarHealth.healthy
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
                    : calendarHealth.status === "error" || calendarHealth.status === "no_access" || calendarHealth.status === "not_configured"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200"
                }`}
                title={calendarHealth.message}
              >
                {calendarHealth.healthy ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Agenda: {calendarHealth.calendarSummary || "Dra. Juliana"}</span>
                  </>
                ) : calendarHealth.status === "error" || calendarHealth.status === "no_access" || calendarHealth.status === "not_configured" ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>Configuração necessária</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-slate-400" />
                    <span>Não conectado</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {calendarHealth.healthy
                ? `Sincronização bidirecional ativa com o Google Agenda da Dra. Juliana.`
                : calendarHealth.message || `A agenda da Dra. Juliana ainda não está configurada.`}
              {!calendarHealth.canManageCalendar && (
                <span className="block text-[10px] text-amber-600 mt-0.5">
                  Nota: Apenas administradores e profissionais podem conectar ou sincronizar o Google Agenda.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {calendarHealth.canManageCalendar ? (
            <>
              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing || !calendarHealth.healthy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#3B9E8C] hover:bg-[#2d8272] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                <span>{isSyncing ? "Sincronizando..." : "Sincronizar Agenda"}</span>
              </button>
            </>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              {calendarHealth.healthy ? "Sincronizado" : "Não conectado"}
            </span>
          )}
        </div>
      </div>

      {/* Orientação informativa para Pacientes */}
      {isPatient && (
        <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-xs text-teal-900 dark:text-teal-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-teal-600 shrink-0" />
          <span>Para cancelamentos ou reagendamentos, entre em contato diretamente com a clínica.</span>
        </div>
      )}

      {/* A. Barra Superior de Controle e Busca */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        {/* Campo de Busca Amplo */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="appointment-search-input"
            type="text"
            placeholder="Buscar por paciente, profissional ou data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Filtros Rápidos em Pílulas (Tabs) + Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pílulas de Filtro */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button
              id="filter-all-appointments"
              onClick={() => {
                setActiveFilterTab("todos");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilterTab === "todos"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Todos
            </button>

            <button
              id="filter-today-appointments"
              onClick={() => {
                setActiveFilterTab("hoje");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilterTab === "hoje"
                  ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 font-bold shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Hoje
            </button>

            <button
              id="filter-upcoming-appointments"
              onClick={() => {
                setActiveFilterTab("proximos");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilterTab === "proximos"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Próximos
            </button>

            <button
              id="filter-completed-appointments"
              onClick={() => {
                setActiveFilterTab("concluidos");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilterTab === "concluidos"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Concluídos
            </button>

            <button
              id="filter-cancelled-appointments"
              onClick={() => {
                setActiveFilterTab("cancelados");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeFilterTab === "cancelados"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              Cancelados
            </button>
          </div>

          {/* Botão de Atualizar Circular */}
          <button
            id="refresh-appointments-btn"
            onClick={() => loadAppointments()}
            disabled={isPending}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
            title="Recarregar / sincronizar dados com o Google Agenda"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-teal-600" : ""}`} />
          </button>

          {/* Botão Principal de Ação Verde Arredondado */}
          <button
            id="open-new-appointment-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* C. Lista / Tabela de Agendamentos */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Paciente</th>
                <th className="py-3.5 px-4">Data / Horário</th>
                <th className="py-3.5 px-4">Procedimento / Especialidade</th>
                <th className="py-3.5 px-4">Contato</th>
                <th className="py-3.5 px-4">Google Agenda</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {isPending && paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Sincronizando agendamentos...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                      <div className="p-3 bg-teal-50 dark:bg-slate-800 rounded-full mb-3 text-teal-600 dark:text-teal-400">
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                        Nenhum agendamento encontrado
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {searchTerm
                          ? `Nenhum resultado para "${searchTerm}". Tente outro termo.`
                          : activeFilterTab === "hoje"
                          ? "Não há consultas agendadas para hoje."
                          : "Clique no botão acima para agendar o primeiro atendimento."}
                      </p>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                      >
                        + Agendar Consulta Agora
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.data.map((appointment) => {
                  const [year, month, day] = appointment.data.split("-");
                  const dateFormatted = `${day}/${month}/${year}`;

                  return (
                    <tr
                      key={appointment.id}
                      id={`appointment-row-${appointment.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* PACIENTE: Avatar em quadrado verde claro arredondado + Nome em negrito */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-teal-500/20">
                            {appointment.client_nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 block truncate max-w-[200px]">
                              {appointment.client_nome}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                              Dra. Juliana Sena
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* DATA / HORÁRIO: Data + pílula destacando horário */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                          {dateFormatted}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/80 dark:border-teal-800/60 mt-0.5 font-mono">
                          <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                          <span>
                            {appointment.horario_inicio} - {appointment.horario_fim}
                          </span>
                        </span>
                      </td>

                      {/* PROCEDIMENTO / ESPECIALIDADE */}
                      <td className="py-3 px-4">
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 block">
                          {appointment.procedimento}
                        </span>
                        {appointment.observacoes && (
                          <span className="text-[11px] text-slate-400 block truncate max-w-[220px]">
                            {appointment.observacoes}
                          </span>
                        )}
                      </td>

                      {/* CONTATO: Telefone e e-mail */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-700 dark:text-slate-300 block">
                          {appointment.client_telefone}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[170px]">
                          {appointment.client_email}
                        </span>
                      </td>

                      {/* GOOGLE AGENDA: Badge com ícone indicando status de sincronização */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {appointment.synced_with_google ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Sincronizado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                            <span>Local</span>
                          </span>
                        )}
                      </td>

                      {/* STATUS: Pílulas coloridas */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {appointment.status === "Confirmado" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Confirmado
                          </span>
                        ) : appointment.status === "Pendente" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Pendente
                          </span>
                        ) : appointment.status === "Concluído" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Concluído
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* AÇÕES: Abrir no Google Agenda com link direto, Editar horário e Cancelar agendamento */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Abrir no Google Agenda */}
                          {appointment.google_html_link && (
                            <a
                              href={appointment.google_html_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
                              title="Abrir evento diretamente no Google Agenda"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}

                          {/* Visualizar Detalhes */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(appointment)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Ver detalhes da consulta"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Editar Horário */}
                          {appointment.status !== "Cancelado" && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(appointment)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar horário ou status"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancelar Agendamento (Apenas para Admin e Profissional) */}
                          {!isPatient && appointment.status !== "Cancelado" && (
                            <button
                              type="button"
                              onClick={() => handleCancelAppointment(appointment)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Cancelar agendamento"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de Paginação: Réplica Exata da Tabela de Pacientes */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              Mostrando {paginatedData.data.length} de {paginatedData.total} agendamentos
            </span>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <span>Por página:</span>
              <select
                id="appointment-page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs">
              Página {paginatedData.page} de {Math.max(1, paginatedData.totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <button
                id="prev-appointment-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isPending}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                id="next-appointment-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(paginatedData.totalPages, p + 1))}
                disabled={currentPage >= paginatedData.totalPages || isPending}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Novo Agendamento */}
      <AppointmentFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadAppointments();
        }}
      />

      {/* Modal de Edição de Agendamento */}
      <AppointmentEditModal
        isOpen={isEditModalOpen}
        appointment={selectedAppointment}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedAppointment(null);
        }}
        onSuccess={() => {
          loadAppointments();
        }}
      />

      {/* Modal de Detalhes do Agendamento */}
      <AppointmentDetailsModal
        isOpen={isDetailsModalOpen}
        appointment={selectedAppointment}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(null);
        }}
        onEdit={(apt) => {
          setIsDetailsModalOpen(false);
          setSelectedAppointment(apt);
          setIsEditModalOpen(true);
        }}
      />

      {/* Modal de Confirmação de Cancelamento */}
      {appointmentToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Cancelar Agendamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação liberará o horário na agenda.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1">
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Paciente:</strong> {appointmentToCancel.client_nome}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Data e Horário:</strong> {appointmentToCancel.data} às {appointmentToCancel.horario_inicio} - {appointmentToCancel.horario_fim}
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Procedimento:</strong> {appointmentToCancel.procedimento}
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja cancelar esta consulta? O status será alterado para cancelado.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAppointmentToCancel(null)}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {isCancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelando...</span>
                  </>
                ) : (
                  <span>Confirmar Cancelamento</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
