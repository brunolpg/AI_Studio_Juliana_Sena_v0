"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  Calendar,
  Phone,
  Mail,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  PatientClinicalTabs,
  normalizeClinicalSubTab,
  type ClinicalSubTab,
} from "./patient-clinical-tabs";
import { getActivePatientsForSelectorAction } from "@/actions/client-actions";
import {
  dedupeSessionRequest,
  getCachedClinicalPatientsSelector,
  invalidateClientsCache,
  setCachedClinicalPatientsSelector,
} from "@/lib/cache/session-cache";
import type { Client } from "@/types/client";
import { PatientAvatar } from "@/components/shared/patient-avatar";
import { useAuth } from "@/components/auth/auth-context";
import { useToast } from "@/components/ui/toast";

interface PatientClinicalDashboardViewProps {
  initialClientId?: string;
  onOpenAppointments?: () => void;
  initialTab?: ClinicalSubTab | string;
}

export function PatientClinicalDashboardView({
  initialClientId,
  onOpenAppointments,
  initialTab = "evolucoes",
}: PatientClinicalDashboardViewProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "administrador";
  const roleScope = user?.id ? `${user.id}:${user.role}` : "anon";

  const initialCachedClients = useMemo(
    () => (user?.id ? getCachedClinicalPatientsSelector(roleScope) ?? [] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [clients, setClients] = useState<Client[]>(initialCachedClients);
  const [isLoadingPatients, setIsLoadingPatients] = useState<boolean>(
    initialCachedClients.length === 0
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(() => {
    if (initialClientId) return initialClientId;
    return initialCachedClients[0]?.id ?? null;
  });
  const initialClientIdRef = useRef<string | null>(initialClientId || null);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [activeTab, setActiveTab] = useState<ClinicalSubTab>(() =>
    normalizeClinicalSubTab(initialTab, "evolucoes")
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincroniza quando initialClientId muda externamente (deep-link)
  useEffect(() => {
    initialClientIdRef.current = initialClientId || null;
    if (initialClientId) {
      setSelectedPatientId(initialClientId);
    }
  }, [initialClientId]);

  // Fallback para deep-links de URL apontando para a antiga aba de sinais vitais ("metricas")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramKey = params.has("subtab") ? "subtab" : params.has("tab") ? "tab" : null;
    if (!paramKey) return;
    const rawParam = params.get(paramKey);
    if (!rawParam) return;
    const resolved = normalizeClinicalSubTab(rawParam, "evolucoes");
    setActiveTab(resolved);
    if (rawParam.toLowerCase().trim() !== resolved) {
      params.set(paramKey, resolved);
      const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const loadPatients = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      if (isAuthLoading) return;
      if (!user?.id) {
        setClients([]);
        setSelectedPatientId(null);
        setIsLoadingPatients(false);
        setLoadError("Sessão não identificada. Faça login novamente para visualizar os prontuários.");
        return;
      }

      const forceRefresh = Boolean(options?.forceRefresh);
      if (forceRefresh) {
        invalidateClientsCache();
      } else {
        const cached = getCachedClinicalPatientsSelector(roleScope);
        if (cached) {
          setClients(cached);
          setLoadError(null);
          setIsLoadingPatients(false);
          setSelectedPatientId((prev) => {
            const preferred = prev || initialClientIdRef.current;
            if (preferred && cached.some((p) => p.id === preferred)) {
              return preferred;
            }
            return cached[0]?.id ?? null;
          });
          return;
        }
      }

      setIsLoadingPatients(true);
      setLoadError(null);

      try {
        const res = await dedupeSessionRequest(
          `clinical-patients:${roleScope}`,
          () => getActivePatientsForSelectorAction()
        );

        if (!res.success) {
          const errorMsg =
            res.message || "Não foi possível carregar a lista de pacientes cadastrados.";
          setLoadError(errorMsg);
          toastRef.current({
            type: "error",
            title: "Erro ao carregar pacientes",
            description: errorMsg,
          });
          return;
        }

        const loadedClients = res.data ?? [];
        setCachedClinicalPatientsSelector(roleScope, loadedClients);
        setClients(loadedClients);
        setLoadError(null);
        setSelectedPatientId((prev) => {
          const preferred = prev || initialClientIdRef.current;
          if (preferred && loadedClients.some((p) => p.id === preferred)) {
            return preferred;
          }
          return loadedClients[0]?.id ?? null;
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Falha de comunicação ao carregar a lista de pacientes.";
        setLoadError(errorMsg);
        toastRef.current({
          type: "error",
          title: "Erro de conexão",
          description: errorMsg,
        });
      } finally {
        setIsLoadingPatients(false);
      }
    },
    [isAuthLoading, user?.id, roleScope]
  );

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // Paciente selecionado (referência estável para evitar re-renders desnecessários nas abas)
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId) return null;
    return clients.find((c) => c.id === selectedPatientId) || null;
  }, [clients, selectedPatientId]);

  const selectedPatientForTabs = useMemo(() => {
    if (!selectedPatient) return null;
    return isAdmin
      ? { ...selectedPatient, avatar_url: null, foto_perfil: null }
      : selectedPatient;
  }, [selectedPatient, isAdmin]);

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
      <div className="w-full p-4 bg-surface-container-lowest rounded-md-2xl border border-outline-variant shadow-sm font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="flex flex-col landscape:max-md:flex-row landscape:max-md:items-center landscape:max-md:flex-wrap md:flex-row md:items-center justify-between gap-3 w-full">
          {/* Dropdown do Paciente */}
          <div className="flex-1 min-w-[240px] w-full min-w-0">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
              Selecione o Prontuário do Paciente
            </label>
            {/* Componente Select/Trigger com largura completa e flex-shrink-0 */}
            <div className="w-full min-w-0 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full min-w-[200px] min-h-[44px] flex items-center justify-between p-2.5 sm:p-3 rounded-md-lg border border-outline-variant bg-surface-container text-on-surface text-left cursor-pointer hover:border-primary transition-colors md-state-layer shadow-2xs overflow-hidden"
              >
                <div className="flex items-center gap-2.5 min-w-0 overflow-hidden flex-1">
                  {/* Foto de Perfil (avatar_url) ou Inicial */}
                  <PatientAvatar
                    name={selectedPatient?.nome || "Paciente"}
                    avatarUrl={isAdmin ? null : (selectedPatient?.avatar_url || selectedPatient?.foto_perfil)}
                    sizeClassName="w-8 h-8"
                    textClassName="text-xs"
                    fallbackClassName="bg-primary text-on-primary"
                    borderClassName="border-outline-variant"
                  />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <span className="font-bold text-xs text-on-surface block truncate">
                      {isLoadingPatients && !selectedPatient
                        ? "Carregando pacientes..."
                        : selectedPatient?.nome || "Selecione um paciente..."}
                    </span>
                    <span className="text-[11px] text-on-surface-variant block truncate">
                      {selectedPatient
                        ? `CPF: ${selectedPatient.cpf || "---"} • ${selectedPatient.idade} anos`
                        : loadError
                        ? "Falha ao carregar lista de pacientes"
                        : isLoadingPatients
                        ? "Sincronizando cadastros ativos..."
                        : "Nenhum paciente selecionado"}
                    </span>
                  </div>
                </div>
                {isLoadingPatients ? (
                  <Loader2 className="w-4 h-4 text-primary shrink-0 ml-2 animate-spin" />
                ) : (
                  <ChevronDown
                    className={`w-4 h-4 text-on-surface-variant shrink-0 ml-2 transition-transform duration-200 ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {isDropdownOpen && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-surface-container-lowest rounded-md-lg border border-outline-variant shadow-xl divide-y divide-outline-variant">
                  <div className="p-2.5 sticky top-0 bg-surface-container-lowest border-b border-outline-variant z-10">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar paciente por nome ou CPF..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (filteredClients.length > 0) {
                              const firstClient = filteredClients[0];
                              setSelectedPatientId(firstClient.id);
                              setIsDropdownOpen(false);
                              setSearchTerm("");
                            }
                          }
                        }}
                        className="w-full pl-9 pr-3.5 py-2 text-xs rounded-full border border-outline-variant bg-surface-container text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        autoFocus
                      />
                    </div>
                  </div>

                  {isLoadingPatients ? (
                    <div className="p-4 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Carregando pacientes...</span>
                    </div>
                  ) : loadError ? (
                    <div className="p-4 text-center space-y-2">
                      <p className="text-xs text-on-error-container bg-error-container px-3 py-2 rounded-md-md">
                        {loadError}
                      </p>
                      <button
                        type="button"
                        onClick={() => loadPatients({ forceRefresh: true })}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-xs font-semibold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tentar novamente</span>
                      </button>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-on-surface-variant">
                      Nenhum paciente encontrado.
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(client.id);
                          setIsDropdownOpen(false);
                          setSearchTerm("");
                        }}
                        className={`w-full min-h-[44px] text-left p-3 flex items-center justify-between transition-colors hover:bg-surface-container cursor-pointer md-state-layer ${
                          client.id === selectedPatient?.id
                            ? "bg-primary-container/50"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden flex-1">
                          {/* Foto de Perfil (avatar_url) ou Inicial */}
                          <PatientAvatar
                            name={client.nome || "Paciente"}
                            avatarUrl={isAdmin ? null : (client.avatar_url || client.foto_perfil)}
                            sizeClassName="w-7 h-7"
                            textClassName="text-xs"
                            fallbackClassName="bg-primary-container text-on-primary-container"
                            borderClassName="border-outline-variant"
                          />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="text-xs font-semibold text-on-surface truncate">
                              {client.nome}
                            </div>
                            <div className="text-[10px] text-on-surface-variant truncate">
                              CPF: {client.cpf} • {client.idade} anos • {client.cidade}/{client.estado}
                            </div>
                          </div>
                        </div>
                        {client.id === selectedPatient?.id && (
                          <span className="text-[10px] font-bold text-on-primary-container bg-primary-container px-2.5 py-0.5 rounded-full border border-outline-variant shrink-0 ml-2">
                            Ativo
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chips de Contato e Atalho */}
          {selectedPatient && (
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              {selectedPatient.telefone && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant text-on-surface text-xs font-semibold shadow-2xs">
                  <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{selectedPatient.telefone}</span>
                </div>
              )}

              {selectedPatient.email && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant text-on-surface text-xs font-semibold shadow-2xs">
                  <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate max-w-[180px]">{selectedPatient.email}</span>
                </div>
              )}

              {onOpenAppointments && (
                <button
                  type="button"
                  onClick={onOpenAppointments}
                  className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-semibold bg-transparent hover:bg-primary-container/50 text-primary border border-primary/40 transition-colors cursor-pointer md-state-layer shadow-2xs active:scale-[0.98]"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Ver Agenda de Consultas</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Renderiza o Subcomponente de Abas do Prontuário ou Estados Explícitos */}
      {selectedPatientForTabs ? (
        <PatientClinicalTabs
          client={selectedPatientForTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : isLoadingPatients ? (
        <div className="p-8 text-center bg-surface-container-lowest rounded-md-2xl border border-outline-variant text-on-surface-variant flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Carregando lista de pacientes cadastrados...</span>
        </div>
      ) : loadError ? (
        <div className="p-6 sm:p-8 text-center bg-error-container/40 rounded-md-2xl border border-error/40 text-on-error-container space-y-3">
          <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-lg mx-auto">
            <h3 className="text-sm font-bold text-on-surface">
              Não foi possível carregar os pacientes
            </h3>
            <p className="text-xs text-on-error-container leading-relaxed">
              {loadError}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadPatients({ forceRefresh: true })}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar novamente</span>
          </button>
        </div>
      ) : (
        <div className="p-8 text-center bg-surface-container-lowest rounded-md-2xl border border-outline-variant text-on-surface-variant">
          Nenhum paciente cadastrado.
        </div>
      )}
    </div>
  );
}
