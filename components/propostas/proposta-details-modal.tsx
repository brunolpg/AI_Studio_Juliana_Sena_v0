"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  ShieldCheck,
  CreditCard,
  AlertTriangle,
  Edit3,
  Copy,
  Check,
  Share2,
  FileText,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { Proposta, OpcaoProposta, EtapaCronograma } from "@/types/proposta";
import { suspenderProposta } from "@/app/actions/propostas-actions";
import { useToast } from "@/components/ui/toast";
import { PropostaNotificationModal } from "./proposta-notification-modal";

interface PropostaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: Proposta | null;
  userRole?: string;
  onEdit?: (proposta: Proposta) => void;
  onSuspended?: () => void;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
}

export function PropostaDetailsModal({
  isOpen,
  onClose,
  proposta,
  userRole,
  onEdit,
  onSuspended,
  patientData,
}: PropostaDetailsModalProps) {
  const { toast } = useToast();
  const [copiedHash, setCopiedHash] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  if (!isOpen || !proposta) return null;

  const isAdminOrProfissional =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const isSuspensa = proposta.status === "Suspenso";

  // Formatação de datas no fuso horário América/São Paulo
  const formatDateBR = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const formatDateTimeBR = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleCopyHash = () => {
    if (!proposta.payload_hash) return;
    navigator.clipboard.writeText(proposta.payload_hash);
    setCopiedHash(true);
    toast({
      type: "info",
      title: "Hash Copiado",
      description: "Hash SHA-256 de integridade copiado para a área de transferência.",
    });
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleConfirmSuspension = async () => {
    if (!justificativa.trim()) {
      toast({
        type: "warning",
        title: "Justificativa obrigatória",
        description: "Informe o motivo clínico ou administrativo da suspensão.",
      });
      return;
    }

    setIsSuspending(true);
    try {
      const res = await suspenderProposta(proposta.id, justificativa.trim());
      if (res.success) {
        toast({
          type: "success",
          title: "Proposta Suspensa",
          description: "O status da proposta foi atualizado para Suspenso.",
        });
        setShowSuspendDialog(false);
        setJustificativa("");
        if (onSuspended) onSuspended();
        onClose();
      } else {
        throw new Error(res.error || "Não foi possível suspender a proposta.");
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro ao suspender",
        description: err.message || "Tente novamente em instantes.",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-proposta-title"
      >
        <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    Planejamento Clínico
                  </span>

                  {/* Status Badge */}
                  {isSuspensa ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-error-container text-on-error-container border border-error/30">
                      <AlertTriangle className="w-3.5 h-3.5 text-error" />
                      Suspenso
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-success-container text-on-success-container border border-success/30">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      Ativo
                    </span>
                  )}

                  {/* SHA-256 Integrity Badge */}
                  <button
                    type="button"
                    onClick={handleCopyHash}
                    title={`Hash SHA-256: ${proposta.payload_hash}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>SHA: {proposta.payload_hash ? `${proposta.payload_hash.substring(0, 8)}...` : "Verificado"}</span>
                    {copiedHash ? (
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-60" />
                    )}
                  </button>
                </div>

                <h2
                  id="modal-proposta-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate"
                >
                  {proposta.titulo}
                </h2>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Responsável: <span className="font-semibold text-slate-700 dark:text-slate-300">{proposta.profissional || "Dra. Juliana Sena"}</span> • Cadastrado em: {formatDateTimeBR(proposta.created_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Banner de Suspensão se aplicável */}
            {isSuspensa && (
              <div className="p-4 rounded-2xl bg-error-container border border-error/30 text-on-error-container flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold uppercase tracking-wider text-on-error-container">
                    Proposta Suspensa em {formatDateTimeBR(proposta.data_suspensao)}
                  </p>
                  <p className="leading-relaxed">
                    <strong className="font-semibold">Justificativa:</strong> {proposta.justificativa_suspensao || "Não especificada."}
                  </p>
                </div>
              </div>
            )}

            {/* Objetivo Clínico */}
            {proposta.objetivo && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-600" />
                  Objetivo do Planejamento
                </h3>
                <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {proposta.objetivo}
                </div>
              </div>
            )}

            {/* Opções de Protocolo Clínico */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  Opções de Tratamento & Protocolos ({proposta.opcoes.length})
                </h3>
              </div>

              <div className="space-y-5">
                {proposta.opcoes.map((opcao: OpcaoProposta, idx: number) => {
                  const subtotal = opcao.procedimentos.reduce(
                    (acc, p) => acc + (p.total || p.num_sessoes * p.valor_sessao),
                    0
                  );

                  return (
                    <div
                      key={opcao.id || idx}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 shadow-xs overflow-hidden"
                    >
                      {/* Opção Header */}
                      <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 block mb-0.5">
                            Alternativa #{idx + 1}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                            {opcao.titulo || `Opção #${idx + 1}`}
                          </h4>
                          {opcao.descricao && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {opcao.descricao}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                            Investimento Total
                          </span>
                          <span className="text-base sm:text-lg font-extrabold text-teal-700 dark:text-teal-300">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      </div>

                      {/* Tabela de Procedimentos */}
                      <div className="p-4 sm:p-5 space-y-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <tr>
                                <th className="pb-2 font-semibold">Procedimento</th>
                                <th className="pb-2 font-semibold text-center">Sessões</th>
                                <th className="pb-2 font-semibold text-right">Valor Unit.</th>
                                <th className="pb-2 font-semibold text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {opcao.procedimentos.map((proc, pIdx) => (
                                <tr key={proc.procedimento_id || pIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                  <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                    {proc.nome_procedimento}
                                  </td>
                                  <td className="py-2.5 text-center text-slate-600 dark:text-slate-400">
                                    {proc.num_sessoes}x
                                  </td>
                                  <td className="py-2.5 text-right text-slate-600 dark:text-slate-400 font-mono">
                                    {formatCurrency(proc.valor_sessao)}
                                  </td>
                                  <td className="py-2.5 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                                    {formatCurrency(proc.total || proc.num_sessoes * proc.valor_sessao)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Benefícios */}
                        {opcao.beneficios && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                              Benefícios Clínicos:
                            </span>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                              {opcao.beneficios}
                            </p>
                          </div>
                        )}

                        {/* Formas de Pagamento da Opção */}
                        {opcao.formas_pagamento && opcao.formas_pagamento.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-2">
                              <CreditCard className="w-3 h-3 text-teal-600" />
                              Condições Facilitadas de Pagamento
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {opcao.formas_pagamento.map((fp, fIdx) => {
                                if (fp.tipo === "a_vista") {
                                  const desc = fp.desconto || 0;
                                  const totalComDesc = subtotal * (1 - desc / 100);
                                  return (
                                    <div
                                      key={fIdx}
                                      className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-between"
                                    >
                                      <div>
                                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 block">
                                          À Vista ({desc}% desc.)
                                        </span>
                                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                          Pix ou Transferência
                                        </span>
                                      </div>
                                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                                        {formatCurrency(totalComDesc)}
                                      </span>
                                    </div>
                                  );
                                } else {
                                  const parcelas = fp.num_parcelas || 1;
                                  const valorParcela = subtotal / parcelas;
                                  return (
                                    <div
                                      key={fIdx}
                                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                                    >
                                      <div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                          Cartão de Crédito
                                        </span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                          Em até {parcelas}x sem juros
                                        </span>
                                      </div>
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono text-right">
                                        {parcelas}x de {formatCurrency(valorParcela)}
                                      </span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cronograma Clínico Inicial */}
            {proposta.cronograma && proposta.cronograma.etapas && proposta.cronograma.etapas.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  {proposta.cronograma.titulo || "Cronograma Clínico Inicial"}
                </h3>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-200 dark:before:bg-teal-900">
                  {proposta.cronograma.etapas.map((etapa: EtapaCronograma, eIdx: number) => (
                    <div key={etapa.id || eIdx} className="relative group">
                      <div className="absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white dark:border-slate-900" />
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Etapa #{eIdx + 1}
                          </span>
                          <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                            {etapa.tipo_data === "periodo"
                              ? `${formatDateBR(etapa.data_inicio)} até ${formatDateBR(etapa.data_fim)}`
                              : formatDateBR(etapa.data)}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">
                          {etapa.desc_etapa}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tópicos Adicionais & Orientações */}
            {proposta.topicos && proposta.topicos.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  Orientações & Observações Gerais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {proposta.topicos.map((topico, tIdx) => (
                    <div
                      key={topico.id || tIdx}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">
                        {topico.titulo}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {topico.texto}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diálogo inline de Suspensão */}
            {showSuspendDialog && (
              <div className="p-4 rounded-2xl bg-error-container border border-error/30 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-on-error-container font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-error" />
                  Confirmar Suspensão da Proposta
                </div>
                <p className="text-xs text-on-error-container">
                  Ao suspender, esta proposta sairá da listagem de planos ativos do paciente. Forneça o motivo:
                </p>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Ex: Paciente optou por adiar o protocolo devido a viagem ou preferiu outra linha de tratamento..."
                  rows={3}
                  className="w-full p-2.5 text-xs rounded-xl border border-error/40 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-error"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSuspendDialog(false)}
                    disabled={isSuspending}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSuspension}
                    disabled={isSuspending}
                    className="px-4 py-1.5 text-xs font-bold bg-error text-on-error hover:opacity-90 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSuspending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Suspendendo...
                      </>
                    ) : (
                      "Confirmar Suspensão"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-full transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Notificar Paciente</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isAdminOrProfissional && !isSuspensa && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSuspendDialog(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-error hover:bg-error-container rounded-full transition-colors cursor-pointer"
                  >
                    Suspender
                  </button>

                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEdit(proposta);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-teal-800 dark:text-teal-200 bg-teal-100 hover:bg-teal-200 dark:bg-teal-950/60 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-full transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-200/70 hover:bg-slate-300/70 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Notificação WhatsApp / E-mail */}
      {showNotificationModal && (
        <PropostaNotificationModal
          isOpen={showNotificationModal}
          onClose={() => setShowNotificationModal(false)}
          proposta={proposta}
          patientData={patientData}
        />
      )}
    </>
  );
}
