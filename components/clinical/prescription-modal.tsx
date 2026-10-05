"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Pill, Check, AlertCircle, Plus, Trash2, Save } from "lucide-react";
import {
  getFormulasAction,
  getComponentesAction,
  getUnidadesAction,
  addStructuredPrescriptionAction,
} from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Client } from "@/types/client";

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
}

interface ComponentRow {
  key: string;
  componente_id: string;
  nome: string;
  quantidade: string;
  unidade_id: string;
  unidade_sigla: string;
}

export function PrescriptionModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: PrescriptionModalProps) {
  const { toast } = useToast();

  // Estados dos catálogos do Supabase (com fallbacks)
  const [formulas, setFormulas] = useState<any[]>([]);
  const [dbComponentes, setDbComponentes] = useState<any[]>([]);
  const [dbUnidades, setDbUnidades] = useState<any[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // Estados dos campos do formulário estruturado
  const [nomeFormula, setNomeFormula] = useState("");
  const [descricao, setDescricao] = useState("");
  const [via, setVia] = useState<"oral" | "tópico">("tópico");
  
  // Lista dinâmica de ativos
  const [componentesRows, setComponentesRows] = useState<ComponentRow[]>([
    { key: "initial_1", componente_id: "", nome: "", quantidade: "", unidade_id: "", unidade_sigla: "%" },
  ]);

  // Veículo e Parâmetros
  const [veiculo, setVeiculo] = useState("");
  const [dosagemValor, setDosagemValor] = useState(""); // Rótulo "Dose" se oral ou "Q.S.P." se tópico
  const [dosagemUnidade, setDosagemUnidade] = useState("g"); // g ou ml (apenas tópico)
  const [totalVeiculo, setTotalVeiculo] = useState(""); // ex: 30, 60, 100
  const [tipoVeiculo, setTipoVeiculo] = useState("dose(s)"); // dose(s), sachê(s) ou comprimido(s) etc.
  
  // Textareas
  const [posologia, setPosologia] = useState("");
  const [orientPaciente, setOrientPaciente] = useState("");
  const [orientFarmacia, setOrientFarmacia] = useState("");

  const [saveAsFormula, setSaveAsFormula] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);

  const [unidadesList, setUnidadesList] = useState<string[]>([]);

  useEffect(() => {
    async function loadUnidades() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setUnidadesList(['%', 'g', 'mcg', 'mg', 'ml', 'ui']);
          return;
        }

        const { data, error } = await supabase
          .from('unidades')
          .select('*');

        if (data && !error && data.length > 0) {
          const first = data[0];
          const keyToMap = ('unidade' in first) ? 'unidade' : ('sigla' in first) ? 'sigla' : null;
          
          if (keyToMap) {
            const mapped = data.map((u: any) => u[keyToMap]).filter(Boolean);
            const uniqueUnits = Array.from(new Set([...mapped, 'mcg']));
            uniqueUnits.sort();
            setUnidadesList(uniqueUnits);
          } else {
            setUnidadesList(['%', 'g', 'mcg', 'mg', 'ml', 'ui']);
          }
        } else {
          setUnidadesList(['%', 'g', 'mcg', 'mg', 'ml', 'ui']);
        }
      } catch (err) {
        console.error("Erro ao carregar unidades do Supabase:", err);
        setUnidadesList(['%', 'g', 'mcg', 'mg', 'ml', 'ui']);
      }
    }
    loadUnidades();
  }, []);

  // Carrega catálogos do Supabase
  useEffect(() => {
    async function loadCatalogs() {
      setIsLoadingCatalogs(true);
      try {
        const [formulasRes, compRes, uniRes] = await Promise.all([
          getFormulasAction(),
          getComponentesAction(),
          getUnidadesAction(),
        ]);

        if (formulasRes.success && formulasRes.data) {
          setFormulas(formulasRes.data);
        }
        if (compRes.success && compRes.data) {
          setDbComponentes(compRes.data);
        }
        if (uniRes.success && uniRes.data) {
          setDbUnidades(uniRes.data);
          // Pré-define unidade default de ativos
          const defaultUni = uniRes.data.find((u) => u.sigla === "%");
          if (defaultUni) {
            setComponentesRows((prev) =>
              prev.map((row) => ({ ...row, unidade_id: defaultUni.id, unidade_sigla: defaultUni.sigla }))
            );
          }
        }
      } catch (err) {
        console.error("Erro ao carregar catálogos de fórmulas:", err);
      } finally {
        setIsLoadingCatalogs(false);
      }
    }

    if (isOpen) {
      loadCatalogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Autocompletar quando escolher uma fórmula existente
  const handleSelectFormula = (formulaId: string) => {
    const selected = formulas.find((f) => f.id === formulaId);
    if (!selected) return;

    setSelectedFormulaId(selected.id);
    setNomeFormula(selected.nome);
    setDescricao(selected.descricao || "");
    setVia((selected.via || selected.tipo) as "oral" | "tópico");
    setDosagemValor(selected.dosagem || "");
    setVeiculo(selected.veiculo || "");
    setTipoVeiculo(selected.tipo_veiculo || "dose(s)");
    setTotalVeiculo(selected.total_veiculo ? String(selected.total_veiculo) : "");
    setOrientPaciente(selected.orient_paciente || "");
    setOrientFarmacia(selected.orient_farmacia || "");
    
    // Autofill componentes
    if (selected.componentes && selected.componentes.length > 0) {
      const rows = selected.componentes.map((c: any, index: number) => {
        // Tenta encontrar unidade correspondente
        const unit = dbUnidades.find((u) => u.id === c.unidade_id);
        return {
          key: `f_${selected.id}_${index}_${Date.now()}`,
          componente_id: c.id || "",
          nome: c.nome,
          quantidade: String(c.quantidade),
          unidade_id: c.unidade_id || "",
          unidade_sigla: unit ? unit.sigla : "%",
        };
      });
      setComponentesRows(rows);
    }
    
    toast({
      type: "success",
      title: "Fórmula Carregada!",
      description: `Parâmetros preenchidos automaticamente com base no modelo: ${selected.nome}.`,
    });
  };

  // Funções da lista dinâmica de ativos
  const handleAddRow = () => {
    // Escolhe a primeira unidade do db como default se houver
    const defUnit = dbUnidades.find((u) => u.sigla === "%") || dbUnidades[0] || { id: "", sigla: "%" };
    setComponentesRows((prev) => [
      ...prev,
      {
        key: `row_${Date.now()}_${Math.random()}`,
        componente_id: "",
        nome: "",
        quantidade: "",
        unidade_id: defUnit.id,
        unidade_sigla: defUnit.sigla,
      },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    if (componentesRows.length === 1) {
      toast({
        type: "error",
        title: "Operação não permitida",
        description: "A receita precisa conter no menos 1 componente ativo.",
      });
      return;
    }
    setComponentesRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleRowChange = (key: string, field: keyof ComponentRow, value: string) => {
    setComponentesRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        
        if (field === "nome") {
          // Busca se o nome já existe no catálogo para preencher o id correspondente
          const match = dbComponentes.find((c) => c.nome.toLowerCase() === value.toLowerCase().trim());
          return { ...row, nome: value, componente_id: match ? match.id : "" };
        }
        
        if (field === "unidade_id") {
          const match = dbUnidades.find((u) => u.id === value || u.sigla === value || u.unidade === value);
          return { 
            ...row, 
            unidade_id: match ? match.id : value, 
            unidade_sigla: match ? match.sigla || match.unidade || value : value 
          };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validações básicas
    if (!nomeFormula.trim()) {
      setErrorMsg("O nome da fórmula é obrigatório.");
      return;
    }

    if (!veiculo.trim() || !dosagemValor.trim() || !totalVeiculo.trim() || !posologia.trim()) {
      setErrorMsg("Por favor, preencha o Veículo, Dosagem, Quantidade Total e Posologia.");
      return;
    }

    // Valida se algum componente está vazio
    const invalidComp = componentesRows.some((c) => !c.nome.trim() || !c.quantidade.trim() || !c.unidade_id);
    if (invalidComp) {
      setErrorMsg("Preencha todos os campos (Ativo, Quantidade e Unidade) de todos os componentes adicionados.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        nome_formula: nomeFormula.trim(),
        descricao: descricao.trim() || undefined,
        via,
        componentes: componentesRows.map((r) => ({
          componente_id: r.componente_id || undefined,
          nome: r.nome.trim(),
          quantidade: parseFloat(r.quantidade),
          unidade_id: r.unidade_id,
          unidade_sigla: r.unidade_sigla,
        })),
        veiculo: veiculo.trim(),
        dosagem_valor: dosagemValor.trim(),
        dosagem_unidade: via === "tópico" ? dosagemUnidade : undefined,
        total_veiculo: parseFloat(totalVeiculo),
        tipo_veiculo: via === "oral" ? tipoVeiculo : "g",
        posologia: posologia.trim(),
        orient_paciente: orientPaciente.trim() || undefined,
        orient_farmacia: orientFarmacia.trim() || undefined,
        save_as_formula: saveAsFormula,
      };

      // 1. Gravação no Banco ao Prescrever (Persistência Real)
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: prescricao, error: errPresc } = await supabase
          .from("prescricoes")
          .insert({
            paciente_id: client.id,
            data_prescricao: new Date().toISOString().split("T")[0],
            status: "Ativo",
          })
          .select()
          .single();

        if (errPresc || !prescricao) {
          throw new Error(errPresc?.message || "Falha ao registrar cabeçalho de prescrição no Supabase.");
        }

        // Tenta encontrar ID de fórmula do catálogo se houver
        const matchedFormula = formulas.find((f) => f.nome.toLowerCase() === nomeFormula.toLowerCase().trim());
        const formulaIdCandidate = selectedFormulaId || matchedFormula?.id;
        const isValidUUID = (id?: string | null) => 
          typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const componentsSnapshot = componentesRows.map((r) => ({
          nome: r.nome.trim(),
          quantidade: parseFloat(r.quantidade),
          unidade: r.unidade_sigla,
        }));

        const { error: errItem } = await supabase
          .from("prescricao_itens")
          .insert({
            prescricao_id: prescricao.id,
            formula_id: isValidUUID(formulaIdCandidate) ? formulaIdCandidate : null,
            nome_formula: nomeFormula.trim(),
            via,
            veiculo: veiculo.trim(),
            dosagem: dosagemValor.trim(),
            tipo_veiculo: via === "oral" ? tipoVeiculo : "g",
            posologia: posologia.trim(),
            duracao: totalVeiculo.trim(),
            orient_paciente: orientPaciente.trim() || null,
            orient_farmacia: orientFarmacia.trim() || null,
            componentes_snapshot: componentsSnapshot,
          });

        if (errItem) {
          throw new Error(errItem.message || "Falha ao registrar itens estruturados de prescrição no Supabase.");
        }
      }

      // 2. Executa action para compatibilidade em memória e criação de novos modelos se selecionado
      const res = await addStructuredPrescriptionAction(client.id, payload);

      if (res.success) {
        toast({
          type: "success",
          title: "Receita Magistral Emitida!",
          description: `Prescrição adicionada ao prontuário do paciente ${client.nome}.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao adicionar receita.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro de conexão ao enviar a prescrição.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Nova Prescrição Magistral (SOAP)
              </h3>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{client.nome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Seletor de Fórmulas Salvas */}
          {formulas.length > 0 && (
            <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/40 bg-teal-50/10 dark:bg-teal-950/10 space-y-1.5">
              <label className="text-[11px] font-bold text-teal-950 dark:text-teal-200 block">
                Carregar Modelo de Fórmula Salva
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) handleSelectFormula(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold focus:outline-none"
              >
                <option value="" disabled>Escolha um modelo pronto para preenchimento rápido...</option>
                {formulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    [{(f.via || f.tipo || "tópico").toUpperCase()}] {f.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Nome & Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Nome da Fórmula *
              </label>
              <input
                type="text"
                list="formulas-suggestions"
                placeholder="Ex: Fórmula Clareadora Facial, Composto Antioxidante..."
                value={nomeFormula}
                onChange={(e) => setNomeFormula(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              <datalist id="formulas-suggestions">
                {formulas.map((f) => (
                  <option key={f.id} value={f.nome} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Via de Administração *
              </label>
              <select
                value={via}
                onChange={(e) => {
                  const val = e.target.value as "oral" | "tópico";
                  setVia(val);
                  setTipoVeiculo(val === "oral" ? "dose(s)" : "g");
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="tópico">Tópico</option>
                <option value="oral">Oral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Descrição do Modelo
            </label>
            <input
              type="text"
              placeholder="Ex: Recomendado para melasma, rejuvenescimento celular..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
            />
          </div>

          {/* Componentes (Lista Dinâmica) */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
                Componentes / Ativos Magistrais
              </span>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Ativo</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {componentesRows.map((row, index) => (
                <div key={row.key} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-150 dark:border-slate-700/80 shadow-2xs">
                  {/* Nome do componente com combobox */}
                  <div className="flex-1">
                    <input
                      type="text"
                      list={`comp-suggestions-${row.key}`}
                      placeholder="Nome do Ativo"
                      value={row.nome}
                      onChange={(e) => handleRowChange(row.key, "nome", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-teal-500 bg-transparent text-slate-900 dark:text-slate-100"
                    />
                    <datalist id={`comp-suggestions-${row.key}`}>
                      {dbComponentes.map((c) => (
                        <option key={c.id} value={c.nome} />
                      ))}
                    </datalist>
                  </div>

                  {/* Quantidade */}
                  <div className="w-20">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Qtd."
                      value={row.quantidade}
                      onChange={(e) => handleRowChange(row.key, "quantidade", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs text-center border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-teal-500 bg-transparent text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Unidade */}
                  <div className="w-24">
                    <select
                      value={row.unidade_sigla}
                      onChange={(e) => handleRowChange(row.key, "unidade_id", e.target.value)}
                      className="w-full py-1 text-xs border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none bg-transparent text-slate-900 dark:text-slate-100"
                    >
                      <option value="" disabled>Unidade</option>
                      {unidadesList.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Remover linha */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.key)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Veículo & Parâmetros */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              Veículo e Parâmetros de Envase
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Veículo Base *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Gel creme, Cápsula, Serum"
                  value={veiculo}
                  onChange={(e) => setVeiculo(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {via === "oral" ? "Dose por Tomada *" : "Concentração Q.S.P. *"}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder={via === "oral" ? "Ex: 1" : "Ex: 30"}
                    value={dosagemValor}
                    onChange={(e) => setDosagemValor(e.target.value)}
                    required
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                  />
                  {via === "tópico" && (
                    <select
                      value={dosagemUnidade}
                      onChange={(e) => setDosagemUnidade(e.target.value)}
                      className="w-16 px-1.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Quantidade Total *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    placeholder="Ex: 30"
                    value={totalVeiculo}
                    onChange={(e) => setTotalVeiculo(e.target.value)}
                    required
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                  />
                  {via === "oral" ? (
                    <select
                      value={tipoVeiculo}
                      onChange={(e) => setTipoVeiculo(e.target.value)}
                      className="w-24 px-1 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="dose(s)">dose(s)</option>
                      <option value="sachê(s)">sachê(s)</option>
                      <option value="comprimido(s)">comprimido(s)</option>
                    </select>
                  ) : (
                    <div className="w-12 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-500">
                      {dosagemUnidade}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Posologia (Frequência e Forma de uso) */}
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Posologia (Frequência & Horários) *
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Tomar 1 dose via oral todas as manhãs logo após o café; Aplicar no rosto limpo à noite..."
              value={posologia}
              onChange={(e) => setPosologia(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none"
            />
          </div>

          {/* Orientações ao Paciente */}
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Orientações ao Paciente/ Instruções Especiais
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Suspender o uso se houver irritação; armazenar em local fresco..."
              value={orientPaciente}
              onChange={(e) => setOrientPaciente(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none"
            />
          </div>

          {/* Observações à Farmácia */}
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Observações à Farmácia Magistral
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Ajustar o pH final para 4.5; envasar em frasco âmbar airless..."
              value={orientFarmacia}
              onChange={(e) => setOrientFarmacia(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none"
            />
          </div>

          {/* Opção para Salvar como modelo */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-teal-200 dark:border-teal-900/40 bg-teal-50/5 dark:bg-teal-950/5">
            <input
              type="checkbox"
              id="saveAsFormula"
              checked={saveAsFormula}
              onChange={(e) => setSaveAsFormula(e.target.checked)}
              className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 focus:ring-2 cursor-pointer"
            />
            <label htmlFor="saveAsFormula" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5 select-none">
              <Save className="w-4 h-4 text-teal-600" />
              <span>Salvar esta receita no catálogo do consultório como modelo de Fórmula</span>
            </label>
          </div>

          {/* Rodapé de Ações */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registrando Prescrição...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Emitir Receituário Magistral</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
