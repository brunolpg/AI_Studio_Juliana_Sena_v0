"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Printer,
  ShieldCheck,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Archive,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  FileText,
  CreditCard,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import type { Proposta } from "@/types/proposta";
import type { Client } from "@/types/client";
import { PrintPropostaModal } from "./print-proposta-modal";
import { PropostaDetailsModal } from "./proposta-details-modal";
import { suspenderProposta } from "@/app/actions/propostas-actions";
import { useToast } from "@/components/ui/toast";

interface PropostasCardsProps {
  propostas: Proposta[];
  client?: Client | null;
  isPatientView?: boolean;
  userRole?: string;
  onEdit?: (proposta: Proposta) => void;
  onRefresh?: () => void;
  onNewProposta?: () => void;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const clean = dateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function formatCurrency(val?: number | null): string {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function PropostasCards({
  propostas,
  client,
  isPatientView = false,
  userRole,
  onEdit,
  onRefresh,
  onNewProposta,
}: PropostasCardsProps) {
  const { toast } = useToast();
  const [selectedPropostaForPrint, setSelectedPropostaForPrint] = useState<Proposta | null>(null);
  const [selectedPropostaForDetails, setSelectedPropostaForDetails] = useState<Proposta | null>(null);
  const [isSuspendedSectionOpen, setIsSuspendedSectionOpen] = useState(false);

  // Modal para confirmação de suspensão com justificativa clínica
  const [propostaToSuspend, setPropostaToSuspend] = useState<Proposta | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [isSuspending, setIsSuspending] = useState(false);

  const isAdminOrProfissional =
    !isPatientView &&
    (userRole === "administrador" ||
      userRole === "admin" ||
      userRole === "profissional" ||
      !userRole);

  // Divide as propostas entre Ativas e Suspensas
  const activePropostas = useMemo(() => {
    return (propostas || [])
      .filter((p) => p.status === "Ativo")
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" }));
  }, [propostas]);

  const suspendedPropostas = useMemo(() => {
    if (isPatientView) return [];
    return (propostas || [])
      .filter((p) => p.status === "Suspenso")
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" }));
  }, [propostas, isPatientView]);

  const handleConfirmSuspension = async () => {
    if (!propostaToSuspend) return;
    if (!justificativa.trim()) {
      toast({
        type: "error",
        title: "Justificativa obrigatória",
        description: "Por favor, informe a justificativa clínica para suspender a proposta.",
      });
      return;
    }

    try {
      setIsSuspending(true);
      const res = await suspenderProposta(propostaToSuspend.id, justificativa);
      if (res.success) {
        toast({
          type: "success",
          title: "Proposta Suspensa",
          description: "O status da proposta foi atualizado para Suspenso com registro de justificativa.",
        });
        setPropostaToSuspend(null);
        setJustificativa("");
        if (onRefresh) onRefresh();
      } else {
        toast({
          type: "error",
          title: "Erro ao suspender",
          description: res.error || "Não foi possível suspender a proposta.",
        });
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: err?.message || "Falha na comunicação com o servidor.",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  const renderCard = (proposta: Proposta, isSuspended = false) => {
    const numOpcoes = proposta.opcoes?.length || 0;
    const numEtapas = proposta.cronograma?.etapas?.length || 0;

    return (
      <div
        key={proposta.id}
        className={`p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-500/30 transition-all flex flex-col justify-between min-w-0 w-full ${
          isSuspended ? "opacity-85 hover:opacity-100" : ""
        }`}
      >
        <div className="min-w-0 w-full">
          {/* Cabeçalho do Card */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full flex-wrap mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 uppercase tracking-wider">
                  PROPOSTA DE PLANEJAMENTO
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  <ShieldCheck className="w-3 h-3" />
                  SHA-256: {proposta.payload_hash ? `${proposta.payload_hash.substring(0, 8)}...` : "ASSINADO"}
                </span>
              </div>

              <h4
                className={`text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-1 leading-snug cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors ${
                  isSuspended ? "line-through text-slate-500 dark:text-slate-400" : ""
                }`}
                onClick={() => setSelectedPropostaForDetails(proposta)}
              >
                {proposta.titulo}
              </h4>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Emitido em {formatDateBR(proposta.created_at || proposta.assinado_em)}
                </span>
                <span>•</span>
                <span>{proposta.profissional || "Dra. Juliana Sena"}</span>
                <span>•</span>
                <span className="text-teal-600 dark:text-teal-400 font-medium">
                  {numOpcoes} {numOpcoes === 1 ? "opção cadastrada" : "opções cadastradas"}
                </span>
                {isSuspended && proposta.data_suspensao && (
                  <>
                    <span>•</span>
                    <span className="text-error font-semibold">
                      Suspenso em {formatDateBR(proposta.data_suspensao)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Ações e Badges MD4 */}
            <div className="flex items-center flex-wrap gap-2 shrink-0 self-start">
              <button
                type="button"
                onClick={() => setSelectedPropostaForPrint(proposta)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 hover:bg-teal-50/70 dark:hover:bg-slate-800/80 rounded-full cursor-pointer transition-colors shadow-2xs md-state-layer"
                title="Visualizar e imprimir relatório oficial"
              >
                <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Gerar Relatório</span>
              </button>

              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold select-none shadow-2xs ${
                  proposta.status === "Ativo"
                    ? "bg-success-container text-on-success-container border border-success/30"
                    : "bg-error-container text-on-error-container border border-error/30"
                }`}
              >
                {proposta.status === "Ativo" ? "Ativo" : "Suspenso"}
              </span>

              {isAdminOrProfissional && (
                <div className="flex items-center gap-1">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(proposta)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md-state-layer"
                      title="Editar proposta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {proposta.status === "Ativo" && (
                    <button
                      type="button"
                      onClick={() => {
                        setPropostaToSuspend(proposta);
                        setJustificativa("");
                      }}
                      className="p-1.5 rounded-full text-slate-400 hover:text-error hover:bg-error-container transition-colors cursor-pointer md-state-layer"
                      title="Suspender proposta"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Justificativa de Suspensão (se suspensa) */}
          {isSuspended && proposta.justificativa_suspensao && (
            <div className="mb-3 p-3 rounded-xl bg-error-container border border-error/30 text-xs">
              <div className="flex items-center gap-1.5 text-on-error-container font-semibold mb-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-error" />
                <span>Motivo da Suspensão:</span>
              </div>
              <p className="text-on-error-container leading-relaxed whitespace-pre-wrap pl-5">
                {proposta.justificativa_suspensao}
              </p>
            </div>
          )}

          {/* Corpo do Card: Objetivo, Prévia de Opções e Cronograma */}
          <div className="space-y-2.5 text-xs">
            {/* Bloco de Objetivo Terapêutico Resumido */}
            {proposta.objetivo && (
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                  Objetivo Terapêutico
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                  {proposta.objetivo}
                </p>
              </div>
            )}

            {/* Prévia das Opções de Protocolo */}
            {proposta.opcoes && proposta.opcoes.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-800/60 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span className="uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-teal-600" />
                    Opções de Tratamento ({numOpcoes})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {proposta.opcoes.map((opcao, oIdx) => {
                    const totalOpcao = opcao.procedimentos.reduce(
                      (acc, cur) => acc + (cur.total || 0),
                      0
                    );
                    const procsNames = opcao.procedimentos
                      .map((p) => `${p.num_sessoes}x ${p.nome_procedimento}`)
                      .join(", ");

                    return (
                      <div
                        key={opcao.id || oIdx}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            {opcao.titulo || `Opção #${oIdx + 1}`}
                          </span>
                          <span className="font-bold text-teal-700 dark:text-teal-400 font-mono text-[11px] shrink-0">
                            {formatCurrency(totalOpcao)}
                          </span>
                        </div>
                        {procsNames && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {procsNames}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resumo do Cronograma Sugerido */}
            {numEtapas > 0 && (
              <div className="px-2 py-1 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    Cronograma sugerido com <strong>{numEtapas} etapa{numEtapas === 1 ? "" : "s"}</strong>
                  </span>
                </span>
                {proposta.cronograma?.titulo && (
                  <span className="text-slate-400 text-[10px] hidden sm:inline">
                    ({proposta.cronograma.titulo})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Card */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Assinado por {proposta.profissional || "Dra. Juliana Sena"}</span>
          <button
            type="button"
            onClick={() => setSelectedPropostaForDetails(proposta)}
            className="text-teal-600 dark:text-teal-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
          >
            <span>Ver Proposta Completa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-4">
        {/* Cabeçalho da Seção */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-800/50 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Propostas de Planejamento Clínico ({activePropostas.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Planos de tratamento personalizados com opções comparativas e cronogramas
              </p>
            </div>
          </div>

          {onNewProposta && isAdminOrProfissional && (
            <button
              type="button"
              onClick={onNewProposta}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs transition-all cursor-pointer md-state-layer active:scale-[0.98]"
            >
              <span>+ Nova Proposta</span>
            </button>
          )}
        </div>

        {/* Lista de Cards de Propostas Ativas */}
        {activePropostas.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 min-w-0 w-full">
            {activePropostas.map((prop) => renderCard(prop, false))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nenhuma proposta ativa registrada para este paciente.
            </p>
            {onNewProposta && isAdminOrProfissional && (
              <button
                type="button"
                onClick={onNewProposta}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                + Criar a primeira proposta clínica
              </button>
            )}
          </div>
        )}

        {/* Seção Colapsável de Propostas Suspensas */}
        {suspendedPropostas.length > 0 && !isPatientView && (
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 overflow-hidden shadow-2xs transition-all">
            <button
              type="button"
              onClick={() => setIsSuspendedSectionOpen(!isSuspendedSectionOpen)}
              className="w-full flex items-center justify-between p-4 bg-slate-100/80 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Propostas Suspensas / Arquivadas
                    </h4>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-error-container text-on-error-container border border-error/30">
                      {suspendedPropostas.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Planos terapêuticos descontinuados ou reformulados com registro de justificativa
                  </p>
                </div>
              </div>
              <div className="text-slate-500 dark:text-slate-400 p-1">
                {isSuspendedSectionOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {isSuspendedSectionOpen && (
              <div className="p-4 space-y-3.5 max-h-[500px] overflow-y-auto">
                {suspendedPropostas.map((prop) => renderCard(prop, true))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes da Proposta */}
      {selectedPropostaForDetails && (
        <PropostaDetailsModal
          isOpen={!!selectedPropostaForDetails}
          onClose={() => setSelectedPropostaForDetails(null)}
          proposta={selectedPropostaForDetails}
          userRole={userRole}
          onEdit={(prop) => {
            setSelectedPropostaForDetails(null);
            if (onEdit) onEdit(prop);
          }}
          onSuspended={() => {
            setSelectedPropostaForDetails(null);
            if (onRefresh) onRefresh();
          }}
          patientData={{
            nome: client?.nome,
            email: client?.email,
            telefone: client?.telefone,
          }}
        />
      )}

      {/* Modal de Impressão e Relatório */}
      {selectedPropostaForPrint && (
        <PrintPropostaModal
          isOpen={true}
          onClose={() => setSelectedPropostaForPrint(null)}
          proposta={selectedPropostaForPrint}
          client={client}
        />
      )}

      {/* Dialog / Modal de Suspensão com Justificativa */}
      {propostaToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-error">
                <div className="w-8 h-8 rounded-xl bg-error-container flex items-center justify-center">
                  <Archive className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Suspender Proposta Clínica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPropostaToSuspend(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                Você está suspendendo a proposta{" "}
                <strong className="text-slate-900 dark:text-white">
                  "{propostaToSuspend.titulo}"
                </strong>
                . Informe a justificativa clínica para manter a rastreabilidade do prontuário:
              </p>
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Ex: Proposta ajustada após reavaliação clínica, paciente optou por protocolo alternativo..."
                rows={3}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-error resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPropostaToSuspend(null)}
                disabled={isSuspending}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspension}
                disabled={isSuspending || !justificativa.trim()}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-error text-on-error hover:opacity-90 rounded-full shadow-xs cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSuspending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suspendendo...</span>
                  </>
                ) : (
                  <span>Confirmar Suspensão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
