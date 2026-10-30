"use client";

import React, { useState, useEffect } from "react";
import { Camera, X, ChevronLeft, ChevronRight, ExternalLink, Download, Image as ImageIcon } from "lucide-react";

interface EvolutionPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  fotos: string[];
  procedimento?: string;
  data?: string;
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
              {/* Preview Ampliado */}
              <div className="relative max-h-[58vh] sm:max-h-[62vh] w-full flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden p-2 sm:p-3 border border-slate-800 shadow-inner">
                <img
                  src={fotos[selectedPhotoIndex]}
                  alt={`Registro clínico ${selectedPhotoIndex + 1}`}
                  className="max-h-[54vh] sm:max-h-[58vh] max-w-full object-contain rounded-xl select-none"
                  referrerPolicy="no-referrer"
                />

                {/* Botões Flutuantes de Navegação na Imagem (se mais de 1 foto) */}
                {fotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={selectedPhotoIndex === 0}
                      onClick={() => setSelectedPhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all"
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

                <a
                  href={fotos[selectedPhotoIndex]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir original</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
              {fotos.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-all duration-200 shadow-2xs hover:shadow-md"
                >
                  <img
                    src={url}
                    alt={`Registro ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 backdrop-blur-[1px]">
                    <span className="text-white text-xs font-bold px-3 py-1 rounded-full bg-emerald-600/90 shadow-md">
                      Ampliar Foto
                    </span>
                    <span className="text-[10px] text-white/80 font-medium">
                      Foto {idx + 1} de {fotos.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
