import type {
  ClinicalEvolution,
  MedicalHistory,
  PrescriptionItem,
} from "@/types/clinical-record";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import type { Proposta } from "@/types/proposta";
import type { TermoConsentimento } from "@/types/termo";
import type {
  ClinicalTabCounts,
  ClinicalTabSection,
} from "@/app/actions/clinical-record-loader";

export type ClinicalRoleScope = "admin" | "patient" | "staff";

export interface PatientClinicalCacheEntry {
  clientId: string;
  roleScope: ClinicalRoleScope;
  countsLoaded: boolean;
  counts: ClinicalTabCounts;
  loadedTabs: Set<ClinicalTabSection>;
  evolutions: ClinicalEvolution[];
  vitalEvolutions: ClinicalEvolution[];
  medicalHistory: MedicalHistory | null;
  aestheticData: { facial: any; corporal: any } | null;
  prescriptions: PrescriptionItem[];
  homeCareFichas: HomeCareFichaCompleta[];
  prescricoesExames: PrescricaoExame[];
  termos: TermoConsentimento[];
  propostas: Proposta[];
  updatedAt: number;
}

const DEFAULT_COUNTS: ClinicalTabCounts = {
  evolucoes: 0,
  prescricoesAtivas: 0,
  termos: 0,
  propostasAtivas: 0,
  hasAlergias: false,
};

// Cache em memória de sessão indexado por client.id
const clinicalSessionCache = new Map<string, PatientClinicalCacheEntry>();

// Deduplicação de chamadas em andamento (mesmo paciente/escopo no mesmo ciclo)
const inFlightRequests = new Map<string, Promise<any>>();

function createEmptyEntry(
  clientId: string,
  roleScope: ClinicalRoleScope
): PatientClinicalCacheEntry {
  return {
    clientId,
    roleScope,
    countsLoaded: false,
    counts: { ...DEFAULT_COUNTS },
    loadedTabs: new Set<ClinicalTabSection>(),
    evolutions: [],
    vitalEvolutions: [],
    medicalHistory: null,
    aestheticData: null,
    prescriptions: [],
    homeCareFichas: [],
    prescricoesExames: [],
    termos: [],
    propostas: [],
    updatedAt: Date.now(),
  };
}

export function getCachedPatientClinical(
  clientId: string,
  roleScope: ClinicalRoleScope
): PatientClinicalCacheEntry | null {
  const entry = clinicalSessionCache.get(clientId);
  if (!entry) return null;
  if (entry.roleScope !== roleScope) {
    clinicalSessionCache.delete(clientId);
    return null;
  }
  return entry;
}

export function updatePatientClinicalCache(
  clientId: string,
  roleScope: ClinicalRoleScope,
  patch: {
    loadedTab?: ClinicalTabSection;
    countsLoaded?: boolean;
    counts?: Partial<ClinicalTabCounts>;
    evolutions?: ClinicalEvolution[];
    vitalEvolutions?: ClinicalEvolution[];
    medicalHistory?: MedicalHistory | null;
    aestheticData?: { facial: any; corporal: any } | null;
    prescriptions?: PrescriptionItem[];
    homeCareFichas?: HomeCareFichaCompleta[];
    prescricoesExames?: PrescricaoExame[];
    termos?: TermoConsentimento[];
    propostas?: Proposta[];
  }
): PatientClinicalCacheEntry {
  const existing = getCachedPatientClinical(clientId, roleScope);
  const base = existing || createEmptyEntry(clientId, roleScope);
  const nextLoadedTabs = new Set(base.loadedTabs);
  if (patch.loadedTab) {
    nextLoadedTabs.add(patch.loadedTab);
  }

  const nextEntry: PatientClinicalCacheEntry = {
    ...base,
    countsLoaded: patch.countsLoaded ?? base.countsLoaded,
    counts: patch.counts ? { ...base.counts, ...patch.counts } : base.counts,
    loadedTabs: nextLoadedTabs,
    evolutions: patch.evolutions !== undefined ? patch.evolutions : base.evolutions,
    vitalEvolutions:
      patch.vitalEvolutions !== undefined ? patch.vitalEvolutions : base.vitalEvolutions,
    medicalHistory:
      patch.medicalHistory !== undefined ? patch.medicalHistory : base.medicalHistory,
    aestheticData:
      patch.aestheticData !== undefined ? patch.aestheticData : base.aestheticData,
    prescriptions:
      patch.prescriptions !== undefined ? patch.prescriptions : base.prescriptions,
    homeCareFichas:
      patch.homeCareFichas !== undefined ? patch.homeCareFichas : base.homeCareFichas,
    prescricoesExames:
      patch.prescricoesExames !== undefined
        ? patch.prescricoesExames
        : base.prescricoesExames,
    termos: patch.termos !== undefined ? patch.termos : base.termos,
    propostas: patch.propostas !== undefined ? patch.propostas : base.propostas,
    updatedAt: Date.now(),
  };

  clinicalSessionCache.set(clientId, nextEntry);
  return nextEntry;
}

/**
 * Invalida o cache do paciente (usado após mutações: criar, editar, suspender, excluir ou assinar).
 */
export function invalidatePatientClinicalCache(clientId?: string | null): void {
  if (!clientId) return;
  clinicalSessionCache.delete(clientId);
  // Remove eventuais requisições em andamento daquele paciente para garantir recarga fresca
  for (const key of inFlightRequests.keys()) {
    if (key.startsWith(`${clientId}:`)) {
      inFlightRequests.delete(key);
    }
  }
}

export function clearAllClinicalSessionCache(): void {
  clinicalSessionCache.clear();
  inFlightRequests.clear();
}

/**
 * Deduplica chamadas concorrentes com a mesma chave no mesmo ciclo de montagem/efeito.
 */
export function dedupeClinicalRequest<T>(
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
