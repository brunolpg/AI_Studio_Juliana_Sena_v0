"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Layers,
  CreditCard,
  FileText,
  Loader2,
  Save,
  HelpCircle,
  Clock,
  DollarSign,
  ChevronDown,
} from "lucide-react";
import type {
  Proposta,
  PropostaInput,
  OpcaoProposta,
  ProcedimentoProposta,
  EtapaCronograma,
  TopicoProposta,
  FormaPagamentoProposta,
} from "@/types/proposta";
import { saveProposta } from "@/app/actions/propostas-actions";
import { useToast } from "@/components/ui/toast";
import {
  PROCEDIMENTOS_CADASTRAIS,
  PROCEDIMENTO_CATEGORIES,
  type Procedimento,
} from "@/lib/procedimentos-mock";

interface PropostaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteId: string;
  propostaToEdit?: Proposta | null;
  onSaved: (proposta: Proposta) => void;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
}

export function PropostaFormModal({
  isOpen,
  onClose,
  pacienteId,
  propostaToEdit,
  onSaved,
  patientData,
}: PropostaFormModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [profissional, setProfissional] = useState("Dra. Juliana Sena");
  const [opcoes, setOpcoes] = useState<OpcaoProposta[]>([]);
  const [cronogramaTitulo, setCronogramaTitulo] = useState("Cronograma Clínico Inicial");
  const [etapas, setEtapas] = useState<EtapaCronograma[]>([]);
  const [topicos, setTopicos] = useState<TopicoProposta[]>([]);

  // Inicializa ou reseta formulário
  useEffect(() => {
    if (!isOpen) return;

    if (propostaToEdit) {
      setTitulo(propostaToEdit.titulo || "");
      setObjetivo(propostaToEdit.objetivo || "");
      setProfissional(propostaToEdit.profissional || "Dra. Juliana Sena");
      setOpcoes(
        propostaToEdit.opcoes && propostaToEdit.opcoes.length > 0
          ? JSON.parse(JSON.stringify(propostaToEdit.opcoes))
          : [createDefaultOpcao(1)]
      );
      setCronogramaTitulo(
        propostaToEdit.cronograma?.titulo || "Cronograma Clínico Inicial"
      );
      setEtapas(
        propostaToEdit.cronograma?.etapas && propostaToEdit.cronograma.etapas.length > 0
          ? JSON.parse(JSON.stringify(propostaToEdit.cronograma.etapas))
          : []
      );
      setTopicos(
        propostaToEdit.topicos && propostaToEdit.topicos.length > 0
          ? JSON.parse(JSON.stringify(propostaToEdit.topicos))
          : []
      );
    } else {
      // Criação nova com valores padrão
      setTitulo("");
      setObjetivo("");
      setProfissional("Dra. Juliana Sena");
      setOpcoes([createDefaultOpcao(1)]);
      setCronogramaTitulo("Cronograma Clínico Inicial");
      setEtapas([
        {
          id: crypto.randomUUID(),
          tipo_data: "unica",
          data: new Date().toISOString().split("T")[0],
          desc_etapa: "Avaliação inicial e alinhamento do protocolo",
        },
      ]);
      setTopicos([
        {
          id: crypto.randomUUID(),
          titulo: "Orientações Gerais do Tratamento",
          texto:
            "Recomenda-se ingestão hídrica adequada e uso diário de protetor solar FPS 50+. Evitar exposição solar direta nos primeiros dias após os procedimentos.",
        },
      ]);
    }
  }, [isOpen, propostaToEdit]);

  if (!isOpen) return null;

  // Função auxiliar para criar opção padrão
  function createDefaultOpcao(numero: number): OpcaoProposta {
    const defaultProc = PROCEDIMENTOS_CADASTRAIS[0] || {
      id: "p1",
      procedimento: "Consulta Estética",
      valor: 200,
    };

    return {
      id: crypto.randomUUID(),
      titulo: `Opção #${numero}: Protocolo Personalizado`,
      descricao: "Combinação personalizada de procedimentos de alto rendimento.",
      beneficios: "Resultados progressivos, naturais e duradouros com mínima intervenção.",
      procedimentos: [
        {
          procedimento_id: defaultProc.id,
          nome_procedimento: defaultProc.procedimento,
          num_sessoes: 1,
          valor_sessao: defaultProc.valor,
          total: defaultProc.valor,
        },
      ],
      formas_pagamento: [
        { tipo: "a_vista", desconto: 10 },
        { tipo: "parcelado", num_parcelas: 10 },
      ],
    };
  }

  // Adicionar Opção
  const handleAddOpcao = () => {
    const nextNum = opcoes.length + 1;
    setOpcoes([...opcoes, createDefaultOpcao(nextNum)]);
  };

  // Remover Opção
  const handleRemoveOpcao = (opcaoIndex: number) => {
    if (opcoes.length <= 1) {
      toast({
        type: "warning",
        title: "Opção obrigatória",
        description: "A proposta precisa ter ao menos uma opção de protocolo.",
      });
      return;
    }
    const updated = opcoes.filter((_, idx) => idx !== opcaoIndex);
    setOpcoes(updated);
  };

  // Atualizar campo de opção
  const handleUpdateOpcaoField = (
    index: number,
    field: keyof OpcaoProposta,
    value: any
  ) => {
    const updated = [...opcoes];
    updated[index] = { ...updated[index], [field]: value };
    setOpcoes(updated);
  };

  // Gerenciamento de procedimentos dentro de uma opção
  const handleAddProcedimento = (opcaoIndex: number) => {
    const defaultProc = PROCEDIMENTOS_CADASTRAIS[0] || {
      id: "p1",
      procedimento: "Consulta Estética",
      valor: 200,
    };
    const updated = [...opcoes];
    updated[opcaoIndex].procedimentos.push({
      procedimento_id: defaultProc.id,
      nome_procedimento: defaultProc.procedimento,
      num_sessoes: 1,
      valor_sessao: defaultProc.valor,
      total: defaultProc.valor,
    });
    setOpcoes(updated);
  };

  const handleRemoveProcedimento = (opcaoIndex: number, procIndex: number) => {
    const updated = [...opcoes];
    if (updated[opcaoIndex].procedimentos.length <= 1) {
      toast({
        type: "warning",
        title: "Procedimento obrigatório",
        description: "Cada opção precisa ter ao menos um procedimento cadastrado.",
      });
      return;
    }
    updated[opcaoIndex].procedimentos.splice(procIndex, 1);
    setOpcoes(updated);
  };

  const handleSelectProcedimento = (
    opcaoIndex: number,
    procIndex: number,
    procedimentoId: string
  ) => {
    const found = PROCEDIMENTOS_CADASTRAIS.find((p) => p.id === procedimentoId);
    if (!found) return;

    const updated = [...opcoes];
    const proc = updated[opcaoIndex].procedimentos[procIndex];
    proc.procedimento_id = found.id;
    proc.nome_procedimento = found.procedimento;
    proc.valor_sessao = found.valor;
    proc.total = proc.num_sessoes * found.valor;
    setOpcoes(updated);
  };

  const handleUpdateProcValue = (
    opcaoIndex: number,
    procIndex: number,
    field: "num_sessoes" | "valor_sessao",
    val: number
  ) => {
    const updated = [...opcoes];
    const proc = updated[opcaoIndex].procedimentos[procIndex];
    if (field === "num_sessoes") {
      proc.num_sessoes = Math.max(1, val);
    } else {
      proc.valor_sessao = Math.max(0, val);
    }
    proc.total = proc.num_sessoes * proc.valor_sessao;
    setOpcoes(updated);
  };

  // Gerenciamento de Cronograma
  const handleAddEtapa = () => {
    setEtapas([
      ...etapas,
      {
        id: crypto.randomUUID(),
        tipo_data: "unica",
        data: new Date().toISOString().split("T")[0],
        desc_etapa: "Nova sessão clínica do protocolo",
      },
    ]);
  };

  const handleRemoveEtapa = (index: number) => {
    setEtapas(etapas.filter((_, idx) => idx !== index));
  };

  const handleUpdateEtapa = (index: number, field: keyof EtapaCronograma, value: any) => {
    const updated = [...etapas];
    updated[index] = { ...updated[index], [field]: value };
    setEtapas(updated);
  };

  // Gerenciamento de Tópicos
  const handleAddTopico = () => {
    setTopicos([
      ...topicos,
      {
        id: crypto.randomUUID(),
        titulo: "Nova Orientação",
        texto: "Descreva recomendações, cuidados específicos ou observações adicionais.",
      },
    ]);
  };

  const handleRemoveTopico = (index: number) => {
    setTopicos(topicos.filter((_, idx) => idx !== index));
  };

  const handleUpdateTopico = (index: number, field: keyof TopicoProposta, value: string) => {
    const updated = [...topicos];
    updated[index] = { ...updated[index], [field]: value };
    setTopicos(updated);
  };

  // Submissão
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast({
        type: "warning",
        title: "Título obrigatório",
        description: "Dê um nome para identificar a proposta (ex: Protocolo Harmonização Facial).",
      });
      return;
    }

    if (opcoes.length === 0) {
      toast({
        type: "warning",
        title: "Opção obrigatória",
        description: "Adicione ao menos uma opção de protocolo à proposta.",
      });
      return;
    }

    for (let i = 0; i < opcoes.length; i++) {
      if (!opcoes[i].procedimentos || opcoes[i].procedimentos.length === 0) {
        toast({
          type: "warning",
          title: "Procedimentos ausentes",
          description: `A ${opcoes[i].titulo || `Opção #${i + 1}`} não possui procedimentos cadastrados.`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const input: PropostaInput = {
        paciente_id: pacienteId,
        titulo: titulo.trim(),
        objetivo: objetivo.trim(),
        profissional: profissional.trim() || "Dra. Juliana Sena",
        status: propostaToEdit?.status || "Ativo",
        opcoes,
        cronograma: {
          titulo: cronogramaTitulo.trim() || "Cronograma Clínico Inicial",
          etapas,
        },
        topicos,
      };

      const res = await saveProposta(input, propostaToEdit?.id);

      if (res.success && res.data) {
        toast({
          type: "success",
          title: "Proposta Salva!",
          description: "O planejamento clínico foi gerado e assinado digitalmente com SHA-256.",
        });
        onSaved(res.data);
        onClose();
      } else {
        throw new Error(res.error || "Erro ao salvar proposta.");
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Falha ao salvar",
        description: err.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {propostaToEdit ? "Editar Proposta de Planejamento" : "Nova Proposta de Planejamento"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <span className="font-semibold text-slate-700 dark:text-slate-300">{patientData?.nome || "Paciente"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Título da Proposta *
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Protocolo Rejuvenescimento Facial 2026"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Profissional Responsável
                </label>
                <input
                  type="text"
                  value={profissional}
                  onChange={(e) => setProfissional(e.target.value)}
                  placeholder="Dra. Juliana Sena"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Objetivo Clínico do Plano
              </label>
              <textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                placeholder="Ex: Estímulo de neocologênese, hidratação profunda e redução de rugas dinâmicas periorbitárias..."
                rows={2}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Opções de Protocolo */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-600" />
                  Opções de Tratamento & Investimento ({opcoes.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Crie uma ou mais alternativas de protocolo clínico para o paciente.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddOpcao}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Opção</span>
              </button>
            </div>

            <div className="space-y-5">
              {opcoes.map((opcao, oIdx) => {
                const totalOpcao = opcao.procedimentos.reduce(
                  (acc, p) => acc + (p.total || p.num_sessoes * p.valor_sessao),
                  0
                );

                return (
                  <div
                    key={opcao.id || oIdx}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={opcao.titulo}
                          onChange={(e) =>
                            handleUpdateOpcaoField(oIdx, "titulo", e.target.value)
                          }
                          placeholder={`Opção #${oIdx + 1}: Nome do Protocolo`}
                          className="w-full font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 pb-1 focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      {opcoes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOpcao(oIdx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer"
                          title="Remover esta opção"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Descrição da Opção
                        </label>
                        <input
                          type="text"
                          value={opcao.descricao}
                          onChange={(e) =>
                            handleUpdateOpcaoField(oIdx, "descricao", e.target.value)
                          }
                          placeholder="Ex: Protocolo padrão com foco em textura facial..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Benefícios Esperados
                        </label>
                        <input
                          type="text"
                          value={opcao.beneficios || ""}
                          onChange={(e) =>
                            handleUpdateOpcaoField(oIdx, "beneficios", e.target.value)
                          }
                          placeholder="Ex: Melhora na elasticidade e luminosidade imediata..."
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {/* Procedimentos da Opção */}
                    <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Procedimentos Inclusos
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddProcedimento(oIdx)}
                          className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Adicionar Procedimento
                        </button>
                      </div>

                      <div className="space-y-2">
                        {opcao.procedimentos.map((proc, pIdx) => (
                          <div
                            key={proc.procedimento_id || pIdx}
                            className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                          >
                            <div className="flex-1 min-w-[200px]">
                              <select
                                value={proc.procedimento_id}
                                onChange={(e) =>
                                  handleSelectProcedimento(oIdx, pIdx, e.target.value)
                                }
                                className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                              >
                                {PROCEDIMENTOS_CADASTRAIS.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.procedimento} ({item.categoria}) — R$ {item.valor}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="w-20">
                                <label className="block text-[9px] uppercase font-bold text-slate-400">
                                  Sessões
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={proc.num_sessoes}
                                  onChange={(e) =>
                                    handleUpdateProcValue(
                                      oIdx,
                                      pIdx,
                                      "num_sessoes",
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-full p-1 text-xs text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                />
                              </div>

                              <div className="w-28">
                                <label className="block text-[9px] uppercase font-bold text-slate-400">
                                  Valor/Sessão (R$)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step="10"
                                  value={proc.valor_sessao}
                                  onChange={(e) =>
                                    handleUpdateProcValue(
                                      oIdx,
                                      pIdx,
                                      "valor_sessao",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="w-full p-1 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                />
                              </div>

                              <div className="w-24 text-right">
                                <span className="block text-[9px] uppercase font-bold text-slate-400">
                                  Subtotal
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                  R$ {proc.total || proc.num_sessoes * proc.valor_sessao}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveProcedimento(oIdx, pIdx)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                                title="Remover procedimento"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Total da Opção:{" "}
                          <strong className="text-teal-700 dark:text-teal-300 font-mono text-sm ml-1">
                            R$ {totalOpcao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cronograma Clínico */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  Cronograma Clínico Sugerido
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Defina datas pontuais ou períodos de acompanhamento para as etapas do plano.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddEtapa}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Etapa</span>
              </button>
            </div>

            <div className="space-y-3">
              {etapas.map((etapa, eIdx) => (
                <div
                  key={etapa.id || eIdx}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800"
                >
                  <div className="w-28 shrink-0">
                    <select
                      value={etapa.tipo_data}
                      onChange={(e) =>
                        handleUpdateEtapa(eIdx, "tipo_data", e.target.value as any)
                      }
                      className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      <option value="unica">Data Única</option>
                      <option value="periodo">Período</option>
                    </select>
                  </div>

                  {etapa.tipo_data === "periodo" ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="date"
                        value={etapa.data_inicio || ""}
                        onChange={(e) => handleUpdateEtapa(eIdx, "data_inicio", e.target.value)}
                        className="p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                      <span className="text-xs text-slate-400">até</span>
                      <input
                        type="date"
                        value={etapa.data_fim || ""}
                        onChange={(e) => handleUpdateEtapa(eIdx, "data_fim", e.target.value)}
                        className="p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="shrink-0">
                      <input
                        type="date"
                        value={etapa.data || ""}
                        onChange={(e) => handleUpdateEtapa(eIdx, "data", e.target.value)}
                        className="p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      value={etapa.desc_etapa}
                      onChange={(e) => handleUpdateEtapa(eIdx, "desc_etapa", e.target.value)}
                      placeholder="Descrição da sessão ou entrega clínica..."
                      className="w-full p-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveEtapa(eIdx)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tópicos e Orientações Adicionais */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  Tópicos & Orientações Adicionais
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Orientações de cuidados, esclarecimentos e condutas personalizadas.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddTopico}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Tópico</span>
              </button>
            </div>

            <div className="space-y-3">
              {topicos.map((topico, tIdx) => (
                <div
                  key={topico.id || tIdx}
                  className="p-3.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={topico.titulo}
                      onChange={(e) => handleUpdateTopico(tIdx, "titulo", e.target.value)}
                      placeholder="Título do Tópico..."
                      className="font-bold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 pb-0.5 focus:outline-none flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTopico(tIdx)}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={topico.texto}
                    onChange={(e) => handleUpdateTopico(tIdx, "texto", e.target.value)}
                    placeholder="Instruções ou orientações detalhadas..."
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando & Assinando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {propostaToEdit ? "Salvar Alterações" : "Salvar & Gerar Proposta"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
