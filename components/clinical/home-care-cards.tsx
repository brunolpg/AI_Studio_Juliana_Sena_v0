"use client";

import React, { useState } from "react";
import {
  HeartHandshake,
  Printer,
  Calendar,
  Edit2,
  Trash2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { Client } from "@/types/client";
import { PrintHomeCareModal } from "@/components/clinical/print-home-care-modal";
import { deleteHomeCareFicha } from "@/app/actions/home-care";

interface HomeCareCardsProps {
  fichas: HomeCareFichaCompleta[];
  client?: Client | null;
  isPatientView?: boolean;
  userRole?: string;
  onEdit?: (ficha: HomeCareFichaCompleta) => void;
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

export function HomeCareCards({
  fichas,
  client,
  isPatientView = false,
  userRole,
  onEdit,
  onRefresh,
}: HomeCareCardsProps) {
  const [selectedFichaForPrint, setSelectedFichaForPrint] = useState<HomeCareFichaCompleta | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta ficha de Home Care? Esta ação não pode ser desfeita.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteHomeCareFicha(id);
      if (res.error) {
        alert(res.error);
      } else if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao excluir ficha de Home Care.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!fichas || fichas.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                Fichas de Home Care & Orientações ({fichas.length})
              </h3>
              <p className="text-[11px] text-on-surface-variant">
                Protocolos e cronogramas de cuidados domiciliares assinados digitalmente
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 min-w-0 w-full">
          {fichas.map((ficha) => {
            const cuidadosCount = ficha.cuidados?.length || 0;
            const cronoCount = ficha.cronograma?.length || 0;
            const recCount = ficha.recomendacoes?.length || 0;

            return (
              <div
                key={ficha.id}
                className="p-4 sm:p-5 rounded-md-2xl bg-surface-container-lowest border border-outline shadow-2xs hover:border-primary/30 transition-all flex flex-col justify-between min-w-0 w-full"
              >
                <div className="min-w-0 w-full">
                  {/* Cabeçalho do Card */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 w-full flex-wrap mb-3 pb-3 border-b border-outline-variant">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md-full bg-primary-container text-on-primary-container">
                          HOME CARE
                        </span>
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md-full select-none ${
                            ficha.status === "Ativo"
                              ? "bg-success-container text-on-success-container"
                              : ficha.status === "Concluído"
                              ? "bg-secondary-container text-on-secondary-container"
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          {ficha.status}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-on-surface mt-1.5 leading-snug">
                        {ficha.titulo_protocolo}
                      </h4>

                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Emissão: {formatDateBR(ficha.data_home_care)}</span>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center flex-wrap gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setSelectedFichaForPrint(ficha)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-md-full cursor-pointer transition-colors"
                        title="Visualizar e imprimir relatório oficial"
                      >
                        <Printer className="w-3.5 h-3.5 text-primary" />
                        <span>Gerar Relatório</span>
                      </button>

                      {!isPatientView && (
                        <div className="flex items-center gap-1.5">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(ficha)}
                              className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container-low text-on-surface hover:text-primary hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-center"
                              title="Editar ficha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(ficha.id)}
                            disabled={deletingId === ficha.id}
                            className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container-low text-on-surface hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
                            title="Excluir ficha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resumo de Cuidados e Cronograma */}
                  <div className="space-y-2 text-xs">
                    {/* Cuidados */}
                    <div className="p-3.5 rounded-md-xl bg-surface-container-low border border-outline-variant/70">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface mb-1.5">
                        <span>Cuidados Diários ({cuidadosCount})</span>
                      </div>
                      <div className="space-y-1">
                        {ficha.cuidados?.slice(0, 2).map((c, i) => (
                          <div key={i} className="flex items-baseline gap-1.5 text-on-surface-variant">
                            <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                            <span className="font-medium text-on-surface">{c.titulo}:</span>
                            <span className="truncate text-on-surface-variant">{c.texto}</span>
                          </div>
                        ))}
                        {cuidadosCount > 2 && (
                          <span className="text-[10px] text-on-surface-variant italic block pt-0.5">
                            + {cuidadosCount - 2} outro(s) cuidado(s) no relatório
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cronograma (se incluído) */}
                    {cronoCount > 0 && (
                      <div className="p-3.5 rounded-md-xl bg-surface-container-low border border-outline-variant/70 text-on-surface">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-on-surface mb-2">
                          <span>Cronograma ({cronoCount} {cronoCount === 1 ? "etapa" : "etapas"})</span>
                        </div>
                        <div className="space-y-1.5">
                          {ficha.cronograma?.map((cr, idx) => (
                            <div key={idx} className="grid grid-cols-[88px_1fr] items-baseline gap-2 text-left">
                              <span className="text-xs font-semibold text-primary shrink-0 text-left">
                                Dias {cr.dia_inicio} ao {cr.dia_fim}
                              </span>
                              <span className="text-xs font-medium text-on-surface truncate text-left">
                                {cr.nome_formula}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ficha.incluir_atencao_critica !== false && Boolean(ficha.atencao_critica_texto) && (
                      <div className="px-2 pt-1 flex items-center gap-1.5 text-[10px] text-warning font-semibold">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">Alerta: {ficha.atencao_critica_titulo || "Atenção Crítica ativa"}</span>
                      </div>
                    )}

                    {recCount > 0 && (
                      <div className="px-2 pt-0.5 flex items-center justify-between text-[10px] text-on-surface-variant font-medium">
                        <span>{recCount} recomendação(ões) complementar(es) inclusa(s)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé com botão de acesso ao relatório completo */}
                <div className="mt-3.5 pt-2.5 border-t border-outline-variant flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedFichaForPrint(ficha)}
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md-full text-xs font-semibold leading-none bg-primary-container text-on-primary-container border border-outline-variant hover:bg-primary-container/80 active:scale-[0.98] transition-all cursor-pointer shadow-xs shrink-0 whitespace-nowrap"
                  >
                    <span>Ver Orientações Completas</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Impressão e Relatório */}
      {selectedFichaForPrint && (
        <PrintHomeCareModal
          isOpen={true}
          onClose={() => setSelectedFichaForPrint(null)}
          ficha={selectedFichaForPrint}
          client={client}
          userRole={userRole || (isPatientView ? "paciente" : "profissional")}
          onEdit={!isPatientView ? onEdit : undefined}
        />
      )}
    </>
  );
}
