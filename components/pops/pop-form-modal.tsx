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
} from "lucide-react";
import type { PopProtocoloCompleto, PopFormData, PopStatus } from "@/types/pop";
import { getPrescricoesDisponiveis, salvarPop } from "@/app/actions/pops";
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
      tipo: "TOPICO" | "PRESCRICAO";
      ordem: number;
      topico_titulo?: string;
      topico_descricao?: string;
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

  // Prescrições cadastradas disponíveis no sistema
  const [prescricoesDisponiveis, setPrescricoesDisponiveis] = useState<any[]>([]);
  const [isLoadingPrescricoes, setIsLoadingPrescricoes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
          tipo: b.tipo,
          ordem: idx + 1,
          topico_titulo: b.topico_titulo || "",
          topico_descricao: b.topico_descricao || "",
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

    // Carrega prescrições disponíveis globalmente
    setIsLoadingPrescricoes(true);
    getPrescricoesDisponiveis()
      .then((rxList) => {
        setPrescricoesDisponiveis(rxList || []);
      })
      .finally(() => {
        setIsLoadingPrescricoes(false);
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

  const handleAddPrescricao = () => {
    const nextOrdem = blocos.length + 1;
    const primeiraPrescricaoId =
      prescricoesDisponiveis.length > 0 ? prescricoesDisponiveis[0].id : "";

    setBlocos((prev) => [
      ...prev,
      {
        tempId: `bloco-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        tipo: "PRESCRICAO",
        ordem: nextOrdem,
        prescricao_id: primeiraPrescricaoId,
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

  const handleUpdatePrescricao = (index: number, prescricaoId: string) => {
    setBlocos((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], prescricao_id: prescricaoId };
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
        description: "Adicione ao menos um Tópico ou Prescrição ao procedimento.",
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
      if (b.tipo === "PRESCRICAO" && !b.prescricao_id) {
        toast({
          type: "error",
          title: "Prescrição Não Selecionada",
          description: `Selecione uma receita cadastrada para o Bloco #${i + 1}.`,
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
          prescricao_id: b.prescricao_id,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Topo do Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004d40] text-white flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {popToEdit
                  ? "Editar Procedimento Operacional Padrão (POP)"
                  : "Novo Procedimento Operacional Padrão (POP)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Padronização clínica institucional • Dra. Juliana Sena
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário com Scroll Suave */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Seção 1: Dados Gerais do POP */}
          <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wider">
                1. Identificação do Procedimento
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                Obrigatório
              </span>
            </div>

            <div>
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

          {/* Seção 2: Gerenciador de Blocos com Ordem Intercalada */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wider block">
                  2. Gerenciador de Blocos (Ordem Intercalada)
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Organize tópicos operacionais e prescrições terapêuticas na sequência exata de
                  execução.
                </p>
              </div>

              {/* Botões para Adicionar Tópico ou Prescrição */}
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
                  onClick={handleAddPrescricao}
                  className="bg-[#004d40] text-white hover:bg-[#003830] rounded-xl px-4 py-2 font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Vincular Prescrição</span>
                </button>
              </div>
            </div>

            {/* Lista Intercalada de Blocos */}
            <div className="space-y-4">
              {blocos.map((bloco, bIdx) => {
                const isPrimeiro = bIdx === 0;
                const isUltimo = bIdx === blocos.length - 1;

                if (bloco.tipo === "TOPICO") {
                  return (
                    <div
                      key={bloco.tempId}
                      className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 relative transition-all"
                    >
                      {/* Cabeçalho do Bloco Tópico com Controles de Posição */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#004d40] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            #{bIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wide">
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
                            title="Excluir tópico"
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
                            placeholder="Ex.: Aplicação do Ativo Regenerativo ou Técnica de Infusão"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Descrição / Diretrizes Operacionais (opcional)
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
                              <span>Adicionar Subtópico</span>
                            </button>
                          </div>

                          {bloco.subtopicos?.map((sub, sIdx) => {
                            const isFirstSub = sIdx === 0;
                            const isLastSub = sIdx === (bloco.subtopicos?.length || 0) - 1;

                            return (
                              <div
                                key={sub.tempId}
                                className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2"
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={sub.titulo}
                                    onChange={(e) =>
                                      handleUpdateSubtopico(bIdx, sIdx, "titulo", e.target.value)
                                    }
                                    placeholder="Título do subtópico (ex.: Ângulo de inserção)"
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#004d40]"
                                  />
                                  <input
                                    type="text"
                                    value={sub.descricao}
                                    onChange={(e) =>
                                      handleUpdateSubtopico(bIdx, sIdx, "descricao", e.target.value)
                                    }
                                    placeholder="Instrução do subtópico (ex.: Inserir agulha a 45 graus)"
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#004d40]"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Bloco do Tipo PRESCRIÇÃO
                const selectedRx = prescricoesDisponiveis.find((p) => p.id === bloco.prescricao_id);

                return (
                  <div
                    key={bloco.tempId}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3.5 relative transition-all"
                  >
                    {/* Cabeçalho do Bloco Prescrição */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#004d40] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          #{bIdx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-[#004d40] dark:text-emerald-400" />
                          <span className="text-xs font-bold text-[#004d40] dark:text-emerald-400 uppercase tracking-wide">
                            Bloco Prescrição Vinculada
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
                          title="Desvincular prescrição"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Seleção da Prescrição */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Selecione a Prescrição Cadastrada *
                      </label>

                      {isLoadingPrescricoes ? (
                        <div className="text-xs text-slate-500 py-2">
                          Carregando receitas cadastradas...
                        </div>
                      ) : prescricoesDisponiveis.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                          Nenhuma prescrição encontrada no sistema. Cadastre receitas no módulo de fórmulas/prescrições ou utilize tópicos operacionais.
                        </div>
                      ) : (
                        <select
                          required
                          value={bloco.prescricao_id || ""}
                          onChange={(e) => handleUpdatePrescricao(bIdx, e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#004d40] cursor-pointer"
                        >
                          <option value="">-- Selecione uma Prescrição --</option>
                          {prescricoesDisponiveis.map((rx) => {
                            const itensNomes = (rx.prescricao_itens || [])
                              .map((it: any) => it.nome_formula)
                              .join(", ");
                            return (
                              <option key={rx.id} value={rx.id}>
                                Receita de {rx.data_prescricao} • {itensNomes || "Sem fórmulas"}
                              </option>
                            );
                          })}
                        </select>
                      )}

                      {/* Exibição dos Itens da Receita Selecionada */}
                      {selectedRx && selectedRx.prescricao_itens?.length > 0 && (
                        <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#004d40] dark:text-emerald-400 block">
                            Itens e Fórmulas Inclusos:
                          </span>
                          <div className="space-y-1">
                            {selectedRx.prescricao_itens.map((it: any, itIdx: number) => (
                              <div
                                key={it.id || itIdx}
                                className="flex items-baseline gap-1.5 text-slate-700 dark:text-slate-300 text-[11px]"
                              >
                                <span className="font-bold text-[#004d40] dark:text-emerald-400">
                                  {itIdx + 1}.
                                </span>
                                <strong className="text-slate-900 dark:text-slate-100">
                                  {it.nome_formula}
                                </strong>
                                {it.via && <span>(Via {it.via})</span>}
                                {it.posologia && <span>— {it.posologia}</span>}
                              </div>
                            ))}
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

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#004d40] hover:bg-[#003830] disabled:opacity-50 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Assinando e Gravando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Salvar e Assinar POP (SHA-256)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
