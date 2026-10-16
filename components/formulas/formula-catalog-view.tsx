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
    <div className="font-['Plus_Jakarta_Sans',sans-serif] min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      
      {/* App Header */}
      <AppHeader
        currentTab="prontuarios"
        onTabChange={() => router.push("/dashboard")}
      />

      {/* Top Header / Hero Card */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#042f2e] via-[#064e3b] to-[#0b1329] p-6 sm:p-8 text-white shadow-md border border-emerald-900/40">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-3 z-10 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Prescrições & Fórmulas Magistrais</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Catálogo de Fórmulas
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed max-w-xl mt-2">
              Gerencie fórmulas magistrais, ativos e diretrizes de manipulação com agilidade e precisão clínica.
            </p>
          </div>
        </div>
      </motion.header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8 space-y-6">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Fórmulas Cadastradas</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <FlaskConical className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formulas.length}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">no catálogo</span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 truncate">Componentes Ativos</span>
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Pill className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {componentes.length}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">insumos disponíveis</span>
            </div>
          </div>
        </div>

        {/* Action Bar (Estilo Prescrições) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl py-3 px-4 text-xs sm:text-sm font-semibold shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Prontuário</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 px-4 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Fórmula</span>
          </button>
        </div>

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
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 mt-16 pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
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
