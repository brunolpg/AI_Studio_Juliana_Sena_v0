"use client";

import React, { useState } from "react";
import {
  FlaskConical,
  Printer,
  ShieldCheck,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Share2,
  Archive,
  AlertTriangle,
} from "lucide-react";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import type { Client } from "@/types/client";
import { PrintExamPrescriptionModal } from "@/components/clinical/print-exam-prescription-modal";
import { suspenderPrescricaoExame } from "@/app/actions/prescricoes-exames-actions";
import { useToast } from "@/components/ui/toast";

interface ExamPrescriptionCardsProps {
  prescricoes: PrescricaoExame[];
  client?: Client | null;
  isPatientView?: boolean;
  onEdit?: (prescricao: PrescricaoExame) => void;
  onNotify?: (prescricao: PrescricaoExame) => void;
  onRefresh?: () => void;
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

export function ExamPrescriptionCards({
  prescricoes,
  client,
  isPatientView = false,
  onEdit,
  onNotify,
  onRefresh,
}: ExamPrescriptionCardsProps) {
  const { toast } = useToast();
  const [selectedForPrint, setSelectedForPrint] = useState<PrescricaoExame | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);

  // Filtra apenas ativas para os cards principais
  const activePrescricoes = (prescricoes || []).filter(
    (p) => p.status === "Ativo"
  );

  const handleSuspend = async (p: PrescricaoExame) => {
    const justificativa = prompt(
      "Informe a justificativa para suspender esta prescrição de exames:",
      "Solicitação de exames substituída ou ajustada"
    );

    if (justificativa === null) return; // cancelou o prompt
    if (!justificativa.trim()) {
      toast({
        type: "warning",
        title: "Justificativa Obrigatória",
        description: "A justificativa é necessária para suspender a prescrição.",
      });
      return;
    }

    setSuspendingId(p.id);
    try {
      const res = await suspenderPrescricaoExame(p.id, justificativa.trim());
      if (res.error) {
        toast({
          type: "error",
          title: "Erro ao Suspender",
          description: res.error,
        });
      } else {
        toast({
          type: "success",
          title: "Prescrição Suspensa",
          description: "A solicitação foi movida para o histórico de prescrições suspensas.",
        });
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: err?.message || "Falha ao suspender prescrição de exames.",
      });
    } finally {
      setSuspendingId(null);
    }
  };

  if (!activePrescricoes || activePrescricoes.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                Solicitações de Exames Laboratoriais ({activePrescricoes.length})
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Guias e painéis de exames laboratoriais ativos com hash SHA-256
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 min-w-0 w-full">
          {activePrescricoes.map((presc) => {
            const gruposCount = presc.grupos_exames?.length || 0;
            const examesCount = (presc.grupos_exames || []).reduce(
              (acc, g) => acc + (g.exames?.length || 0),
              0
            );
            const truncatedHash = presc.payload_hash
              ? `${presc.payload_hash.substring(0, 8)}...${presc.payload_hash.substring(presc.payload_hash.length - 8)}`
              : null;

            return (
              <div
                key={presc.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-md-2xl p-4 sm:p-5 transition-all hover:border-outline shadow-2xs flex flex-col justify-between min-w-0 w-full"
              >
                <div className="min-w-0 w-full">
                  {/* Cabeçalho do Card */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md-full bg-primary-container text-on-primary-container">
                          Exames Laboratoriais
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md-full bg-success-container text-on-success-container">
                          {presc.status}
                        </span>
                        {truncatedHash && (
                          <span
                            className="text-[10px] font-mono px-2.5 py-0.5 rounded-md-full bg-surface-container text-on-surface/85 border border-outline-variant"
                            title={`Hash SHA-256: ${presc.payload_hash}`}
                          >
                            SHA-256: {truncatedHash}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-on-surface leading-snug mt-1.5">
                        {presc.titulo}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-on-surface/80 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-on-surface font-medium">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          <span>Emissão: {formatDateBR(presc.data)}</span>
                        </span>
                        <span>•</span>
                        <span>{gruposCount} {gruposCount === 1 ? "grupo" : "grupos"}</span>
                        <span>•</span>
                        <span className="text-primary font-semibold">{examesCount} {examesCount === 1 ? "exame" : "exames"}</span>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center flex-wrap gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setSelectedForPrint(presc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-surface-container-lowest border border-outline-variant hover:bg-surface-container rounded-md-full cursor-pointer transition-colors"
                        title="Visualizar e imprimir guia de exames"
                      >
                        <Printer className="w-3.5 h-3.5 text-primary" />
                        <span>Gerar Relatório</span>
                      </button>

                      {!isPatientView && (
                        <>
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(presc)}
                              className="p-2 rounded-full text-on-surface/85 bg-surface-container/60 border border-outline-variant/70 hover:text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center"
                              title="Editar solicitação de exames"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onNotify && (
                            <button
                              type="button"
                              onClick={() => onNotify(presc)}
                              className="p-2 rounded-full text-on-surface/85 bg-surface-container/60 border border-outline-variant/70 hover:text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center"
                              title="Notificar paciente via WhatsApp ou E-mail"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSuspend(presc)}
                            disabled={suspendingId === presc.id}
                            className="p-2 rounded-full text-on-surface/85 bg-surface-container/60 border border-outline-variant/70 hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
                            title="Suspender esta solicitação"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resumo dos Grupos e Exames */}
                  <div className="mt-3 p-3.5 rounded-md-xl bg-surface-container/50 border border-outline-variant space-y-2.5">
                    {presc.descricao && (
                      <p className="text-xs text-on-surface leading-relaxed">
                        {presc.descricao}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {presc.grupos_exames?.map((grp, idx) => (
                        <span
                          key={grp.id || idx}
                          className="text-xs px-2.5 py-1 rounded-md-lg bg-primary-container/60 text-on-primary-container border border-primary/25 font-medium"
                        >
                          <strong className="font-semibold">{grp.nome_grupo}:</strong>{" "}
                          <span>{grp.exames.length} {grp.exames.length === 1 ? "exame" : "exames"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Impressão Integrado */}
      {selectedForPrint && (
        <PrintExamPrescriptionModal
          isOpen={Boolean(selectedForPrint)}
          onClose={() => setSelectedForPrint(null)}
          prescricao={selectedForPrint}
          client={client}
          userRole={isPatientView ? "paciente" : "profissional"}
          onEdit={onEdit}
          onSuccessSuspend={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}
