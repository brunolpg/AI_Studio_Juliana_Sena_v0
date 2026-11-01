"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import {
  ClipboardList,
  Search,
  Trash2,
  Edit2,
  Printer,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Pill,
  Loader2,
  Plus,
} from "lucide-react";
import { PopFormModal } from "./pop-form-modal";
import { PrintPopModal } from "@/components/print-pop-modal";
import { getPopsAction, getPopCompletoAction, excluirPop } from "@/app/actions/pops";
import { useToast } from "@/components/ui/toast";
import type { PopProtocoloCompleto } from "@/types/pop";

// Cache em memória no cliente para renderização instantânea (SWR) entre trocas de abas
let cachedPopsList: PopProtocoloCompleto[] | null = null;
const fullPopsCache = new Map<string, PopProtocoloCompleto>();

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function PopsView() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Inicialização instantânea com dados em cache local se disponíveis
  const [pops, setPops] = useState<PopProtocoloCompleto[]>(() => cachedPopsList || []);
  const [isLoadingPops, setIsLoadingPops] = useState(() => !cachedPopsList);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [popToEdit, setPopToEdit] = useState<PopProtocoloCompleto | null>(null);
  const [popToPrint, setPopToPrint] = useState<PopProtocoloCompleto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Carregamento de POPs com revalidação assíncrona não-bloqueante
  const loadPops = async (isBackgroundRevalidate = false) => {
    if (!isBackgroundRevalidate && !cachedPopsList) {
      setIsLoadingPops(true);
    }

    try {
      const data = await getPopsAction();
      startTransition(() => {
        cachedPopsList = data || [];
        setPops(data || []);
      });
    } catch (err: any) {
      console.error("Erro ao carregar POPs institucionais:", err);
      if (!cachedPopsList) {
        toast({
          type: "error",
          title: "Erro ao Carregar",
          description: "Falha ao carregar os Procedimentos Operacionais Padrão.",
        });
      }
    } finally {
      setIsLoadingPops(false);
    }
  };

  useEffect(() => {
    // Se já temos cache, fazemos revalidação silenciosa em background
    loadPops(Boolean(cachedPopsList));
  }, []);

  // Ações de gerenciamento dos POPs
  const handleOpenNew = () => {
    setPopToEdit(null);
    setIsFormModalOpen(true);
  };

  // Carregamento sob demanda (lazy loading) dos detalhes para edição
  const handleEdit = async (pop: PopProtocoloCompleto) => {
    const hasPrescricao = pop.blocos?.some(
      (b) => b.tipo === "PRESCRICAO" && b.prescricao_id
    );

    // Se já estiver no cache detalhado ou não tiver prescrições complexas, abre direto
    if (!hasPrescricao || fullPopsCache.has(pop.id)) {
      setPopToEdit(fullPopsCache.get(pop.id) || pop);
      setIsFormModalOpen(true);
      return;
    }

    setLoadingDetailId(pop.id);
    try {
      const fullPop = await getPopCompletoAction(pop.id);
      if (fullPop) {
        fullPopsCache.set(pop.id, fullPop);
        setPopToEdit(fullPop);
      } else {
        setPopToEdit(pop);
      }
    } catch {
      setPopToEdit(pop);
    } finally {
      setLoadingDetailId(null);
      setIsFormModalOpen(true);
    }
  };

  // Carregamento sob demanda (lazy loading) dos detalhes para relatório/impressão A4
  const handlePrintModal = async (pop: PopProtocoloCompleto) => {
    const hasPrescricao = pop.blocos?.some(
      (b) => b.tipo === "PRESCRICAO" && b.prescricao_id
    );

    if (!hasPrescricao || fullPopsCache.has(pop.id)) {
      setPopToPrint(fullPopsCache.get(pop.id) || pop);
      return;
    }

    setLoadingDetailId(pop.id);
    try {
      const fullPop = await getPopCompletoAction(pop.id);
      if (fullPop) {
        fullPopsCache.set(pop.id, fullPop);
        setPopToPrint(fullPop);
      } else {
        setPopToPrint(pop);
      }
    } catch {
      setPopToPrint(pop);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleDelete = async (pop: PopProtocoloCompleto) => {
    if (
      !confirm(
        `Tem certeza que deseja excluir o Procedimento "${pop.protocolo}"? Esta ação removerá os tópicos e prescrições vinculadas permanentemente.`
      )
    ) {
      return;
    }

    setDeletingId(pop.id);
    try {
      const res = await excluirPop(pop.id);
      if (res.error) {
        toast({
          type: "error",
          title: "Erro na Exclusão",
          description: res.error,
        });
      } else {
        toast({
          type: "success",
          title: "POP Excluído",
          description: `"${pop.protocolo}" foi removido com sucesso.`,
        });
        fullPopsCache.delete(pop.id);
        // Atualiza imediatamente na UI
        const updated = pops.filter((p) => p.id !== pop.id);
        cachedPopsList = updated;
        setPops(updated);
        // Revalida em background
        loadPops(true);
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro",
        description: err?.message || "Falha ao excluir procedimento.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Contadores para métricas institucionais
  const ativosCount = useMemo(() => {
    return pops.filter((p) => p.status === "Ativo" || !p.status).length;
  }, [pops]);

  const emRevisaoCount = useMemo(() => {
    return pops.filter((p) => p.status === "Em Revisão").length;
  }, [pops]);

  const canceladosCount = useMemo(() => {
    return pops.filter((p) => p.status === "Cancelado").length;
  }, [pops]);

  // Filtro de busca na lista de POPs
  const filteredPops = useMemo(() => {
    if (!searchTerm.trim()) return pops;
    const q = searchTerm.toLowerCase().trim();
    return pops.filter(
      (p) =>
        p.protocolo.toLowerCase().includes(q) ||
        p.finalidade.toLowerCase().includes(q) ||
        (p.profissional && p.profissional.toLowerCase().includes(q))
    );
  }, [pops, searchTerm]);

  return (
    <div className="font-['Plus_Jakarta_Sans',sans-serif] space-y-4 sm:space-y-6 w-full min-w-0 box-border">
      {/* 1. Métricas Institucionais (Ativos, Em Revisão, Cancelados) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 w-full mb-6 max-lg:landscape:grid-cols-3 max-lg:landscape:gap-3 box-border">
        {/* Card: Ativos */}
        <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
              Ativos
            </span>
            <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
            </div>
          </div>
          <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
            {isLoadingPops && pops.length === 0 ? (
              <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 leading-none">
                {ativosCount}
              </span>
            )}
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
              procedimentos vigentes
            </span>
          </div>
        </div>

        {/* Card: Em Revisão */}
        <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
              Em Revisão
            </span>
            <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
            </div>
          </div>
          <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
            {isLoadingPops && pops.length === 0 ? (
              <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400 leading-none">
                {emRevisaoCount}
              </span>
            )}
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
              sob atualização clínica
            </span>
          </div>
        </div>

        {/* Card: Cancelados */}
        <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
              Cancelados
            </span>
            <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-rose-500/10 text-rose-700 dark:text-rose-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
            </div>
          </div>
          <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
            {isLoadingPops && pops.length === 0 ? (
              <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
            ) : (
              <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-rose-700 dark:text-rose-400 leading-none">
                {canceladosCount}
              </span>
            )}
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
              descontinuados
            </span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Busca e Ação de Cadastro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por protocolo, finalidade clínica ou responsável..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d40]"
          />
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs hover:shadow transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] md-state-layer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Cadastrar Novo POP</span>
        </button>
      </div>

      {/* 3. Lista de POPs Cadastrados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#004d40] dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Procedimentos Operacionais Padrão ({filteredPops.length})
            </h2>
          </div>
          {isPending && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-[#004d40]" />
              <span>Sincronizando...</span>
            </span>
          )}
        </div>

        {/* Skeleton Inicial Imediato */}
        {isLoadingPops && pops.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs animate-pulse space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                      <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3.5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  </div>
                  <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
                </div>
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                  <div className="h-9 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPops.length === 0 ? (
          <div className="p-10 sm:p-14 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-[#004d40] dark:text-emerald-400">
              <ClipboardList className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {searchTerm ? "Nenhum procedimento encontrado" : "Nenhum POP Cadastrado"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {searchTerm
                  ? "Tente ajustar os termos da busca para encontrar o protocolo desejado."
                  : "A clínica ainda não possui procedimentos operacionais padronizados cadastrados. Comece cadastrando o primeiro POP institucional."}
              </p>
            </div>
            {!searchTerm && (
              <button
                type="button"
                onClick={handleOpenNew}
                className="mt-4 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium text-white dark:text-slate-950 bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-500 dark:hover:bg-teal-400 rounded-full shadow-xs hover:shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] md-state-layer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Criar Primeiro POP</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 w-full">
            {filteredPops.map((pop) => {
              const blocos = pop.blocos || [];
              const topicosCount = blocos.filter((b) => b.tipo === "TOPICO").length;
              const prescricoesCount = blocos.filter((b) => b.tipo === "PRESCRICAO").length;
              const subtopicosCount = blocos.reduce(
                (acc, b) => acc + (b.subtopicos?.length || 0),
                0
              );

              // Cores do badge de status
              let statusClasses =
                "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
              if (pop.status === "Em Revisão") {
                statusClasses =
                  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
              } else if (pop.status === "Cancelado") {
                statusClasses =
                  "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
              }

              const isDetailLoading = loadingDetailId === pop.id;

              return (
                <div
                  key={pop.id}
                  className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-[#004d40]/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusClasses}`}
                          >
                            {pop.status || "Ativo"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            SHA-256:{" "}
                            {pop.payload_hash ? pop.payload_hash.substring(0, 8) : "ASSINADO"}...
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {pop.protocolo}
                        </h3>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Emitido em {formatDateBR(pop.data_pop)}
                          </span>
                          <span>•</span>
                          <span>{pop.profissional || "Juliana Sena de Souza Vieira"}</span>
                        </div>
                      </div>

                      {/* Botões de Ação do Card */}
                      <div className="flex items-center gap-2 shrink-0 self-start">
                        <button
                          type="button"
                          onClick={() => handlePrintModal(pop)}
                          disabled={isDetailLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#004d40] dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-full cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                          title="Visualizar e imprimir relatório oficial A4"
                        >
                          {isDetailLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#004d40]" />
                          ) : (
                            <Printer className="w-3.5 h-3.5 text-[#004d40] dark:text-emerald-400" />
                          )}
                          <span>Gerar Relatório</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(pop)}
                          disabled={isDetailLoading}
                          className="p-1.5 rounded-full text-slate-400 hover:text-[#004d40] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                          title="Editar POP"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(pop)}
                          disabled={deletingId === pop.id}
                          className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Excluir POP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Finalidade do POP */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 leading-relaxed">
                      {pop.finalidade}
                    </p>

                    {/* Resumo dos Blocos e Contadores */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Tópicos:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-bold">
                          {topicosCount}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Subtópicos:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-bold">
                          {subtopicosCount}
                        </strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Prescrições:</span>
                        <strong className="text-[#004d40] dark:text-emerald-400 font-bold">
                          {prescricoesCount}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Formulário de POP */}
      {isFormModalOpen && (
        <PopFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          popToEdit={popToEdit}
          onSuccess={() => {
            fullPopsCache.clear();
            loadPops(true);
          }}
        />
      )}

      {/* Modal de Relatório e Impressão A4 */}
      {popToPrint && (
        <PrintPopModal
          isOpen={Boolean(popToPrint)}
          onClose={() => setPopToPrint(null)}
          pop={popToPrint}
        />
      )}
    </div>
  );
}
