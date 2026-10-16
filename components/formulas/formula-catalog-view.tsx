"use client";

import React, { useState, useMemo } from "react";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 pb-16">
      
      {/* Top Header / Hero Card */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8"
      >
        <div className="bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Prescrições & Fórmulas Magistrais</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Catálogo de Fórmulas
            </h1>
            <p className="text-sm text-emerald-100/80 leading-relaxed max-w-xl">
              Gerencie fórmulas magistrais, ativos e diretrizes de manipulação com agilidade e precisão clínica.
            </p>
          </div>

          <div className="flex items-center gap-3 z-10 w-full md:w-auto justify-start md:justify-end">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition-colors backdrop-blur-md cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar</span>
            </a>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fórmula</span>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-6">
        
        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
          
          {/* Busca por texto */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, descrição ou veículo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Filtro por Via */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Via:</span>
            {(["todos", "oral", "tópico"] as const).map((via) => (
              <button
                key={via}
                type="button"
                onClick={() => setViaFilter(via)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer shrink-0 ${
                  viaFilter === via
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {via === "todos" ? "Todas as Vias" : via === "oral" ? "Oral" : "Tópico"}
              </button>
            ))}
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
              const viaBadgeColor =
                f.via === "oral"
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200/60"
                  : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60";

              return (
                <div
                  key={f.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs hover:border-teal-500/40 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${viaBadgeColor} mb-1.5`}>
                          Uso {f.via}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                          {f.nome}
                        </h3>
                      </div>

                      <button
                        type="button"
                        disabled={deletingId === f.id}
                        onClick={() => handleDelete(f.id, f.nome)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Excluir fórmula"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {f.descricao && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {f.descricao}
                      </p>
                    )}

                    {/* Veículo & Dosagem */}
                    {(f.veiculo || f.dosagem) && (
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                        {f.veiculo && (
                          <p className="text-slate-700 dark:text-slate-300">
                            <strong className="text-slate-400">Veículo:</strong> {f.veiculo}
                          </p>
                        )}
                        {f.dosagem && (
                          <p className="text-slate-700 dark:text-slate-300">
                            <strong className="text-slate-400">Dosagem:</strong> {f.dosagem} {f.tipo_veiculo || ""}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Lista de Ativos / Componentes */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Componentes Ativos ({f.formula_componentes?.length || 0})
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {f.formula_componentes?.map((fc, idx) => {
                          const compName = fc.componentes?.nome || "Ativo";
                          const qtd = fc.quantidade;
                          const unit = fc.componentes?.unidades?.unidade || "";

                          return (
                            <div key={idx} className="flex items-center justify-between text-xs bg-slate-50/70 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                                {compName}
                              </span>
                              <span className="font-bold text-teal-700 dark:text-teal-300 shrink-0">
                                {qtd} {unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Posologia */}
                    {f.posologia && (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                          Posologia
                        </span>
                        <p className="text-slate-700 dark:text-slate-300 font-medium italic">
                          &ldquo;{f.posologia}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Rodapé do Card */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>ID: {f.id.substring(0, 8)}...</span>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">Magistral Oficial</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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
