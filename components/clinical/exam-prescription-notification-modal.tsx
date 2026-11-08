"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Mail,
  CheckCircle2,
  X,
  Send,
  Loader2,
  FlaskConical,
} from "lucide-react";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import { useToast } from "@/components/ui/toast";

interface ExamPrescriptionNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescricao: PrescricaoExame | null;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
  isEdit?: boolean;
}

export function ExamPrescriptionNotificationModal({
  isOpen,
  onClose,
  prescricao,
  patientData,
  isEdit = false,
}: ExamPrescriptionNotificationModalProps) {
  const { toast } = useToast();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen || !prescricao) return null;

  const patientName =
    patientData?.nome ||
    prescricao.paciente?.nome ||
    "Paciente";

  const rawPhone =
    patientData?.telefone ||
    prescricao.paciente?.telefone ||
    "";
  const patientPhone = rawPhone.replace(/\D/g, "");

  const patientEmail =
    patientData?.email ||
    prescricao.paciente?.email ||
    "";

  const totalExames = (prescricao.grupos_exames || []).reduce(
    (acc, g) => acc + (g.exames?.length || 0),
    0
  );

  // Envio via WhatsApp
  const handleSendWhatsApp = () => {
    const gruposResumo = (prescricao.grupos_exames || [])
      .map((g) => `*${g.nome_grupo}:*\n${g.exames.map((e) => `• ${e}`).join("\n")}`)
      .join("\n\n");

    const mensagem = [
      `Olá, *${patientName}*!`,
      ``,
      isEdit
        ? `Sua solicitação de exames laboratoriais na *Clínica Dra. Juliana Sena* foi *atualizada*:`
        : `Sua solicitação de exames laboratoriais na *Clínica Dra. Juliana Sena* já está disponível:`,
      `🧪 *${prescricao.titulo}*`,
      `📅 *Data de Emissão:* ${prescricao.data.split("-").reverse().join("/")}`,
      ``,
      `*Painel de Exames (${totalExames} exames solicitados):*`,
      gruposResumo,
      ``,
      prescricao.orientacoes && prescricao.orientacoes.length > 0
        ? `*Orientações para o Laboratório:*\n${prescricao.orientacoes.map((o) => `• ${o}`).join("\n")}\n`
        : "",
      `Acesse seu Portal do Paciente para visualizar a guia completa e imprimir:`,
      `${typeof window !== "undefined" ? window.location.origin : ""}/portal-paciente`,
      ``,
      `Ficamos à disposição para esclarecer qualquer dúvida! ✨`,
    ]
      .filter(Boolean)
      .join("\n");

    const encoded = encodeURIComponent(mensagem);
    const waUrl = patientPhone
      ? `https://wa.me/55${patientPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, "_blank", "noopener,noreferrer");
    toast({
      type: "success",
      title: "WhatsApp Aberto",
      description: "Mensagem com a solicitação de exames gerada para envio.",
    });
  };

  // Envio via E-mail
  const handleSendEmail = async () => {
    if (!patientEmail) {
      toast({
        type: "warning",
        title: "E-mail não cadastrado",
        description: "O paciente não possui endereço de e-mail informado no cadastro.",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const res = await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientEmail,
          procedimento: `Prescrição de Exames: ${prescricao.titulo}`,
          observacoes: `Solicitação com ${prescricao.grupos_exames.length} grupo(s) e ${totalExames} exame(s) laboratoriais. Acesse o portal para visualizar e imprimir a guia.`,
        }),
      });

      if (res.ok) {
        setEmailSent(true);
        toast({
          type: "success",
          title: "Notificação Enviada",
          description: `Resumo enviado com sucesso para ${patientEmail}.`,
        });
      } else {
        throw new Error("Falha no servidor de e-mail");
      }
    } catch {
      // Fallback com mailto
      const subject = encodeURIComponent(
        `Solicitação de Exames Laboratoriais - Dra. Juliana Sena: ${prescricao.titulo}`
      );
      const body = encodeURIComponent(
        `Olá ${patientName},\n\nSua prescrição de exames laboratoriais "${prescricao.titulo}" foi emitida com sucesso na Clínica Dra. Juliana Sena.\n\nAcesse o Portal do Paciente para visualizar todos os detalhes e orientações de preparo.`
      );
      window.open(`mailto:${patientEmail}?subject=${subject}&body=${body}`, "_blank");
      setEmailSent(true);
      toast({
        type: "info",
        title: "Cliente de E-mail Aberto",
        description: "Abrindo seu aplicativo padrão de e-mail para envio.",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-on-surface/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-md-2xl sm:rounded-md-3xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md-xl bg-success-container text-on-success-container flex items-center justify-center shrink-0 border border-success/30">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                {isEdit ? "Prescrição de Exames Atualizada!" : "Prescrição de Exames Salva!"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Deseja notificar o paciente agora?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo da Prescrição */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="p-3.5 rounded-md-xl bg-surface-container-lowest border border-outline-variant space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Paciente: {patientName}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                {totalExames} {totalExames === 1 ? "Exame" : "Exames"}
              </span>
            </div>
            <h4 className="text-sm font-bold text-on-surface">
              {prescricao.titulo}
            </h4>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>{prescricao.grupos_exames.length} grupos cadastrados</span>
              <span>•</span>
              <span>Emissão: {prescricao.data.split("-").reverse().join("/")}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Botão WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 min-h-[44px] rounded-md-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Enviar Resumo pelo WhatsApp</span>
            </button>

            {/* Botão E-mail */}
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSendingEmail || emailSent}
              className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 min-h-[44px] rounded-md-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                emailSent
                  ? "bg-success-container text-on-success-container border-success/30"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface border-outline-variant"
              }`}
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Disparando E-mail...</span>
                </>
              ) : emailSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>E-mail Enviado!</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Notificar por E-mail</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-3.5 sm:p-4 border-t border-outline-variant bg-surface-container-low flex justify-end">
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
