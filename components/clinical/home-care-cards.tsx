"use client";

import React, { useState } from "react";
import {
  HeartHandshake,
  Printer,
  ShieldCheck,
  Calendar,
  Clock,
  Pill,
  Edit2,
  Trash2,
  Sparkles,
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
      <div className="space-y-3.5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fichas de Home Care & Orientações ({fichas.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Protocolos e cronogramas de cuidados domiciliares assinados digitalmente
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {fichas.map((ficha) => {
            const cuidadosCount = ficha.cuidados?.length || 0;
            const cronoCount = ficha.cronograma?.length || 0;
            const recCount = ficha.recomendacoes?.length || 0;

            return (
              <div
                key={ficha.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <div className="flex flex-col md:flex-row justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 uppercase tracking-wider">
                          HOME CARE
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          <ShieldCheck className="w-3 h-3" />
                          SHA-256: {ficha.payload_hash ? ficha.payload_hash.substring(0, 8) : "ASSINADO"}...
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 break-words leading-snug">
                        {ficha.titulo_protocolo}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          Emitido em {formatDateBR(ficha.data_home_care)}
                        </span>
                        <span>•</span>
                        <span>{ficha.profissional || "Dra. Juliana Sena"}</span>
                        {ficha.appointment && (
                          <>
                            <span>•</span>
                            <span className="text-teal-600 dark:text-teal-400">
                              Consulta ({ficha.appointment.procedimento})
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Ações e Badges */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedFichaForPrint(ficha)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 hover:bg-teal-50/70 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer transition-colors shadow-2xs"
                        title="Visualizar e imprimir relatório oficial"
                      >
                        <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>Gerar Relatório</span>
                      </button>

                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold select-none ${
                          ficha.status === "Ativo"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            : ficha.status === "Concluído"
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {ficha.status}
                      </span>

                      {!isPatientView && (
                        <div className="flex items-center gap-1">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(ficha)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar ficha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(ficha.id)}
                            disabled={deletingId === ficha.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        <span className="uppercase tracking-wider">Cuidados Diários ({cuidadosCount})</span>
                      </div>
                      <div className="space-y-1">
                        {ficha.cuidados?.slice(0, 2).map((c, i) => (
                          <div key={i} className="flex items-baseline gap-1.5 text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-teal-600 dark:text-teal-400 shrink-0">{i + 1}.</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{c.titulo}:</span>
                            <span className="truncate text-slate-500 dark:text-slate-400">{c.texto}</span>
                          </div>
                        ))}
                        {cuidadosCount > 2 && (
                          <span className="text-[10px] text-slate-400 italic block pt-0.5">
                            + {cuidadosCount - 2} outro(s) cuidado(s) no relatório
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cronograma */}
                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        <span className="uppercase tracking-wider">Cronograma ({cronoCount} etapas)</span>
                      </div>
                      <div className="space-y-1.5">
                        {ficha.cronograma?.map((cr, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-bold text-teal-700 dark:text-teal-400 shrink-0">
                              Dias {cr.dia_inicio} ao {cr.dia_fim}
                            </span>
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate flex-1 text-right">
                              {cr.nome_formula}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {ficha.incluir_atencao_critica !== false && Boolean(ficha.atencao_critica_texto) && (
                      <div className="px-2 pt-1 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">Alerta: {ficha.atencao_critica_titulo || "Atenção Crítica ativa"}</span>
                      </div>
                    )}

                    {recCount > 0 && (
                      <div className="px-2 pt-0.5 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                        <span>{recCount} recomendação(ões) complementar(es) inclusa(s)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé com botão de acesso ao relatório completo */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Assinado por {ficha.profissional || "Juliana Sena"}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFichaForPrint(ficha)}
                    className="text-teal-600 dark:text-teal-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ver Orientações Completas</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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
        />
      )}
    </>
  );
}
