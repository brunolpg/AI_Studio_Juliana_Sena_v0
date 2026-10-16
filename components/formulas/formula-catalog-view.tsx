"use client";

import React, { useState, useMemo } from "react";
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
      
      {/* Top Header / Hero */}
      <header className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 px-4 sm:px-8 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <a
              href="/"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Voltar ao Início"
            >
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Catálogo de Fórmulas Magistrais
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerenciamento de Fórmulas, Ativos & Prescrições Avançadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Fórmula</span>
            </button>
          </div>
        </div>
      </header>

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
