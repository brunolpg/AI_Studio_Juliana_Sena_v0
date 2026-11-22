"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Search,
  Check,
  ChevronDown,
  FileSignature,
  FileText,
  UploadCloud,
  ShieldCheck,
  Loader2,
  User,
  CheckSquare,
  Square,
  PenTool,
  Calendar,
  Trash2,
} from "lucide-react";
import { uploadTermoAssinadoAction } from "@/app/actions/termos";
import { useToast } from "@/components/ui/toast";
import { normalizeDeclaracaoOrdem } from "@/lib/validations/termo";
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

const MAX_UPLOAD_PDF_BYTES = 1 * 1024 * 1024; // 1MB

function buildFileTooLargeMessage(fileSizeBytes?: number): string {
  if (typeof fileSizeBytes === "number" && fileSizeBytes > 0) {
    const sizeMb = (Math.ceil((fileSizeBytes / (1024 * 1024)) * 100) / 100)
      .toFixed(2)
      .replace(".", ",");
    return `O arquivo selecionado possui ${sizeMb} MB e excede o limite máximo de 1 MB. Reduza ou comprima o PDF antes de anexá-lo.`;
  }
  return "O arquivo selecionado excede o limite máximo de 1 MB. Reduza ou comprima o PDF antes de anexá-lo.";
}

function getTodaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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
  const [signatureOnlyInAttachedPdf, setSignatureOnlyInAttachedPdf] =
    useState<boolean>(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [legacyProcedimentoNome, setLegacyProcedimentoNome] =
    useState<string>("");
  const [legacyTermoData, setLegacyTermoData] = useState<string>(() =>
    getTodaySaoPaulo()
  );

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

  // Lista de todas as chaves de checkboxes do modelo selecionado
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
    setSignatureOnlyInAttachedPdf(false);
    setSelectedPdfFile(null);
    setLegacyProcedimentoNome("");
    setLegacyTermoData(getTodaySaoPaulo());
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
    if (signatureOnlyInAttachedPdf && !legacyProcedimentoNome.trim()) {
      setLegacyProcedimentoNome(
        modelo.procedimento?.procedimento || modelo.titulo || ""
      );
    }
    setIsComboboxOpen(false);
    setCheckedMap({});
    setFormError(null);
  };

  const toggleCheckbox = (key: string) => {
    setCheckedMap((prev) => ({ ...prev, [key]: !prev[key] }));
    setFormError(null);
  };

  const handleToggleSignatureOnlyInAttachedPdf = (checked: boolean) => {
    setSignatureOnlyInAttachedPdf(checked);
    setFormError(null);
    setSignatureError(null);
    if (checked) {
      signatureRef.current?.clear();
      setHasSignature(false);
      if (!legacyProcedimentoNome.trim() && selectedModelo) {
        setLegacyProcedimentoNome(
          selectedModelo.procedimento?.procedimento ||
            selectedModelo.titulo ||
            ""
        );
      }
    } else {
      setSelectedPdfFile(null);
    }
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
            ordem_blocos: normalizeDeclaracaoOrdem(
              selectedModelo.declaracao.ordem_blocos
            ),
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
    setSignatureError(null);
    fileInputRef.current?.click();
  };

  const validatePdfFile = (file: File): string | null => {
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return "Selecione um arquivo no formato PDF (.pdf).";
    }
    if (file.size <= 0) {
      return "O arquivo PDF selecionado está vazio.";
    }
    if (file.size > MAX_UPLOAD_PDF_BYTES) {
      return buildFileTooLargeMessage(file.size);
    }
    return null;
  };

  const submitUploadedPdf = async (file: File) => {
    const validationError = validatePdfFile(file);
    if (validationError) {
      setSelectedPdfFile(null);
      setFormError(validationError);
      setSignatureError(validationError);
      toast({
        type: "error",
        title: "Arquivo excede o limite permitido",
        description: validationError,
      });
      return;
    }

    const fallbackName = file.name
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    const procedimentoNome =
      legacyProcedimentoNome.trim() ||
      selectedModelo?.procedimento?.procedimento ||
      selectedModelo?.titulo ||
      fallbackName ||
      "Termo de Consentimento Assinado";

    const dataFinal = legacyTermoData.trim() || getTodaySaoPaulo();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFinal)) {
      const msg = "Informe uma data válida para o termo.";
      setFormError(msg);
      toast({ type: "error", title: "Data inválida", description: msg });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("paciente_id", client.id);
      formData.append("procedimento_nome", procedimentoNome);
      formData.append("data", dataFinal);
      formData.append("origem_pdf", "upload");
      formData.append("assinatura_apenas_no_pdf", "true");

      if (selectedModelo?.id) {
        formData.append("modelo_id", selectedModelo.id);
      }

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
        title: "Termo antigo registrado com sucesso!",
        description: `O PDF foi vinculado ao prontuário de ${client.nome}.`,
      });

      onSuccess(res.data);
      onClose();
    } catch (err: unknown) {
      const rawMsg =
        err instanceof Error
          ? err.message
          : "Erro inesperado ao enviar o arquivo PDF.";
      const normalizedErr = rawMsg.toLowerCase();
      const isPayloadLimitError =
        normalizedErr.includes("body exceeded") ||
        normalizedErr.includes("unexpected response") ||
        normalizedErr.includes("payload too large") ||
        normalizedErr.includes("413");
      const msg = isPayloadLimitError
        ? buildFileTooLargeMessage(
            file.size > MAX_UPLOAD_PDF_BYTES ? file.size : undefined
          )
        : rawMsg;

      if (isPayloadLimitError) {
        setSelectedPdfFile(null);
        setSignatureError(msg);
      }

      setFormError(msg);
      toast({
        type: "error",
        title: isPayloadLimitError ? "Arquivo excede o limite de 1 MB" : "Erro inesperado",
        description: msg,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitLegacyAttachedPdf = async () => {
    setFormError(null);
    setSignatureError(null);

    if (!selectedPdfFile) {
      setSignatureError(
        "Anexe o arquivo PDF assinado do termo antigo para concluir o registro."
      );
      setFormError(
        'Selecione o PDF assinado do termo antigo na seção "Assinatura do Paciente".'
      );
      return;
    }

    await submitUploadedPdf(selectedPdfFile);
  };

  const processSelectedPdfFile = (file: File) => {
    setFormError(null);
    setSignatureError(null);

    const validationError = validatePdfFile(file);
    if (validationError) {
      setSelectedPdfFile(null);
      setFormError(validationError);
      setSignatureError(validationError);
      toast({
        type: "error",
        title:
          file.size > MAX_UPLOAD_PDF_BYTES
            ? "Arquivo excede o limite de 1 MB"
            : "Arquivo inválido",
        description: validationError,
      });
      return;
    }

    setSelectedPdfFile(file);
    if (!legacyProcedimentoNome.trim()) {
      const fallbackName = file.name
        .replace(/\.pdf$/i, "")
        .replace(/[_-]+/g, " ")
        .trim();
      setLegacyProcedimentoNome(
        selectedModelo?.procedimento?.procedimento ||
          selectedModelo?.titulo ||
          fallbackName
      );
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reseta o input para permitir selecionar o mesmo arquivo novamente se necessário
    e.target.value = "";
    if (!file) return;

    processSelectedPdfFile(file);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    processSelectedPdfFile(file);
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
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-md-md bg-surface-container border border-outline-variant text-xs">
                    <span className="font-semibold text-on-surface">
                      {signatureOnlyInAttachedPdf
                        ? "Cláusulas do modelo (opcionais para termo antigo anexado)"
                        : "Confirmações pendentes pelo paciente"}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md-full font-bold ${
                        signatureOnlyInAttachedPdf
                          ? "bg-primary-container text-on-primary-container"
                          : checkedCount === requiredCheckboxKeys.length
                            ? "bg-success-container text-on-success-container"
                            : "bg-warning-container text-on-warning-container"
                      }`}
                    >
                      {signatureOnlyInAttachedPdf
                        ? "Assinatura no PDF"
                        : `${checkedCount} / ${requiredCheckboxKeys.length}`}
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
                {selectedModelo.declaracao && (() => {
                  const decl = selectedModelo.declaracao;
                  const declTexto = decl.texto_topico?.trim() || "";
                  const declCheckboxes = (decl.linhas_checkbox || []).filter(
                    (l) => l.trim().length > 0
                  );
                  const declOrdem = normalizeDeclaracaoOrdem(decl.ordem_blocos);
                  const visibleBlocks = declOrdem.filter((bloco) =>
                    bloco === "texto"
                      ? declTexto.length > 0
                      : declCheckboxes.length > 0
                  );

                  return (
                    <div className="p-4 sm:p-5 rounded-md-lg bg-primary-container/35 border-2 border-primary/50 space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <h4 className="text-sm sm:text-base font-bold text-on-surface">
                          {decl.titulo || "Declaração de Consentimento"}
                        </h4>
                      </div>

                      {visibleBlocks.map((bloco, idx) => {
                        const dividerClass =
                          idx > 0 ? "pt-2.5 border-t border-primary/25" : "";

                        if (bloco === "texto") {
                          return (
                            <p
                              key="texto"
                              className={`text-xs sm:text-sm text-on-surface leading-relaxed whitespace-pre-line ${dividerClass}`}
                            >
                              {decl.texto_topico}
                            </p>
                          );
                        }

                        return (
                          <div
                            key="confirmacoes"
                            className={`space-y-1.5 ${dividerClass}`}
                          >
                            {declCheckboxes.map((line, cIdx) => {
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
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6 rounded-md-lg bg-surface-container-low border border-dashed border-outline-variant text-center space-y-1.5">
                <p className="text-xs sm:text-sm font-semibold text-on-surface">
                  Nenhum modelo selecionado
                </p>
                <p className="text-xs text-on-surface-variant">
                  {signatureOnlyInAttachedPdf
                    ? "Para termos antigos, selecionar um modelo acima é opcional. Informe os dados do documento e anexe o PDF assinado na seção abaixo."
                    : 'Escolha um modelo no campo acima para preencher e assinar digitalmente, ou marque a opção na seção "Assinatura do Paciente" para anexar um termo antigo já assinado em PDF.'}
                </p>
              </div>
            )}

            {/* Seção ASSINATURA DO PACIENTE */}
            <div className="pt-3 border-t border-outline-variant space-y-3">
              {signatureOnlyInAttachedPdf ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PenTool className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                      Assinatura do Paciente
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md-full text-[11px] font-semibold bg-primary-container text-on-primary-container">
                      <UploadCloud className="w-3 h-3 shrink-0" />
                      Assinatura no PDF anexado
                    </span>
                  </div>
                </div>
              ) : (
                <SignaturePad
                  ref={signatureRef}
                  disabled={isBusy}
                  error={signatureError}
                  onChange={(signed) => {
                    setHasSignature(signed);
                    if (signed) setSignatureError(null);
                  }}
                />
              )}

              {/* Checkbox Acessível: Termo Antigo com Assinatura Apenas no PDF Anexado */}
              <label
                htmlFor="termo-assinatura-apenas-pdf"
                className={`flex items-start gap-3 min-h-[44px] p-3.5 rounded-md-lg border transition-colors cursor-pointer select-none ${
                  signatureOnlyInAttachedPdf
                    ? "bg-primary-container/40 border-primary/50 text-on-surface"
                    : "bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container"
                } ${isBusy ? "opacity-60 pointer-events-none" : ""}`}
              >
                <input
                  id="termo-assinatura-apenas-pdf"
                  type="checkbox"
                  checked={signatureOnlyInAttachedPdf}
                  disabled={isBusy}
                  onChange={(e) =>
                    handleToggleSignatureOnlyInAttachedPdf(e.target.checked)
                  }
                  className="sr-only"
                />
                {signatureOnlyInAttachedPdf ? (
                  <CheckSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-on-surface-variant shrink-0 mt-0.5" />
                )}
                <span className="space-y-0.5 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-on-surface block leading-snug">
                    A assinatura do paciente consta apenas no termo antigo que será anexado
                  </span>
                  <span className="text-[11px] sm:text-xs text-on-surface-variant block leading-relaxed">
                    Dispensa o desenho na tela e registra o documento antigo diretamente pelo PDF já assinado (origem: upload).
                  </span>
                </span>
              </label>

              {/* Painel de Registro de Termo Antigo Anexado */}
              {signatureOnlyInAttachedPdf && (
                <div className="p-4 rounded-md-lg bg-surface-container-low border border-outline-variant space-y-4">
                  <div className="flex items-start gap-2.5 p-3 rounded-md-md bg-primary-container/35 border border-primary/30 text-xs text-on-surface">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      O traçado em tela foi desabilitado. Informe o procedimento e a data original do termo antigo e anexe o arquivo PDF assinado para salvar com status{" "}
                      <strong className="font-bold">Assinado</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="termo-antigo-procedimento"
                        className="text-xs font-bold text-on-surface uppercase tracking-wider block"
                      >
                        Procedimento / Título do Termo
                      </label>
                      <input
                        id="termo-antigo-procedimento"
                        type="text"
                        value={legacyProcedimentoNome}
                        disabled={isBusy}
                        onChange={(e) => {
                          setLegacyProcedimentoNome(e.target.value);
                          setFormError(null);
                        }}
                        placeholder="Ex.: Harmonização Facial, PEIM..."
                        className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="termo-antigo-data"
                        className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>Data do Termo (Retroativa ou Atual)</span>
                      </label>
                      <input
                        id="termo-antigo-data"
                        type="date"
                        value={legacyTermoData}
                        disabled={isBusy}
                        onChange={(e) => {
                          setLegacyTermoData(e.target.value);
                          setFormError(null);
                        }}
                        className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-md-md border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Área do Arquivo PDF Anexado */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                      Arquivo PDF Assinado
                    </span>

                    {selectedPdfFile ? (
                      <div className="p-3.5 rounded-md-md bg-surface-container-lowest border border-primary/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md-md bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-on-surface block truncate">
                              {selectedPdfFile.name}
                            </span>
                            <span className="text-[11px] text-on-surface-variant block">
                              {formatFileSize(selectedPdfFile.size)} • Pronto para registro (origem: PDF anexado)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleTriggerUploadClick}
                            disabled={isBusy}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-md-full text-xs font-semibold bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                            <span>Trocar PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPdfFile(null)}
                            disabled={isBusy}
                            aria-label="Remover arquivo PDF selecionado"
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md-full bg-error-container text-on-error-container hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTriggerUploadClick}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        disabled={isBusy}
                        className="w-full min-h-[72px] p-4 rounded-md-md border-2 border-dashed border-outline-variant bg-surface-container-lowest hover:bg-surface-container hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer disabled:opacity-50"
                      >
                        <UploadCloud className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-on-surface">
                          Selecionar ou arrastar PDF assinado do termo antigo
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Formato .pdf • Tamanho máximo de 1 MB
                        </span>
                      </button>
                    )}

                    {signatureError && (
                      <p className="text-xs font-medium text-error">
                        {signatureError}
                      </p>
                    )}
                  </div>
                </div>
              )}
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

          {/* Rodapé com Ação Principal */}
          <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low shrink-0">
            {signatureOnlyInAttachedPdf ? (
              <button
                type="button"
                onClick={handleSubmitLegacyAttachedPdf}
                disabled={isBusy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>Registrando Termo Antigo...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 shrink-0" />
                    <span>Salvar Termo Antigo Anexado</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateSignedPdf}
                disabled={isBusy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-md-full text-xs font-semibold bg-primary text-on-primary hover:opacity-95 shadow-xs transition-all cursor-pointer disabled:opacity-50"
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
            )}
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
