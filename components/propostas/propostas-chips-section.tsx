"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  Archive,
  Loader2,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { Proposta } from "@/types/proposta";
import { getPropostasByPaciente } from "@/app/actions/propostas-actions";
import { PropostaDetailsModal } from "./proposta-details-modal";
import { PropostaFormModal } from "./proposta-form-modal";
import { PropostaNotificationModal } from "./proposta-notification-modal";

interface PropostasChipsSectionProps {
  pacienteId: string;
  userRole?: string;
  patientData?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
}

export function PropostasChipsSection({
  pacienteId,
  userRole,
  patientData,
}: PropostasChipsSectionProps) {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuspended, setShowSuspended] = useState(false);

  // Modals state
  const [selectedProposta, setSelectedProposta] = useState<Proposta | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [propostaToEdit, setPropostaToEdit] = useState<Proposta | null>(null);
  const [notificationProposta, setNotificationProposta] = useState<Proposta | null>(null);

  const isAdminOrProfissional =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const isPatient = userRole === "paciente";

  // Busca as propostas do paciente via Server Action
  const loadPropostas = useCallback(async () => {
    if (!pacienteId) return;
    setIsLoading(true);
    try {
      const res = await getPropostasByPaciente(pacienteId);
      if (res.success && res.data) {
        setPropostas(res.data);
      } else {
        setPropostas([]);
      }
    } catch {
      setPropostas([]);
    } finally {
      setIsLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    loadPropostas();
  }, [loadPropostas]);

  // Filtra e ordena propostas ativas em ordem alfabética por título
  const activePropostas = useMemo(() => {
    return propostas
      .filter((p) => p.status === "Ativo")
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" }));
  }, [propostas]);

  // Filtra propostas suspensas (ocultadas completamente se for paciente)
  const suspendedPropostas = useMemo(() => {
    if (isPatient) return [];
    return propostas
      .filter((p) => p.status === "Suspenso")
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR", { sensitivity: "base" }));
  }, [propostas, isPatient]);

  const formatDateBR = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    } catch {
      return "";
    }
  };

  const handleOpenNew = () => {
    setPropostaToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (prop: Proposta) => {
    setPropostaToEdit(prop);
    setIsFormOpen(true);
  };

  const handlePropostaSaved = (saved: Proposta) => {
    loadPropostas();
    // Abre automaticamente o modal de notificação (WhatsApp / E-mail)
    setNotificationProposta(saved);
  };

  return (
    <div className="space-y-2.5">
      {/* Header da Seção */}
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>PROPOSTAS DE PLANEJAMENTO</span>
          {activePropostas.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {activePropostas.length}
            </span>
          )}
        </h4>

        {isAdminOrProfissional && (
          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-full transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Nova Proposta</span>
          </button>
        )}
      </div>

      {/* Conteúdo Principal / Chips */}
      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            <span>Carregando propostas de planejamento...</span>
          </div>
        ) : activePropostas.length === 0 && suspendedPropostas.length === 0 ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Nenhuma proposta de planejamento registrada para este paciente.</span>
            {isAdminOrProfissional && (
              <button
                type="button"
                onClick={handleOpenNew}
                className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Criar a primeira proposta
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Chips Ativos */}
            {activePropostas.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {activePropostas.map((prop) => {
                  const numOpcoes = prop.opcoes?.length || 0;
                  return (
                    <button
                      key={prop.id}
                      type="button"
                      onClick={() => setSelectedProposta(prop)}
                      className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300 dark:hover:border-teal-700 shadow-xs hover:shadow transition-all text-left cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-teal-700 dark:group-hover:text-teal-300 truncate max-w-[220px] sm:max-w-[280px]">
                        {prop.titulo}
                      </span>

                      {numOpcoes > 0 && (
                        <span className="text-[10px] font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded-md border border-teal-200 dark:border-teal-800 shrink-0">
                          {numOpcoes} {numOpcoes === 1 ? "opção" : "opções"}
                        </span>
                      )}

                      {prop.created_at && (
                        <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
                          {formatDateBR(prop.created_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Nenhuma proposta ativa no momento.
              </p>
            )}

            {/* Seção Segregada de Propostas Suspensas (apenas admin/profissional) */}
            {suspendedPropostas.length > 0 && !isPatient && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setShowSuspended(!showSuspended)}
                  className="flex items-center justify-between w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer py-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-rose-500" />
                    <span>Propostas Suspensas ({suspendedPropostas.length})</span>
                  </div>
                  {showSuspended ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showSuspended && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 animate-in fade-in duration-150">
                    {suspendedPropostas.map((prop) => (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => setSelectedProposta(prop)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                      >
                        <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 line-through opacity-80 truncate max-w-[200px]">
                          {prop.titulo}
                        </span>
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
                          Suspensa
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes da Proposta */}
      {selectedProposta && (
        <PropostaDetailsModal
          isOpen={!!selectedProposta}
          onClose={() => setSelectedProposta(null)}
          proposta={selectedProposta}
          userRole={userRole}
          onEdit={handleOpenEdit}
          onSuspended={loadPropostas}
          patientData={patientData}
        />
      )}

      {/* Modal de Formulário (Criar / Editar) */}
      {isFormOpen && (
        <PropostaFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setPropostaToEdit(null);
          }}
          pacienteId={pacienteId}
          propostaToEdit={propostaToEdit}
          onSaved={handlePropostaSaved}
          patientData={patientData}
        />
      )}

      {/* Modal de Notificação WhatsApp / E-mail */}
      {notificationProposta && (
        <PropostaNotificationModal
          isOpen={!!notificationProposta}
          onClose={() => setNotificationProposta(null)}
          proposta={notificationProposta}
          patientData={patientData}
        />
      )}
    </div>
  );
}
