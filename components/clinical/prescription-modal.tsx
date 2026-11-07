"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Pill, Check, AlertCircle, Plus, Trash2, Save } from "lucide-react";
import {
  getFormulasAction,
  getComponentesAction,
  getUnidadesAction,
  addStructuredPrescriptionAction,
  updateStructuredPrescriptionAction,
} from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Client } from "@/types/client";

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPrescriptionId?: string) => void;
  client: Client;
  zIndex?: string;
  initialData?: any | null;
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
  zIndex = "z-50",
  initialData = null,
}: PrescriptionModalProps) {
  const { toast } = useToast();

  // Refs para inputs/textareas com suporte a IME / Dead Keys (Android / Samsung Keyboard)
  const nomeFormulaInputRef = useRef<HTMLInputElement>(null);
  const descricaoInputRef = useRef<HTMLInputElement>(null);
  const veiculoInputRef = useRef<HTMLInputElement>(null);
  const posologiaInputRef = useRef<HTMLTextAreaElement>(null);
  const orientPacienteInputRef = useRef<HTMLTextAreaElement>(null);
  const orientFarmaciaInputRef = useRef<HTMLTextAreaElement>(null);

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);

  const [unidadesList, setUnidadesList] = useState<string[]>([]);

  useEffect(() => {
    async function loadUnidades() {
      try {
        const res = await getUnidadesAction();
        if (res.success && res.data && res.data.length > 0) {
          const mapped = res.data.map((u: any) => u.unidade).filter(Boolean);
          const uniqueUnits = Array.from(new Set([...mapped, 'mcg']));
          uniqueUnits.sort();
          setUnidadesList(uniqueUnits);
        } else {
          setUnidadesList(['%', 'g', 'mcg', 'mg', 'ml', 'ui']);
        }
      } catch (err) {
        console.error("Erro ao carregar unidades:", err);
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
          const defaultUni = uniRes.data.find((u: any) => u.unidade === "%" || u.sigla === "%");
          if (defaultUni) {
            setComponentesRows((prev) =>
              prev.map((row) => ({
                ...row,
                unidade_id: defaultUni.id,
                unidade_sigla: defaultUni.unidade || defaultUni.sigla || "%",
              }))
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

  // Preenche dados quando for modo de edição (initialData) ou reseta para novo cadastro
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      const item = initialData.prescricao_itens?.[0] || initialData.item || {};
      const formulaNome = item.nome_formula || initialData.medicamento || initialData.nome_formula || "";
      const rawVia = (item.via || initialData.via || "tópico").toLowerCase();
      const normalizedVia: "oral" | "tópico" = rawVia === "oral" ? "oral" : "tópico";
      const veiculoVal = item.veiculo || initialData.veiculo || "";
      const dosagemVal = item.dosagem != null ? String(item.dosagem).replace(".", ",") : (initialData.dosagem_valor || "");
      const totalVeiculoVal = item.duracao != null ? String(item.duracao) : (initialData.total_veiculo || "");
      const tipoVeiculoVal = item.tipo_veiculo || initialData.tipo_veiculo || (normalizedVia === "oral" ? "dose(s)" : "un");
      const posologiaVal = item.posologia || initialData.posologia || "";
      const orientPacVal = item.orient_paciente || initialData.orient_paciente || "";
      const orientFarmVal = item.orient_farmacia || initialData.orient_farmacia || "";
      const descVal = initialData.observacoes || initialData.descricao || "";

      setNomeFormula(formulaNome);
      if (nomeFormulaInputRef.current) nomeFormulaInputRef.current.value = formulaNome;

      setDescricao(descVal);
      if (descricaoInputRef.current) descricaoInputRef.current.value = descVal;

      setVia(normalizedVia);
      setVeiculo(veiculoVal);
      if (veiculoInputRef.current) veiculoInputRef.current.value = veiculoVal;

      setDosagemValor(dosagemVal);
      setTotalVeiculo(totalVeiculoVal);
      setTipoVeiculo(tipoVeiculoVal);

      setPosologia(posologiaVal);
      if (posologiaInputRef.current) posologiaInputRef.current.value = posologiaVal;

      setOrientPaciente(orientPacVal);
      if (orientPacienteInputRef.current) orientPacienteInputRef.current.value = orientPacVal;

      setOrientFarmacia(orientFarmVal);
      if (orientFarmaciaInputRef.current) orientFarmaciaInputRef.current.value = orientFarmVal;

      const rawComponents = item.componentes_snapshot || initialData.componentes || [];
      if (Array.isArray(rawComponents) && rawComponents.length > 0) {
        const rows: ComponentRow[] = rawComponents.map((c: any, idx: number) => {
          const sigla = c.unidade_sigla || c.unidade || "%";
          const unitMatch = dbUnidades.find((u) => u.unidade === sigla || u.sigla === sigla);
          const compMatch = dbComponentes.find((comp) => comp.nome?.toLowerCase() === c.nome?.toLowerCase());
          return {
            key: `edit_comp_${idx}_${c.nome || idx}`,
            componente_id: compMatch?.id || c.componente_id || "",
            nome: c.nome || "",
            quantidade: c.quantidade != null ? String(c.quantidade).replace(".", ",") : "",
            unidade_id: unitMatch?.id || sigla,
            unidade_sigla: sigla,
          };
        });
        setComponentesRows(rows);
      }
    } else {
      setNomeFormula("");
      if (nomeFormulaInputRef.current) nomeFormulaInputRef.current.value = "";
      setDescricao("");
      if (descricaoInputRef.current) descricaoInputRef.current.value = "";
      setVia("tópico");
      setVeiculo("");
      if (veiculoInputRef.current) veiculoInputRef.current.value = "";
      setDosagemValor("");
      setDosagemUnidade("g");
      setTotalVeiculo("");
      setTipoVeiculo("dose(s)");
      setPosologia("");
      if (posologiaInputRef.current) posologiaInputRef.current.value = "";
      setOrientPaciente("");
      if (orientPacienteInputRef.current) orientPacienteInputRef.current.value = "";
      setOrientFarmacia("");
      if (orientFarmaciaInputRef.current) orientFarmaciaInputRef.current.value = "";
      setComponentesRows([
        { key: "initial_1", componente_id: "", nome: "", quantidade: "", unidade_id: "", unidade_sigla: "%" },
      ]);
      setSelectedFormulaId(null);
    }
  }, [isOpen, initialData, dbUnidades, dbComponentes]);

  if (!isOpen) return null;

  // Funções auxiliares de formatação PT-BR
  const formatNumberToBr = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    return String(val).replace('.', ',');
  };

  const parseBrNumberToFloat = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const sanitized = String(val).replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Autocompletar quando escolher uma fórmula existente
  const handleSelectFormula = (formulaId: string) => {
    const selected = formulas.find((f) => f.id === formulaId);
    if (!selected) return;

    setSelectedFormulaId(selected.id);
    setNomeFormula(selected.nome);
    if (nomeFormulaInputRef.current) {
      nomeFormulaInputRef.current.value = selected.nome || "";
    }

    setDescricao(selected.descricao || "");
    if (descricaoInputRef.current) {
      descricaoInputRef.current.value = selected.descricao || "";
    }

    setVia((selected.via || selected.tipo) as "oral" | "tópico");
    setDosagemValor(formatNumberToBr(selected.dosagem));
    setVeiculo(selected.veiculo || "");
    if (veiculoInputRef.current) {
      veiculoInputRef.current.value = selected.veiculo || "";
    }

    setTipoVeiculo(selected.tipo_veiculo || "dose(s)");
    setTotalVeiculo(formatNumberToBr(selected.total_veiculo || ''));

    if (selected.posologia) {
      setPosologia(selected.posologia);
      if (posologiaInputRef.current) {
        posologiaInputRef.current.value = selected.posologia;
      }
    }

    setOrientPaciente(selected.orient_paciente || "");
    if (orientPacienteInputRef.current) {
      orientPacienteInputRef.current.value = selected.orient_paciente || "";
    }

    setOrientFarmacia(selected.orient_farmacia || "");
    if (orientFarmaciaInputRef.current) {
      orientFarmaciaInputRef.current.value = selected.orient_farmacia || "";
    }
    
    // Autofill componentes
    if (selected.componentes && selected.componentes.length > 0) {
      const rows = selected.componentes.map((c: any, index: number) => {
        // Tenta encontrar unidade correspondente
        const unit = dbUnidades.find((u) => u.id === c.unidade_id);
        return {
          key: `f_${selected.id}_${index}_${Date.now()}`,
          componente_id: c.id || "",
          nome: c.nome,
          quantidade: formatNumberToBr(c.quantidade),
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

    const finalNomeFormula = nomeFormulaInputRef.current?.value || nomeFormula;
    const finalDescricao = descricaoInputRef.current?.value || descricao;
    const finalVeiculo = veiculoInputRef.current?.value || veiculo;
    const finalPosologia = posologiaInputRef.current?.value || posologia;
    const finalOrientPaciente = orientPacienteInputRef.current?.value || orientPaciente;
    const finalOrientFarmacia = orientFarmaciaInputRef.current?.value || orientFarmacia;

    // Validações básicas
    if (!finalNomeFormula.trim()) {
      setErrorMsg("O nome da fórmula é obrigatório.");
      return;
    }

    if (!finalVeiculo.trim() || !dosagemValor.trim() || !totalVeiculo.trim() || !finalPosologia.trim()) {
      setErrorMsg("Por favor, preencha o Veículo, Dosagem, Quantidade Total e Posologia.");
      return;
    }

    // Filtragem de linhas vazias residuais
    const ativosValidos = componentesRows.filter(
      (c) => c.nome && c.nome.trim() !== ''
    );

    if (ativosValidos.length === 0) {
      setErrorMsg("Adicione pelo menos um componente à fórmula.");
      return;
    }

    // Tratamento de números com vírgula (PT-BR)
    const parseQuantidade = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const parsed = parseFloat(String(val).replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Validação flexível: garante que a quantidade seja positiva para todos os ativos preenchidos
    const invalidComp = componentesRows.some(
      (c) => !c.nome.trim() || parseBrNumberToFloat(c.quantidade) <= 0 || !c.unidade_id
    );

    if (invalidComp) {
      setErrorMsg("A quantidade de todos os componentes deve ser maior que zero e nome/unidade preenchidos.");
      return;
    }

    // Mapeamento e associação flexível de unidade
    const componentesPayload = ativosValidos.map((c) => ({
      componente_id: c.componente_id || undefined,
      nome: c.nome.trim(),
      quantidade: parseBrNumberToFloat(c.quantidade),
      unidade_sigla: c.unidade_sigla || (c as any).unidade || '%',
      unidade_id: c.unidade_id || (dbUnidades.find(u => u.unidade === (c.unidade_sigla || '%'))?.id) || (dbUnidades[0]?.id) || ''
    }));

    setIsSubmitting(true);

    try {
      const payload = {
        nome_formula: finalNomeFormula.trim(),
        descricao: finalDescricao.trim() || undefined,
        via,
        componentes: componentesPayload,
        veiculo: finalVeiculo.trim(),
        dosagem_valor: String(parseBrNumberToFloat(dosagemValor)),
        dosagem_unidade: via === "tópico" ? dosagemUnidade : undefined,
        total_veiculo: parseBrNumberToFloat(totalVeiculo),
        tipo_veiculo: via === "oral" ? tipoVeiculo : "un",
        posologia: finalPosologia.trim(),
        orient_paciente: finalOrientPaciente.trim() || undefined,
        orient_farmacia: finalOrientFarmacia.trim() || undefined,
        save_as_formula: true,
      };

      // Executa a action que realiza o salvamento (novo registro ou atualização com versionamento clínico)
      let res;
      const targetPrescriptionId = initialData?.id || initialData?.prescricao_id;

      if (targetPrescriptionId) {
        res = await updateStructuredPrescriptionAction(client.id, targetPrescriptionId, payload);
      } else {
        res = await addStructuredPrescriptionAction(client.id, payload);
      }

      if (res.success) {
        // Atualiza instantaneamente a lista de fórmulas/modelos salvos no seletor
        const fRes = await getFormulasAction();
        if (fRes.success && fRes.data) {
          setFormulas(fRes.data);
        }

        toast({
          type: "success",
          title: targetPrescriptionId ? "Prescrição Atualizada" : "Prescrição Magistral Emitida!",
          description: targetPrescriptionId
            ? "Prescrição atualizada e versão anterior arquivada"
            : `Receita gerada e salva com sucesso para ${client.nome}.`,
        });
        const createdPrescriptionId = res.data?.prescricao_id || res.data?.id;
        onSuccess(createdPrescriptionId);
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao salvar receita.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro de conexão ao enviar a prescrição.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]`}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] flex flex-col transition-all">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {initialData ? "Editar Prescrição Magistral" : "Nova Prescrição Magistral (SOAP)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <strong className="text-slate-700 dark:text-slate-200">{client.nome}</strong>
                {initialData && (
                  <span className="ml-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    (Versão anterior será arquivada como suspensa)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors md-state-layer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900/60 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Seletor de Fórmulas Salvas */}
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
              disabled={formulas.length === 0}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold focus:outline-none disabled:opacity-60"
            >
              {formulas.length === 0 ? (
                <option value="" disabled>Nenhum modelo salvo encontrado no catálogo</option>
              ) : (
                <>
                  <option value="" disabled>Escolha um modelo pronto para preenchimento rápido...</option>
                  {formulas.map((f) => (
                    <option key={f.id} value={f.id}>
                      [{f.via ? f.via.toUpperCase() : 'GERAL'}] {f.nome}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Nome & Descrição */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Nome da Fórmula *
              </label>
              <input
                ref={nomeFormulaInputRef}
                type="text"
                list="formulas-suggestions"
                placeholder="Ex: Fórmula Clareadora Facial, Composto Antioxidante..."
                defaultValue={nomeFormula}
                onInput={(e) => setNomeFormula(e.currentTarget.value)}
                onBlur={(e) => setNomeFormula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = (nomeFormulaInputRef.current?.value || nomeFormula).toLowerCase().trim();
                    const matches = formulas.filter((f) =>
                      f.nome.toLowerCase().includes(q)
                    );
                    if (matches.length > 0) {
                      handleSelectFormula(matches[0].id);
                    }
                  }
                }}
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
              ref={descricaoInputRef}
              type="text"
              placeholder="Ex: Recomendado para melasma, rejuvenescimento celular..."
              defaultValue={descricao}
              onInput={(e) => setDescricao(e.currentTarget.value)}
              onBlur={(e) => setDescricao(e.target.value)}
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
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#004d40] hover:bg-[#003830] active:scale-[0.98] dark:bg-emerald-800 dark:hover:bg-emerald-700 rounded-full shadow-xs cursor-pointer transition-all md-state-layer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Ativo</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {componentesRows.map((row, index) => (
                <div 
                  key={row.key} 
                  className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-2 p-2.5 sm:p-2 rounded-xl sm:rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 shadow-xs transition-colors"
                >
                  {/* Nome do componente com combobox */}
                  <div className="w-full sm:flex-1 min-w-0">
                    <input
                      type="text"
                      list={`comp-suggestions-${row.key}`}
                      placeholder="Nome do Ativo"
                      value={row.nome}
                      onChange={(e) => handleRowChange(row.key, "nome", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const q = row.nome.toLowerCase().trim();
                          const matches = dbComponentes.filter((c) =>
                            c.nome.toLowerCase().includes(q)
                          );
                          if (matches.length > 0) {
                            handleRowChange(row.key, "nome", matches[0].nome);
                          }
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border-0 border-b border-slate-200 dark:border-slate-700/80 focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <datalist id={`comp-suggestions-${row.key}`}>
                      {dbComponentes.map((c) => (
                        <option key={c.id} value={c.nome} />
                      ))}
                    </datalist>
                  </div>

                  {/* Segunda linha no mobile / alinhado no desktop */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Quantidade */}
                    <div className="w-20 sm:w-20">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Qtd."
                        value={row.quantidade}
                        onChange={(e) => {
                          let val = e.target.value.replace('.', ',');
                          val = val.replace(/[^0-9,]/g, '');
                          const parts = val.split(',');
                          if (parts.length > 2) {
                            val = parts[0] + ',' + parts.slice(1).join('');
                          }
                          handleRowChange(row.key, "quantidade", val);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs text-center border-0 border-b border-slate-200 dark:border-slate-700 focus:outline-none focus:border-teal-500 bg-transparent text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    {/* Unidade */}
                    <div className="w-24 sm:w-24">
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
                    <div className="ml-auto sm:ml-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.key)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Veículo & Parâmetros */}
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-4 w-full">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Veículo e Parâmetros de Envase
            </h4>
            
            <div className="flex flex-col sm:flex-row items-end gap-3 w-full">
              {/* Veículo Base - ocupa o espaço restante com maior peso */}
              <div className="flex-[3] min-w-0 w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Veículo Base *
                </label>
                <input
                  ref={veiculoInputRef}
                  type="text"
                  defaultValue={veiculo}
                  onInput={(e) => setVeiculo(e.currentTarget.value)}
                  onBlur={(e) => setVeiculo(e.target.value)}
                  placeholder="Ex: Cápsula vegetal, Gel creme..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* QSP (Renomeado de 'Dose *') */}
              <div className="flex-[1.5] min-w-0 w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                  QSP *
                </label>
                <div className="flex items-center w-full gap-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dosagemValor}
                    onChange={(e) => setDosagemValor(e.target.value)}
                    placeholder="Ex: 1"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {via === "tópico" && (
                    <select
                      value={dosagemUnidade}
                      onChange={(e) => setDosagemUnidade(e.target.value)}
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Quantidade Total com Sufixo Integrado */}
              <div className="flex-[2] min-w-0 w-full">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 whitespace-nowrap">
                  Quantidade Total *
                </label>
                <div className="flex items-center w-full">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalVeiculo}
                    onChange={(e) => setTotalVeiculo(e.target.value)}
                    placeholder="Ex: 30"
                    className="w-full px-3 py-2 text-sm rounded-l-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="px-3 py-2 text-sm font-medium border border-l-0 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-r-lg whitespace-nowrap select-none shrink-0">
                    {via?.toLowerCase() === 'tópico' ? 'un' : (tipoVeiculo || 'dose(s)')}
                  </span>
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
              ref={posologiaInputRef}
              rows={2}
              placeholder="Ex: Tomar 1 dose via oral todas as manhãs logo após o café; Aplicar no rosto limpo à noite..."
              defaultValue={posologia}
              onInput={(e) => setPosologia(e.currentTarget.value)}
              onBlur={(e) => setPosologia(e.target.value)}
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
              ref={orientPacienteInputRef}
              rows={2}
              placeholder="Ex: Suspender o uso se houver irritação; armazenar em local fresco..."
              defaultValue={orientPaciente}
              onInput={(e) => setOrientPaciente(e.currentTarget.value)}
              onBlur={(e) => setOrientPaciente(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none"
            />
          </div>

          {/* Observações à Farmácia */}
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Observações à Farmácia Magistral
            </label>
            <textarea
              ref={orientFarmaciaInputRef}
              rows={2}
              placeholder="Ex: Ajustar o pH final para 4.5; envasar em frasco âmbar airless..."
              defaultValue={orientFarmacia}
              onInput={(e) => setOrientFarmacia(e.currentTarget.value)}
              onBlur={(e) => setOrientFarmacia(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none"
            />
          </div>

          {/* Rodapé de Ações MD4 */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors md-state-layer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 text-xs font-semibold text-white bg-[#004d40] hover:bg-[#003830] active:scale-[0.98] dark:bg-emerald-800 dark:hover:bg-emerald-700 rounded-full shadow-xs transition-all disabled:opacity-50 cursor-pointer md-state-layer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{initialData ? "Salvando Alterações..." : "Registrando Prescrição..."}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{initialData ? "Salvar Alterações e Arquivar Versão" : "Emitir Receituário Magistral"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
