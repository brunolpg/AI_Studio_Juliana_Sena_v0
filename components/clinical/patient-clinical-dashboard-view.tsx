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
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Client } from "@/types/client";

interface PatientClinicalDashboardViewProps {
  initialClientId?: string;
  onOpenAppointments?: () => void;
}

export function PatientClinicalDashboardView({
  initialClientId,
  onOpenAppointments,
}: PatientClinicalDashboardViewProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    initialClientId || null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Carrega pacientes ativos diretamente do Supabase
  useEffect(() => {
    async function loadPatients() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { data: pacientes, error } = await supabase
          .from("pacientes")
          .select("*")
          .is("deleted_at", null)
          .order("nome", { ascending: true });

        if (error) {
          console.error("Erro ao carregar lista de pacientes do Supabase:", error);
          return;
        }

        if (pacientes && pacientes.length > 0) {
          setClients(pacientes as Client[]);
          if (!selectedPatientId) {
            setSelectedPatientId(pacientes[0].id);
          } else {
            const exists = pacientes.some((p) => p.id === selectedPatientId);
            if (!exists) {
              setSelectedPatientId(pacientes[0].id);
            }
          }
        } else {
          setClients([]);
          setSelectedPatientId(null);
        }
      } catch (err) {
        console.error("Erro ao carregar lista de pacientes:", err);
      }
    }
    loadPatients();
  }, [selectedPatientId]);

  // Paciente selecionado
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return clients.find((c) => c.id === selectedPatientId) || null;
  }, [clients, selectedPatientId]);

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
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Seletor Dropdown */}
        <div className="relative flex-1 max-w-md">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
            Selecione o Prontuário do Paciente
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-left cursor-pointer hover:border-teal-500/80 dark:hover:border-teal-500 transition-colors md-state-layer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-full bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {selectedPatient?.nome.charAt(0) || "P"}
                </div>
                <div className="truncate">
                  <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                    {selectedPatient?.nome || "Selecione um paciente..."}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    CPF: {selectedPatient?.cpf} • {selectedPatient?.idade} anos
                  </span>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isDropdownOpen && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl divide-y divide-slate-100 dark:divide-slate-800/80">
                <div className="p-2.5 sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar paciente por nome ou CPF..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(client.id);
                      setIsDropdownOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full text-left p-3 flex items-center justify-between transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer md-state-layer ${
                      client.id === selectedPatient?.id
                        ? "bg-teal-50/70 dark:bg-teal-950/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
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
                      <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
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
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs">
              <Phone className="w-3.5 h-3.5 text-[#0d6e64] dark:text-teal-400 shrink-0" />
              <span>{selectedPatient.telefone}</span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-semibold shadow-2xs">
              <Mail className="w-3.5 h-3.5 text-[#0d6e64] dark:text-teal-400 shrink-0" />
              <span className="truncate max-w-[180px]">{selectedPatient.email}</span>
            </div>

            {onOpenAppointments && (
              <button
                type="button"
                onClick={onOpenAppointments}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0d6e64] dark:text-teal-300 bg-teal-50/80 dark:bg-teal-950/60 hover:bg-teal-100/90 dark:hover:bg-teal-900/60 border border-teal-700/30 dark:border-teal-500/40 transition-all cursor-pointer md-state-layer shadow-2xs active:scale-[0.98]"
              >
                <Calendar className="w-3.5 h-3.5 text-[#0d6e64] dark:text-teal-400 shrink-0" />
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
          Nenhum paciente cadastrado.
        </div>
      )}
    </div>
  );
}
