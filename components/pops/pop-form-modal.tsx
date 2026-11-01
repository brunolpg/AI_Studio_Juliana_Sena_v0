"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Pill,
  ShieldCheck,
  FileText,
  Plus,
} from "lucide-react";
import type { PopProtocoloCompleto, PopFormData, PopStatus } from "@/types/pop";
import { getFormulasCatalogoAction, salvarPop } from "@/app/actions/pops";
import { getComponentesEUnidadesAction } from "@/actions/formula-actions";
import { FormulaModal } from "@/components/formulas/formula-modal";
import { useToast } from "@/components/ui/toast";

interface PopFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  popToEdit?: PopProtocoloCompleto | null;
  onSuccess: () => void;
}

export function PopFormModal({
  isOpen,
  onClose,
  popToEdit,
  onSuccess,
}: PopFormModalProps) {
  const { toast } = useToast();

  const [protocolo, setProtocolo] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [dataPop, setDataPop] = useState("");
  const profissional = "Juliana Sena de Souza Vieira";
  const [status, setStatus] = useState<PopStatus>("Ativo");

  // Lista intercalada de blocos
  const [blocos, setBlocos] = useState<
    Array<{
      id?: string;
      tempId: string;
      tipo: "TOPICO" | "FORMULA" | "PRESCRICAO";
      ordem: number;
      topico_titulo?: string;
      topico_descricao?: string;
      formula_id?: string;
      prescricao_id?: string;
      subtopicos?: Array<{
        id?: string;
        tempId: string;
        ordem: number;
        titulo: string;
        descricao: string;
      }>;
    }>
  >([]);

  // Fórmulas cadastradas disponíveis no catálogo
  const [formulasDisponiveis, setFormulasDisponiveis] = useState<any[]>([]);
  const [isLoadingFormulas, setIsLoadingFormulas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal para cadastro rápido de Nova Fórmula
  const [isNovaFormulaModalOpen, setIsNovaFormulaModalOpen] = useState(false);
  const [componentesList, setComponentesList] = useState<any[]>([]);
  const [unidadesList, setUnidadesList] = useState<any[]>([]);
  const [activeBlocoIndexForNewFormula, setActiveBlocoIndexForNewFormula] = useState<number | null>(null);

  // Inicializa dados para criação ou edição
  useEffect(() => {
    if (!isOpen) return;

    if (popToEdit) {
      setProtocolo(popToEdit.protocolo || "");
      setFinalidade(popToEdit.finalidade || "");
      setDataPop(popToEdit.data_pop || new Date().toISOString().split("T")[0]);
      setStatus(popToEdit.status || "Ativo");

      const mappedBlocos = (popToEdit.blocos || [])
        .sort((a, b) => a.ordem - b.ordem)
        .map((b, idx) => ({
          id: b.id,
          tempId: `bloco-${idx}-${Date.now()}`,
          tipo: (b.tipo as "TOPICO" | "FORMULA" | "PRESCRICAO") || (b.formula_id ? "FORMULA" : "TOPICO"),
          ordem: idx + 1,
          topico_titulo: b.topico_titulo || "",
          topico_descricao: b.topico_descricao || "",
          formula_id: b.formula_id || b.prescricao_id || "",
          prescricao_id: b.prescricao_id || "",
          subtopicos: (b.subtopicos || [])
            .sort((s1, s2) => s1.ordem - s2.ordem)
            .map((s, sIdx) => ({
              id: s.id,
              tempId: `sub-${sIdx}-${Date.now()}`,
              ordem: sIdx + 1,
              titulo: s.titulo || "",
              descricao: s.descricao || "",
            })),
        }));
      setBlocos(mappedBlocos);
    } else {
      // Criação novo
      setProtocolo("");
      setFinalidade("");
      setDataPop(new Date().toISOString().split("T")[0]);
      setStatus("Ativo");

      // Bloco inicial padrão de tópico para facilitar
      setBlocos([
        {
          tempId: `bloco-init-${Date.now()}`,
          tipo: "TOPICO",
          ordem: 1,
          topico_titulo: "1. Higienização e Antissepsia Pré-Procedimento",
          topico_descricao:
            "Realizar higienização rigorosa da área de tratamento com sabonete antisséptico neutro e aplicação de Clorexidina Alcoólica 0,5% ou Clorexidina Aquosa 2% antes do procedimento.",
          subtopicos: [
            {
              tempId: `sub-init-1-${Date.now()}`,
              ordem: 1,
              titulo: "Inspeção visual preliminar",
              descricao:
                "Confirmar ausência de lesões ativas, infecções herpéticas ou soluções de continuidade cutânea.",
            },
          ],
        },
      ]);
    }

    // Carrega fórmulas do catálogo institucional e dados para o modal de nova fórmula
    setIsLoadingFormulas(true);
    Promise.all([
      getFormulasCatalogoAction(),
      getComponentesEUnidadesAction(),
    ])
      .then(([formulas, compUni]) => {
        setFormulasDisponiveis(formulas || []);
        if (compUni?.success) {
          setComponentesList(compUni.componentes || []);
          setUnidadesList(compUni.unidades || []);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar catálogo de fórmulas:", err);
      })
      .finally(() => {
        setIsLoadingFormulas(false);
      });
  }, [isOpen, popToEdit]);

  if (!isOpen) return null;

  // Ações de gerenciamento dos blocos intercalados
  const handleAddTopico = () => {
    const nextOrdem = blocos.length + 1;
    setBlocos((prev) => [
      ...prev,
      {
        tempId: `bloco-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tipo: "TOPICO",
        ordem: nextOrdem,
        topico_titulo: "",
        topico_descricao: "",
        subtopicos: [],
      },
    ]);
  };

  const handleAddFormula = () => {
    const nextOrdem = blocos.length + 1;
    const primeiraFormulaId =
      formulasDisponiveis.length > 0 ? formulasDisponiveis[0].id : "";

    setBlocos((prev) => [
      ...prev,
      {
        tempId: `bloco-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tipo: "FORMULA",
        ordem: nextOrdem,
        formula_id: primeiraFormulaId,
      },
    ]);
  };

  const handleRemoveBloco = (index: number) => {
    setBlocos((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((b, idx) => ({ ...b, ordem: idx + 1 }));
    });
  };

  const handleMoveBlocoUp = (index: number) => {
    if (index === 0) return;
    setBlocos((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((b, idx) => ({ ...b, ordem: idx + 1 }));
    });
  };

  const handleMoveBlocoDown = (index: number) => {
    if (index === blocos.length - 1) return;
    setBlocos((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((b, idx) => ({ ...b, ordem: idx + 1 }));
    });
  };

  const handleUpdateTopico = (
    index: number,
    field: "topico_titulo" | "topico_descricao",
    value: string
  ) => {
    setBlocos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleUpdateFormula = (index: number, formulaId: string) => {
    setBlocos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], formula_id: formulaId, prescricao_id: formulaId };
      return copy;
    });
  };

  // Ações de gerenciamento dos subtópicos
  const handleAddSubtopico = (blocoIndex: number) => {
    setBlocos((prev) => {
      const copy = [...prev];
      const subs = copy[blocoIndex].subtopicos || [];
      copy[blocoIndex] = {
        ...copy[blocoIndex],
        subtopicos: [
          ...subs,
          {
            tempId: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ordem: subs.length + 1,
            titulo: "",
            descricao: "",
          },
        ],
      };
      return copy;
    });
  };

  const handleRemoveSubtopico = (blocoIndex: number, subIndex: number) => {
    setBlocos((prev) => {
      const copy = [...prev];
      const subs = copy[blocoIndex].subtopicos || [];
      const updatedSubs = subs
        .filter((_, i) => i !== subIndex)
        .map((s, idx) => ({ ...s, ordem: idx + 1 }));
      copy[blocoIndex] = { ...copy[blocoIndex], subtopicos: updatedSubs };
      return copy;
    });
  };

  const handleMoveSubtopicoUp = (blocoIndex: number, subIndex: number) => {
    if (subIndex === 0) return;
    setBlocos((prev) => {
      const copy = [...prev];
      const subs = [...(copy[blocoIndex].subtopicos || [])];
      const temp = subs[subIndex - 1];
      subs[subIndex - 1] = subs[subIndex];
      subs[subIndex] = temp;
      copy[blocoIndex] = {
        ...copy[blocoIndex],
        subtopicos: subs.map((s, idx) => ({ ...s, ordem: idx + 1 })),
      };
      return copy;
    });
  };

  const handleMoveSubtopicoDown = (blocoIndex: number, subIndex: number) => {
    setBlocos((prev) => {
      const copy = [...prev];
      const subs = [...(copy[blocoIndex].subtopicos || [])];
      if (subIndex === subs.length - 1) return prev;
      const temp = subs[subIndex + 1];
      subs[subIndex + 1] = subs[subIndex];
      subs[subIndex] = temp;
      copy[blocoIndex] = {
        ...copy[blocoIndex],
        subtopicos: subs.map((s, idx) => ({ ...s, ordem: idx + 1 })),
      };
      return copy;
    });
  };

  const handleUpdateSubtopico = (
    blocoIndex: number,
    subIndex: number,
    field: "titulo" | "descricao",
    value: string
  ) => {
    setBlocos((prev) => {
      const copy = [...prev];
      const subs = [...(copy[blocoIndex].subtopicos || [])];
      subs[subIndex] = { ...subs[subIndex], [field]: value };
      copy[blocoIndex] = { ...copy[blocoIndex], subtopicos: subs };
      return copy;
    });
  };

  // Salvar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!protocolo.trim()) {
      toast({
        type: "error",
        title: "Campo Obrigatório",
        description: "Informe o título do Protocolo / Procedimento.",
      });
      return;
    }

    if (!finalidade.trim()) {
      toast({
        type: "error",
        title: "Campo Obrigatório",
        description: "Informe a finalidade clínica do procedimento.",
      });
      return;
    }

    if (blocos.length === 0) {
      toast({
        type: "error",
        title: "Estrutura Vazia",
        description: "Adicione ao menos um Tópico ou Fórmula ao procedimento.",
      });
      return;
    }

    // Validações individuais
    for (let i = 0; i < blocos.length; i++) {
      const b = blocos[i];
      if (b.tipo === "TOPICO" && !b.topico_titulo?.trim()) {
        toast({
          type: "error",
          title: "Tópico Incompleto",
          description: `Preencha o título do Bloco #${i + 1}.`,
        });
        return;
      }
      if (b.tipo === "FORMULA" && !b.formula_id) {
        toast({
          type: "error",
          title: "Fórmula Não Selecionada",
          description: `Selecione uma fórmula magistral cadastrada para o Bloco #${i + 1}.`,
        });
        return;
      }
      if (b.tipo === "PRESCRICAO" && !b.prescricao_id && !b.formula_id) {
        toast({
          type: "error",
          title: "Prescrição Não Selecionada",
          description: `Selecione uma receita ou fórmula para o Bloco #${i + 1}.`,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const payloadData: PopFormData = {
        id: popToEdit?.id,
        protocolo: protocolo.trim(),
        finalidade: finalidade.trim(),
        data_pop: dataPop || popToEdit?.data_pop || new Date().toISOString().split("T")[0],
        profissional: "Juliana Sena de Souza Vieira",
        status,
        blocos: blocos.map((b) => ({
          id: b.id,
          tipo: b.tipo,
          ordem: b.ordem,
          topico_titulo: b.topico_titulo?.trim(),
          topico_descricao: b.topico_descricao?.trim(),
          formula_id: b.formula_id,
          prescricao_id: b.prescricao_id || b.formula_id,
          subtopicos: (b.subtopicos || []).map((s) => ({
            id: s.id,
            ordem: s.ordem,
            titulo: s.titulo.trim(),
            descricao: s.descricao.trim(),
          })),
        })),
      };

      const res = await salvarPop(payloadData);

      if (res.error) {
        toast({
          type: "error",
          title: "Erro ao Salvar",
          description: res.error,
        });
      } else {
        toast({
          type: "success",
          title: popToEdit ? "POP Atualizado" : "POP Cadastrado",
          description: `Procedimento institucional assinado digitalmente com SHA-256 e salvo com sucesso.`,
        });
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro",
        description: err?.message || "Ocorreu uma falha ao salvar o procedimento.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {popToEdit
                  ? "Editar Procedimento Operacional Padrão"
                  : "Novo Procedimento Operacional Padrão"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Padronização institucional de condutas clínicas, parâmetros e fórmulas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Seção 1: Identificação do Procedimento */}
          <div className="space-y-3.5 p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
              <span className="text-xs font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wider">
                1. Identificação do Procedimento
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                Obrigatório
              </span>
            </div>

            {/* Linha 1: Protocolo (esquerda, maior) e Status (direita, largura compacta/proporcional) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 landscape:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2 landscape:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Protocolo / Nome do Procedimento *
                </label>
                <input
                  type="text"
                  required
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value)}
                  placeholder="Ex.: POP 04 - Microagulhamento com Drug Delivery & Regeneração Cutânea"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d40]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status do Procedimento
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PopStatus)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40] cursor-pointer"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Em Revisão">Em Revisão</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Linha 2: Finalidade Clínica (largura total) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Finalidade Clínica do Procedimento *
              </label>
              <textarea
                required
                rows={3}
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                placeholder="Descreva a finalidade institucional, objetivos terapêuticos e diretrizes clínicas deste procedimento..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d40] resize-y"
              />
            </div>
          </div>

          {/* Seção 2: Gerenciador de Blocos com Ordem Intercalada */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wider block">
                  2. Gerenciador de Blocos (Ordem Intercalada)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Organize tópicos operacionais e fórmulas magistrais na sequência exata de execução.
                </p>
              </div>

              {/* Botões para Adicionar Tópico ou Fórmula */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAddTopico}
                  className="bg-[#004d40] text-white hover:bg-[#003830] rounded-xl px-4 py-2 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Adicionar Tópico</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddFormula}
                  className="bg-[#004d40] text-white hover:bg-[#0b5c54] rounded-xl px-3 py-1.5 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Vincular Fórmula</span>
                </button>
              </div>
            </div>

            {/* Lista dos Blocos Intercalados */}
            <div className="space-y-4">
              {blocos.map((bloco, bIdx) => {
                const isPrimeiro = bIdx === 0;
                const isUltimo = bIdx === blocos.length - 1;

                if (bloco.tipo === "TOPICO") {
                  return (
                    <div
                      key={bloco.tempId}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative transition-all"
                    >
                      {/* Cabeçalho do Bloco Tópico */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#004d40] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            #{bIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                            Bloco Tópico Operacional
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveBlocoUp(bIdx)}
                            disabled={isPrimeiro}
                            title="Subir posição do bloco"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlocoDown(bIdx)}
                            disabled={isUltimo}
                            title="Descer posição do bloco"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                          <button
                            type="button"
                            onClick={() => handleRemoveBloco(bIdx)}
                            title="Excluir bloco"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Campos do Tópico */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Título do Tópico *
                          </label>
                          <input
                            type="text"
                            required
                            value={bloco.topico_titulo || ""}
                            onChange={(e) =>
                              handleUpdateTopico(bIdx, "topico_titulo", e.target.value)
                            }
                            placeholder="Ex.: 2. Preparação da Pele & Desinfecção"
                            className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Descrição / Procedimento Geral
                          </label>
                          <textarea
                            rows={2}
                            value={bloco.topico_descricao || ""}
                            onChange={(e) =>
                              handleUpdateTopico(bIdx, "topico_descricao", e.target.value)
                            }
                            placeholder="Instruções passo a passo, parâmetros do equipamento, técnica aplicada..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40] resize-y"
                          />
                        </div>

                        {/* Subtópicos do Tópico */}
                        <div className="pl-3 sm:pl-4 border-l-2 border-emerald-200 dark:border-emerald-800 space-y-3 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                              Subtópicos ({bloco.subtopicos?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddSubtopico(bIdx)}
                              className="bg-[#004d40] text-white hover:bg-[#003830] rounded-xl px-3 py-1.5 font-semibold text-[11px] flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Subtópico</span>
                            </button>
                          </div>

                          {bloco.subtopicos?.map((sub, sIdx) => {
                            const isFirstSub = sIdx === 0;
                            const isLastSub = sIdx === (bloco.subtopicos?.length || 0) - 1;

                            return (
                              <div
                                key={sub.tempId}
                                className="bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-bold text-[#004d40] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60">
                                    Subtópico #{bIdx + 1}.{sIdx + 1}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSubtopicoUp(bIdx, sIdx)}
                                      disabled={isFirstSub}
                                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSubtopicoDown(bIdx, sIdx)}
                                      disabled={isLastSub}
                                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubtopico(bIdx, sIdx)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-600 ml-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Container dos campos do Subtópico */}
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                      Título do Subtópico *
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      value={sub.titulo}
                                      onChange={(e) =>
                                        handleUpdateSubtopico(bIdx, sIdx, "titulo", e.target.value)
                                      }
                                      placeholder="Ex.: Incompatibilidade Absoluta:"
                                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d40]"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                      Descrição Detalhada / Conduta Clínica *
                                    </label>
                                    <textarea
                                      required
                                      rows={3}
                                      value={sub.descricao}
                                      onChange={(e) =>
                                        handleUpdateSubtopico(bIdx, sIdx, "descricao", e.target.value)
                                      }
                                      placeholder="Descreva detalhadamente as diretrizes, contraindicações, alertas ou técnica operacional..."
                                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#004d40] resize-y"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Bloco do Tipo FÓRMULA (ou PRESCRIÇÃO legada)
                const formulaIdAtual = bloco.formula_id || bloco.prescricao_id || "";
                const selectedFormula = formulasDisponiveis.find((f) => f.id === formulaIdAtual);

                return (
                  <div
                    key={bloco.tempId}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5 relative transition-all"
                  >
                    {/* Cabeçalho do Bloco Fórmula */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#004d40] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          #{bIdx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-[#004d40] dark:text-emerald-400" />
                          <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wide">
                            Bloco Fórmula Vinculada
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveBlocoUp(bIdx)}
                          disabled={isPrimeiro}
                          title="Subir posição do bloco"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveBlocoDown(bIdx)}
                          disabled={isUltimo}
                          title="Descer posição do bloco"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                        <button
                          type="button"
                          onClick={() => handleRemoveBloco(bIdx)}
                          title="Desvincular fórmula"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Seleção da Fórmula e Botão de Cadastro Rápido */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Selecione a Fórmula Cadastrada *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBlocoIndexForNewFormula(bIdx);
                            setIsNovaFormulaModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#004d40] dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Cadastrar Nova Fórmula</span>
                        </button>
                      </div>

                      {isLoadingFormulas ? (
                        <div className="text-xs text-slate-500 py-2">
                          Carregando fórmulas magistrais...
                        </div>
                      ) : formulasDisponiveis.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                          <span>Nenhuma fórmula encontrada no catálogo.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBlocoIndexForNewFormula(bIdx);
                              setIsNovaFormulaModalOpen(true);
                            }}
                            className="font-bold underline text-amber-900 dark:text-amber-200"
                          >
                            Cadastrar agora
                          </button>
                        </div>
                      ) : (
                        <select
                          required
                          value={formulaIdAtual}
                          onChange={(e) => handleUpdateFormula(bIdx, e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40] cursor-pointer"
                        >
                          <option value="">-- Selecione uma Fórmula Magistral --</option>
                          {formulasDisponiveis.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome} {f.via ? `(${f.via})` : ""} {f.dosagem ? `• Dose: ${f.dosagem}` : ""}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Exibição dos Detalhes da Fórmula Selecionada */}
                      {selectedFormula && (
                        <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#004d40] dark:text-emerald-400 block">
                              Parâmetros da Fórmula:
                            </span>
                            {selectedFormula.via && (
                              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                Via {selectedFormula.via}
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                            {selectedFormula.dosagem && (
                              <p>
                                <strong>Dosagem:</strong> {selectedFormula.dosagem}
                                {selectedFormula.veiculo ? ` em ${selectedFormula.veiculo}` : ""}
                              </p>
                            )}
                            {selectedFormula.posologia && (
                              <p>
                                <strong>Posologia:</strong> {selectedFormula.posologia}
                              </p>
                            )}
                            {selectedFormula.descricao && (
                              <p className="text-slate-500 italic">
                                {selectedFormula.descricao}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Rodapé com Botões de Ação */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Assinatura Digital SHA-256 gerada automaticamente ao salvar.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-[#004d40] hover:bg-[#003830] text-white px-5 py-2 text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              {isSaving ? "Salvando..." : popToEdit ? "Atualizar POP" : "Salvar POP"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Cadastro de Nova Fórmula */}
      {isNovaFormulaModalOpen && (
        <FormulaModal
          isOpen={isNovaFormulaModalOpen}
          onClose={() => {
            setIsNovaFormulaModalOpen(false);
            setActiveBlocoIndexForNewFormula(null);
          }}
          initialComponentes={componentesList}
          initialUnidades={unidadesList}
          onSuccess={async () => {
            setIsNovaFormulaModalOpen(false);
            try {
              const updatedFormulas = await getFormulasCatalogoAction();
              setFormulasDisponiveis(updatedFormulas || []);
              if (
                activeBlocoIndexForNewFormula !== null &&
                updatedFormulas &&
                updatedFormulas.length > 0
              ) {
                // Seleciona a última fórmula criada no bloco que disparou a ação
                const latest = updatedFormulas[updatedFormulas.length - 1];
                if (latest) {
                  handleUpdateFormula(activeBlocoIndexForNewFormula, latest.id);
                }
              }
            } catch (err) {
              console.error("Erro ao atualizar lista de fórmulas:", err);
            } finally {
              setActiveBlocoIndexForNewFormula(null);
            }
          }}
        />
      )}
    </div>
  );
}
