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
  FileCheck,
} from "lucide-react";
import type { Client } from "@/types/client";
import type { PrescriptionItem } from "@/types/clinical-record";
import { useToast } from "@/components/ui/toast";
import {
  generatePrescriptionPdfClient,
  sanitizePdfFileName,
  sharePdfViaWhatsApp,
} from "@/lib/utils/whatsapp-share-pdf";

export type NotifiablePrescription = PrescriptionItem & {
  nome_formula?: string;
  item?: {
    nome_formula?: string;
    via?: string;
    veiculo?: string;
    dosagem?: number | string;
    tipo_veiculo?: string;
    posologia?: string;
    duracao?: string;
    orient_paciente?: string;
    orient_farmacia?: string;
  };
  componentes?: Array<{
    nome: string;
    quantidade?: number | string;
    unidade?: string;
  }>;
  orient_paciente?: string;
  orient_farmacia?: string;
  data_prescricao?: string;
};

interface PrescriptionNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: NotifiablePrescription | null;
  client: Client;
  isEdit?: boolean;
  isReactivation?: boolean;
}

interface FeedbackState {
  type: "success" | "warning" | "error";
  message: string;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) {
    return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return clean;
}

function parseRxDetails(rx: NotifiablePrescription) {
  const dosagemStr = rx.dosagem || "";
  let componentes: { nome: string; qtd: string }[] = [];
  let veiculoInfo = rx.item?.veiculo || "";
  let dosagemInfo = rx.item?.dosagem != null ? String(rx.item.dosagem) : "";
  let totalInfo = "";

  if (Array.isArray(rx.componentes) && rx.componentes.length > 0) {
    componentes = rx.componentes.map((c) => ({
      nome: c.nome,
      qtd: `${c.quantidade ?? ""}${c.unidade || ""}`.trim(),
    }));
  } else {
    try {
      const emIndex = dosagemStr.indexOf(" em ");
      if (emIndex !== -1) {
        const assetsPart = dosagemStr.substring(0, emIndex);
        componentes = assetsPart.split(" + ").map((a) => {
          const colonIdx = a.indexOf(": ");
          if (colonIdx !== -1) {
            return {
              nome: a.substring(0, colonIdx).trim(),
              qtd: a.substring(colonIdx + 2).trim(),
            };
          }
          return { nome: a.trim(), qtd: "" };
        });

        const remaining = dosagemStr.substring(emIndex + 4);
        const parenthesIndex = remaining.indexOf(" (");
        if (parenthesIndex !== -1) {
          veiculoInfo = veiculoInfo || remaining.substring(0, parenthesIndex).trim();
          const insideParentheses = remaining.substring(parenthesIndex + 2, remaining.length - 1);
          if (insideParentheses.includes(" | ")) {
            const parts = insideParentheses.split(" | ");
            dosagemInfo = dosagemInfo || parts[0].replace("Dose: ", "").trim();
            totalInfo = parts[1].replace("Total: ", "").trim();
          } else {
            totalInfo = insideParentheses.replace("Total: ", "").trim();
          }
        } else {
          veiculoInfo = veiculoInfo || remaining;
        }
      } else {
        componentes = [{ nome: rx.medicamento, qtd: dosagemStr }];
      }
    } catch {
      componentes = [{ nome: rx.medicamento, qtd: dosagemStr }];
    }
  }

  let orientPaciente = rx.orient_paciente || rx.item?.orient_paciente || "";
  let orientFarmacia = rx.orient_farmacia || rx.item?.orient_farmacia || "";

  if (!orientPaciente && !orientFarmacia && rx.instrucoes) {
    if (rx.instrucoes.includes("[Observações à Farmácia Magistral]\n")) {
      const parts = rx.instrucoes.split("[Observações à Farmácia Magistral]\n");
      orientPaciente = parts[0].replace("[Orientações ao Paciente]\n", "").trim();
      if (parts.length > 1) {
        orientFarmacia = parts[1].trim();
      }
    } else {
      orientPaciente = rx.instrucoes.replace("[Orientações ao Paciente]\n", "").trim();
    }
  }

  return {
    componentes: componentes.length > 0 ? componentes : [{ nome: rx.medicamento, qtd: dosagemStr }],
    veiculo: veiculoInfo || "Veículo base adequado",
    dosagem: dosagemInfo,
    total: totalInfo || rx.duracao,
    orientPaciente,
    orientFarmacia,
  };
}

export function PrescriptionNotificationModal({
  isOpen,
  onClose,
  prescription,
  client,
  isEdit = false,
  isReactivation = false,
}: PrescriptionNotificationModalProps) {
  const { toast } = useToast();
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<FeedbackState | null>(null);
  const [gmailAuthUrl, setGmailAuthUrl] = useState<string | null>(null);

  const rxId = prescription?.prescricao_id || prescription?.id || "";

  useEffect(() => {
    if (isOpen) {
      setEmailSent(false);
      setEmailFeedback(null);
      setGmailAuthUrl(null);
      setIsSendingWhatsApp(false);
      setIsSendingEmail(false);
    }
  }, [isOpen, rxId]);

  if (!isOpen || !prescription) return null;

  const patientName = client?.nome || "Paciente";
  const patientPhone = client?.telefone || (client as any)?.whatsapp || "";
  const patientEmail = client?.email || "";

  const formulaName =
    prescription.item?.nome_formula ||
    prescription.nome_formula ||
    (prescription.medicamento && prescription.medicamento !== "Fórmula Magistral"
      ? prescription.medicamento
      : "Fórmula Magistral");

  const viaLabel = prescription.item?.via
    ? prescription.item.via.toLowerCase() === "oral"
      ? "Oral"
      : "Tópico"
    : String(prescription.via || "").toLowerCase() === "oral"
    ? "Oral"
    : "Tópico";

  const emissionDate = prescription.data || prescription.data_prescricao || "";
  const hasSignedPdf = Boolean(prescription.pdf_assinado_url);

  // Envio via WhatsApp (PDF oficial ou assinado + Mensagem padronizada)
  const handleSendWhatsApp = async () => {
    setIsSendingWhatsApp(true);
    try {
      const fileName = sanitizePdfFileName(
        hasSignedPdf ? "Receita_Assinada" : "Receituario",
        patientName
      );

      let pdfFile: File | null = null;

      // 1. Se já existe PDF assinado (ICP-Brasil), prioriza o arquivo assinado
      if (prescription.pdf_assinado_url && prescription.pdf_assinado_url.startsWith("http")) {
        try {
          const signedRes = await fetch(prescription.pdf_assinado_url);
          if (signedRes.ok) {
            const blob = await signedRes.blob();
            pdfFile = new File([blob], fileName, { type: "application/pdf" });
          }
        } catch (err) {
          console.warn("[PrescriptionNotification] Falha ao baixar pdf_assinado_url:", err);
        }
      }

      // 2. Gera/obtém o PDF oficial no servidor (/api/prescricoes/[id]/pdf)
      if (!pdfFile && rxId) {
        try {
          const res = await fetch(`/api/prescricoes/${rxId}/pdf`, {
            credentials: "same-origin",
          });
          if (res.ok) {
            const blob = await res.blob();
            pdfFile = new File([blob], fileName, { type: "application/pdf" });
          }
        } catch (err) {
          console.warn("[PrescriptionNotification] Falha ao obter PDF do servidor:", err);
        }
      }

      // 3. Fallback em memória via pdf-lib (paridade 1:1 com a visualização e o servidor)
      if (!pdfFile) {
        const rxDetails = parseRxDetails(prescription);
        pdfFile = await generatePrescriptionPdfClient({
          fileName,
          id: rxId || undefined,
          patientName,
          patientCpf: client?.cpf,
          dataPrescricao: emissionDate || undefined,
          medicamento: formulaName,
          via: viaLabel,
          componentes: rxDetails.componentes,
          veiculo: rxDetails.veiculo,
          dosagem: rxDetails.dosagem,
          total: rxDetails.total,
          posologia:
            prescription.posologia ||
            prescription.item?.posologia ||
            "Conforme orientação profissional.",
          orientPaciente: rxDetails.orientPaciente,
          orientFarmacia: rxDetails.orientFarmacia,
        });
      }

      const firstName = patientName.trim().split(/\s+/)[0] || "Paciente";
      const customMessage = [
        `Olá, *${firstName}*! Tudo bem?`,
        ``,
        isReactivation
          ? `Sua prescrição magistral *${formulaName}* (Uso ${viaLabel}) foi *reativada* pela *Dra. Juliana Sena* e voltou ao seu tratamento ativo.`
          : `Sua prescrição magistral *${formulaName}* (Uso ${viaLabel}) emitida pela *Dra. Juliana Sena* já está pronta.`,
        hasSignedPdf
          ? `O documento já conta com *assinatura digital qualificada (ICP-Brasil)* e segue disponível junto a esta mensagem.`
          : `Segue o documento em *PDF* com todas as especificações de manipulação e posologia.`,
        ``,
        `Qualquer dúvida, nossa equipe permanece à disposição!`,
        `*Clínica Dra. Juliana Sena*`,
      ].join("\n");

      const result = await sharePdfViaWhatsApp({
        file: pdfFile,
        documentTitle: `Receituário - ${formulaName}`,
        patientName,
        patientPhone,
        customMessage,
      });

      if (result.method === "cancelled") return;

      if (result.success) {
        toast({
          type: "success",
          title: "PDF e Notificação Prontos no WhatsApp",
          description:
            result.method === "web-share"
              ? "Receita em PDF compartilhada diretamente pelo dispositivo."
              : "WhatsApp aberto com a mensagem e o link do PDF da receita.",
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
        description:
          err?.message || "Erro inesperado ao gerar o PDF da receita para o WhatsApp.",
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Envio via E-mail (/api/prescricoes/[id]/notify-email)
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
    setGmailAuthUrl(null);

    try {
      const res = await fetch(`/api/prescricoes/${rxId}/notify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientEmail: patientEmail.trim(),
          formulaName,
          pdfUrl: prescription.pdf_assinado_url || undefined,
          prescriptionDate: emissionDate || new Date().toISOString(),
          isReactivation,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (data?.code === "GMAIL_AUTH_REQUIRED") {
        const authPath =
          typeof data?.authUrl === "string" && data.authUrl.startsWith("/api/auth/google")
            ? data.authUrl
            : "/api/auth/google";
        const authMsg =
          data?.message ||
          "Conecte a conta Gmail (julianasevieira@gmail.com) para enviar prescrições por e-mail.";
        setGmailAuthUrl(authPath);
        setEmailFeedback({ type: "warning", message: authMsg });
        toast({
          type: "warning",
          title: "Conexão com Gmail Necessária",
          description: authMsg,
        });
        return;
      }

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

      const successMsg = `E-mail enviado com o PDF da receita em anexo para ${patientEmail.trim()}!`;
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

  const modalTitle = isReactivation
    ? "Receita Reativada!"
    : isEdit
    ? "Receita Atualizada!"
    : "Receita Emitida!";

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
                {modalTitle}
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

        {/* Resumo da Receita e Ações */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="p-3.5 rounded-md-xl bg-surface-container-lowest border border-outline-variant space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary truncate">
                Paciente: {patientName}
              </span>
              <span className="text-[10px] font-semibold text-on-surface-variant shrink-0">
                Uso {viaLabel}
              </span>
            </div>

            <h4 className="text-sm font-bold text-on-surface leading-snug">
              {formulaName}
            </h4>

            <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
              <span>Emissão: {formatDateBR(emissionDate)}</span>
              {hasSignedPdf && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-success font-semibold">
                    <FileCheck className="w-3.5 h-3.5 shrink-0" />
                    PDF Assinado ICP-Brasil
                  </span>
                </>
              )}
            </div>

            {(prescription.posologia || prescription.item?.posologia) && (
              <p className="text-[11px] text-on-surface-variant line-clamp-2 pt-1 border-t border-outline-variant/60">
                <strong className="text-on-surface">Posologia:</strong>{" "}
                {prescription.posologia || prescription.item?.posologia}
              </p>
            )}
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
            {/* Botão 1 — WhatsApp (PDF + Mensagem de Notificação) */}
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

            {/* Botão 2 — E-mail (PDF em Anexo + Notificação) */}
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

            {gmailAuthUrl && (
              <div className="p-2.5 rounded-md-xl bg-surface-container border border-outline-variant">
                <a
                  href={gmailAuthUrl}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md-xl bg-primary text-on-primary hover:brightness-105 border border-outline-variant text-xs sm:text-sm font-semibold transition-all shadow-xs"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>Conectar Gmail (julianasevieira@gmail.com)</span>
                </a>
              </div>
            )}
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
