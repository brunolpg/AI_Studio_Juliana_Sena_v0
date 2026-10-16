"use client";

import React, { useState } from "react";
import { X, Plus, Trash2, FlaskConical, AlertCircle, Check, Loader2 } from "lucide-react";
import { createFormulaAction, createUnidadeQuickAction, createComponenteQuickAction } from "@/actions/formula-actions";
import { useToast } from "@/components/ui/toast";
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
  const [componentesList, setComponentesList] = useState<Componente[]>(initialComponentes);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>(initialUnidades);

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

  if (!isOpen) return null;

  const handleAddItem = () => {
    setSelectedItens((prev) => [...prev, { componente_id: "", quantidade: "" }]);
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
        setUnidadesList((prev) => [...prev, uRes.unidade!]);
        unidadeId = uRes.unidade.id;
      }

      const cRes = await createComponenteQuickAction(newCompNome, unidadeId);
      if (cRes.success && cRes.componente) {
        setComponentesList((prev) => [...prev, cRes.componente!]);
        toast({ type: "success", title: "Componente criado!", description: `${newCompNome} adicionado com sucesso.` });
        setShowNewCompModal(false);
        setNewCompNome("");
        setNewUnidadeNome("");
        setNewCompUnidadeId("");
      } else {
        toast({ type: "error", title: "Erro", description: cRes.error || "Falha ao criar componente." });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Erro", description: err.message });
    } finally {
      setIsCreatingQuick(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90dvh] overflow-hidden">
        
        {/* Cabeçalho Fixo */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/9ોર્ dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FlaskConical className="w-5 h-5" />
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Grid de Campos Básicos (Responsivo para 1 ou 2 colunas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome da Fórmula *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Cápsulas Antioxidantes Avançadas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Via de Administração *
              </label>
              <select
                value={via}
                onChange={(e) => setVia(e.target.value as "oral" | "tópico")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="oral">Oral (Uso Oral)</option>
                <option value="tópico">Tópico (Uso Tópico / Cutâneo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Veículo Base
              </label>
              <input
                type="text"
                value={veiculo}
                onChange={(e) => setVeiculo(e.target.value)}
                placeholder="Ex: Cápsula Vegetal / Gel Creme Oil Free"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Dosagem / Concentração
              </label>
              <input
                type="number"
                step="any"
                value={dosagem}
                onChange={(e) => setDosagem(e.target.value)}
                placeholder="Ex: 1 ou 30"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tipo de Veículo (Apresentação)
              </label>
              <select
                value={tipoVeiculo}
                onChange={(e) => setTipoVeiculo(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Nenhum / Padrão</option>
                <option value="dose(s)">dose(s)</option>
                <option value="sachê(s)">sachê(s)</option>
                <option value="comprimido(s)">comprimido(s)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Descrição Resumida
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Fórmula antioxidante para suporte mitocondrial"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Construtor Dinâmico de Componentes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Componentes / Ativos da Fórmula *
              </label>
              <button
                type="button"
                onClick={() => setShowNewCompModal(true)}
                className="text-xs text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
              >
                + Cadastrar Novo Componente
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
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                        required
                      >
                        <option value="">Selecione o componente...</option>
                        {componentesList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome} ({(c as any).unidades?.unidade || "un"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28 sm:w-36 shrink-0 flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        value={item.quantidade}
                        onChange={(e) => handleItemChange(index, "quantidade", e.target.value)}
                        placeholder="Qtd"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Posologia Padrão
              </label>
              <textarea
                value={posologia}
                onChange={(e) => setPosologia(e.target.value)}
                placeholder="Ex: Tomar 1 cápsula ao dia pela manhã, em jejum."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Orientações ao Paciente
              </label>
              <textarea
                value={orientPaciente}
                onChange={(e) => setOrientPaciente(e.target.value)}
                placeholder="Ex: Evitar consumo de alimentos ácidos 30 minutos antes."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Observações à Farmácia Magistral
              </label>
              <textarea
                value={orientFarmacia}
                onChange={(e) => setOrientFarmacia(e.target.value)}
                placeholder="Ex: Manipular em cápsulas gastroresistentes sem corantes."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Rodapé do Formulário */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <form onSubmit={handleQuickCreateComponente} className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cadastrar Novo Componente</h4>
              <button type="button" onClick={() => setShowNewCompModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do Componente *</label>
                <input
                  type="text"
                  value={newCompNome}
                  onChange={(e) => setNewCompNome(e.target.value)}
                  placeholder="Ex: Coenzima Q10"
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Unidade de Medida *</label>
                <select
                  value={newCompUnidadeId}
                  onChange={(e) => setNewCompUnidadeId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  required
                >
                  <option value="">Selecione a unidade...</option>
                  <option value="NEW">+ Criar Nova Unidade...</option>
                  {unidadesList.map((u) => (
                    <option key={u.id} value={u.id}>{u.unidade}</option>
                  ))}
                </select>
              </div>

              {newCompUnidadeId === "NEW" && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome da Nova Unidade *</label>
                  <input
                    type="text"
                    value={newUnidadeNome}
                    onChange={(e) => setNewUnidadeNome(e.target.value)}
                    placeholder="Ex: mg, ml, UI, gotas"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCompModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingQuick}
                className="px-4 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl disabled:opacity-50"
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
