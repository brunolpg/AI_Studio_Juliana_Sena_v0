"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Search,
  Check,
  ChevronDown,
  FileSignature,
  UploadCloud,
  ShieldCheck,
  Loader2,
  User,
  CheckSquare,
  Square,
} from "lucide-react";
import { uploadTermoAssinadoAction } from "@/app/actions/termos";
import { useToast } from "@/components/ui/toast";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { TermoModeloModal } from "./termo-modelo-modal";
import type { Client } from "@/types/client";
import type {
  TermoConsentimento,
  TermoModelo,
  TermoProcedimento,
  TermoSnapshot,
} from "@/types/termo";

interface TermoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  modelos: TermoModelo[];
  procedimentos: TermoProcedimento[];
  onModeloSaved: (modelo: TermoModelo) => void;
  onSuccess: (termo: TermoConsentimento) => void;
}

const MAX_UPLOAD_PDF_BYTES = 10 * 1024 * 1024; // 10MB

function formatCpf(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

export function TermoFormModal({
  isOpen,
  onClose,
  client,
  modelos,
  procedimentos,
  onModeloSaved,
  onSuccess,
}: TermoFormModalProps) {
  const { toast } = useToast();
  const signatureRef = useRef<SignaturePadHandle>(null);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedModeloId, setSelectedModeloId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isComboboxOpen, setIsComboboxOpen] = useState<boolean>(false);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [hasSignature, setHasSignature] = useState<boolean>(false);

  const [isModeloModalOpen, setIsModeloModalOpen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);

  const selectedModelo = useMemo(
    () => modelos.find((m) => m.id === selectedModeloId) || null,
    [modelos, selectedModeloId]
  );

  const filteredModelos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modelos;
    return modelos.filter((m) => {
      const procName = (m.procedimento?.procedimento || "").toLowerCase();
      const titulo = (m.titulo || "").toLowerCase();
      return procName.includes(q) || titulo.includes(q);
    });
  }, [modelos, searchQuery]);

  // Lista de todas as chaves de checkboxes obrigatórios do modelo selecionado
  const requiredCheckboxKeys = useMemo(() => {
    if (!selectedModelo) return [];
    const keys: string[] = [];
    const sortedTopicos = [...(selectedModelo.topicos || [])].sort(
      (a, b) => a.ordem - b.ordem
    );
    sortedTopicos.forEach((t, tIdx) => {
      (t.linhas_checkbox || []).forEach((line, cIdx) => {
        if (line.trim()) keys.push(`topico-${tIdx}-${cIdx}`);
      });
    });
    if (selectedModelo.declaracao) {
      (selectedModelo.declaracao.linhas_checkbox || []).forEach((line, cIdx) => {
        if (line.trim()) keys.push(`declaracao-${cIdx}`);
      });
    }
    return keys;
  }, [selectedModelo]);

  const checkedCount = useMemo(
    () => requiredCheckboxKeys.filter((k) => Boolean(checkedMap[k])).length,
    [requiredCheckboxKeys, checkedMap]
  );

  // Reset ao abrir modal
  useEffect(() => {
    if (!isOpen) return;
    setSelectedModeloId("");
    setSearchQuery("");
    setIsComboboxOpen(false);
    setCheckedMap({});
    setHasSignature(false);
    setFormError(null);
    setSignatureError(null);
    signatureRef.current?.clear();
  }, [isOpen, client?.id]);

  // Fecha combobox ao clicar fora
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        comboboxRef.current &&
        !comboboxRef.current.contains(e.target as Node)
      ) {
        setIsComboboxOpen(false);
      }
    }
    if (isComboboxOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isComboboxOpen]);

  if (!isOpen) return null;

  const selectModelo = (modelo: TermoModelo) => {
    setSelectedModeloId(modelo.id);
    setSearchQuery(
      modelo.procedimento?.procedimento
        ? `${modelo.procedimento.procedimento} — ${modelo.titulo}`
        : modelo.titulo
    );
    setIsComboboxOpen(false);
    setCheckedMap({});
    setFormError(null);
  };

  const toggleCheckbox = (key: string) => {
    setCheckedMap((prev) => ({ ...prev, [key]: !prev[key] }));
    setFormError(null);
  };

  const buildSnapshotFromSelectedModelo = (): TermoSnapshot | null => {
    if (!selectedModelo) return null;
    const sortedTopicos = [...(selectedModelo.topicos || [])].sort(
      (a, b) => a.ordem - b.ordem
    );

    return {
      titulo: selectedModelo.titulo || "Termo de Consentimento Livre e Esclarecido",
      procedimento:
        selectedModelo.procedimento?.procedimento ||
        selectedModelo.titulo ||
        "Procedimento Estético",
      topicos: sortedTopicos.map((t, tIdx) => ({
        ordem: tIdx + 1,
        titulo: t.titulo,
        texto_topico: t.texto_topico,
        linhas_checkbox: (t.linhas_checkbox || [])
          .filter((line) => line.trim().length > 0)
          .map((line, cIdx) => ({
            texto: line.trim(),
            marcado: Boolean(checkedMap[`topico-${tIdx}-${cIdx}`]),
          })),
      })),
      declaracao: selectedModelo.declaracao
        ? {
            titulo:
              selectedModelo.declaracao.titulo || "Declaração de Consentimento",
            texto_topico: selectedModelo.declaracao.texto_topico,
            linhas_checkbox: (selectedModelo.declaracao.linhas_checkbox || [])
              .filter((line) => line.trim().length > 0)
              .map((line, cIdx) => ({
                texto: line.trim(),
                marcado: Boolean(checkedMap[`declaracao-${cIdx}`]),
              })),
          }
        : null,
    };
  };

  const handleGenerateSignedPdf = async () => {
    setFormError(null);
    setSignatureError(null);

    if (!selectedModelo) {
      setFormError("Selecione um modelo de termo de consentimento antes de gerar.");
      return;
    }

    if (
      requiredCheckboxKeys.length > 0 &&
      checkedCount < requiredCheckboxKeys.length
    ) {
      setFormError(
        `Marque todas as confirmações obrigatórias (${checkedCount} de ${requiredCheckboxKeys.length} marcadas) antes de assinar.`
      );
      return;
    }

    const signatureDataUrl = signatureRef.current?.toDataURL() || null;
    if (!signatureDataUrl) {
      setSignatureError("A assinatura do paciente é obrigatória.");
      setFormError("Solicite a assinatura do paciente no campo abaixo.");
      return;
    }

    const snapshot = buildSnapshotFromSelectedModelo();
    if (!snapshot) return;

    const procedimentoNome =
      selectedModelo.procedimento?.procedimento || selectedModelo.titulo;

    try {
      setIsGenerating(true);
      const response = await fetch("/api/termos/gerar-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          paciente_id: client.id,
          modelo_id: selectedModelo.id,
          procedimento_nome: procedimentoNome,
          conteudo_snapshot: snapshot,
          signature_data_url: signatureDataUrl,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.termo) {
        const msg =
          data?.error || "Não foi possível gerar o termo de consentimento assinado.";
        setFormError(msg);
        toast({
          type: "error",
          title: "Erro ao gerar termo",
          description: msg,
        });
        return;
      }

      toast({
        type: "success",
        title: "Termo assinado gerado com sucesso!",
        description: `PDF salvo no prontuário de ${client.nome}.`,
      });

      onSuccess(data.termo as TermoConsentimento);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Falha de comunicação ao gerar o PDF do termo.";
      setFormError(msg);
      toast({
        type: "error",
        title: "Erro inesperado",
        description: msg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTriggerUploadClick = () => {
    setFormError(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    // Reseta o input para permitir selecionar o mesmo arquivo novamente se necessário
    e.target.value = "";
    if (!file) return;

    setFormError(null);

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      const msg = "Selecione um arquivo no formato PDF (.pdf).";
      setFormError(msg);
      toast({ type: "error", title: "Formato inválido", description: msg });
      return;
    }

    if (file.size > MAX_UPLOAD_PDF_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `O arquivo (${sizeMb}MB) excede o limite máximo de 10MB.`;
      setFormError(msg);
      toast({ type: "error", title: "Arquivo muito grande", description: msg });
      return;
    }

    const fallbackName = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    const procedimentoNome =
      selectedModelo?.procedimento?.procedimento ||
      selectedModelo?.titulo ||
      fallbackName ||
      "Termo de Consentimento Assinado";

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("paciente_id", client.id);
      if (selectedModelo?.id) {
        formData.append("modelo_id", selectedModelo.id);
        const snapshot = buildSnapshotFromSelectedModelo();
        if (snapshot) {
          formData.append("conteudo_snapshot", JSON.stringify(snapshot));
        }
      }
      formData.append("procedimento_nome", procedimentoNome);

      const res = await uploadTermoAssinadoAction(formData);
      if (!res.success || !res.data) {
        const msg = res.error || "Não foi possível enviar o termo assinado.";
        setFormError(msg);
        toast({
          type: "error",
          title: "Erro no upload",
          description: msg,
        });
        return;
      }

      toast({
        type: "success",
        title: "Termo assinado anexado!",
        description: `O PDF foi vinculado ao prontuário de ${client.nome}.`,
      });

      onSuccess(res.data);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro inesperado ao enviar o arquivo PDF.";
      setFormError(msg);
      toast({
        type: "error",
        title: "Erro inesperado",
        description: msg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const sortedTopicos = selectedModelo
    ? [...(selectedModelo.topicos || [])].sort((a, b) => a.ordem - b.ordem)
    : [];

  const isBusy = isGenerating || isUploading;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-on-surface/50 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="termo-form-modal-title"
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
                  id="termo-form-modal-title"
                  className="text-sm sm:text-base font-bold text-on-surface truncate"
                >
                  Novo Termo de Consentimento
                </h3>
                <p className="text-xs text-on-surface-variant truncate">
                  Selecione o modelo, confirme as cláusulas e colete a assinatura ou envie o PDF assinado
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
              aria-label="Fechar modal de novo termo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Corpo Rolável */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-5">
            {formError && (
              <div className="p-3.5 rounded-md-md bg-error-container text-on-error-container border border-error/30 text-xs font-medium">
                {formError}
              </div>
            )}

            {/* Paciente Selecionado em Destaque (Somente Leitura) */}
            <div className="p-4 rounded-md-lg bg-primary-container/40 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-on-primary-container uppercase tracking-wider block">
                    Paciente Selecionado
                  </span>
                  <span className="text-sm sm:text-base font-bold text-on-surface block truncate">
                    {client.nome}
                  </span>
                </div>
              </div>
              <div className="text-xs text-on-surface-variant sm:text-right shrink-0">
                <span className="font-semibold text-on-surface block">
                  CPF: {formatCpf(client.cpf)}
                </span>
                {client.telefone && (
                  <span className="block">{client.telefone}</span>
                )}
              </div>
            </div>

            {/* Combobox com Busca + Botão "+" para Criar Modelo */}
            <div className="space-y-1.5">
              <label
                htmlFor="termo-modelo-combobox"
                className="text-xs font-bold text-on-surface uppercase tracking-wider block"
              >
                Modelo de Termo / Procedimento
              </label>
              <div className="flex items-stretch gap-2">
                <div ref={comboboxRef} className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="termo-modelo-combobox"
                    type="text"
                    value={searchQuery}
                    onFocus={() => setIsComboboxOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsComboboxOpen(true);
                      if (!e.target.value.trim()) {
                        setSelectedModeloId("");
                      }
                    }}
                    placeholder="Buscar ou selecionar modelo de termo..."
                    autoComplete="off"
                    className="w-full min-h-[44px] pl-10 pr-10 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setIsComboboxOpen((prev) => !prev)}
                    className="absolute right-0 top-0 bottom-0 min-w-[44px] flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                    aria-label="Abrir lista de modelos"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        isComboboxOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isComboboxOpen && (
                    <div className="absolute z-30 left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-md-lg bg-surface-container-lowest border border-outline-variant shadow-xl divide-y divide-outline-variant/60">
                      {filteredModelos.length === 0 ? (
                        <div className="p-4 text-center space-y-2">
                          <p className="text-xs text-on-surface-variant">
                            Nenhum modelo encontrado para "{searchQuery}".
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsComboboxOpen(false);
                              setIsModeloModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Criar novo modelo</span>
                          </button>
                        </div>
                      ) : (
                        filteredModelos.map((modelo) => {
                          const isSelected = modelo.id === selectedModeloId;
                          return (
                            <button
                              key={modelo.id}
                              type="button"
                              onClick={() => selectModelo(modelo)}
                              className={`w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-primary-container/50 text-on-primary-container"
                                  : "hover:bg-surface-container text-on-surface"
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-semibold block truncate">
                                  {modelo.procedimento?.procedimento || modelo.titulo}
                                </span>
                                {modelo.procedimento?.procedimento && (
                                  <span className="text-[11px] text-on-surface-variant block truncate">
                                    {modelo.titulo}
                                  </span>
                                )}
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsModeloModalOpen(true)}
                  disabled={isBusy}
                  className="min-h-[44px] min-w-[44px] px-3 flex items-center justify-center rounded-md-md bg-primary-container text-on-primary-container hover:opacity-90 border border-primary/30 transition-all cursor-pointer shrink-0"
                  title="Criar novo modelo de termo"
                  aria-label="Criar novo modelo de termo"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prévia Interativa dos Tópicos + Declaração */}
            {selectedModelo ? (
              <div className="space-y-4">
                {requiredCheckboxKeys.length > 0 && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-md-md bg-surface-container border border-outline-variant text-xs">
                    <span className="font-semibold text-on-surface">
                      Confirmações obrigatórias do paciente
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md-full font-bold ${
                        checkedCount === requiredCheckboxKeys.length
                          ? "bg-success-container text-on-success-container"
                          : "bg-warning-container text-on-warning-container"
                      }`}
                    >
                      {checkedCount} / {requiredCheckboxKeys.length}
                    </span>
                  </div>
                )}

                {/* Tópicos Enumerados */}
                <div className="space-y-3">
                  {sortedTopicos.map((topico, tIdx) => {
                    const checkboxes = (topico.linhas_checkbox || []).filter(
                      (l) => l.trim().length > 0
                    );
                    return (
                      <div
                        key={topico.id || tIdx}
                        className="p-4 rounded-md-lg bg-surface-container-low border border-outline-variant space-y-2.5"
                      >
                        <h4 className="text-sm font-bold text-primary">
                          {tIdx + 1}. {topico.titulo}
                        </h4>
                        <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line">
                          {topico.texto_topico}
                        </p>

                        {checkboxes.length > 0 && (
                          <div className="pt-2 space-y-1.5 border-t border-outline-variant/60">
                            {checkboxes.map((line, cIdx) => {
                              const key = `topico-${tIdx}-${cIdx}`;
                              const checked = Boolean(checkedMap[key]);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  role="checkbox"
                                  aria-checked={checked}
                                  onClick={() => toggleCheckbox(key)}
                                  className={`w-full min-h-[44px] px-3 py-2 rounded-md-md border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                                    checked
                                      ? "bg-primary-container/40 border-primary/40 text-on-surface"
                                      : "bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container"
                                  }`}
                                >
                                  {checked ? (
                                    <CheckSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                  ) : (
                                    <Square className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
                                  )}
                                  <span className="text-xs sm:text-sm leading-snug">
                                    {line}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Declaração de Consentimento (Destacada) */}
                {selectedModelo.declaracao && (
                  <div className="p-4 sm:p-5 rounded-md-lg bg-primary-container/35 border-2 border-primary/50 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <ShieldCheck className="w-5 h-5 shrink-0" />
                      <h4 className="text-sm sm:text-base font-bold text-on-surface">
                        {selectedModelo.declaracao.titulo ||
                          "Declaração de Consentimento"}
                      </h4>
                    </div>

                    <p className="text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line">
                      {selectedModelo.declaracao.texto_topico}
                    </p>

                    {(selectedModelo.declaracao.linhas_checkbox || []).filter(
                      (l) => l.trim().length > 0
                    ).length > 0 && (
                      <div className="pt-2 space-y-1.5 border-t border-primary/25">
                        {(selectedModelo.declaracao.linhas_checkbox || [])
                          .filter((l) => l.trim().length > 0)
                          .map((line, cIdx) => {
                            const key = `declaracao-${cIdx}`;
                            const checked = Boolean(checkedMap[key]);
                            return (
                              <button
                                key={key}
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                onClick={() => toggleCheckbox(key)}
                                className={`w-full min-h-[44px] px-3 py-2 rounded-md-md border text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                                  checked
                                    ? "bg-primary-container border-primary text-on-primary-container"
                                    : "bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container"
                                }`}
                              >
                                {checked ? (
                                  <CheckSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
                                )}
                                <span className="text-xs sm:text-sm font-medium leading-snug">
                                  {line}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-md-lg bg-surface-container-low border border-dashed border-outline-variant text-center space-y-1.5">
                <p className="text-xs sm:text-sm font-semibold text-on-surface">
                  Nenhum modelo selecionado
                </p>
                <p className="text-xs text-on-surface-variant">
                  Escolha um modelo no campo acima para preencher e assinar digitalmente, ou utilize &ldquo;Carregar Termo Assinado&rdquo; para anexar um PDF já assinado.
                </p>
              </div>
            )}

            {/* Assinatura Digital com Caneta / Toque / Mouse */}
            <div className="pt-2 border-t border-outline-variant">
              <SignaturePad
                ref={signatureRef}
                disabled={isBusy}
                error={signatureError}
                onChange={(signed) => {
                  setHasSignature(signed);
                  if (signed) setSignatureError(null);
                }}
              />
            </div>

            {/* Input Oculto para Upload de PDF Assinado */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelected}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {/* Rodapé com 2 Botões Principais */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low shrink-0">
            <button
              type="button"
              onClick={handleTriggerUploadClick}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-md-full text-xs font-semibold bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enviando PDF...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 shrink-0" />
                  <span>Carregar Termo Assinado</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleGenerateSignedPdf}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Gerando Termo Assinado...</span>
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4 shrink-0" />
                  <span>Gerar Termo Assinado</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Criação de Modelo (aberto pelo botão "+") */}
      <TermoModeloModal
        isOpen={isModeloModalOpen}
        onClose={() => setIsModeloModalOpen(false)}
        modelos={modelos}
        procedimentos={procedimentos}
        initialModeloId={null}
        onSaved={(modeloSalvo) => {
          onModeloSaved(modeloSalvo);
          selectModelo(modeloSalvo);
        }}
      />
    </>
  );
}
