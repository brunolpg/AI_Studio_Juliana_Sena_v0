"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  FileSignature,
  FileText,
  Download,
  Share2,
  ChevronDown,
  MessageCircle,
  Mail,
  Loader2,
  CheckSquare,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import { getTermoPdfSignedUrl } from "@/app/actions/termos";
import { useToast } from "@/components/ui/toast";
import {
  cleanBrazilianPhone,
  sharePdfViaWhatsApp,
} from "@/lib/utils/whatsapp-share-pdf";
import type { Client } from "@/types/client";
import type { TermoConsentimento, TermoSnapshotCheckbox } from "@/types/termo";

interface TermoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  termo: TermoConsentimento;
  client: Client;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatDateTimeSaoPaulo(isoStr?: string | null): string {
  if (!isoStr) return "—";
  const parsed = new Date(isoStr);
  if (Number.isNaN(parsed.getTime())) return isoStr;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function sanitizePatientPdfFileName(patientName?: string | null): string {
  const sanitized = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `Termo_Consentimento_${sanitized || "Paciente"}.pdf`;
}

function getCheckboxText(item: TermoSnapshotCheckbox | string): string {
  if (typeof item === "string") return item;
  return item?.texto || "";
}

export function TermoDetailsModal({
  isOpen,
  onClose,
  termo,
  client,
}: TermoDetailsModalProps) {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"dados" | "pdf">("dados");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [sharingMethod, setSharingMethod] = useState<"whatsapp" | "email" | null>(
    null
  );
  const [gmailAuthUrl, setGmailAuthUrl] = useState<string | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareTriggerRef = useRef<HTMLButtonElement>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!termo?.id) return;
    try {
      setIsLoadingPdf(true);
      setPdfError(null);
      const res = await getTermoPdfSignedUrl(termo.id);
      if (!res.success || !res.data?.signedUrl) {
        setPdfError(res.error || "Não foi possível carregar o PDF do termo.");
        return;
      }
      setSignedUrl(res.data.signedUrl);
    } catch (err: unknown) {
      setPdfError(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao obter o PDF do termo."
      );
    } finally {
      setIsLoadingPdf(false);
    }
  }, [termo?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveView("dados");
    setSignedUrl(null);
    setPdfError(null);
    setIsShareMenuOpen(false);
    setSharingMethod(null);
    setGmailAuthUrl(null);
  }, [isOpen, termo?.id]);

  useEffect(() => {
    if (isOpen && activeView === "pdf" && !signedUrl && !isLoadingPdf && !pdfError) {
      fetchSignedUrl();
    }
  }, [isOpen, activeView, signedUrl, isLoadingPdf, pdfError, fetchSignedUrl]);

  useEffect(() => {
    if (!isShareMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node)
      ) {
        setIsShareMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsShareMenuOpen(false);
        shareTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isShareMenuOpen]);

  if (!isOpen) return null;

  const resolvePdfSignedUrl = async (): Promise<string | null> => {
    if (signedUrl) return signedUrl;
    const res = await getTermoPdfSignedUrl(termo.id);
    if (!res.success || !res.data?.signedUrl) {
      toast({
        type: "error",
        title: "PDF indisponível",
        description: res.error || "URL do PDF não disponível.",
      });
      return null;
    }
    setSignedUrl(res.data.signedUrl);
    return res.data.signedUrl;
  };

  const patientName = client?.nome?.trim() || "Paciente";
  const procedimentoTitulo =
    termo.procedimento_nome?.trim() || "Termo de Consentimento";

  const handleDownloadPdf = async () => {
    let urlToUse: string | null = null;
    try {
      setIsDownloading(true);
      urlToUse = await resolvePdfSignedUrl();
      if (!urlToUse) return;

      const fileName = sanitizePatientPdfFileName(patientName);
      try {
        const response = await fetch(urlToUse);
        if (!response.ok) {
          throw new Error("Não foi possível transferir o arquivo PDF.");
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
      } catch {
        // Fallback direto para download caso CORS impeça fetch do blob
        const anchor = document.createElement("a");
        anchor.href = urlToUse;
        anchor.download = fileName;
        anchor.rel = "noopener noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setIsShareMenuOpen(false);
    setGmailAuthUrl(null);
    setSharingMethod("whatsapp");

    try {
      const urlToUse = await resolvePdfSignedUrl();
      if (!urlToUse) return;

      const response = await fetch(urlToUse);
      if (!response.ok) {
        throw new Error("Não foi possível carregar o PDF do termo para envio.");
      }

      const blob = await response.blob();
      const fileName = sanitizePatientPdfFileName(patientName);
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });
      const cleanPhone = cleanBrazilianPhone(client?.telefone);

      const customMessage = `Olá, ${patientName}!\n\nSegue o seu *Termo de Consentimento* referente ao procedimento *${procedimentoTitulo}* (emitido em ${formatDateBR(termo.data)}).\n\nQualquer dúvida, nossa equipe permanece à disposição.\n\n*Clínica Dra. Juliana Sena*\nEstética Avançada e Regenerativa\nSalvador - BA`;

      const result = await sharePdfViaWhatsApp({
        file: pdfFile,
        documentTitle: `Termo de Consentimento - ${procedimentoTitulo}`,
        patientName,
        patientPhone: cleanPhone || client?.telefone,
        customMessage,
      });

      if (result.method === "cancelled") {
        return;
      }

      if (result.success) {
        toast({
          type: "success",
          title: "Termo pronto no WhatsApp",
          description:
            result.method === "web-share"
              ? "PDF do termo compartilhado diretamente pelo dispositivo."
              : "WhatsApp aberto com a mensagem e o link do PDF do termo.",
        });
      } else {
        toast({
          type: "error",
          title: "Erro ao compartilhar no WhatsApp",
          description:
            result.error || "Não foi possível compartilhar o PDF pelo WhatsApp.",
        });
      }
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Falha ao preparar WhatsApp",
        description:
          err instanceof Error
            ? err.message
            : "Erro inesperado ao preparar o PDF do termo para envio.",
      });
    } finally {
      setSharingMethod(null);
    }
  };

  const handleShareEmail = async () => {
    setIsShareMenuOpen(false);
    setGmailAuthUrl(null);

    const trimmedEmail = client?.email?.trim() || "";
    if (!trimmedEmail) {
      toast({
        type: "warning",
        title: "E-mail não cadastrado",
        description: "O paciente não possui um endereço de e-mail cadastrado.",
      });
      return;
    }

    setSharingMethod("email");
    try {
      const response = await fetch(`/api/termos/${termo.id}/notify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          patientEmail: trimmedEmail,
          patientName,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (data?.code === "GMAIL_AUTH_REQUIRED") {
        const authPath =
          typeof data?.authUrl === "string" &&
          data.authUrl.startsWith("/api/auth/google")
            ? data.authUrl
            : "/api/auth/google";
        setGmailAuthUrl(authPath);
        toast({
          type: "warning",
          title: "Conexão com Gmail necessária",
          description:
            data?.message ||
            "Conecte a conta Gmail profissional para enviar termos por e-mail.",
        });
        return;
      }

      if (!response.ok || !data?.success) {
        toast({
          type: "error",
          title: "Falha ao enviar e-mail",
          description:
            data?.message ||
            data?.error ||
            "Não foi possível enviar o PDF do termo por e-mail.",
        });
        return;
      }

      toast({
        type: "success",
        title: "E-mail enviado",
        description: `PDF do termo enviado com sucesso para ${trimmedEmail}.`,
      });
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Erro no envio por e-mail",
        description:
          err instanceof Error
            ? err.message
            : "Erro de conexão ao enviar o PDF do termo por e-mail.",
      });
    } finally {
      setSharingMethod(null);
    }
  };

  const snapshot = termo.conteudo_snapshot;
  const sortedTopicos = Array.isArray(snapshot?.topicos)
    ? [...snapshot.topicos].sort((a, b) => (a?.ordem ?? 0) - (b?.ordem ?? 0))
    : [];
  const hasSnapshotContent =
    sortedTopicos.length > 0 || Boolean(snapshot?.declaracao);

  const isUploadPdf = termo.origem_pdf === "upload";
  const isLegacyAttachedTermo =
    isUploadPdf &&
    (!termo.assinado_em ||
      !hasSnapshotContent ||
      Boolean(snapshot?.assinatura_apenas_no_pdf));

  const origemLabel = isLegacyAttachedTermo
    ? "Termo antigo (PDF anexado)"
    : isUploadPdf
      ? "Upload de PDF assinado"
      : termo.origem_pdf === "gerado"
        ? "Gerado digitalmente"
        : "Não informada";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-on-surface/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="termo-details-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[85dvh] flex flex-col bg-surface-container-lowest rounded-md-2xl border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="termo-details-modal-title"
                  className="text-sm sm:text-base font-bold text-on-surface truncate"
                >
                  {procedimentoTitulo}
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md-full text-[11px] font-semibold ${
                    termo.assinado
                      ? "bg-success-container text-on-success-container border border-success/30"
                      : "bg-warning-container text-on-warning-container border border-warning/30"
                  }`}
                >
                  {termo.assinado ? "Assinado" : "Pendente"}
                </span>
                {isUploadPdf && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md-full text-[11px] font-semibold bg-surface-container text-on-surface-variant border border-outline-variant">
                    <UploadCloud className="w-3 h-3 shrink-0" />
                    {isLegacyAttachedTermo ? "Termo antigo anexado" : "PDF anexado"}
                  </span>
                )}
              </div>
              <p className="text-xs text-on-surface-variant truncate">
                Paciente: {patientName} • Data: {formatDateBR(termo.data)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
            aria-label="Fechar detalhes do termo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navegação interna: Dados do Termo | Visualizar PDF */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-outline-variant bg-surface-container-lowest shrink-0">
          <div className="inline-flex items-center p-1 rounded-md-full bg-surface-container border border-outline-variant">
            <button
              type="button"
              onClick={() => setActiveView("dados")}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold transition-all cursor-pointer ${
                activeView === "dados"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span>Dados do Termo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("pdf")}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold transition-all cursor-pointer ${
                activeView === "pdf"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Visualizar PDF</span>
            </button>
          </div>

          {termo.pdf_path && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloading || sharingMethod !== null}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Preparando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Baixar PDF</span>
                  </>
                )}
              </button>

              <div ref={shareMenuRef} className="relative">
                <button
                  ref={shareTriggerRef}
                  type="button"
                  onClick={() => setIsShareMenuOpen((prev) => !prev)}
                  disabled={isDownloading || sharingMethod !== null}
                  aria-haspopup="menu"
                  aria-expanded={isShareMenuOpen}
                  aria-controls="termo-share-menu"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-surface-container-low text-on-surface border border-outline-variant hover:bg-surface-container-high transition-all cursor-pointer disabled:opacity-50"
                >
                  {sharingMethod ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      <span>
                        {sharingMethod === "whatsapp"
                          ? "Preparando WhatsApp..."
                          : "Enviando e-mail..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-primary shrink-0" />
                      <span>Compartilhar</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-on-surface-variant transition-transform ${
                          isShareMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </>
                  )}
                </button>

                {isShareMenuOpen && (
                  <div
                    id="termo-share-menu"
                    role="menu"
                    aria-label="Compartilhar PDF do termo"
                    className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-30 w-64 max-w-[calc(100vw-2.5rem)] p-1.5 rounded-md-lg bg-surface-container-lowest border border-outline-variant shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleShareWhatsApp}
                      className="w-full flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-md-md text-left bg-surface-container-lowest hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                    >
                      <span className="w-8 h-8 rounded-md-full bg-success-container text-on-success-container flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-on-surface">
                          WhatsApp
                        </span>
                        <span className="block text-[11px] text-on-surface-variant truncate">
                          {client?.telefone?.trim() || "Enviar PDF pelo WhatsApp"}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleShareEmail}
                      className="w-full flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-md-md text-left bg-surface-container-lowest hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                    >
                      <span className="w-8 h-8 rounded-md-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-on-surface">
                          E-mail
                        </span>
                        <span className="block text-[11px] text-on-surface-variant truncate">
                          {client?.email?.trim() || "E-mail não cadastrado"}
                        </span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {gmailAuthUrl && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-b border-outline-variant bg-warning-container text-on-warning-container shrink-0">
            <span className="text-xs font-medium">
              A conta Gmail profissional precisa ser reconectada para enviar termos por e-mail.
            </span>
            <a
              href={gmailAuthUrl}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span>Conectar Gmail</span>
            </a>
          </div>
        )}

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-5">
          {activeView === "dados" ? (
            <>
              {/* Resumo Metadados */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-md-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Paciente
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-on-surface mt-0.5 block">
                    {patientName}
                  </span>
                </div>

                <div className="p-3.5 rounded-md-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Procedimento
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-on-surface mt-0.5 block">
                    {procedimentoTitulo}
                  </span>
                </div>

                <div className="p-3.5 rounded-md-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Data / Assinatura
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-on-surface mt-0.5 block">
                    {termo.assinado_em
                      ? formatDateTimeSaoPaulo(termo.assinado_em)
                      : formatDateBR(termo.data)}
                  </span>
                  {isUploadPdf && !termo.assinado_em && (
                    <span className="text-[11px] text-on-surface-variant block mt-0.5">
                      Assinatura no PDF anexado
                    </span>
                  )}
                </div>

                <div className="p-3.5 rounded-md-lg bg-surface-container-low border border-outline-variant">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                    Origem do Documento
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-primary mt-0.5 block">
                    {origemLabel}
                  </span>
                </div>
              </div>

              {/* Aviso de origem para termos anexados via PDF quando também houver snapshot */}
              {isUploadPdf && hasSnapshotContent && (
                <div className="p-3.5 rounded-md-lg bg-primary-container/35 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 text-xs text-on-surface">
                    <UploadCloud className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Este documento foi registrado via upload de PDF assinado. A assinatura válida do paciente consta no arquivo PDF anexado.
                    </p>
                  </div>
                  {termo.pdf_path && (
                    <button
                      type="button"
                      onClick={() => setActiveView("pdf")}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 transition-all cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Abrir PDF</span>
                    </button>
                  )}
                </div>
              )}

              {/* Tópicos & Declaração do Snapshot */}
              {hasSnapshotContent && snapshot ? (
                <div className="space-y-4">
                  {sortedTopicos.map((topico, idx) => {
                    const checkboxes = (topico.linhas_checkbox || [])
                      .map(getCheckboxText)
                      .filter((txt) => txt.trim().length > 0);
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-md-lg bg-surface-container-low border border-outline-variant space-y-2.5"
                      >
                        <h4 className="text-sm font-bold text-primary">
                          {idx + 1}. {topico.titulo}
                        </h4>
                        <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line">
                          {topico.texto_topico}
                        </p>
                        {checkboxes.length > 0 && (
                          <ul className="pt-2 space-y-1.5 border-t border-outline-variant/60">
                            {checkboxes.map((txt, cIdx) => (
                              <li
                                key={cIdx}
                                className="flex items-start gap-2 text-xs sm:text-sm text-on-surface"
                              >
                                <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{txt}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}

                  {snapshot.declaracao && (
                    <div className="p-4 sm:p-5 rounded-md-lg bg-primary-container/35 border-2 border-primary/50 space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <h4 className="text-sm sm:text-base font-bold text-on-surface">
                          {snapshot.declaracao.titulo ||
                            "Declaração de Consentimento"}
                        </h4>
                      </div>
                      {snapshot.declaracao.texto_topico?.trim() && (
                        <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line">
                          {snapshot.declaracao.texto_topico}
                        </p>
                      )}
                      {(snapshot.declaracao.linhas_checkbox || []).length > 0 && (
                        <ul className="pt-2 space-y-1.5 border-t border-primary/25">
                          {(snapshot.declaracao.linhas_checkbox || [])
                            .map(getCheckboxText)
                            .filter((txt) => txt.trim().length > 0)
                            .map((txt, cIdx) => (
                              <li
                                key={cIdx}
                                className="flex items-start gap-2 text-xs sm:text-sm font-medium text-on-surface"
                              >
                                <CheckSquare className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span>{txt}</span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-md-lg bg-surface-container-low border border-outline-variant text-center space-y-3">
                  <div className="w-11 h-11 rounded-md-full bg-primary-container text-on-primary-container flex items-center justify-center mx-auto">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 max-w-lg mx-auto">
                    <p className="text-xs sm:text-sm font-semibold text-on-surface">
                      {isUploadPdf
                        ? "Termo registrado com assinatura no PDF anexado"
                        : "Documento disponível no arquivo PDF vinculado"}
                    </p>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {isUploadPdf
                        ? "Este termo não foi gerado a partir de um modelo digital no sistema. A assinatura do paciente e o conteúdo integral constam no arquivo PDF anexado."
                        : "Utilize os botões abaixo para visualizar ou baixar o arquivo PDF do termo de consentimento."}
                    </p>
                  </div>
                  {termo.pdf_path && (
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveView("pdf")}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 transition-all cursor-pointer"
                      >
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>Visualizar PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-4 h-4 shrink-0" />
                        <span>Baixar PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Aba Visualizar PDF */
            <div className="space-y-3">
              {!termo.pdf_path ? (
                <div className="p-8 rounded-md-lg bg-surface-container-low border border-outline-variant text-center">
                  <p className="text-xs sm:text-sm text-on-surface-variant">
                    Este registro ainda não possui arquivo PDF vinculado.
                  </p>
                </div>
              ) : isLoadingPdf ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs font-medium">
                    Carregando visualização segura do PDF...
                  </span>
                </div>
              ) : pdfError ? (
                <div className="p-6 rounded-md-lg bg-error-container text-on-error-container border border-error/30 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{pdfError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSignedUrl}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-surface-container-lowest text-on-surface border border-outline-variant cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tentar novamente</span>
                  </button>
                </div>
              ) : signedUrl ? (
                <div className="rounded-md-lg border border-outline-variant overflow-hidden bg-surface-container h-[55dvh] min-h-[340px]">
                  <object
                    data={signedUrl}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    <iframe
                      src={signedUrl}
                      title={`PDF do termo - ${procedimentoTitulo}`}
                      className="w-full h-full border-0"
                    />
                  </object>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-md-full text-xs font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high border border-outline-variant transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
