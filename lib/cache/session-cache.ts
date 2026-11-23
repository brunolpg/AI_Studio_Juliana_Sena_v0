import { clearAllClinicalSessionCache } from "@/lib/clinical/session-cache";
import type { Client, PaginatedResult } from "@/types/client";
import type { Appointment } from "@/types/appointment";
import type { DashboardStats } from "@/actions/stats-actions";
import type { TermoModelo, TermoProcedimento } from "@/types/termo";
import type { Formula } from "@/types/formula";

export interface CalendarHealthState {
  healthy: boolean;
  status?: string;
  calendarSummary?: string;
  canManageCalendar?: boolean;
  message?: string;
}

export interface CalendarMetaCacheEntry {
  status: { isConfigured: boolean; calendarId: string };
  health: CalendarHealthState;
  updatedAt: number;
}

export interface TermosModelosCacheEntry {
  modelos: TermoModelo[];
  procedimentos: TermoProcedimento[];
  updatedAt: number;
}

// Caches em memória durante a sessão (Map por chave de filtro/aba/perfil)
const clientsListCache = new Map<string, PaginatedResult<Client>>();
const clinicalPatientsSelectorCache = new Map<string, Client[]>();
const appointmentsListCache = new Map<string, PaginatedResult<Appointment>>();
const dashboardStatsCache = new Map<string, DashboardStats>();
const calendarMetaCache = new Map<string, CalendarMetaCacheEntry>();
const termosModelosCache = new Map<string, TermosModelosCacheEntry>();
const formulasCatalogCache = new Map<string, Formula[]>();

// Deduplicação de requisições concorrentes
const inFlightRequests = new Map<string, Promise<unknown>>();

export function dedupeSessionRequest<T>(
  requestKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(requestKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = fetcher().finally(() => {
    if (inFlightRequests.get(requestKey) === promise) {
      inFlightRequests.delete(requestKey);
    }
  });

  inFlightRequests.set(requestKey, promise);
  return promise;
}

function clearInFlightByPrefix(prefix: string): void {
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(prefix)) {
      inFlightRequests.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Pacientes (Listagem Paginada & Seletor de Prontuários)
// ---------------------------------------------------------------------------
export function buildClientsListCacheKey(params: {
  roleScope: string;
  search: string;
  status: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
}): string {
  return [
    params.roleScope,
    params.status,
    params.search.trim().toLowerCase(),
    params.page,
    params.pageSize,
    params.sortBy,
    params.sortOrder,
  ].join("|");
}

export function getCachedClientsList(key: string): PaginatedResult<Client> | null {
  return clientsListCache.get(key) ?? null;
}

export function setCachedClientsList(key: string, data: PaginatedResult<Client>): void {
  clientsListCache.set(key, data);
}

export function getCachedClinicalPatientsSelector(roleScope: string): Client[] | null {
  return clinicalPatientsSelectorCache.get(roleScope) ?? null;
}

export function setCachedClinicalPatientsSelector(roleScope: string, clients: Client[]): void {
  clinicalPatientsSelectorCache.set(roleScope, clients);
}

export function invalidateClientsCache(): void {
  clientsListCache.clear();
  clinicalPatientsSelectorCache.clear();
  dashboardStatsCache.clear();
  clearInFlightByPrefix("clients:");
  clearInFlightByPrefix("clinical-patients:");
  clearInFlightByPrefix("stats:");
}

// ---------------------------------------------------------------------------
// 2. Agendamentos & Google Calendar Status/Health
// ---------------------------------------------------------------------------
export function buildAppointmentsListCacheKey(params: {
  roleScope: string;
  clientId?: string;
  tab: string;
  search: string;
  page: number;
  pageSize: number;
}): string {
  return [
    params.roleScope,
    params.clientId || "all",
    params.tab,
    params.search.trim().toLowerCase(),
    params.page,
    params.pageSize,
  ].join("|");
}

export function getCachedAppointmentsList(key: string): PaginatedResult<Appointment> | null {
  return appointmentsListCache.get(key) ?? null;
}

export function setCachedAppointmentsList(key: string, data: PaginatedResult<Appointment>): void {
  appointmentsListCache.set(key, data);
}

export function getCachedCalendarMeta(roleScope: string): CalendarMetaCacheEntry | null {
  return calendarMetaCache.get(roleScope) ?? null;
}

export function setCachedCalendarMeta(roleScope: string, entry: CalendarMetaCacheEntry): void {
  calendarMetaCache.set(roleScope, entry);
}

export function invalidateAppointmentsCache(): void {
  appointmentsListCache.clear();
  dashboardStatsCache.clear();
  clearInFlightByPrefix("appointments:");
  clearInFlightByPrefix("stats:");
}

// ---------------------------------------------------------------------------
// 3. Estatísticas do Dashboard
// ---------------------------------------------------------------------------
export function getCachedDashboardStats(roleScope: string): DashboardStats | null {
  return dashboardStatsCache.get(roleScope) ?? null;
}

export function setCachedDashboardStats(roleScope: string, stats: DashboardStats): void {
  dashboardStatsCache.set(roleScope, stats);
}

export function invalidateStatsCache(): void {
  dashboardStatsCache.clear();
  clearInFlightByPrefix("stats:");
}

// ---------------------------------------------------------------------------
// 4. Modelos de Termos de Consentimento
// ---------------------------------------------------------------------------
export function getCachedTermosModelos(): TermosModelosCacheEntry | null {
  return termosModelosCache.get("default") ?? null;
}

export function setCachedTermosModelos(
  modelos: TermoModelo[],
  procedimentos: TermoProcedimento[]
): void {
  termosModelosCache.set("default", {
    modelos,
    procedimentos,
    updatedAt: Date.now(),
  });
}

export function invalidateTermosModelosCache(): void {
  termosModelosCache.clear();
  clearInFlightByPrefix("termos-modelos:");
}

// ---------------------------------------------------------------------------
// 5. Catálogo de Fórmulas
// ---------------------------------------------------------------------------
export function getCachedFormulasCatalog(): Formula[] | null {
  return formulasCatalogCache.get("default") ?? null;
}

export function setCachedFormulasCatalog(formulas: Formula[]): void {
  formulasCatalogCache.set("default", formulas);
}

export function invalidateFormulasCache(): void {
  formulasCatalogCache.clear();
  clearInFlightByPrefix("formulas:");
}

// ---------------------------------------------------------------------------
// 6. Limpeza Global (Logout / Troca de Conta)
// ---------------------------------------------------------------------------
export function clearAllAppSessionCaches(): void {
  clientsListCache.clear();
  clinicalPatientsSelectorCache.clear();
  appointmentsListCache.clear();
  dashboardStatsCache.clear();
  calendarMetaCache.clear();
  termosModelosCache.clear();
  formulasCatalogCache.clear();
  inFlightRequests.clear();
  clearAllClinicalSessionCache();
}
