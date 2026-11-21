"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileSignature,
  Plus,
  BookOpen,
  Eye,
  Calendar,
  UploadCloud,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { getTermosModelos } from "@/app/actions/termos";
import { useToast } from "@/components/ui/toast";
import { TermoModeloModal } from "./termo-modelo-modal";
import { TermoFormModal } from "./termo-form-modal";
import { TermoDetailsModal } from "./termo-details-modal";
import type { Client } from "@/types/client";
import type {
  TermoConsentimento,
  TermoModelo,
  TermoProcedimento,
} from "@/types/termo";

interface TermosTabProps {
  client: Client;
  termos: TermoConsentimento[];
  onRefresh: () => void;
  openNewTermoSignal?: number;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function TermosTab({
  client,
  termos,
  onRefresh,
  openNewTermoSignal,
}: TermosTabProps) {
  const { toast } = useToast();

  const [modelos, setModelos] = useState<TermoModelo[]>([]);
  const [procedimentos, setProcedimentos] = useState<TermoProcedimento[]>([]);
  const [isLoadingModelos, setIsLoadingModelos] = useState(false);

  const [isModeloModalOpen, setIsModeloModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedTermoForDetails, setSelectedTermoForDetails] =
    useState<TermoConsentimento | null>(null);
  const lastNewTermoSignalRef = useRef(openNewTermoSignal ?? 0);

  useEffect(() => {
    if (
      openNewTermoSignal &&
      openNewTermoSignal !== lastNewTermoSignalRef.current
    ) {
      lastNewTermoSignalRef.current = openNewTermoSignal;
      setIsFormModalOpen(true);
    }
  }, [openNewTermoSignal]);

  const loadModelos = useCallback(async () => {
    try {
      setIsLoadingModelos(true);
      const res = await getTermosModelos();
      if (res.success && res.data) {
        setModelos(res.data.modelos);
        setProcedimentos(res.data.procedimentos);
      } else if (res.error) {
        toast({
          type: "error",
          title: "Erro ao carregar modelos",
          description: res.error,
        });
      }
    } catch (err: unknown) {
      toast({
        type: "error",
        title: "Erro ao carregar modelos",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível consultar os modelos de termo.",
      });
    } finally {
      setIsLoadingModelos(false);
    }
  }, [toast]);

  useEffect(() => {
    loadModelos();
  }, [loadModelos]);

  const handleModeloSaved = (modeloSalvo: TermoModelo) => {
    setModelos((prev) => {
      const exists = prev.some((m) => m.id === modeloSalvo.id);
      const updated = exists
        ? prev.map((m) => (m.id === modeloSalvo.id ? modeloSalvo : m))
        : [...prev, modeloSalvo];
      return updated.sort((a, b) =>
        a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" })
      );
    });
  };

  return (
    <>
      <div className="space-y-4">
        {/* Cabeçalho da Seção (mesmo molde de Propostas) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md-md bg-primary-container text-on-primary-container border border-primary/20 flex items-center justify-center shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-on-surface">
                Termos de Consentimento ({termos.length})
              </h3>
              <p className="text-xs text-on-surface-variant">
                Termos de consentimento livre e esclarecido assinados pelo paciente
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsModeloModalOpen(true)}
              disabled={isLoadingModelos}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-2xs transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] md-state-layer disabled:opacity-60"
            >
              {isLoadingModelos ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <BookOpen className="w-4 h-4 shrink-0" />
              )}
              <span>Modelos</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFormModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs hover:shadow transition-all cursor-pointer whitespace-nowrap active:scale-[0.98] md-state-layer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Novo Termo</span>
            </button>
          </div>
        </div>

        {/* Lista de Termos ou Estado Vazio */}
        {termos.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 min-w-0 w-full">
            {termos.map((termo) => {
              const topicosCount = termo.conteudo_snapshot?.topicos?.length || 0;
              return (
                <div
                  key={termo.id}
                  className="p-4 sm:p-5 rounded-md-2xl bg-surface-container-lowest border border-outline-variant hover:border-primary/40 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md-full bg-primary-container text-on-primary-container uppercase tracking-wider">
                        TERMO DE CONSENTIMENTO
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md-full text-[11px] font-semibold ${
                          termo.assinado
                            ? "bg-success-container text-on-success-container border border-success/30"
                            : "bg-warning-container text-on-warning-container border border-warning/30"
                        }`}
                      >
                        {termo.assinado ? (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        ) : (
                          <Clock className="w-3 h-3 shrink-0" />
                        )}
                        {termo.assinado ? "Assinado" : "Pendente"}
                      </span>

                      {termo.origem_pdf === "upload" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md-full text-[11px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant">
                          <UploadCloud className="w-3 h-3 shrink-0" />
                          Upload PDF
                        </span>
                      )}
                    </div>

                    <h4
                      onClick={() => setSelectedTermoForDetails(termo)}
                      className="text-sm sm:text-base font-bold text-on-surface hover:text-primary transition-colors cursor-pointer truncate"
                    >
                      {termo.procedimento_nome}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                      <span className="inline-flex items-center gap-1 font-medium text-on-surface">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        {formatDateBR(termo.data)}
                      </span>
                      <span>•</span>
                      <span>{termo.profissional || "Dra. Juliana Sena"}</span>
                      {topicosCount > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            {topicosCount}{" "}
                            {topicosCount === 1 ? "tópico" : "tópicos"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTermoForDetails(termo)}
                      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>Visualizar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-md-2xl bg-surface-container-lowest border border-outline-variant text-center space-y-3">
            <div className="w-12 h-12 rounded-md-lg bg-primary-container text-on-primary-container flex items-center justify-center mx-auto">
              <FileSignature className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-on-surface">
                Nenhum termo de consentimento registrado
              </p>
              <p className="text-xs text-on-surface-variant">
                Crie um termo para coleta de assinatura digital ou anexe um documento PDF assinado para este paciente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFormModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-md-full text-xs font-semibold bg-primary-container text-on-primary-container hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Criar primeiro termo</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Modelos */}
      <TermoModeloModal
        isOpen={isModeloModalOpen}
        onClose={() => setIsModeloModalOpen(false)}
        modelos={modelos}
        procedimentos={procedimentos}
        initialModeloId={null}
        onSaved={handleModeloSaved}
      />

      {/* Modal de Novo Termo */}
      <TermoFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        client={client}
        modelos={modelos}
        procedimentos={procedimentos}
        onModeloSaved={handleModeloSaved}
        onSuccess={() => {
          onRefresh();
        }}
      />

      {/* Modal de Visualização / PDF */}
      {selectedTermoForDetails && (
        <TermoDetailsModal
          isOpen={true}
          onClose={() => setSelectedTermoForDetails(null)}
          termo={selectedTermoForDetails}
          client={client}
        />
      )}
    </>
  );
}
