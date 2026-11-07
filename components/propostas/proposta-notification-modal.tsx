"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Mail,
  CheckCircle2,
  X,
  FileCheck,
  Send,
  Loader2,
} from "lucide-react";
import type { Proposta } from "@/types/proposta";
import { useToast } from "@/components/ui/toast";

interface PropostaNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: Proposta | null;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
}

export function PropostaNotificationModal({
  isOpen,
  onClose,
  proposta,
  patientData,
}: PropostaNotificationModalProps) {
  const { toast } = useToast();
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  if (!isOpen || !proposta) return null;

  const patientName = patientData?.nome || "Paciente";
  const patientPhone = patientData?.telefone?.replace(/\D/g, "") || "";
  const patientEmail = patientData?.email || "";

  // Montagem do texto detalhado para WhatsApp
  const handleSendWhatsApp = () => {
    const opcoesResumo = proposta.opcoes
      .map((op, idx) => {
        const procs = op.procedimentos
          .map((p) => `• ${p.nome_procedimento} (${p.num_sessoes}x)`)
          .join("\n");
        const totalOpcao = op.procedimentos.reduce((acc, p) => acc + p.total, 0);
        return `*${op.titulo || `Opção #${idx + 1}`}* (Total: R$ ${totalOpcao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})\n${procs}`;
      })
      .join("\n\n");

    const mensagem = [
      `Olá, *${patientName}*!`,
      ``,
      `Sua proposta de planejamento clínico na *Clínica Dra. Juliana Sena* já está disponível:`,
      `📋 *${proposta.titulo}*`,
      proposta.objetivo ? `🎯 *Objetivo:* ${proposta.objetivo}` : "",
      ``,
      `*Opções de Tratamento:*`,
      opcoesResumo,
      ``,
      `Acesse seu Portal do Paciente para visualizar todos os detalhes do cronograma e condições de pagamento:`,
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
      description: "A mensagem com o resumo da proposta foi gerada para envio.",
    });
  };

  // Envio por e-mail de contingência
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
          procedimento: `Proposta: ${proposta.titulo}`,
          observacoes: `Objetivo: ${proposta.objetivo || "Planejamento personalizado"}. Proposta com ${proposta.opcoes.length} opção(ões) de protocolo clínico.`,
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
      // Fallback gracioso com mailto
      const subject = encodeURIComponent(`Proposta de Planejamento Clínico - Dra. Juliana Sena: ${proposta.titulo}`);
      const body = encodeURIComponent(
        `Olá ${patientName},\n\nSua proposta de planejamento "${proposta.titulo}" foi cadastrada com sucesso. Acesse o portal para visualizar o cronograma completo.`
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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Proposta Salva com Sucesso!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deseja notificar o paciente agora?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumo da Proposta */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                Paciente: {patientName}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {proposta.opcoes.length} {proposta.opcoes.length === 1 ? "Opção" : "Opções"}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {proposta.titulo}
            </h4>
            {proposta.objetivo && (
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {proposta.objetivo}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Envie os dados de acesso e o resumo do plano de tratamento diretamente pelos canais oficiais:
          </p>

          {/* Botões de Ação de Notificação */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4" />
                <span>Notificar via WhatsApp</span>
              </div>
              <Send className="w-3.5 h-3.5 opacity-80" />
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5">
                {isSendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                ) : (
                  <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                )}
                <span>
                  {isSendingEmail
                    ? "Enviando e-mail..."
                    : emailSent
                    ? "Reenviar via E-mail"
                    : "Notificar via E-mail"}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                {patientEmail || "Sem e-mail"}
              </span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Concluir sem notificar
          </button>
        </div>
      </div>
    </div>
  );
}
