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
import { PropostasCards } from "./propostas-cards";
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

        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
          <span>Carregando propostas de planejamento...</span>
        </div>
      ) : (
        <PropostasCards
          propostas={propostas}
          client={
            patientData
              ? ({
                  id: pacienteId,
                  nome: patientData.nome,
                  email: patientData.email,
                  telefone: patientData.telefone,
                } as any)
              : null
          }
          isPatientView={isPatient}
          userRole={userRole}
          onEdit={handleOpenEdit}
          onRefresh={loadPropostas}
          onNewProposta={isAdminOrProfissional ? handleOpenNew : undefined}
        />
      )}

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
