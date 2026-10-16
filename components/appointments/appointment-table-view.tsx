"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo, useRef } from "react";
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
  FileText,
  CreditCard,
  QrCode,
  Copy,
  Upload,
  X,
  Paperclip,
  Loader2,
} from "lucide-react";
import {
  getAppointmentsAction,
  cancelAppointmentAction,
  getCalendarIntegrationStatusAction,
  updateAppointmentReceiptAction,
  addAppointmentAttachmentsAction,
} from "@/actions/appointment-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { AppointmentFormModal } from "./appointment-form-modal";
import { AppointmentEditModal } from "./appointment-edit-modal";
import { AppointmentDetailsModal } from "./appointment-details-modal";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-context";
function formatShortName(fullName?: string): string {
  if (!fullName) return "Paciente";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleInitials = parts
    .slice(1, -1)
    .filter((p) => p.length > 2) // ignora preposições como 'de', 'da', 'do'
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");

  return middleInitials ? `${firstName} ${middleInitials} ${lastName}` : `${firstName} ${lastName}`;
}

function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txId = '***',
}: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
}) {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };
  const cleanKey = pixKey.replace(/\D/g, '');
  const formattedKey = cleanKey.length === 11 ? `+55${cleanKey}` : cleanKey;
  const mai = formatField('00', 'BR.GOV.BCB.PIX') + formatField('01', formattedKey);
  let payload =
    formatField('00', '01') +
    formatField('26', mai) +
    formatField('52', '0000') +
    formatField('53', '986') +
    (amount > 0 ? formatField('54', amount.toFixed(2)) : '') +
    formatField('58', 'BR') +
    formatField('59', merchantName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25)) +
    formatField('60', merchantCity.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15)) +
    formatField('62', formatField('05', txId));
  payload += '6304';
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xffff;
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return payload.slice(0, -4) + formatField('63', crcHex);
}

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

  // Modal de Pagamento / Recibo do Paciente
  const [paymentModalAppointment, setPaymentModalAppointment] = useState<Appointment | null>(null);
  const [isUploadingPaymentReceipt, setIsUploadingPaymentReceipt] = useState(false);
  const [copiedPixPaymentModal, setCopiedPixPaymentModal] = useState(false);
  const [isGeneratingCheckout, setIsGeneratingCheckout] = useState(false);

  const handlePayWithInfinitePay = async (appointmentId?: string) => {
    if (!appointmentId) {
      toast({
        type: "error",
        title: "Agendamento não identificado",
        description: "Selecione um agendamento válido."
      });
      return;
    }
    setIsGeneratingCheckout(true);
    try {
      const res = await fetch("/api/infinitepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Não foi possível gerar o link de pagamento.");
      }
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro no Checkout",
        description: err.message || "Falha ao conectar com a InfinitePay."
      });
    } finally {
      setIsGeneratingCheckout(false);
    }
  };

  // Modal de Anexos Clínicos (Exames e Fotos)
  const [attachmentModalAppointment, setAttachmentModalAppointment] = useState<Appointment | null>(null);
  const [isUploadingClinical, setIsUploadingClinical] = useState(false);

  const handleUploadClinicalAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !attachmentModalAppointment) return;

    const currentCount = attachmentModalAppointment.anexos_clinicos?.length || 0;
    const remainingSlots = 3 - currentCount;
    if (files.length > remainingSlots) {
      toast({
        type: "error",
        title: "Limite excedido",
        description: `Você só pode adicionar mais ${remainingSlots} arquivo(s).`,
      });
      return;
    }

    setIsUploadingClinical(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({ type: "error", title: "Erro", description: "Supabase não conectado." });
        return;
      }

      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          toast({ type: "error", title: "Arquivo muito grande", description: `O arquivo ${file.name} excede 10MB.` });
          continue;
        }
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `anexos/${attachmentModalAppointment.id}_${Date.now()}_${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('anexos-consultas')
          .upload(fileName, file, { upsert: false });

        if (uploadErr) {
          toast({ type: "error", title: "Erro no upload", description: uploadErr.message });
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from('anexos-consultas')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        const res = await addAppointmentAttachmentsAction({
          appointmentId: attachmentModalAppointment.id,
          newAttachmentUrls: uploadedUrls,
        });

        if (res.success && res.data) {
          const updatedAppt = { ...attachmentModalAppointment, anexos_clinicos: res.data };
          setAttachmentModalAppointment(updatedAppt);
          setPaginatedData((prev) => ({
            ...prev,
            data: prev.data.map((item) => item.id === updatedAppt.id ? updatedAppt : item),
          }));
          toast({ type: "success", title: "Sucesso", description: res.message });
        } else {
          toast({ type: "error", title: "Erro", description: res.message });
        }
      }
    } catch (err: any) {
      console.error("Erro no upload de anexos:", err);
      toast({ type: "error", title: "Erro", description: "Falha ao enviar arquivos." });
    } finally {
      setIsUploadingClinical(false);
    }
  };


  const PIX_KEY = "71986612878";
  const PIX_BENEFICIARIO = "Juliana Sena de Souza Vieira";

  const modalPixAmount = Number(paymentModalAppointment?.valor_cobrado || 200);
  const modalPixPayload = useMemo(() => {
    if (!paymentModalAppointment) return "";
    return generatePixPayload({
      pixKey: "71986612878",
      merchantName: "JULIANA VIEIRA",
      merchantCity: "SALVADOR",
      amount: modalPixAmount,
    });
  }, [paymentModalAppointment, modalPixAmount]);

  const modalPixQrCodeUrl = useMemo(() => {
    if (!modalPixPayload) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(modalPixPayload)}`;
  }, [modalPixPayload]);

  const handleCopyPixPaymentModal = () => {
    navigator.clipboard.writeText(modalPixPayload);
    setCopiedPixPaymentModal(true);
    setTimeout(() => setCopiedPixPaymentModal(false), 2500);
  };

  const handleUploadPaymentReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !paymentModalAppointment) return;

    setIsUploadingPaymentReceipt(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          type: "error",
          title: "Erro de Conexão",
          description: "Não foi possível conectar ao Supabase.",
        });
        return;
      }

      const fileExt = file.name.split(".").pop() || "png";
      const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `comprovantes/${cleanFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("comprovantes-pagamento")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        toast({
          type: "error",
          title: "Erro no Upload",
          description: uploadError.message,
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("comprovantes-pagamento")
        .getPublicUrl(filePath);

      const receiptUrl = publicUrlData?.publicUrl;
      if (!receiptUrl) {
        toast({
          type: "error",
          title: "Erro de URL",
          description: "Não foi possível obter a URL do comprovante.",
        });
        return;
      }

      const res = await updateAppointmentReceiptAction({
        appointmentId: paymentModalAppointment.id,
        receiptUrl,
      });

      if (res.success) {
        toast({
          type: "success",
          title: "Recibo Enviado!",
          description: "O comprovante foi registrado e está em análise.",
        });

        const targetId = paymentModalAppointment.id;

        setPaymentModalAppointment((prev) =>
          prev && prev.id === targetId
            ? {
                ...prev,
                comprovante_url: receiptUrl,
                status_pagamento: "Em Análise",
              }
            : null
        );

        setPaginatedData((prev) => ({
          ...prev,
          data: prev.data.map((apt) =>
            apt.id === targetId
              ? {
                  ...apt,
                  comprovante_url: receiptUrl,
                  status_pagamento: "Em Análise",
                }
              : apt
          ),
        }));
      } else {
        toast({
          type: "error",
          title: "Erro ao Atualizar Agendamento",
          description: res.message,
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        title: "Erro Inesperado",
        description: "Ocorreu uma falha ao enviar o comprovante.",
      });
    } finally {
      setIsUploadingPaymentReceipt(false);
    }
  };

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

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Carregar agendamentos (dependências exclusivamente primitivas e estáveis)
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
          toastRef.current({
            type: "error",
            title: "Erro ao buscar agendamentos",
            description: res.message,
          });
        }
      } catch (err) {
        console.error(err);
        toastRef.current({
          type: "error",
          title: "Erro de conexão",
          description: "Falha ao sincronizar agenda de consultas.",
        });
      }
    });
  }, [debouncedSearch, activeFilterTab, currentPage, pageSize]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Polling automático seguro para status 'Em Análise' (mínimo de 60s, com limpeza no unmount)
  const hasPendingPayments = useMemo(() => {
    return (paginatedData?.data || []).some(
      (apt) => apt.status_pagamento === "Em Análise" || (apt as any).comprovante_url && apt.status_pagamento !== "Pago"
    );
  }, [paginatedData?.data]);

  useEffect(() => {
    if (!hasPendingPayments) return;

    const timer = setInterval(() => {
      loadAppointments();
    }, 60000); // 60 segundos

    return () => clearInterval(timer);
  }, [hasPendingPayments, loadAppointments]);

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
      {!isPatient && (
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
      )}

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
            placeholder={
              isPatient
                ? "Buscar por procedimento ou data..."
                : "Buscar por paciente, profissional ou data..."
            }
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
                {!isPatient && (
                  <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300 w-52 max-w-[210px]">
                    PACIENTE
                  </th>
                )}
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  Data / Horário
                </th>
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  PROCEDIMENTO
                </th>
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  Contato
                </th>
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  Google Agenda
                </th>
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  Status
                </th>
                <th className="py-2.5 px-3 text-left font-bold text-slate-700 dark:text-slate-300">
                  PAGAMENTO
                </th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {isPending && paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={isPatient ? 7 : 8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Sincronizando agendamentos...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.data.length === 0 ? (
                <tr>
                  <td colSpan={isPatient ? 7 : 8} className="py-12 text-center">
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
                paginatedData.data.map((rawAppointment) => {
                  const appointment = rawAppointment as Appointment & {
                    status_pagamento?: string | null;
                    comprovante_url?: string | null;
                    patientPhoto?: string | null;
                  };
                  const [year, month, day] = appointment.data.split("-");
                  const dateFormatted = `${day}/${month}/${year}`;

                  return (
                    <tr
                      key={appointment.id}
                      id={`appointment-row-${appointment.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* PACIENTE (Foto, Largura Reduzida e Nome Abreviado) */}
                      {!isPatient && (
                        <td className="py-2.5 px-3 max-w-[210px]">
                          <div className="flex items-center gap-2.5">
                            {/* Foto de Perfil ou Inicial */}
                            {appointment.patientPhoto ? (
                              <img
                                src={appointment.patientPhoto}
                                alt={appointment.client_nome || "Paciente"}
                                className="w-8 h-8 rounded-full object-cover shrink-0 border border-teal-200 dark:border-slate-700 shadow-2xs"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center shrink-0">
                                {(appointment.client_nome || "P")[0].toUpperCase()}
                              </div>
                            )}

                            {/* Nome com iniciais nos sobrenomes do meio */}
                            <div className="min-w-0 truncate">
                              <p
                                className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                                title={appointment.client_nome}
                              >
                                {formatShortName(appointment.client_nome)}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">Dra. Juliana Sena</p>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* DATA / HORÁRIO: Data + pílula destacando horário */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
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
                      <td className="py-2.5 px-3">
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
                      <td className="py-2.5 px-3">
                        <span className="text-xs text-slate-700 dark:text-slate-300 block">
                          {appointment.client_telefone}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[170px]">
                          {appointment.client_email}
                        </span>
                      </td>

                      {/* GOOGLE AGENDA: Badge com ícone indicando status de sincronização */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
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
                      <td className="py-2.5 px-3 whitespace-nowrap">
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

                      {/* PAGAMENTO */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {appointment.status_pagamento === "Pago" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                              Pago
                            </span>
                          ) : appointment.status_pagamento === "Em Análise" || appointment.comprovante_url ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Em Análise</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                              Pendente
                            </span>
                          )}

                          {/* Botão para visualizar o comprovativo PIX anexado */}
                          {appointment.comprovante_url && (
                            <a
                              href={appointment.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 hover:bg-teal-100 transition-colors"
                              title="Abrir comprovante de pagamento"
                            >
                              <FileText className="w-3 h-3 text-teal-600" />
                              <span>Ver PIX</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* AÇÕES: Abrir no Google Agenda com link direto, Detalhes, Editar horário e Cancelar agendamento */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão de anexos apenas para o Paciente */}
                          {isPatient && (
                            <button
                              type="button"
                              onClick={() => setAttachmentModalAppointment(appointment)}
                              className="p-1.5 rounded-lg text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors cursor-pointer"
                              title="Anexar ou visualizar exames e fotos"
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                          )}

                          {/* Botão de Pagamento / Recibo para o Paciente */}
                          {isPatient && appointment.status !== "Cancelado" && (
                            <button
                              type="button"
                              onClick={() => setPaymentModalAppointment(appointment)}
                              className="p-1.5 rounded-lg text-teal-600 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors cursor-pointer"
                              title="Efetuar pagamento ou anexar recibo PIX"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                          )}

                          {/* Abrir no Google Agenda (Para Profissional/Admin) */}
                          {!isPatient && appointment.google_html_link && (
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

                          {/* Editar Agendamento (Apenas para Admin e Profissional) */}
                          {!isPatient && appointment.status !== "Cancelado" && (
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

      {/* MODAL DE PAGAMENTO VIA PIX E ANEXO DE RECIBO PARA O PACIENTE */}
      {paymentModalAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            {/* CABEÇALHO DO MODAL */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Garantia do Agendamento (Sinal de Reserva)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {paymentModalAppointment.procedimento} • {paymentModalAppointment.data.split("-").reverse().join("/")} às {paymentModalAppointment.horario_inicio}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalAppointment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CARD PIX COM QR CODE E CHAVE COPIA E COLA */}
            <div className="space-y-3 p-3.5 rounded-2xl bg-teal-50/50 dark:bg-slate-800/60 border border-teal-200/80 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Garantia via PIX
                </span>
                <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200/60 dark:border-teal-800">
                  Chave CNPJ / Telefone
                </span>
              </div>

              {/* DADOS PIX E BOTÃO DE CÓPIA */}
              <div className="relative w-full rounded-2xl border border-teal-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 box-border">
                
                <div className="flex flex-col md:flex-row items-center md:items-stretch gap-4 w-full">
                  {/* QR Code */}
                  <div className="shrink-0">
                    <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-xl border border-teal-200 dark:border-teal-800 flex items-center justify-center p-1 bg-white overflow-hidden shadow-xs">
                      {modalPixQrCodeUrl ? (
                        <img
                          src={modalPixQrCodeUrl}
                          alt="QR Code Pix"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-teal-600" />
                      )}
                    </div>
                  </div>

                  {/* Coluna de Textos: Topo (Chave) e Base (Beneficiário em linha única) */}
                  <div className="flex flex-col justify-between min-w-0 flex-1 text-center md:text-left py-0.5">
                    
                    {/* Topo: Chave PIX (com recuo à direita no PC para não colidir com o botão) */}
                    <div className="flex flex-col md:pr-44">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Chave PIX da Clínica:</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">{PIX_KEY}</span>
                    </div>

                    {/* Parte Inferior: Beneficiário ocupando uma única linha no PC */}
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 md:mt-auto md:whitespace-nowrap">
                      Beneficiário: {PIX_BENEFICIARIO}
                    </span>

                  </div>
                </div>

                {/* Botão Copiar Código PIX mantido no canto superior direito no PC */}
                <button
                  type="button"
                  onClick={handleCopyPixPaymentModal}
                  className="mt-3 md:mt-0 w-full md:w-auto md:absolute md:top-3.5 md:right-3.5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 transition-colors text-xs font-medium whitespace-nowrap cursor-pointer"
                >
                  {copiedPixPaymentModal ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 shrink-0" />
                      <span>Copiar Código PIX</span>
                    </>
                  )}
                </button>

              </div>

              {/* SEÇÃO ANEXAR COMPROVANTE PIX */}
              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-dashed border-teal-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>Anexar Comprovante PIX</span>
                  </label>
                  {paymentModalAppointment.comprovante_url && (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      Recibo já anexado (Em Análise)
                    </span>
                  )}
                </div>

                {paymentModalAppointment.comprovante_url ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-teal-50/60 dark:bg-slate-800/80 p-2.5 px-3 rounded-lg border border-teal-200/80 dark:border-slate-700 text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          Comprovante Anexado
                        </span>
                      </div>
                      <a
                        href={paymentModalAppointment.comprovante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900 dark:hover:bg-teal-800 rounded-lg transition-colors shrink-0"
                      >
                        Visualizar Recibo
                      </a>
                    </div>

                    <label className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-teal-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer transition-colors">
                      {isUploadingPaymentReceipt ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                          <span>Enviando novo comprovante...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span>Alterar / Enviar Novo Comprovante</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={isUploadingPaymentReceipt}
                            onChange={handleUploadPaymentReceipt}
                            className="hidden"
                          />
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-teal-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium cursor-pointer transition-colors">
                    {isUploadingPaymentReceipt ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                        <span>Enviando comprovante...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <span>Clique para selecionar o comprovante (.png, .jpg, .pdf)</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={isUploadingPaymentReceipt}
                          onChange={handleUploadPaymentReceipt}
                          className="hidden"
                        />
                      </>
                    )}
                  </label>
                )}
              </div>

              {/* OPÇÃO CARTÃO DE CRÉDITO - INFINITEPAY */}
              <div className="pt-1.5 border-t border-teal-100 dark:border-slate-700/60">
                <button
                  type="button"
                  disabled={isGeneratingCheckout}
                  onClick={() => handlePayWithInfinitePay(paymentModalAppointment.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/60 dark:bg-slate-800/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Pagar com Cartão de Crédito
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Parcelamento seguro via InfinitePay
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isGeneratingCheckout ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                    ) : (
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950 px-2 py-0.5 rounded-full">
                        Pagar Agora →
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>

            {/* RODAPÉ DO MODAL */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPaymentModalAppointment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXAMES E FOTOS CLÍNICAS */}
      {attachmentModalAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Exames e Fotos Clínicas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {attachmentModalAppointment.procedimento} • {
                      attachmentModalAppointment.data
                        ? attachmentModalAppointment.data.split("-").reverse().join("/")
                        : ""
                    } ({attachmentModalAppointment.horario_inicio})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttachmentModalAppointment(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contador de arquivos */}
            <div className="flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              <span>Total de arquivos anexados</span>
              <span className="text-teal-600 dark:text-teal-400">
                {attachmentModalAppointment.anexos_clinicos?.length || 0} de 3 arquivos
              </span>
            </div>

            {/* Lista de anexos existentes */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Arquivos no Prontuário
              </h4>
              {Array.isArray(attachmentModalAppointment.anexos_clinicos) && attachmentModalAppointment.anexos_clinicos.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {attachmentModalAppointment.anexos_clinicos.map((url: string, idx: number) => {
                    const isPdf = url.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          {isPdf ? (
                            <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                          )}
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            Arquivo Clínico {idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 rounded-lg border border-teal-200 dark:border-teal-800 transition-colors"
                          >
                            Visualizar
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic p-3 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  Nenhum exame ou foto clínica anexado a esta consulta ainda.
                </p>
              )}
            </div>

            {/* Área de Upload ou Aviso de Limite */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              {(attachmentModalAppointment.anexos_clinicos?.length || 0) < 3 ? (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 hover:bg-teal-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 border-2 border-dashed border-teal-200 dark:border-slate-700 cursor-pointer transition-all text-center">
                    {isUploadingClinical ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 dark:text-teal-400 py-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enviando arquivos...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-teal-600 dark:text-teal-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Clique para adicionar fotos ou exames
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Selecione até {3 - (attachmentModalAppointment.anexos_clinicos?.length || 0)} arquivo(s) (PDF, PNG, JPG até 10MB)
                        </span>
                        <input
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          disabled={isUploadingClinical}
                          onChange={handleUploadClinicalAttachments}
                          className="hidden"
                        />
                      </>
                    )}
                  </label>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-xs text-amber-800 dark:text-amber-300 text-center font-medium">
                  Limite máximo de 3 arquivos atingido para esta consulta.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAttachmentModalAppointment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
