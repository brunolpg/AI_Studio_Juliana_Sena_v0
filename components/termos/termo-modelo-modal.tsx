"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  FileSignature,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { saveTermoModelo } from "@/app/actions/termos";
import { useToast } from "@/components/ui/toast";
import {
  DEFAULT_DECLARACAO_ORDEM,
  normalizeDeclaracaoOrdem,
} from "@/lib/validations/termo";
import type {
  TermoDeclaracaoBloco,
  TermoModelo,
  TermoProcedimento,
} from "@/types/termo";

interface TermoModeloModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelos: TermoModelo[];
  procedimentos: TermoProcedimento[];
  initialModeloId?: string | null;
  onSaved: (modeloSalvo: TermoModelo) => void;
}

interface DraftTopico {
  localId: string;
  titulo: string;
  texto_topico: string;
  linhas_checkbox: string[];
}

interface DraftDeclaracaoCheckboxItem {
  localId: string;
  texto: string;
}

interface DraftDeclaracao {
  titulo: string;
  texto_topico: string;
  linhas_checkbox: DraftDeclaracaoCheckboxItem[];
  ordem_blocos: TermoDeclaracaoBloco[];
}

const DEFAULT_DECLARACAO_TITULO = "Declaração de Consentimento";

function createLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildEmptyTopico(): DraftTopico {
  return {
    localId: createLocalId(),
    titulo: "",
    texto_topico: "",
    linhas_checkbox: [],
  };
}

function buildEmptyDeclaracao(): DraftDeclaracao {
  return {
    titulo: DEFAULT_DECLARACAO_TITULO,
    texto_topico: "",
    linhas_checkbox: [],
    ordem_blocos: [...DEFAULT_DECLARACAO_ORDEM],
  };
}

export function TermoModeloModal({
  isOpen,
  onClose,
  modelos,
  procedimentos,
  initialModeloId = null,
  onSaved,
}: TermoModeloModalProps) {
  const { toast } = useToast();

  const [selectedModeloKey, setSelectedModeloKey] = useState<string>("__new__");
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [titulo, setTitulo] = useState<string>("");
  const [topicos, setTopicos] = useState<DraftTopico[]>([buildEmptyTopico()]);
  const [declaracao, setDeclaracao] = useState<DraftDeclaracao>(
    buildEmptyDeclaracao()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadModeloIntoForm = (modelo: TermoModelo | null) => {
    setFormError(null);
    if (!modelo) {
      setSelectedModeloKey("__new__");
      setProcedimentoId("");
      setTitulo("");
      setTopicos([buildEmptyTopico()]);
      setDeclaracao(buildEmptyDeclaracao());
      return;
    }

    setSelectedModeloKey(modelo.id);
    setProcedimentoId(modelo.procedimento_id || "");
    setTitulo(modelo.titulo || "");
    setTopicos(
      modelo.topicos && modelo.topicos.length > 0
        ? [...modelo.topicos]
            .sort((a, b) => a.ordem - b.ordem)
            .map((t) => ({
              localId: t.id || createLocalId(),
              titulo: t.titulo || "",
              texto_topico: t.texto_topico || "",
              linhas_checkbox: Array.isArray(t.linhas_checkbox)
                ? [...t.linhas_checkbox]
                : [],
            }))
        : [buildEmptyTopico()]
    );
    setDeclaracao(
      modelo.declaracao
        ? {
            titulo: modelo.declaracao.titulo || DEFAULT_DECLARACAO_TITULO,
            texto_topico: modelo.declaracao.texto_topico || "",
            linhas_checkbox: Array.isArray(modelo.declaracao.linhas_checkbox)
              ? modelo.declaracao.linhas_checkbox.map((texto) => ({
                  localId: createLocalId(),
                  texto: String(texto),
                }))
              : [],
            ordem_blocos: normalizeDeclaracaoOrdem(
              modelo.declaracao.ordem_blocos
            ),
          }
        : buildEmptyDeclaracao()
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    if (initialModeloId) {
      const found = modelos.find((m) => m.id === initialModeloId) || null;
      loadModeloIntoForm(found);
    } else {
      loadModeloIntoForm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialModeloId]);

  if (!isOpen) return null;

  const handleSelectModeloChange = (value: string) => {
    if (value === "__new__") {
      loadModeloIntoForm(null);
      return;
    }
    const found = modelos.find((m) => m.id === value) || null;
    loadModeloIntoForm(found);
  };

  const handleProcedimentoChange = (nextProcId: string) => {
    setProcedimentoId(nextProcId);
    if (selectedModeloKey === "__new__" && !titulo.trim()) {
      const proc = procedimentos.find((p) => p.id === nextProcId);
      if (proc) {
        setTitulo(`Termo de Consentimento — ${proc.procedimento}`);
      }
    }
  };

  // --- Manipulação de Tópicos ---
  const handleAddTopico = () => {
    setTopicos((prev) => [...prev, buildEmptyTopico()]);
  };

  const handleRemoveTopico = (localId: string) => {
    setTopicos((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((t) => t.localId !== localId);
    });
  };

  const handleMoveTopico = (index: number, direction: "up" | "down") => {
    setTopicos((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  };

  const handleUpdateTopicoField = (
    localId: string,
    field: "titulo" | "texto_topico",
    value: string
  ) => {
    setTopicos((prev) =>
      prev.map((t) => (t.localId === localId ? { ...t, [field]: value } : t))
    );
  };

  const handleAddTopicoCheckbox = (localId: string) => {
    setTopicos((prev) =>
      prev.map((t) =>
        t.localId === localId
          ? { ...t, linhas_checkbox: [...t.linhas_checkbox, ""] }
          : t
      )
    );
  };

  const handleUpdateTopicoCheckbox = (
    localId: string,
    cbIndex: number,
    value: string
  ) => {
    setTopicos((prev) =>
      prev.map((t) => {
        if (t.localId !== localId) return t;
        const next = [...t.linhas_checkbox];
        next[cbIndex] = value;
        return { ...t, linhas_checkbox: next };
      })
    );
  };

  const handleRemoveTopicoCheckbox = (localId: string, cbIndex: number) => {
    setTopicos((prev) =>
      prev.map((t) => {
        if (t.localId !== localId) return t;
        return {
          ...t,
          linhas_checkbox: t.linhas_checkbox.filter((_, i) => i !== cbIndex),
        };
      })
    );
  };

  // --- Manipulação da Declaração ---
  const handleMoveDeclaracaoBloco = (
    index: number,
    direction: "up" | "down"
  ) => {
    setDeclaracao((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.ordem_blocos.length) {
        return prev;
      }
      const nextOrdem = [...prev.ordem_blocos];
      const [moved] = nextOrdem.splice(index, 1);
      nextOrdem.splice(targetIndex, 0, moved);
      return {
        ...prev,
        ordem_blocos: nextOrdem,
      };
    });
  };

  const handleAddDeclaracaoCheckbox = () => {
    setDeclaracao((prev) => ({
      ...prev,
      linhas_checkbox: [
        ...prev.linhas_checkbox,
        { localId: createLocalId(), texto: "" },
      ],
    }));
  };

  const handleUpdateDeclaracaoCheckbox = (cbIndex: number, value: string) => {
    setDeclaracao((prev) => {
      const next = [...prev.linhas_checkbox];
      if (!next[cbIndex]) return prev;
      next[cbIndex] = { ...next[cbIndex], texto: value };
      return { ...prev, linhas_checkbox: next };
    });
  };

  const handleMoveDeclaracaoCheckbox = (
    cbIndex: number,
    direction: "up" | "down"
  ) => {
    setDeclaracao((prev) => {
      const targetIndex = direction === "up" ? cbIndex - 1 : cbIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.linhas_checkbox.length) {
        return prev;
      }
      const next = [...prev.linhas_checkbox];
      const [moved] = next.splice(cbIndex, 1);
      next.splice(targetIndex, 0, moved);
      return { ...prev, linhas_checkbox: next };
    });
  };

  const handleRemoveDeclaracaoCheckbox = (cbIndex: number) => {
    setDeclaracao((prev) => ({
      ...prev,
      linhas_checkbox: prev.linhas_checkbox.filter((_, i) => i !== cbIndex),
    }));
  };

  // --- Salvar ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!procedimentoId) {
      setFormError("Selecione o procedimento associado a este modelo.");
      return;
    }

    const sanitizedTopicos = topicos.map((t, index) => ({
      ordem: index + 1,
      titulo: t.titulo.trim(),
      texto_topico: t.texto_topico.trim(),
      linhas_checkbox: t.linhas_checkbox
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    }));

    if (sanitizedTopicos.length === 0) {
      setFormError("Adicione ao menos um tópico ao modelo de termo.");
      return;
    }

    for (let i = 0; i < sanitizedTopicos.length; i++) {
      if (!sanitizedTopicos[i].titulo) {
        setFormError(`Informe o título do Tópico ${i + 1}.`);
        return;
      }
      if (!sanitizedTopicos[i].texto_topico) {
        setFormError(`Informe o texto do Tópico ${i + 1}.`);
        return;
      }
    }

    if (!declaracao.titulo.trim()) {
      setFormError("Informe o título da Declaração de Consentimento.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await saveTermoModelo({
        id: selectedModeloKey !== "__new__" ? selectedModeloKey : undefined,
        procedimento_id: procedimentoId,
        titulo: titulo.trim() || undefined,
        topicos: sanitizedTopicos,
        declaracao: {
          titulo: declaracao.titulo.trim(),
          texto_topico: declaracao.texto_topico.trim(),
          linhas_checkbox: declaracao.linhas_checkbox
            .map((c) => c.texto.trim())
            .filter((c) => c.length > 0),
          ordem_blocos: declaracao.ordem_blocos,
        },
      });

      if (!res.success || !res.data) {
        const msg = res.error || "Não foi possível salvar o modelo de termo.";
        setFormError(msg);
        toast({
          type: "error",
          title: "Erro ao salvar modelo",
          description: msg,
        });
        return;
      }

      toast({
        type: "success",
        title:
          selectedModeloKey !== "__new__"
            ? "Modelo atualizado!"
            : "Modelo criado com sucesso!",
        description: `O modelo "${res.data.titulo}" já está disponível para uso.`,
      });

      onSaved(res.data);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro inesperado ao salvar modelo de termo.";
      setFormError(msg);
      toast({
        type: "error",
        title: "Erro inesperado",
        description: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-on-surface/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="termo-modelo-modal-title"
    >
      <div className="w-full max-w-3xl max-h-[85dvh] flex flex-col bg-surface-container-lowest rounded-md-2xl border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="termo-modelo-modal-title"
                className="text-sm sm:text-base font-bold text-on-surface truncate"
              >
                Modelos de Termo de Consentimento
              </h3>
              <p className="text-xs text-on-surface-variant truncate">
                Crie ou edite modelos reutilizáveis vinculados aos procedimentos da clínica
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
            aria-label="Fechar modal de modelos"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <form
          id="termo-modelo-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-5"
        >
          {formError && (
            <div className="p-3.5 rounded-md-md bg-error-container text-on-error-container border border-error/30 text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Seletor de Modelo Existente ou Novo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-md-lg bg-surface-container-low border border-outline-variant">
            <div className="space-y-1.5">
              <label
                htmlFor="termo-modelo-selector"
                className="text-xs font-bold text-on-surface uppercase tracking-wider block"
              >
                Modelo Selecionado
              </label>
              <select
                id="termo-modelo-selector"
                value={selectedModeloKey}
                onChange={(e) => handleSelectModeloChange(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="__new__">+ Criar novo modelo</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.procedimento?.procedimento
                      ? `${m.procedimento.procedimento} — ${m.titulo}`
                      : m.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="termo-modelo-procedimento"
                className="text-xs font-bold text-on-surface uppercase tracking-wider block"
              >
                Procedimento *
              </label>
              <select
                id="termo-modelo-procedimento"
                value={procedimentoId}
                onChange={(e) => handleProcedimentoChange(e.target.value)}
                required
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              >
                <option value="">Selecione um procedimento...</option>
                {procedimentos.map((proc) => (
                  <option key={proc.id} value={proc.id}>
                    {proc.procedimento}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label
                htmlFor="termo-modelo-titulo"
                className="text-xs font-bold text-on-surface uppercase tracking-wider block"
              >
                Título do Modelo (opcional)
              </label>
              <input
                id="termo-modelo-titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Termo de Consentimento — Toxina Botulínica"
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          {/* Seção de Tópicos */}
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-on-surface">
                  Tópicos do Termo ({topicos.length})
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Organize os esclarecimentos clínicos e adicione caixas de confirmação quando necessário.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {topicos.map((topico, idx) => (
                <div
                  key={topico.localId}
                  className="p-4 rounded-md-lg bg-surface-container-low border border-outline-variant space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/70">
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-primary">
                      <span className="w-6 h-6 rounded-md-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      Tópico {idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveTopico(idx, "up")}
                        disabled={idx === 0}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 cursor-pointer transition-colors"
                        title="Mover tópico para cima"
                        aria-label={`Mover tópico ${idx + 1} para cima`}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTopico(idx, "down")}
                        disabled={idx === topicos.length - 1}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 cursor-pointer transition-colors"
                        title="Mover tópico para baixo"
                        aria-label={`Mover tópico ${idx + 1} para baixo`}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopico(topico.localId)}
                        disabled={topicos.length <= 1}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-error hover:bg-error-container disabled:opacity-35 cursor-pointer transition-colors"
                        title="Remover tópico"
                        aria-label={`Remover tópico ${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface block">
                      Título do Tópico *
                    </label>
                    <input
                      type="text"
                      value={topico.titulo}
                      onChange={(e) =>
                        handleUpdateTopicoField(
                          topico.localId,
                          "titulo",
                          e.target.value
                        )
                      }
                      placeholder="Ex: Natureza e Objetivo do Procedimento"
                      required
                      className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface block">
                      Texto Explicativo *
                    </label>
                    <textarea
                      value={topico.texto_topico}
                      onChange={(e) =>
                        handleUpdateTopicoField(
                          topico.localId,
                          "texto_topico",
                          e.target.value
                        )
                      }
                      placeholder="Descreva os esclarecimentos, riscos, benefícios ou cuidados pertinentes a este tópico..."
                      rows={3}
                      required
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
                    />
                  </div>

                  {/* Linhas com Checkbox do Tópico */}
                  <div className="space-y-2 pt-1">
                    {topico.linhas_checkbox.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                          Linhas com Checkbox ({topico.linhas_checkbox.length})
                        </span>
                        {topico.linhas_checkbox.map((line, cbIdx) => (
                          <div
                            key={`${topico.localId}-cb-${cbIdx}`}
                            className="flex items-center gap-2"
                          >
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                            <input
                              type="text"
                              value={line}
                              onChange={(e) =>
                                handleUpdateTopicoCheckbox(
                                  topico.localId,
                                  cbIdx,
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Compreendo que os resultados variam conforme resposta individual."
                              className="flex-1 min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveTopicoCheckbox(topico.localId, cbIdx)
                              }
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-error hover:bg-error-container transition-colors cursor-pointer shrink-0"
                              aria-label="Remover linha com checkbox"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAddTopicoCheckbox(topico.localId)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-md-full text-xs font-semibold text-primary bg-primary-container/50 hover:bg-primary-container border border-primary/25 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>Adicionar linha com checkbox</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddTopico}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Adicionar Tópico</span>
            </button>
          </div>

          {/* Seção Declaração de Consentimento */}
          <div className="p-4 sm:p-5 rounded-md-lg bg-primary-container/30 border-2 border-primary/40 space-y-3.5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-primary/25">
              <div className="w-8 h-8 rounded-md-md bg-primary text-on-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">
                  Declaração de Consentimento
                </h4>
                <p className="text-xs text-on-surface-variant">
                  Bloco final exibido em destaque acima da assinatura do paciente no PDF.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface block">
                Título da Declaração *
              </label>
              <input
                type="text"
                value={declaracao.titulo}
                onChange={(e) =>
                  setDeclaracao((prev) => ({ ...prev, titulo: e.target.value }))
                }
                required
                className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Blocos Reordenáveis da Declaração: Texto da Declaração <-> Confirmações */}
            <div className="space-y-3">
              {declaracao.ordem_blocos.map((bloco, blocoIdx) => {
                const isTexto = bloco === "texto";
                const blocoLabel = isTexto
                  ? "Texto da Declaração (opcional)"
                  : `Confirmações da Declaração (${declaracao.linhas_checkbox.length})`;

                return (
                  <div
                    key={bloco}
                    className="p-3.5 sm:p-4 rounded-md-md bg-surface-container-low border border-outline-variant space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/70">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface min-w-0">
                        <span className="w-6 h-6 rounded-md-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold shrink-0">
                          {blocoIdx + 1}
                        </span>
                        <span className="truncate">{blocoLabel}</span>
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveDeclaracaoBloco(blocoIdx, "up")
                          }
                          disabled={blocoIdx === 0}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 cursor-pointer transition-colors"
                          title={
                            isTexto
                              ? "Mover Texto da Declaração para cima"
                              : "Mover Confirmações da Declaração para cima"
                          }
                          aria-label={
                            isTexto
                              ? "Mover bloco Texto da Declaração para cima"
                              : "Mover bloco Confirmações da Declaração para cima"
                          }
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleMoveDeclaracaoBloco(blocoIdx, "down")
                          }
                          disabled={
                            blocoIdx === declaracao.ordem_blocos.length - 1
                          }
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 cursor-pointer transition-colors"
                          title={
                            isTexto
                              ? "Mover Texto da Declaração para baixo"
                              : "Mover Confirmações da Declaração para baixo"
                          }
                          aria-label={
                            isTexto
                              ? "Mover bloco Texto da Declaração para baixo"
                              : "Mover bloco Confirmações da Declaração para baixo"
                          }
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isTexto ? (
                      <textarea
                        value={declaracao.texto_topico}
                        onChange={(e) =>
                          setDeclaracao((prev) => ({
                            ...prev,
                            texto_topico: e.target.value,
                          }))
                        }
                        placeholder="Ex: Declaro que li e compreendi todas as informações contidas neste termo, tive todas as minhas dúvidas esclarecidas e autorizo a realização do procedimento..."
                        rows={3}
                        aria-label="Texto da Declaração"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
                      />
                    ) : (
                      <div className="space-y-2.5">
                        {declaracao.linhas_checkbox.length > 0 && (
                          <div className="space-y-2">
                            {declaracao.linhas_checkbox.map((item, cbIdx) => (
                              <div
                                key={item.localId}
                                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-0 rounded-md-md bg-surface-container-lowest sm:bg-transparent border border-outline-variant/60 sm:border-0"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                                  <input
                                    type="text"
                                    value={item.texto}
                                    onChange={(e) =>
                                      handleUpdateDeclaracaoCheckbox(
                                        cbIdx,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Ex: Autorizo a realização do procedimento proposto."
                                    className="flex-1 min-w-0 min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveDeclaracaoCheckbox(cbIdx, "up")
                                    }
                                    disabled={cbIdx === 0}
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 transition-colors cursor-pointer shrink-0"
                                    title="Mover confirmação para cima"
                                    aria-label={`Mover confirmação ${cbIdx + 1} para cima`}
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMoveDeclaracaoCheckbox(
                                        cbIdx,
                                        "down"
                                      )
                                    }
                                    disabled={
                                      cbIdx ===
                                      declaracao.linhas_checkbox.length - 1
                                    }
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high disabled:opacity-35 transition-colors cursor-pointer shrink-0"
                                    title="Mover confirmação para baixo"
                                    aria-label={`Mover confirmação ${cbIdx + 1} para baixo`}
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveDeclaracaoCheckbox(cbIdx)
                                    }
                                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-error hover:bg-error-container transition-colors cursor-pointer shrink-0"
                                    title="Remover confirmação da declaração"
                                    aria-label={`Remover confirmação ${cbIdx + 1} da declaração`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleAddDeclaracaoCheckbox}
                          className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-md-full text-xs font-semibold text-on-primary-container bg-primary-container hover:opacity-90 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Adicionar linha com checkbox</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] px-5 rounded-md-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="termo-modelo-form"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 shrink-0" />
                <span>Salvar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
