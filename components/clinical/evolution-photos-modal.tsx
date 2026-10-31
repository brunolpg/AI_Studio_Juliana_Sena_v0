"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";

interface EvolutionPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  fotos: string[];
  procedimento?: string;
  data?: string;
}

// 1. Verificação e detecção de URLs inválidas ou de fallback fictício local
export const isInvalidStorageUrl = (rawUrl?: string | null): boolean => {
  if (!rawUrl || typeof rawUrl !== "string") return true;
  const trimmed = rawUrl.trim();
  if (!trimmed) return true;
  if (
    trimmed.includes("supabase-storage-fallback.local") ||
    trimmed.includes("placeholder") ||
    trimmed.includes(".local")
  ) {
    return true;
  }
  return false;
};

// Verifica se há pelo menos uma foto com URL legítima (não fictícia de fallback de teste local)
export const hasValidClinicalPhoto = (fotos?: string[] | null): boolean => {
  if (!fotos || !Array.isArray(fotos) || fotos.length === 0) return false;
  return fotos.some((foto) => !isInvalidStorageUrl(foto));
};

// 2. Normalização das URLs das Fotografias do Supabase (sem fallbacks aleatórios de terceiros)
export const resolvePhotoUrl = (rawUrl?: string | null, _index = 0): string => {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || isInvalidStorageUrl(trimmed)) {
    return "";
  }

  // 1. URLs com blob local ou data URI legítimas
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // 2. URLs absolutas (HTTP/HTTPS)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("/storage/v1/object/public/")) {
      if (trimmed.includes("localhost:54321") || trimmed.includes(".local")) {
        if (!supabaseUrl) return "";
        const pathAfter = trimmed.split("/storage/v1/object/public/")[1];
        return `${supabaseUrl}/storage/v1/object/public/${pathAfter}`;
      }
    }
    return trimmed;
  }

  // 3. Caminho relativo dentro do bucket prontuarios-fotos
  if (!supabaseUrl) return "";
  const cleanPath = trimmed.replace(/^(\.\/|\/)+/, "");
  if (cleanPath.startsWith("prontuarios-fotos/")) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }

  return `${supabaseUrl}/storage/v1/object/public/prontuarios-fotos/${cleanPath}`;
};

// 3. Item de Miniatura da Grade com Tratamento Informativo Sem Placeholders de Terceiros
function EvolutionPhotoItem({
  url,
  index,
  onClick,
}: {
  url: string;
  index: number;
  onClick: () => void;
}) {
  const resolved = resolvePhotoUrl(url);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!resolved);
  const [currentSrc, setCurrentSrc] = useState(resolved);

  useEffect(() => {
    const nextUrl = resolvePhotoUrl(url);
    setCurrentSrc(nextUrl);
    setIsLoading(!!nextUrl);
    setHasError(false);
  }, [url]);

  const isInvalid = !currentSrc || hasError;

  return (
    <div
      onClick={!isInvalid ? onClick : undefined}
      className={`group relative aspect-square rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${
        !isInvalid
          ? "cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 shadow-2xs hover:shadow-md"
          : "border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20"
      } transition-all duration-200`}
    >
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 animate-pulse">
          <span className="text-xs text-slate-400">Carregando foto...</span>
        </div>
      )}

      {isInvalid ? (
        <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-1.5 shadow-2xs">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Registo {index + 1}
          </span>
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mt-1 max-w-[150px] leading-tight">
            Fotografia não encontrada no Storage
          </span>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={`Registo Clínico ${index + 1}`}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {!isInvalid && !isLoading && (
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity duration-200 backdrop-blur-[1px]">
          <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-emerald-600/90 shadow-md">
            Ampliar
          </span>
          <span className="text-[10px] text-white/80 font-medium">
            Registo {index + 1}
          </span>
        </div>
      )}
    </div>
  );
}

// 4. Visualizador Ampliado com Card Informativo Sem Placeholders de Terceiros
function ZoomedPhotoView({
  url,
  index,
}: {
  url: string;
  index: number;
}) {
  const resolved = resolvePhotoUrl(url);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!resolved);
  const [currentSrc, setCurrentSrc] = useState(resolved);

  useEffect(() => {
    const nextUrl = resolvePhotoUrl(url);
    setCurrentSrc(nextUrl);
    setIsLoading(!!nextUrl);
    setHasError(false);
  }, [url]);

  const isInvalid = !currentSrc || hasError;

  return (
    <div className="relative max-h-[58vh] sm:max-h-[62vh] w-full min-h-[260px] flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden p-2 sm:p-3 border border-slate-800 shadow-inner">
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs text-slate-400">Carregando imagem em alta resolução...</span>
        </div>
      )}

      {isInvalid ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <span className="text-sm font-semibold text-slate-200">
            Registo {index + 1}
          </span>
          <span className="text-xs text-amber-400 mt-1 font-medium">
            Fotografia não encontrada no Storage
          </span>
          <span className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
            O arquivo original não pôde ser recuperado do armazenamento em nuvem.
          </span>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={`Registo clínico ${index + 1}`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className="max-h-[54vh] sm:max-h-[58vh] max-w-full object-contain rounded-xl select-none"
        />
      )}
    </div>
  );
}

export function EvolutionPhotosModal({
  isOpen,
  onClose,
  fotos,
  procedimento,
  data,
}: EvolutionPhotosModalProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  // Fecha ou reseta ao fechar o modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedPhotoIndex(null);
    }
  }, [isOpen]);

  // Navegação por teclado (Esc para voltar à grade ou fechar, Setas para navegar)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedPhotoIndex !== null) {
          setSelectedPhotoIndex(null);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft" && selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
        setSelectedPhotoIndex((prev) => (prev !== null ? prev - 1 : null));
      } else if (
        e.key === "ArrowRight" &&
        selectedPhotoIndex !== null &&
        selectedPhotoIndex < fotos.length - 1
      ) {
        setSelectedPhotoIndex((prev) => (prev !== null ? prev + 1 : null));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedPhotoIndex, fotos.length, onClose]);

  if (!isOpen || !fotos || fotos.length === 0) return null;

  // Formatação segura de data (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDateBR = (val?: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  };

  const formattedDate = formatDateBR(data);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs font-['Plus_Jakarta_Sans',sans-serif] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Registros Fotográficos da Sessão
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {procedimento ? <strong className="text-slate-700 dark:text-slate-300">{procedimento}</strong> : "Evolução Clínica"}
                {formattedDate && ` • ${formattedDate}`}
                {" "}({fotos.length} foto{fotos.length > 1 ? "s" : ""})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md-state-layer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Galeria de Fotos */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-80px)] flex-1">
          {selectedPhotoIndex !== null ? (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
              {/* Preview Ampliado com Tratamento Resiliente */}
              <div className="relative w-full">
                <ZoomedPhotoView
                  url={fotos[selectedPhotoIndex]}
                  index={selectedPhotoIndex}
                />

                {/* Botões Flutuantes de Navegação na Imagem (se mais de 1 foto) */}
                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={selectedPhotoIndex === 0}
                      onClick={() => setSelectedPhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all z-20"
                      title="Foto anterior"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      disabled={selectedPhotoIndex === fotos.length - 1}
                      onClick={() =>
                        setSelectedPhotoIndex((prev) => (prev !== null && prev < fotos.length - 1 ? prev + 1 : prev))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all z-20"
                      title="Próxima foto"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Barra de Ações e Paginação */}
              <div className="flex flex-wrap items-center justify-between gap-3 w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPhotoIndex(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/80 dark:border-emerald-800 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Voltar para a grade</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedPhotoIndex === 0}
                    onClick={() => setSelectedPhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Foto anterior"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  </button>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1">
                    {selectedPhotoIndex + 1} de {fotos.length}
                  </span>
                  <button
                    type="button"
                    disabled={selectedPhotoIndex === fotos.length - 1}
                    onClick={() =>
                      setSelectedPhotoIndex((prev) => (prev !== null && prev < fotos.length - 1 ? prev + 1 : prev))
                    }
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Próxima foto"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                  </button>
                </div>

                {resolvePhotoUrl(fotos[selectedPhotoIndex]) ? (
                  <a
                    href={resolvePhotoUrl(fotos[selectedPhotoIndex])}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir original</span>
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>Fotografia não encontrada</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
              {fotos.map((url, idx) => (
                <EvolutionPhotoItem
                  key={idx}
                  url={url}
                  index={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
