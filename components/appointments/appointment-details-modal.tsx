"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Phone,
  Mail,
  FileText,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  CreditCard,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Appointment } from "@/types/appointment";
import { useToast } from "@/components/ui/toast";
import { PatientAvatar } from "@/components/shared/patient-avatar";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

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
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCheckoutUrl(null);
      setCopied(false);
      setIsGenerating(false);
    }
  }, [isOpen, appointment?.id]);

  if (!isOpen || !appointment) return null;

  const attachments = appointment.anexos_clinicos || [];
  const paymentStatus = appointment.status_pagamento || "Pendente";
  const isPaymentPending =
    paymentStatus.trim().toLowerCase() === "pendente";

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleGenerateLink = async (): Promise<string | null> => {
    if (checkoutUrl) return checkoutUrl;
    if (!appointment.id) {
      toast({
        type: "error",
        title: "Agendamento inválido",
        description: "Identificador do agendamento não encontrado.",
      });
      return null;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/infinitepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Não foi possível gerar o link de pagamento.");
      }

      setCheckoutUrl(data.checkoutUrl);
      return data.checkoutUrl;
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro ao gerar link",
        description: err.message || "Falha ao conectar com a InfinitePay.",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    let url = checkoutUrl;
    if (!url) {
      url = await handleGenerateLink();
    }
    if (!url) return;

    const rawPhone = appointment.client_telefone || "";
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const targetPhone = cleanDigits.startsWith("55")
      ? cleanDigits
      : cleanDigits.length >= 10
      ? `55${cleanDigits}`
      : cleanDigits;

    const patientName = appointment.client_nome || "Paciente";
    const procedimentoNome = appointment.procedimento || "Consulta";

    const message = `Olá, ${patientName}! Segue o link para pagamento do procedimento ${procedimentoNome}: ${url}`;
    const encodedMessage = encodeURIComponent(message);

    const waUrl = targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    let url = checkoutUrl;
    if (!url) {
      url = await handleGenerateLink();
    }
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        toast({
          type: "success",
          title: "Link Copiado",
          description: "Link da InfinitePay copiado para a área de transferência.",
        });
      } catch {
        toast({
          type: "error",
          title: "Erro ao copiar",
          description: "Não foi possível copiar o link automaticamente.",
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-surface-dim/80 backdrop-blur-xs font-sans overflow-y-auto">
      <div className="relative w-full max-w-lg bg-surface rounded-t-md-3xl sm:rounded-md-3xl landscape:rounded-md-3xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] transition-all">
        {/* Handle indicador para Bottom Sheet no Mobile Vertical */}
        <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-outline-variant rounded-full mx-auto my-2 shrink-0" />

        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 pb-4 flex items-center justify-between border-b border-outline-variant bg-surface-container shrink-0">
          <div className="flex items-center gap-3">
            <PatientAvatar
              name={appointment.client_nome}
              avatarUrl={
                appointment.avatar_url ||
                appointment.patientPhoto ||
                (appointment as any).foto_url ||
                (appointment as any).foto_perfil
              }
              sizeClassName="w-10 h-10"
              textClassName="text-sm font-bold"
              borderClassName="border-outline-variant"
            />
            <div>
              <h3 className="text-base font-bold text-on-surface">
                Detalhes do Atendimento
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-semibold bg-surface-container-high text-on-surface border border-outline-variant/80 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  {formatDateBR(appointment.data)}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-full hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Card do Paciente */}
          <div className="p-4 rounded-md-2xl bg-surface-container border border-outline-variant space-y-3">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              PACIENTE
            </span>
            <div className="flex items-center gap-3">
              <PatientAvatar
                name={appointment.client_nome}
                avatarUrl={
                  appointment.avatar_url ||
                  appointment.patientPhoto ||
                  (appointment as any).foto_url ||
                  (appointment as any).foto_perfil
                }
                sizeClassName="w-12 h-12"
                textClassName="text-base font-bold"
                borderClassName="border-outline-variant"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">
                  {appointment.client_nome}
                </p>
                <div className="space-y-1 pt-1 text-xs text-on-surface-variant">
                  {appointment.client_telefone && (
                    <p className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{appointment.client_telefone}</span>
                    </p>
                  )}
                  {appointment.client_email && (
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{appointment.client_email}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Grid Horário e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-md-2xl bg-surface-container border border-outline-variant">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Horário Agendado
              </span>
              <p className="text-sm font-bold text-primary flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4 shrink-0 text-primary" />
                <span>
                  {appointment.horario_inicio} - {appointment.horario_fim}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-md-2xl bg-surface-container border border-outline-variant">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Status da Consulta
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md-sm border ${
                    appointment.status === "Confirmado"
                      ? "bg-success-container text-on-success-container border-success/30"
                      : appointment.status === "Cancelado"
                      ? "bg-error-container text-on-error-container border-error/30"
                      : "bg-warning-container text-on-warning-container border-warning/30"
                  }`}
                >
                  {appointment.status}
                </span>
                <span
                  className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md-sm border ${
                    paymentStatus === "Pago"
                      ? "bg-success-container text-on-success-container border-success/30"
                      : paymentStatus === "Em Análise"
                      ? "bg-warning-container text-on-warning-container border-warning/30"
                      : "bg-surface-container-high text-on-surface-variant border-outline-variant"
                  }`}
                  title="Status Financeiro"
                >
                  {paymentStatus === "Pago" ? "Pago" : `Pgto: ${paymentStatus}`}
                </span>
              </div>
            </div>
          </div>

          {/* Procedimento */}
          <div className="p-4 rounded-md-2xl bg-surface-container border border-outline-variant space-y-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
              Procedimento / Especialidade
            </span>
            <p className="text-sm font-bold text-on-surface">
              {appointment.procedimento}
            </p>
            {appointment.observacoes && (
              <p className="text-xs text-on-surface-variant pt-1 border-t border-outline-variant/60 mt-2">
                {appointment.observacoes}
              </p>
            )}
          </div>

          {/* Bloco de Pagamento InfinitePay (Exibido quando Status Financeiro é Pendente) */}
          {isPaymentPending && (
            <div className="p-4 rounded-md-2xl bg-surface-container-high border border-outline-variant space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-md-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0 border border-primary/20">
                    <CreditCard className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">
                      Pagamento via InfinitePay
                    </h4>
                    <p className="text-[11px] text-on-surface-variant">
                      Gere ou envie o link de checkout seguro diretamente pelo WhatsApp
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-bold rounded-md-sm bg-warning-container text-on-warning-container border border-warning/30 shrink-0">
                  Pendente
                </span>
              </div>

              {checkoutUrl && (
                <div className="p-2.5 rounded-md-lg bg-surface-container-lowest border border-outline-variant flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-on-surface-variant font-mono text-[11px] select-all flex-1">
                    {checkoutUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-1.5 rounded-md-sm hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
                    title="Copiar URL"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleCopyLink}
                  className="min-h-[44px] px-3.5 py-2 rounded-md-lg border border-outline-variant bg-surface hover:bg-surface-container text-on-surface text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs md-state-layer"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  ) : copied ? (
                    <Check className="w-4 h-4 text-success shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-on-surface-variant shrink-0" />
                  )}
                  <span>{copied ? "Link Copiado!" : "Copiar Link"}</span>
                </button>

                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={handleSendWhatsApp}
                  className="min-h-[44px] px-3.5 py-2 rounded-md-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs md-state-layer"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-on-primary shrink-0" />
                  ) : (
                    <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  )}
                  <span>Enviar Link de Pagamento</span>
                </button>
              </div>
            </div>
          )}

          {/* Anexos Clínicos (Apenas leitura/consulta) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between p-3 rounded-md-2xl bg-surface-container border border-outline-variant">
              <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                Total de ficheiros anexados
              </span>
              <span className="text-xs font-bold text-primary">
                {attachments.length} de 3 ficheiros
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                FICHEIROS NO PRONTUÁRIO
              </span>

              {attachments.length === 0 ? (
                <div className="p-4 rounded-md-2xl border border-outline-variant bg-surface-container text-center text-xs text-on-surface-variant italic">
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
                        className="flex items-center gap-2 p-2.5 rounded-md-lg border border-outline-variant bg-surface hover:bg-surface-container-high text-xs text-on-surface transition-colors group cursor-pointer min-h-[44px]"
                      >
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-secondary shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-tertiary shrink-0" />
                        )}
                        <span className="truncate flex-1 font-medium group-hover:text-primary">
                          Anexo {idx + 1} ({isImage ? "Foto" : "Documento"})
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Integração Google Agenda */}
          {appointment.google_html_link && (
            <div className="p-4 rounded-md-2xl bg-surface-container border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-on-surface">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Sincronizado na Agenda Oficial</span>
              </div>
              <a
                href={appointment.google_html_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full shadow-2xs hover:shadow transition-all cursor-pointer md-state-layer"
              >
                <span>Ver no Google Agenda</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 px-6 border-t border-outline-variant flex items-center justify-between bg-surface-container shrink-0">
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(appointment);
              }}
              className="text-xs font-bold text-primary hover:underline cursor-pointer min-h-[44px] flex items-center"
            >
              Editar Horário / Status
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 min-h-[44px] text-xs font-bold text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors cursor-pointer md-state-layer flex items-center justify-center"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
