"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  ShieldCheck,
  Calendar,
  Clock,
  FlaskConical,
  Edit2,
  AlertTriangle,
  Archive,
  Sparkles,
} from "lucide-react";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import type { Client } from "@/types/client";
import { suspenderPrescricaoExame } from "@/app/actions/prescricoes-exames-actions";
import { useToast } from "@/components/ui/toast";

interface PrintExamPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescricao: PrescricaoExame | null;
  client?: Client | null;
  userRole?: string;
  onEdit?: (prescricao: PrescricaoExame) => void;
  onSuccessSuspend?: () => void;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatCPF(cpf?: string): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

export function PrintExamPrescriptionModal({
  isOpen,
  onClose,
  prescricao,
  client,
  userRole = "profissional",
  onEdit,
  onSuccessSuspend,
}: PrintExamPrescriptionModalProps) {
  const { toast } = useToast();
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [isSuspending, setIsSuspending] = useState(false);
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);
  const [justificativa, setJustificativa] = useState("Solicitação de exames substituída ou ajustada");

  if (!isOpen || !prescricao) return null;

  const isProfissionalOrAdmin =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const isAtivo = prescricao.status === "Ativo";

  const patientName =
    prescricao.paciente?.nome ||
    client?.nome ||
    "Paciente";

  const patientCpf =
    prescricao.paciente?.cpf ||
    client?.cpf;

  const patientAge = client?.idade;

  const handlePrint = () => {
    window.print();
  };

  const handleConfirmSuspend = async () => {
    if (!justificativa.trim()) {
      toast({
        type: "warning",
        title: "Justificativa Obrigatória",
        description: "Informe a justificativa para suspender esta prescrição de exames.",
      });
      return;
    }

    setIsSuspending(true);
    try {
      const res = await suspenderPrescricaoExame(prescricao.id, justificativa.trim());
      if (!res.success) {
        toast({
          type: "error",
          title: "Erro ao Suspender",
          description: res.error || "Não foi possível suspender a prescrição.",
        });
        return;
      }

      toast({
        type: "success",
        title: "Prescrição Suspensa",
        description: "A prescrição de exames foi arquivada no histórico de suspensas.",
      });

      setShowSuspendPrompt(false);
      if (onSuccessSuspend) onSuccessSuspend();
      onClose();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Falha",
        description: err?.message || "Erro inesperado ao suspender.",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-on-surface/50 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-4xl max-h-[85dvh] bg-surface rounded-md-2xl sm:rounded-md-3xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:border-none print:shadow-none print:max-h-none print:rounded-none">
        {/* Barra Superior de Ações (Oculta na Impressão) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0 print:hidden flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-on-surface">
                Solicitação de Exames Laboratoriais
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                <span>{patientName}</span>
                <span>•</span>
                <span className={`px-2 py-0.2 rounded-md-full font-semibold ${
                  isAtivo
                    ? "bg-success-container text-on-success-container border border-success/30"
                    : "bg-error-container text-on-error-container border border-error/30"
                }`}>
                  {prescricao.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Ações Restritas a Administrador e Profissional */}
            {isProfissionalOrAdmin && isAtivo && (
              <>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(prescricao);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                    <span>Editar Prescrição</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSuspendPrompt(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-semibold rounded-md-full border border-error/30 bg-error-container/60 text-on-error-container hover:bg-error-container transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-error" />
                  <span>Suspender</span>
                </button>
              </>
            )}

            {/* Botão Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] text-xs font-semibold rounded-md-full bg-primary text-on-primary hover:brightness-105 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal de Justificativa de Suspensão */}
        {showSuspendPrompt && (
          <div className="p-4 bg-error-container text-on-error-container border-b border-error/30 space-y-2 shrink-0 animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-error shrink-0" />
              <h4 className="text-xs font-bold">Suspender Prescrição de Exames</h4>
            </div>
            <p className="text-xs">
              Informe a justificativa clínica para descontinuar/suspender esta solicitação. Ela será arquivada no histórico de suspensas.
            </p>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Exames atualizados ou coletados"
              className="w-full min-h-[44px] px-3 rounded-md-md border border-error/40 bg-surface text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-error"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSuspendPrompt(false)}
                disabled={isSuspending}
                className="px-3 py-1.5 min-h-[44px] rounded-md-md text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                disabled={isSuspending}
                className="px-4 py-1.5 min-h-[44px] rounded-md-md bg-error text-on-error text-xs font-semibold hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                {isSuspending ? "Suspendendo..." : "Confirmar Suspensão"}
              </button>
            </div>
          </div>
        )}

        {/* Documento Clínico Formatado para Leitura e Impressão */}
        <div
          ref={printAreaRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-10 space-y-6 bg-surface-container-lowest text-on-surface print:p-8 print:overflow-visible print:bg-white"
        >
          {/* Cabeçalho do Laudo Clínico */}
          <div className="border-b-2 border-primary/20 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-primary">
                  Dra. Juliana Sena
                </h1>
              </div>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Biomedicina Estética & Práticas Integrativas em Saúde
              </p>
              <p className="text-[11px] text-on-surface-variant">
                Salvador - Bahia • Atendimento Personalizado
              </p>
            </div>

            <div className="sm:text-right space-y-0.5">
              <span className="inline-block px-3 py-1 rounded-md-full text-xs font-bold uppercase tracking-wider bg-primary-container text-on-primary-container border border-primary/30">
                {prescricao.titulo || "Prescrição de Exames"}
              </span>
              <div className="flex sm:justify-end items-center gap-1.5 text-xs text-on-surface-variant pt-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Emissão: {formatDateBR(prescricao.data)}</span>
              </div>
            </div>
          </div>

          {/* Dados do Paciente */}
          <div className="p-4 rounded-md-xl border border-outline-variant bg-surface-container-low space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Identificação do Paciente
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-on-surface-variant block">Nome Completo:</span>
                <strong className="text-on-surface text-sm">{patientName}</strong>
              </div>
              <div>
                <span className="text-on-surface-variant block">CPF:</span>
                <span className="text-on-surface font-mono">{formatCPF(patientCpf)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Idade / Status:</span>
                <span className="text-on-surface">
                  {patientAge ? `${patientAge} anos` : "Não informada"} • {prescricao.status}
                </span>
              </div>
            </div>
          </div>

          {/* Alerta de Prescrição Suspensa se for o caso */}
          {!isAtivo && (
            <div className="p-3.5 rounded-md-lg bg-error-container text-on-error-container border border-error/30 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-error" />
              <div>
                <strong>Atenção - Documento Suspenso:</strong> Esta solicitação de exames foi descontinuada ou substituída.
                {prescricao.justificativa_suspensao && (
                  <p className="mt-0.5 italic">Motivo: &quot;{prescricao.justificativa_suspensao}&quot;</p>
                )}
                {prescricao.data_suspensao && (
                  <p className="mt-0.5 text-[11px]">Data da suspensão: {formatDateBR(prescricao.data_suspensao)}</p>
                )}
              </div>
            </div>
          )}

          {/* Descrição / Mensagem ao Laboratório */}
          {prescricao.descricao && (
            <div className="p-3.5 rounded-md-lg border border-outline-variant bg-surface-container text-xs text-on-surface leading-relaxed whitespace-pre-wrap">
              {prescricao.descricao}
            </div>
          )}

          {/* Grupos e Exames */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-primary" />
              <span>Painel de Exames Laboratoriais Solicitados</span>
            </h2>

            <div className="space-y-3.5">
              {prescricao.grupos_exames && prescricao.grupos_exames.length > 0 ? (
                prescricao.grupos_exames.map((grp, gIdx) => (
                  <div
                    key={grp.id || `view_grp_${gIdx}`}
                    className="p-4 rounded-md-xl border border-outline-variant bg-surface-container-lowest space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                      <h3 className="text-xs sm:text-sm font-bold text-primary">
                        {grp.nome_grupo || `Grupo #${gIdx + 1}`}
                      </h3>
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        {grp.exames.length} {grp.exames.length === 1 ? "exame" : "exames"}
                      </span>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-on-surface pt-1">
                      {grp.exames.map((ex, eIdx) => (
                        <li key={`ex_item_${eIdx}`} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          <span className="font-medium">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant italic">
                  Nenhum grupo de exame registrado.
                </p>
              )}
            </div>
          </div>

          {/* Orientações para Coleta */}
          {prescricao.orientacoes && prescricao.orientacoes.length > 0 && (
            <div className="p-4 rounded-md-xl border border-outline-variant bg-surface-container-low space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Instruções e Orientações para a Realização dos Exames</span>
              </h3>
              <ul className="space-y-1.5 text-xs text-on-surface pl-2">
                {prescricao.orientacoes.map((ori, oIdx) => (
                  <li key={`ori_view_${oIdx}`} className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">{oIdx + 1}.</span>
                    <span className="leading-relaxed">{ori}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bloco de Assinatura e Integridade Criptográfica SHA-256 */}
          <div className="p-4 rounded-md-xl border border-outline-variant bg-surface-container-lowest space-y-3 mt-6">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-on-surface">
                  Assinatura Digital & Integridade Clínica
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md-full bg-primary-container text-on-primary-container font-semibold">
                Algoritmo: {prescricao.algoritmo || "SHA-256"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-on-surface-variant block text-[11px]">Profissional Responsável:</span>
                <strong className="text-on-surface">{prescricao.profissional || "Dra. Juliana Sena"}</strong>
              </div>

              <div>
                <span className="text-on-surface-variant block text-[11px]">Assinado Digitalmente em:</span>
                <span className="text-on-surface font-mono">
                  {prescricao.assinado_em
                    ? new Date(prescricao.assinado_em).toLocaleString("pt-BR")
                    : formatDateBR(prescricao.data)}
                </span>
              </div>
            </div>

            {prescricao.payload_hash && (
              <div className="p-2.5 rounded-md-lg bg-surface-container font-mono text-[10px] text-on-surface-variant break-all">
                <span className="font-bold text-on-surface">Hash de Integridade (SHA-256):</span>{" "}
                {prescricao.payload_hash}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
