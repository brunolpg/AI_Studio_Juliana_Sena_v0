"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  FlaskConical,
  Search,
  Plus,
  Trash2,
  FileText,
  Pill,
  Sparkles,
  ChevronRight,
  Stethoscope,
  ArrowLeft,
  BookOpen,
} from "lucide-react";
import { FormulaModal } from "./formula-modal";
import { AppHeader } from "@/components/shared/app-header";
import { deleteFormulaAction } from "@/actions/formula-actions";
import { useToast } from "@/components/ui/toast";
import type { Formula, Componente, Unidade } from "@/types/formula";

interface FormulaCatalogViewProps {
  initialFormulas: Formula[];
  componentes: Componente[];
  unidades: Unidade[];
}

export function FormulaCatalogView({
  initialFormulas,
  componentes,
  unidades,
}: FormulaCatalogViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [formulas, setFormulas] = useState<Formula[]>(initialFormulas);
  const [searchTerm, setSearchTerm] = useState("");
  const [viaFilter, setViaFilter] = useState<"todos" | "oral" | "tópico">("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredFormulas = useMemo(() => {
    return formulas.filter((f) => {
      const matchSearch =
        f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.descricao && f.descricao.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.veiculo && f.veiculo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchVia = viaFilter === "todos" ? true : f.via === viaFilter;

      return matchSearch && matchVia;
    });
  }, [formulas, searchTerm, viaFilter]);

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a fórmula "${nome}" do catálogo?`)) return;

    setDeletingId(id);
    try {
      const res = await deleteFormulaAction(id);
      if (res.success) {
        setFormulas((prev) => prev.filter((f) => f.id !== id));
        toast({ type: "success", title: "Fórmula Excluída", description: `"${nome}" foi removida com sucesso.` });
      } else {
        toast({ type: "error", title: "Erro", description: res.error || "Não foi possível excluir a fórmula." });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Erro", description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  return (
    <div className="font-['Plus_Jakarta_Sans',sans-serif] min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col box-border w-full max-w-full min-w-0 overflow-x-hidden pb-16 landscape:pb-8">
      
      {/* App Header */}
      <AppHeader
        currentTab="prontuarios"
        onTabChange={() => router.push("/dashboard")}
      />

      {/* Main Container com Compensação da Barra Lateral no Landscape e Desktop */}
      <main className="md4-main-content box-border flex-1 min-w-0 w-auto max-w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pr-4 sm:pr-6 landscape:pr-4 sm:landscape:pr-6 landscape:pl-0 pt-4 pb-12 sm:pt-6 space-y-5 sm:space-y-6 landscape:space-y-2.5 landscape:pt-2 landscape:pb-8 overflow-x-hidden">
        
        {/* Top Header / Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#042f2e] to-[#091522] p-4 sm:p-6 landscape:py-2.5 landscape:px-4 text-white shadow-sm border border-emerald-900/30 font-['Plus_Jakarta_Sans',sans-serif] w-full max-w-full box-border"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 landscape:py-0.5 landscape:px-2 landscape:text-[11px] landscape:mb-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[11px] sm:text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 landscape:w-3 landscape:h-3 text-emerald-400 shrink-0"/>
            <span>Prescrições & Fórmulas Magistrais</span>
          </div>

          <h1 className="mt-2.5 sm:mt-3 landscape:mt-1 text-lg sm:text-2xl landscape:text-lg font-bold tracking-tight text-white leading-tight">
            Catálogo de Fórmulas
          </h1>

          <p className="mt-1.5 sm:mt-2 landscape:mt-0.5 text-xs sm:text-sm landscape:text-xs landscape:line-clamp-1 text-emerald-100/75 leading-relaxed max-w-xl font-normal">
            Gerencie fórmulas magistrais, ativos e diretrizes de manipulação com agilidade e precisão clínica.
          </p>
        </motion.div>
        
        {/* KPI Cards (Idênticos a Pacientes Ativos e Consultas Hoje) */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-full box-border landscape:mt-2 landscape:gap-2.5">
          <div className="p-3.5 sm:p-5 landscape:p-2.5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm landscape:text-xs font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
                Fórmulas Cadastradas
              </span>
              <div className="p-1.5 sm:p-2.5 landscape:p-1.5 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7">
                <FlaskConical className="w-3.5 h-3.5 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-2 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-3xl landscape:text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400 leading-none">
                {formulas.length}
              </span>
              <span className="text-[10px] sm:text-[11px] landscape:text-[10px] text-slate-400 whitespace-nowrap">no catálogo</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-5 landscape:p-2.5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm landscape:text-xs font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">
                Componentes Ativos
              </span>
              <div className="p-1.5 sm:p-2.5 landscape:p-1.5 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 landscape:w-7 landscape:h-7">
                <Pill className="w-3.5 h-3.5 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-2 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-3xl landscape:text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400 leading-none">
                {componentes.length}
              </span>
              <span className="text-[10px] sm:text-[11px] landscape:text-[10px] text-slate-400 whitespace-nowrap">insumos disponíveis</span>
            </div>
          </div>
        </div>

        {/* Barra Superior de Controle, Busca MD4 e Ações */}
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-5 landscape:p-2.5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 landscape:gap-2 w-full max-w-full box-border min-w-0">
          
          {/* Campo de Busca Amplo MD4 Search Pill */}
          <div className="relative flex-1 max-w-lg min-w-0 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, descrição ou veículo..."
              className="w-full pl-10 pr-16 py-2 text-xs sm:text-sm rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Filtros em Pílulas (Tabs MD4) + Botões de Ação */}
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto min-w-0">
            {/* Pílulas de Filtro por Via */}
            <div className="flex items-center flex-nowrap overflow-x-auto max-w-full gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-full border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0 no-scrollbar shadow-2xs">
              {(["todos", "oral", "tópico"] as const).map((via) => (
                <button
                  key={via}
                  type="button"
                  onClick={() => setViaFilter(via)}
                  className={`text-xs px-3 sm:px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 text-center md-state-layer ${
                    viaFilter === via
                      ? "bg-[#0d6e64] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {via === "todos" ? "Todas as Vias" : via === "oral" ? "Oral" : "Tópico"}
                </button>
              ))}
            </div>

            {/* Botões de Ação no Padrão Pílula Compacto */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs active:scale-[0.98] md-state-layer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Voltar ao Prontuário</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full transition-all cursor-pointer shadow-xs active:scale-[0.98] md-state-layer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Nova Fórmula</span>
              </button>
            </div>
          </div>
        </div>

        {/* Listagem em Grid Responsiva (1 col mobile retrato, 2 col landscape/sm, 3 col desktop) */}
        {filteredFormulas.length === 0 ? (
          <div className="py-16 text-center max-w-sm mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              Nenhuma fórmula encontrada
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm || viaFilter !== "todos"
                ? "Tente ajustar os filtros ou o termo de busca."
                : "Cadastre sua primeira fórmula magistral no botão acima."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredFormulas.map((f) => {
              return (
                <div
                  key={f.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-500/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Cabeçalho do Card */}
                    <div className="flex flex-col md:flex-row justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
                      <div className="min-w-0 flex-1 w-full">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words leading-snug">
                          {f.nome}
                        </h4>
                        {f.descricao && (
                          <p className="text-xs sm:text-sm font-medium text-slate-700/80 dark:text-slate-300/80 mt-0.5 break-words leading-snug">
                            {f.descricao}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                          <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                            (Uso {f.via === "oral" ? "Oral" : "Tópico"})
                          </span>
                          {f.veiculo && (
                            <>
                              <span>•</span>
                              <span>Veículo: {f.veiculo}</span>
                            </>
                          )}
                          {f.dosagem && (
                            <>
                              <span>•</span>
                              <span>Dose: {f.dosagem} {f.tipo_veiculo || ""}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status / Ação */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span className="inline-flex items-center px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 select-none">
                          Em Uso (Ativo)
                        </span>
                        <button
                          type="button"
                          disabled={deletingId === f.id}
                          onClick={() => handleDelete(f.id, f.nome)}
                          className="border border-rose-200 bg-rose-50/50 dark:bg-rose-950/30 text-rose-600 hover:bg-rose-100 rounded-full px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="Excluir fórmula"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>

                    {/* Bloco de Composição (Caixa Verde Suave) */}
                    {f.formula_componentes && f.formula_componentes.length > 0 && (
                      <div className="mt-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 p-3.5 text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 font-semibold leading-relaxed space-y-1">
                        <strong className="block text-[11px] uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1">Composição:</strong>
                        {f.formula_componentes.map((fc, idx) => {
                          const compName = fc.componentes?.nome || "Ativo";
                          const qtd = fc.quantidade;
                          const unit = fc.componentes?.unidades?.unidade || "";
                          return (
                            <div key={idx}>
                              {compName}: {qtd}{unit}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Bloco de Posologia e Orientações (Caixa Cinza Suave, Sem Itálico/Aspas) */}
                    {(f.posologia || f.orient_paciente || f.orient_farmacia) && (
                      <div className="mt-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
                        {f.posologia && (
                          <p className="not-italic">
                            <strong className="font-bold text-slate-800 dark:text-slate-200">Posologia:</strong> {f.posologia}
                          </p>
                        )}
                        {f.orient_paciente && (
                          <p className="not-italic">
                            <strong className="font-bold text-slate-800 dark:text-slate-200">Orientação ao Paciente:</strong> {f.orient_paciente}
                          </p>
                        )}
                        {f.orient_farmacia && (
                          <p className="not-italic">
                            <strong className="font-bold text-slate-800 dark:text-slate-200">Orientação à Farmácia:</strong> {f.orient_farmacia}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>ID: {f.id.substring(0, 8)}...</span>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">Magistral Oficial</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Profissional */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 mt-16 landscape:mt-6 pt-6 landscape:pt-3 landscape:pl-20 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>Dra. Juliana Sena • Sistema Clínico e Prescrições Magistrais • Todos os direitos reservados.</p>
      </footer>

      {/* Modal de Nova Fórmula */}
      <FormulaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleRefresh}
        initialComponentes={componentes}
        initialUnidades={unidades}
      />
    </div>
  );
}
