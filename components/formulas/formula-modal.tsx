"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, FlaskConical, AlertCircle, Check, Loader2 } from "lucide-react";
import {
  createFormulaAction,
  createUnidadeQuickAction,
  createComponenteQuickAction,
  getComponentesAndUnidadesAction,
} from "@/actions/formula-actions";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import type { Componente, Unidade } from "@/types/formula";

interface FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialComponentes: Componente[];
  initialUnidades: Unidade[];
}

export function FormulaModal({
  isOpen,
  onClose,
  onSuccess,
  initialComponentes,
  initialUnidades,
}: FormulaModalProps) {
  const { toast } = useToast();
  const [componentesList, setComponentesList] = useState<Componente[]>(() =>
    [...(initialComponentes || [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    )
  );
  const [unidadesList, setUnidadesList] = useState<Unidade[]>(() =>
    [...(initialUnidades || [])].sort((a, b) =>
      a.unidade.localeCompare(b.unidade, "pt-BR", { sensitivity: "base" })
    )
  );

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [via, setVia] = useState<"oral" | "tópico">("oral");
  const [veiculo, setVeiculo] = useState("");
  const [dosagem, setDosagem] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<"dose(s)" | "sachê(s)" | "comprimido(s)" | "">("");
  const [posologia, setPosologia] = useState("");
  const [orientPaciente, setOrientPaciente] = useState("");
  const [orientFarmacia, setOrientFarmacia] = useState("");

  const [selectedItens, setSelectedItens] = useState<{ componente_id: string; quantidade: string }[]>([
    { componente_id: "", quantidade: "" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para modal rápido de novo componente ou unidade
  const [showNewCompModal, setShowNewCompModal] = useState(false);
  const [newCompNome, setNewCompNome] = useState("");
  const [newCompUnidadeId, setNewCompUnidadeId] = useState("");
  const [newUnidadeNome, setNewUnidadeNome] = useState("");
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);
  const [quickCompError, setQuickCompError] = useState<{ title: string; description: string } | null>(null);

  // Sincronização em tempo real de componentes e unidades com o banco
  const fetchLatestComponentes = async () => {
    try {
      const res = await getComponentesAndUnidadesAction();
      if (res.success && res.componentes) {
        const sortedComps = [...res.componentes].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
        );
        setComponentesList(sortedComps);
      }
      if (res.success && res.unidades) {
        const sortedUnits = [...res.unidades].sort((a, b) =>
          a.unidade.localeCompare(b.unidade, "pt-BR", { sensitivity: "base" })
        );
        setUnidadesList(sortedUnits);
      }
    } catch (err) {
      console.error("Erro ao sincronizar componentes e unidades:", err);
    }
  };

  // Atualização ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      fetchLatestComponentes();
    }
  }, [isOpen]);

  const fieldClassName =
    "w-full rounded-xl border transition-all text-sm font-['Plus_Jakarta_Sans',sans-serif] px-3.5 py-2.5 " +
    "bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 " +
    "dark:bg-slate-900/60 dark:border-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900 dark:focus:border-emerald-500 dark:focus:ring-1 dark:focus:ring-emerald-500";

  if (!isOpen) return null;

  const handleAddItem = () => {
    setSelectedItens((prev) => [...prev, { componente_id: "", quantidade: "" }]);
    fetchLatestComponentes();
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: "componente_id" | "quantidade", value: string) => {
    setSelectedItens((prev) => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!nome.trim()) {
      setErrorMsg("O nome da fórmula é obrigatório.");
      return;
    }

    const formattedItems = selectedItens
      .filter((i) => i.componente_id && i.quantidade && Number(i.quantidade) > 0)
      .map((i) => ({
        componente_id: i.componente_id,
        quantidade: Number(i.quantidade),
      }));

    if (formattedItems.length === 0) {
      setErrorMsg("Adicione ao menos um componente com quantidade válida.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createFormulaAction({
        nome,
        descricao,
        via,
        veiculo,
        dosagem: dosagem ? Number(dosagem) : null,
        tipo_veiculo: tipoVeiculo || null,
        posologia,
        orient_paciente: orientPaciente,
        orient_farmacia: orientFarmacia,
        componentes: formattedItems,
      });

      if (res.success) {
        toast({ type: "success", title: "Fórmula Cadastrada!", description: `A fórmula "${nome}" foi salva no catálogo.` });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.error || "Erro ao salvar fórmula.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickCreateComponente = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCompError(null);

    if (!newCompNome.trim() || !newCompUnidadeId) {
      toast({ type: "error", title: "Campos obrigatórios", description: "Informe o nome do componente e selecione a unidade." });
      return;
    }

    setIsCreatingQuick(true);
    try {
      let unidadeId = newCompUnidadeId;
      if (newCompUnidadeId === "NEW") {
        if (!newUnidadeNome.trim()) {
          toast({ type: "error", title: "Informe a unidade", description: "Digite o nome da nova unidade." });
          setIsCreatingQuick(false);
          return;
        }
        const uRes = await createUnidadeQuickAction(newUnidadeNome);
        if (!uRes.success || !uRes.unidade) {
          toast({ type: "error", title: "Erro na unidade", description: uRes.error || "Falha ao criar unidade." });
          setIsCreatingQuick(false);
          return;
        }
        setUnidadesList((prev) => {
          if (prev.some((u) => u.id === uRes.unidade!.id)) return prev;
          return [...prev, uRes.unidade!].sort((a, b) =>
            a.unidade.localeCompare(b.unidade, "pt-BR", { sensitivity: "base" })
          );
        });
        unidadeId = uRes.unidade.id;
      }

      const formattedCompNome = newCompNome.trim();
      const cRes = await createComponenteQuickAction(formattedCompNome, unidadeId);

      if (cRes.success && cRes.componente) {
        const novoComponente = cRes.componente;

        // Atualiza a lista local garantindo ordenação alfabética
        setComponentesList((prev) => {
          const exists = prev.some((c) => c.id === novoComponente.id);
          const updated = exists ? prev : [...prev, novoComponente];
          return updated.sort((a, b) =>
            a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
          );
        });

        // Seleciona automaticamente o novo componente na primeira linha vazia (ou adiciona nova linha)
        setSelectedItens((prev) => {
          const emptyIndex = prev.findIndex((item) => !item.componente_id);
          if (emptyIndex !== -1) {
            const updated = [...prev];
            updated[emptyIndex] = { ...updated[emptyIndex], componente_id: novoComponente.id };
            return updated;
          } else {
            return [...prev, { componente_id: novoComponente.id, quantidade: "" }];
          }
        });

        toast({
          type: "success",
          title: "Componente criado!",
          description: `${formattedCompNome} adicionado e selecionado com sucesso.`,
        });
        setShowNewCompModal(false);
        setNewCompNome("");
        setNewUnidadeNome("");
        setNewCompUnidadeId("");
        setQuickCompError(null);

        // Recarrega componentes e unidades atualizados do banco
        fetchLatestComponentes();
      } else {
        const isDuplicate =
          (cRes as any)?.code === "23505" ||
          (cRes as any)?.isDuplicate ||
          cRes.error?.toLowerCase().includes("já está cadastrado") ||
          cRes.error?.includes("componentes_nome_key") ||
          cRes.error?.includes("duplicate key value");

        if (isDuplicate) {
          toast({
            type: "warning",
            title: "Componente já existente",
            description: "Já existe um componente cadastrado com este nome no catálogo.",
          });
          setQuickCompError({
            title: "Componente já existente",
            description: "Já existe um componente cadastrado com este nome no catálogo.",
          });
          // Se retornou o componente existente, adiciona à lista ordenada e auto-seleciona
          if ((cRes as any)?.componente) {
            const existingComp = (cRes as any).componente;
            setComponentesList((prev) => {
              const exists = prev.some((c) => c.id === existingComp.id);
              const updated = exists ? prev : [...prev, existingComp];
              return updated.sort((a, b) =>
                a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
              );
            });
            setSelectedItens((prev) => {
              const emptyIndex = prev.findIndex((item) => !item.componente_id);
              if (emptyIndex !== -1) {
                const updated = [...prev];
                updated[emptyIndex] = { ...updated[emptyIndex], componente_id: existingComp.id };
                return updated;
              }
              return prev;
            });
          }
        } else {
          toast({
            type: "error",
            title: "Erro ao cadastrar componente",
            description: cRes.error || "Falha ao criar componente.",
          });
          setQuickCompError({
            title: "Erro ao cadastrar componente",
            description: cRes.error || "Falha ao criar componente.",
          });
        }
        // Mantém showNewCompModal aberto e os dados digitados preservados
      }
    } catch (err: any) {
      toast({ type: "error", title: "Erro", description: err.message || "Erro inesperado ao cadastrar componente." });
      setQuickCompError({
        title: "Erro inesperado",
        description: err.message || "Erro inesperado ao cadastrar componente.",
      });
    } finally {
      setIsCreatingQuick(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90dvh] overflow-hidden">
        
        {/* Cabeçalho Fixo */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FlaskConical className="w-6 h-6 text-white stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nova Fórmula Magistral
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Catálogo de Fórmulas • Prescrições Avançadas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com Rolagem Interna */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Grid de Campos Básicos (Responsivo para 1 ou 2 colunas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Nome da Fórmula *
              </label>
              <Input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cápsulas Antioxidantes Avançadas"
                className={fieldClassName}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Via de Administração *
              </label>
              <select
                value={via}
                onChange={(e) => setVia(e.target.value as "oral" | "tópico")}
                className={fieldClassName}
              >
                <option value="oral">Oral (Uso Oral)</option>
                <option value="tópico">Tópico (Uso Tópico / Cutâneo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Veículo Base
              </label>
              <Input
                type="text"
                value={veiculo}
                onChange={(e) => setVeiculo(e.target.value)}
                placeholder="Ex: Cápsula Vegetal / Gel Creme Oil Free"
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Dosagem / Concentração
              </label>
              <Input
                type="number"
                step="any"
                value={dosagem}
                onChange={(e) => setDosagem(e.target.value)}
                placeholder="Ex: 1 ou 30"
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Tipo de Veículo (Apresentação)
              </label>
              <select
                value={tipoVeiculo}
                onChange={(e) => setTipoVeiculo(e.target.value as any)}
                className={fieldClassName}
              >
                <option value="">Nenhum / Padrão</option>
                <option value="dose(s)">dose(s)</option>
                <option value="sachê(s)">sachê(s)</option>
                <option value="comprimido(s)">comprimido(s)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Descrição Resumida
              </label>
              <Input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Fórmula antioxidante para suporte mitocondrial"
                className={fieldClassName}
              />
            </div>
          </div>

          {/* Construtor Dinâmico de Componentes */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight uppercase tracking-wider">
                Componentes / Ativos da Fórmula *
              </label>
              <button
                type="button"
                onClick={() => {
                  setQuickCompError(null);
                  setShowNewCompModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#043e33] hover:bg-[#064e3b] hover:opacity-90 dark:bg-emerald-950 dark:hover:bg-emerald-900 rounded-full shadow-xs cursor-pointer transition-all active:scale-[0.98] dark:border dark:border-white/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Novo Componente</span>
              </button>
            </div>

            <div className="space-y-2">
              {selectedItens.map((item, index) => {
                const compObj = componentesList.find((c) => c.id === item.componente_id);
                const unidadeStr = (compObj as any)?.unidades?.unidade || "";

                return (
                  <div key={index} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex-1 min-w-0">
                      <select
                        value={item.componente_id}
                        onChange={(e) => handleItemChange(index, "componente_id", e.target.value)}
                        className={fieldClassName}
                        required
                      >
                        <option value="">Selecione o componente...</option>
                        {[...componentesList]
                          .sort((a, b) =>
                            a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome} ({(c as any).unidades?.unidade || "un"})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="w-28 sm:w-36 shrink-0 flex items-center gap-1.5">
                      <Input
                        type="number"
                        step="any"
                        value={item.quantidade}
                        onChange={(e) => handleItemChange(index, "quantidade", e.target.value)}
                        placeholder="Qtd"
                        className={fieldClassName}
                        required
                      />
                      <span className="text-[11px] font-bold text-slate-500 w-12 truncate" title={unidadeStr}>
                        {unidadeStr || "qtd"}
                      </span>
                    </div>

                    {selectedItens.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                        title="Remover componente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Outro Componente</span>
            </button>
          </div>

          {/* Posologia e Orientações */}
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Posologia Padrão
              </label>
              <textarea
                value={posologia}
                onChange={(e) => setPosologia(e.target.value)}
                placeholder="Ex: Tomar 1 cápsula ao dia pela manhã, em jejum."
                rows={2}
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Orientações ao Paciente
              </label>
              <textarea
                value={orientPaciente}
                onChange={(e) => setOrientPaciente(e.target.value)}
                placeholder="Ex: Evitar consumo de alimentos ácidos 30 minutos antes."
                rows={2}
                className={fieldClassName}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                Observações à Farmácia Magistral
              </label>
              <textarea
                value={orientFarmacia}
                onChange={(e) => setOrientFarmacia(e.target.value)}
                placeholder="Ex: Manipular em cápsulas gastroresistentes sem corantes."
                rows={2}
                className={fieldClassName}
              />
            </div>
          </div>

          {/* Rodapé do Formulário */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#043e33] hover:bg-[#064e3b] hover:opacity-90 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border dark:border-white/10 text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Fórmula...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Fórmula no Catálogo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Rápido de Criação de Componente */}
      {showNewCompModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleQuickCreateComponente}
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 font-['Plus_Jakarta_Sans',sans-serif]"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Cadastrar Novo Componente
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowNewCompModal(false);
                  setQuickCompError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso Amigável em Caso de Componente Já Existente / Erro */}
            {quickCompError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs transition-all animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-950 dark:text-amber-100 text-xs">
                    {quickCompError.title}
                  </p>
                  <p className="mt-0.5 text-amber-800/95 dark:text-amber-300/90 text-xs leading-relaxed">
                    {quickCompError.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickCompError(null)}
                  className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-lg transition-colors cursor-pointer"
                  aria-label="Fechar aviso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Nome do Componente *
                </label>
                <Input
                  type="text"
                  value={newCompNome}
                  onChange={(e) => {
                    setNewCompNome(e.target.value);
                    if (quickCompError) setQuickCompError(null);
                  }}
                  placeholder="Ex: Coenzima Q10"
                  className={fieldClassName + " mt-1"}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                  Unidade de Medida *
                </label>
                <select
                  value={newCompUnidadeId}
                  onChange={(e) => {
                    setNewCompUnidadeId(e.target.value);
                    if (quickCompError) setQuickCompError(null);
                  }}
                  className={fieldClassName + " mt-1"}
                  required
                >
                  <option value="">Selecione a unidade...</option>
                  <option value="NEW">+ Criar Nova Unidade...</option>
                  {[...unidadesList]
                    .sort((a, b) =>
                      a.unidade.localeCompare(b.unidade, "pt-BR", { sensitivity: "base" })
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unidade}
                      </option>
                    ))}
                </select>
              </div>

              {newCompUnidadeId === "NEW" && (
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                    Nome da Nova Unidade *
                  </label>
                  <Input
                    type="text"
                    value={newUnidadeNome}
                    onChange={(e) => setNewUnidadeNome(e.target.value)}
                    placeholder="Ex: mg, ml, UI, gotas"
                    className={fieldClassName + " mt-1"}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewCompModal(false);
                  setQuickCompError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingQuick}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#043e33] hover:bg-[#064e3b] dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border dark:border-white/10 rounded-full shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isCreatingQuick ? "Salvando..." : "Criar Componente"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
