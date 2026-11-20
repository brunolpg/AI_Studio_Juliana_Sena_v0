"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Mail,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import { useToast } from "@/components/ui/toast";
import {
  buildExamNotificationMessage,
  buildExamPrescriptionPdf,
  examPrescriptionPdfFileName,
} from "@/lib/prescricoes-exames/pdf";
import { sharePdfViaWhatsApp } from "@/lib/utils/whatsapp-share-pdf";

interface ExamPrescriptionNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescricao: PrescricaoExame | null;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
    cpf?: string;
    idade?: number | string;
    status?: string;
  };
  isEdit?: boolean;
}

interface FeedbackState {
  type: "success" | "warning" | "error";
  message: string;
}

export function ExamPrescriptionNotificationModal({
  isOpen,
  onClose,
  prescricao,
  patientData,
  isEdit = false,
}: ExamPrescriptionNotificationModalProps) {
  const { toast } = useToast();
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<FeedbackState | null>(null);

  const prescricaoId = prescricao?.id || "";

  useEffect(() => {
    if (isOpen) {
      setEmailSent(false);
      setEmailFeedback(null);
      setIsSendingWhatsApp(false);
      setIsSendingEmail(false);
    }
  }, [isOpen, prescricaoId]);

  if (!isOpen || !prescricao) return null;

  const patientName =
    patientData?.nome ||
    prescricao.paciente?.nome ||
    "Paciente";

  const patientPhone =
    patientData?.telefone ||
    prescricao.paciente?.telefone ||
    "";

  const patientEmail =
    patientData?.email ||
    prescricao.paciente?.email ||
    "";

  const pacienteInfo = {
    nome: patientName,
    cpf: patientData?.cpf || prescricao.paciente?.cpf,
    idade: patientData?.idade,
    status: patientData?.status || prescricao.status,
  };

  const totalExames = (prescricao.grupos_exames || []).reduce(
    (acc, g) => acc + (g.exames?.length || 0),
    0
  );

  // Envio via WhatsApp (Texto padronizado + PDF oficial)
  const handleSendWhatsApp = async () => {
    setIsSendingWhatsApp(true);
    try {
      const pdfBytes = await buildExamPrescriptionPdf(prescricao, pacienteInfo);
      const fileName = examPrescriptionPdfFileName(patientName, prescricao.data);
      const file = new File([pdfBytes as unknown as BlobPart], fileName, {
        type: "application/pdf",
      });

      const mensagemNotificacao = buildExamNotificationMessage(
        patientName,
        prescricao.titulo,
        prescricao.data
      );

      const result = await sharePdfViaWhatsApp({
        file,
        documentTitle: prescricao.titulo || "Solicitação de Exames Laboratoriais",
        patientName,
        patientPhone,
        customMessage: mensagemNotificacao,
      });

      if (result.method === "cancelled") {
        return;
      }

      if (result.success) {
        toast({
          type: "success",
          title: "PDF e Notificação Prontos no WhatsApp",
          description:
            result.method === "web-share"
              ? "Documento PDF compartilhado diretamente pelo dispositivo."
              : "WhatsApp aberto com a mensagem padronizada e o link do documento PDF.",
        });
      } else {
        toast({
          type: "error",
          title: "Erro no Envio pelo WhatsApp",
          description: result.error || "Não foi possível compartilhar o PDF no WhatsApp.",
        });
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Falha ao Gerar PDF",
        description: err?.message || "Erro inesperado ao gerar o relatório PDF para o WhatsApp.",
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Envio via E-mail (Mesmo texto padronizado + PDF oficial em anexo)
  const handleSendEmail = async () => {
    if (!patientEmail.trim()) {
      const msg = "O paciente não possui endereço de e-mail cadastrado.";
      setEmailFeedback({ type: "error", message: msg });
      toast({
        type: "warning",
        title: "E-mail não cadastrado",
        description: msg,
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailFeedback(null);

    try {
      const res = await fetch(`/api/prescricoes-exames/${prescricao.id}/notify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientEmail: patientEmail.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const errMsg =
          data?.message ||
          data?.error ||
          "Não foi possível enviar o e-mail com o PDF em anexo.";
        setEmailFeedback({ type: "error", message: errMsg });
        toast({
          type: "error",
          title: "Falha no Envio por E-mail",
          description: errMsg,
        });
        return;
      }

      if (data?.mocked) {
        const mockedMsg =
          "PDF processado com sucesso, porém a chave RESEND_API_KEY precisa estar ativa no servidor para o disparo externo de e-mails.";
        setEmailSent(true);
        setEmailFeedback({ type: "warning", message: mockedMsg });
        toast({
          type: "warning",
          title: "Envio Externo Não Configurado",
          description: mockedMsg,
        });
        return;
      }

      const successMsg = `E-mail enviado com o PDF em anexo para ${patientEmail.trim()}!`;
      setEmailSent(true);
      setEmailFeedback({ type: "success", message: successMsg });
      toast({
        type: "success",
        title: "E-mail Enviado!",
        description: successMsg,
      });
    } catch (err: any) {
      const errMsg =
        err?.message || "Erro de conexão ao disparar o e-mail com o PDF em anexo.";
      setEmailFeedback({ type: "error", message: errMsg });
      toast({
        type: "error",
        title: "Erro no Envio por E-mail",
        description: errMsg,
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-on-surface/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[85dvh] bg-surface rounded-md-2xl sm:rounded-md-3xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md-xl bg-success-container text-on-success-container flex items-center justify-center shrink-0 border border-success/30">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                {isEdit ? "Prescrição de Exames Atualizada!" : "Prescrição de Exames Salva!"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Deseja enviar o PDF e notificar o paciente agora?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo da Prescrição e Ações */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="p-3.5 rounded-md-xl bg-surface-container-lowest border border-outline-variant space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
                Paciente: {patientName}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant shrink-0">
                {totalExames} {totalExames === 1 ? "Exame" : "Exames"}
              </span>
            </div>
            <h4 className="text-sm font-bold text-on-surface">
              {prescricao.titulo}
            </h4>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
              <span>{prescricao.grupos_exames.length} grupos cadastrados</span>
              <span>•</span>
              <span>Emissão: {prescricao.data.split("-").reverse().join("/")}</span>
            </div>
          </div>

          {/* Feedback visual de envio de e-mail */}
          {emailFeedback && (
            <div
              className={`p-3 rounded-md-lg border text-xs flex items-start gap-2 leading-relaxed ${
                emailFeedback.type === "success"
                  ? "bg-success-container text-on-success-container border-success/30"
                  : emailFeedback.type === "warning"
                  ? "bg-warning-container text-on-warning-container border-warning/30"
                  : "bg-error-container text-on-error-container border-error/30"
              }`}
            >
              {emailFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              ) : emailFeedback.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              )}
              <span>{emailFeedback.message}</span>
            </div>
          )}

          <div className="space-y-2.5">
            {/* Botão 1 — WhatsApp (Texto de Notificação + Documento PDF) */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 min-h-[44px] rounded-md-xl bg-success hover:brightness-105 text-on-success font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSendingWhatsApp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Gerando PDF para WhatsApp...</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Enviar PDF e Notificação no WhatsApp</span>
                </>
              )}
            </button>

            {/* Botão 2 — E-mail (Mesmo Texto de Notificação + PDF Anexo) */}
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSendingEmail || emailSent}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 min-h-[44px] rounded-md-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed ${
                emailSent
                  ? "bg-success-container text-on-success-container border-success/30"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant disabled:opacity-60"
              }`}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <span>Enviando PDF por E-mail...</span>
                </>
              ) : emailSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span>E-mail enviado com o PDF em anexo!</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                  <span>Enviar PDF e Notificação por E-mail</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-3.5 sm:p-4 border-t border-outline-variant bg-surface-container-low flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] text-xs font-semibold text-on-surface-variant hover:text-on-surface rounded-md-full hover:bg-surface-container transition-colors cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
