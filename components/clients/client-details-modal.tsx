"use client";

import React from "react";
import { X, User, Calendar, Mail, Phone, MapPin, Briefcase, FileText, Clock, ShieldCheck, Tag, Stethoscope } from "lucide-react";
import { PatientClinicalTabs } from "@/components/clinical/patient-clinical-tabs";
import type { Client } from "@/types/client";

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onEdit: (client: Client) => void;
}

export function ClientDetailsModal({
  isOpen,
  onClose,
  client,
  onEdit,
}: ClientDetailsModalProps) {
  if (!isOpen || !client) return null;

  const formattedBirthDate = new Date(client.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedCreatedAt = new Date(client.created_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const formattedUpdatedAt = new Date(client.updated_at).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div
      id="client-details-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div
        id="client-details-modal-dialog"
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85dvh] transition-all"
      >
        {/* Handle indicador para Bottom Sheet no Mobile Vertical */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2 shrink-0" />

        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-base shadow-2xs">
              {client.nome.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg leading-tight">
                  {client.nome}
                </h3>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs ${
                    client.deleted_at
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60"
                      : client.status === "Ativo"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {client.deleted_at ? "Excluído (Lixeira)" : client.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>CPF: {client.cpf}</span>
                <span>•</span>
                <span>{client.sexo}</span>
              </p>
            </div>
          </div>
          <button
            id="close-details-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors md-state-layer cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">Idade Atual</span>
              <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
                {client.idade} anos
              </span>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">Nascimento</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formattedBirthDate}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">Estado / UF</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {client.estado}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block">Profissão</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {client.profissao || "Não informada"}
              </span>
            </div>
          </div>

          {/* Contact & Location */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Contato e Localização
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <Mail className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-600 dark:text-slate-400 block">E-mail</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">{client.email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <Phone className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-600 dark:text-slate-400 block">Telefone</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{client.telefone}</span>
                </div>
              </div>

              <div className="sm:col-span-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Endereço Completo</span>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {client.cep ? `CEP: ${client.cep} — ` : ""}
                  {client.logradouro}, nº {client.numero}
                  {client.complemento ? ` (${client.complemento})` : ""} — {client.cidade} / {client.estado}
                </p>
              </div>
            </div>
          </div>

          {/* Clinical Observations */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-600" /> Observações Administrativas & Iniciais
            </h4>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {client.observacoes || "Nenhuma observação clínica ou administrativa registrada."}
            </div>
          </div>

          {/* Subcomponente de Abas do Prontuário, Histórico e Evoluções Clínicas */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Prontuário Médico & Evoluções Clínicas
              </h4>
            </div>
            <PatientClinicalTabs client={client} />
          </div>

          {/* Audit Trail */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Cadastrado em: {formattedCreatedAt}</span>
            </div>
            <div>
              <span>Última atualização: {formattedUpdatedAt}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
            UUID: {client.id}
          </span>
          <div className="flex items-center gap-2">
            <button
              id="details-close-bottom-btn"
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors md-state-layer cursor-pointer"
            >
              Fechar
            </button>
            {!client.deleted_at && (
              <button
                id="details-edit-btn"
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(client);
                }}
                className="px-5 py-2 text-xs font-bold text-white dark:text-slate-950 bg-teal-700 dark:bg-teal-500 hover:bg-teal-800 dark:hover:bg-teal-400 rounded-full shadow-xs hover:shadow transition-colors md-state-layer cursor-pointer"
              >
                Editar Paciente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
