"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  FileHeart,
  ChevronDown,
  Sparkles,
  Stethoscope,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { getClientsAction } from "@/actions/client-actions";
import { PatientClinicalTabs } from "./patient-clinical-tabs";
import { INITIAL_CLIENTS } from "@/lib/mock-data";
import type { Client } from "@/types/client";

interface PatientClinicalDashboardViewProps {
  initialClientId?: string;
  onOpenAppointments?: () => void;
}

export function PatientClinicalDashboardView({
  initialClientId,
  onOpenAppointments,
}: PatientClinicalDashboardViewProps) {
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string>(
    initialClientId || INITIAL_CLIENTS[0]?.id || ""
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Carrega pacientes ativos
  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await getClientsAction({ status: "Ativo", pageSize: 50 });
        if (res.success && res.data && res.data.data.length > 0) {
          setClients(res.data.data);
          if (!selectedClientId) {
            setSelectedClientId(res.data.data[0].id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar lista de pacientes:", err);
      }
    }
    loadPatients();
  }, [selectedClientId]);

  // Paciente selecionado
  const selectedPatient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || clients[0] || null;
  }, [clients, selectedClientId]);

  // Filtro do dropdown
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const q = searchTerm.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.cpf.includes(q) ||
        c.telefone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Barra de Seleção de Paciente com Autocomplete & Troca Rápida */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Seletor Dropdown */}
        <div className="relative flex-1 max-w-md">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Selecione o Prontuário do Paciente
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left cursor-pointer hover:border-teal-500 transition-colors"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {selectedPatient?.nome.charAt(0) || "P"}
                </div>
                <div className="truncate">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                    {selectedPatient?.nome || "Selecione um paciente..."}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    CPF: {selectedPatient?.cpf} • {selectedPatient?.idade} anos
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-2 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar paciente por nome ou CPF..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      autoFocus
                    />
                  </div>
                </div>

                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setSelectedClientId(client.id);
                      setIsDropdownOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full text-left p-2.5 flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
                      client.id === selectedPatient?.id
                        ? "bg-teal-50/60 dark:bg-teal-950/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {client.nome.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {client.nome}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {client.idade} anos • {client.cidade}/{client.estado}
                        </div>
                      </div>
                    </div>
                    {client.id === selectedPatient?.id && (
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-teal-200">
                        Ativo
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Informações Rápidas de Contato do Paciente Ativo */}
        {selectedPatient && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <Phone className="w-3.5 h-3.5 text-teal-600" />
              <span>{selectedPatient.telefone}</span>
            </div>

            <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <Mail className="w-3.5 h-3.5 text-teal-600" />
              <span className="truncate max-w-[180px]">{selectedPatient.email}</span>
            </div>

            {onOpenAppointments && (
              <button
                type="button"
                onClick={onOpenAppointments}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 border border-teal-200 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Ver Agenda de Consultas</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Renderiza o Subcomponente de Abas do Prontuário */}
      {selectedPatient ? (
        <PatientClinicalTabs
          key={selectedPatient.id}
          client={selectedPatient}
        />
      ) : (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 text-slate-500">
          Nenhum paciente selecionado para visualização do prontuário.
        </div>
      )}
    </div>
  );
}
