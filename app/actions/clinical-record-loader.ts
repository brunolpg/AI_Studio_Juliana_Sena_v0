"use server";

import { verifyProfissionalOrOwnPaciente } from "@/lib/auth/session";
import { sanitizeVehicleText, formatPrescriptionSummaryString } from "@/lib/prescricoes/format";
import type {
  ClinicalEvolution,
  MedicalHistory,
  PrescriptionItem,
} from "@/types/clinical-record";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { PrescricaoExame } from "@/types/prescricao-exame";
import type { Proposta } from "@/types/proposta";
import type { TermoConsentimento } from "@/types/termo";

export type ClinicalTabSection =
  | "evolucoes"
  | "historico"
  | "prescricoes"
  | "termos"
  | "propostas";

export interface ClinicalTabCounts {
  evolucoes: number;
  prescricoesAtivas: number;
  termos: number;
  propostasAtivas: number;
  hasAlergias: boolean;
}

export interface ClinicalSectionPayload {
  evolutions?: ClinicalEvolution[];
  vitalEvolutions?: ClinicalEvolution[];
  medicalHistory?: MedicalHistory;
  aestheticData?: { facial: any; corporal: any };
  prescriptions?: PrescriptionItem[];
  homeCareFichas?: HomeCareFichaCompleta[];
  prescricoesExames?: PrescricaoExame[];
  termos?: TermoConsentimento[];
  propostas?: Proposta[];
}

export interface ClinicalTabBundleResult {
  success: boolean;
  message?: string;
  data?: {
    clientId: string;
    tab: ClinicalTabSection;
    counts?: Partial<ClinicalTabCounts>;
    section: ClinicalSectionPayload;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_MEDICAL_HISTORY: MedicalHistory = {
  alergias: [],
  comorbidades: [],
  medicamentosUsoContinuo: [],
  acompanhamentoMedico: [],
  isotretinoina6Meses: false,
  lesoesDetalhes: "",
  implantesDispositivos: [],
  ingestaoAgua: "",
  qualidadeSono: "",
  funcionamentoIntestino: "",
  fotosAreaTratada: [],
  tipoSanguineo: "Não informado",
  historicoCirurgico: "",
  historicoFamiliar: "",
  habitosVida: {
    tabagismo: "Não fuma",
    etilismo: "Não consome",
    atividadeFisica: "Sedentário",
  },
  observacoesGerais: "",
};

const EVOLUCOES_LIST_COLUMNS_STAFF = `
  id,
  paciente_id,
  data,
  horario,
  tipo,
  tipo_atendimento,
  status,
  procedimento_id,
  appointment_id,
  exames_anexos,
  fotos_paciente,
  profissional,
  especialidade,
  subjetivo,
  objetivo,
  sinais_vitais,
  avaliacao,
  plano,
  prescricoes_ids,
  home_care_ficha_id,
  payload_hash,
  algoritmo,
  assinado_em,
  created_at,
  home_care_ficha:home_care_fichas (
    id,
    titulo_protocolo,
    data_home_care,
    status,
    payload_hash,
    incluir_atencao_critica,
    atencao_critica_titulo,
    atencao_critica_texto
  )
`;

const EVOLUCOES_LIST_COLUMNS_ADMIN = `
  id,
  paciente_id,
  data,
  horario,
  tipo,
  tipo_atendimento,
  status,
  procedimento_id,
  appointment_id,
  exames_anexos,
  profissional,
  especialidade,
  subjetivo,
  objetivo,
  sinais_vitais,
  avaliacao,
  plano,
  prescricoes_ids,
  home_care_ficha_id,
  payload_hash,
  algoritmo,
  assinado_em,
  created_at,
  home_care_ficha:home_care_fichas (
    id,
    titulo_protocolo,
    data_home_care,
    status,
    payload_hash,
    incluir_atencao_critica,
    atencao_critica_titulo,
    atencao_critica_texto
  )
`;

const PRESCRICOES_LIST_COLUMNS = `
  id,
  paciente_id,
  data_prescricao,
  status,
  observacoes,
  justificativa_suspensao,
  data_suspensao,
  pdf_assinado_url,
  data_assinatura,
  prescricao_itens (
    id,
    nome_formula,
    via,
    veiculo,
    dosagem,
    tipo_veiculo,
    posologia,
    duracao,
    orient_paciente,
    orient_farmacia,
    componentes_snapshot
  )
`;

const PRESCRICOES_SUMMARY_COLUMNS = `
  id,
  data_prescricao,
  status,
  prescricao_itens (
    nome_formula
  )
`;

const HOME_CARE_FICHAS_COLUMNS = `
  id,
  paciente_id,
  appointment_id,
  titulo_protocolo,
  data_home_care,
  incluir_atencao_critica,
  atencao_critica_titulo,
  atencao_critica_texto,
  incluir_recomendacoes,
  status,
  profissional,
  payload_hash,
  algoritmo,
  assinado_em,
  created_at,
  updated_at,
  paciente:pacientes (id, nome, cpf, data_nascimento, email, telefone),
  appointment:appointments (id, data, horario_inicio, horario_fim, procedimento)
`;

const PRESCRICOES_EXAMES_COLUMNS = `
  id,
  paciente_id,
  titulo,
  data,
  descricao,
  grupos_exames,
  orientacoes,
  status,
  justificativa_suspensao,
  data_suspensao,
  profissional,
  payload_hash,
  algoritmo,
  assinado_em,
  created_at,
  updated_at
`;

const TERMOS_LIST_COLUMNS = `
  id,
  paciente_id,
  modelo_id,
  procedimento_nome,
  data,
  conteudo_snapshot,
  assinado,
  origem_pdf,
  pdf_path,
  assinado_em,
  profissional,
  created_at,
  updated_at
`;

const PROPOSTAS_LIST_COLUMNS = `
  id,
  paciente_id,
  titulo,
  objetivo,
  opcoes,
  cronograma,
  topicos,
  status,
  justificativa_suspensao,
  data_suspensao,
  profissional,
  payload_hash,
  algoritmo,
  assinado_em,
  created_at,
  updated_at
`;

const HISTORICO_CLINICO_BASE_COLUMNS = `
  id,
  paciente_id,
  alergias,
  comorbidades,
  medicamentos_uso_continuo,
  acompanhamento_medico,
  isotretinoina_6_meses,
  lesoes_detalhes,
  implantes_dispositivos,
  ingestao_agua,
  qualidade_sono,
  funcionamento_intestino,
  tipo_sanguineo,
  historico_cirurgico,
  historico_familiar,
  tabagismo,
  etilismo,
  atividade_fisica,
  observacoes_gerais,
  updated_at
`;

const HISTORICO_CLINICO_COLUMNS_STAFF = `${HISTORICO_CLINICO_BASE_COLUMNS}, fotos_area_tratada`;
const HISTORICO_CLINICO_COLUMNS_ADMIN = HISTORICO_CLINICO_BASE_COLUMNS;

const AVALIACAO_FACIAL_COLUMNS = `
  id,
  paciente_id,
  tipo_pele,
  textura,
  fototipo,
  hidratacao,
  oleosidade,
  escala_glogau,
  acne_grau,
  discromias,
  textura_relevo,
  vascularizacao,
  outras_alteracoes,
  avaliacao_lupa,
  exames_laboratoriais,
  created_at,
  updated_at
`;

const AVALIACAO_CORPORAL_COLUMNS = `
  id,
  paciente_id,
  fototipo,
  hidratacao_pele,
  estrias_localizacao,
  estrias_localizacao_outros,
  estrias_tipo_coloracao,
  estrias_espessura,
  tempo_estimado_surgimento,
  fatores_desencadeantes,
  alteracoes_associadas,
  created_at,
  updated_at
`;

function mapMedicalHistory(dbHistory: any, isAdminRole: boolean): MedicalHistory {
  if (!dbHistory) return { ...DEFAULT_MEDICAL_HISTORY };
  return {
    alergias: dbHistory.alergias || [],
    comorbidades: dbHistory.comorbidades || [],
    medicamentosUsoContinuo:
      dbHistory.medicamentos_uso_continuo || dbHistory.medicamentosUsoContinuo || [],
    acompanhamentoMedico: dbHistory.acompanhamento_medico || [],
    isotretinoina6Meses: Boolean(dbHistory.isotretinoina_6_meses),
    lesoesDetalhes: dbHistory.lesoes_detalhes || "",
    implantesDispositivos: dbHistory.implantes_dispositivos || [],
    ingestaoAgua: dbHistory.ingestao_agua || "",
    qualidadeSono: dbHistory.qualidade_sono || "",
    funcionamentoIntestino: dbHistory.funcionamento_intestino || "",
    fotosAreaTratada: isAdminRole ? [] : dbHistory.fotos_area_tratada || [],
    tipoSanguineo: dbHistory.tipo_sanguineo || dbHistory.tipoSanguineo || "Não informado",
    historicoCirurgico: dbHistory.historico_cirurgico || dbHistory.historicoCirurgico || "",
    historicoFamiliar: dbHistory.historico_familiar || dbHistory.historicoFamiliar || "",
    habitosVida: {
      tabagismo: dbHistory.tabagismo || "Não fuma",
      etilismo: dbHistory.etilismo || "Não consome",
      atividadeFisica: dbHistory.atividade_fisica || "Sedentário",
    },
    observacoesGerais: dbHistory.observacoes_gerais || dbHistory.observacoesGerais || "",
    updated_at: dbHistory.updated_at,
  };
}

function mapPrescriptions(prescricoesDb: any[] | null, clientId: string): PrescriptionItem[] {
  const mapped: PrescriptionItem[] = [];
  if (!prescricoesDb || prescricoesDb.length === 0) return mapped;

  const fallbackDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  for (const p of prescricoesDb) {
    const items = p.prescricao_itens || [];
    for (const item of items) {
      const snap = (item.componentes_snapshot as any[]) || [];
      const listAtivos = snap
        .map((c: any) => `${c.nome}: ${c.quantidade}${c.unidade || "%"}`)
        .join(" + ");

      const cleanVeiculo = sanitizeVehicleText(item.veiculo);
      const sanitizedTipoVeiculo = item.tipo_veiculo;
      const formattedDosagem = formatPrescriptionSummaryString({
        ativos: listAtivos,
        via: item.via,
        veiculo: cleanVeiculo,
        dosagem: item.dosagem,
        duracao: item.duracao,
        tipoVeiculo: sanitizedTipoVeiculo,
      });

      const combinedInstrucoes = [
        item.orient_paciente ? `[Orientações ao Paciente]\n${item.orient_paciente}` : "",
        item.orient_farmacia ? `[Observações à Farmácia Magistral]\n${item.orient_farmacia}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      mapped.push({
        id: p.id,
        prescricao_id: p.id,
        item_id: item.id,
        client_id: clientId,
        data: p.data_prescricao || fallbackDate,
        data_prescricao: p.data_prescricao || fallbackDate,
        medicamento: item.nome_formula || "Fórmula Magistral",
        nome_formula: item.nome_formula || "Fórmula Magistral",
        dosagem: formattedDosagem || String(item.dosagem ?? ""),
        via: item.via === "oral" ? "Oral" : "Tópico",
        posologia: item.posologia || "",
        duracao:
          item.via === "oral"
            ? `${item.duracao} ${sanitizedTipoVeiculo || "dose(s)"}`
            : "Uso recomendado",
        ativo: p.status === "Ativo",
        status: p.status,
        justificativa_suspensao: p.justificativa_suspensao ?? null,
        data_suspensao: p.data_suspensao ?? null,
        instrucoes: combinedInstrucoes || undefined,
        orient_paciente: item.orient_paciente || undefined,
        orient_farmacia: item.orient_farmacia || undefined,
        componentes: snap.map((c: any) => ({
          nome: c.nome,
          quantidade: c.quantidade,
          unidade: c.unidade || "%",
        })),
        item: {
          nome_formula: item.nome_formula,
          via: item.via,
          veiculo: cleanVeiculo || null,
          dosagem: item.dosagem,
          tipo_veiculo: sanitizedTipoVeiculo,
          posologia: item.posologia,
          duracao: item.duracao,
          orient_paciente: item.orient_paciente,
          orient_farmacia: item.orient_farmacia,
          componentes_snapshot: snap,
        },
        pdf_assinado_url: p.pdf_assinado_url ?? null,
        data_assinatura: p.data_assinatura ?? null,
      });
    }
  }

  return mapped;
}

function mapEvolutions(
  evDb: any[] | null,
  prescricoesSummary: any[] | null,
  isAdminRole: boolean
): ClinicalEvolution[] {
  if (!evDb || evDb.length === 0) return [];

  const prescMap = new Map<string, any>();
  for (const p of prescricoesSummary || []) {
    prescMap.set(p.id, p);
  }

  return evDb.map((e: any) => {
    const linkedPrescs = (e.prescricoes_ids || [])
      .map((rxId: string) => prescMap.get(rxId))
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
        data_prescricao: p.data_prescricao,
        status: p.status,
        formulas: (p.prescricao_itens || []).map((it: any) => it.nome_formula),
      }));

    return {
      id: e.id,
      client_id: e.paciente_id,
      data: e.data,
      horario: e.horario,
      tipo: e.tipo,
      tipo_atendimento: e.tipo_atendimento,
      status: e.status || "Ativo",
      procedimento_id: e.procedimento_id,
      appointment_id: e.appointment_id,
      exames_anexos: e.exames_anexos || [],
      fotos_paciente: isAdminRole ? [] : e.fotos_paciente || [],
      profissional: e.profissional,
      especialidade: e.especialidade,
      subjetivo: e.subjetivo,
      objetivo: e.objetivo,
      sinaisVitais: e.sinais_vitais || undefined,
      avaliacao: e.avaliacao,
      plano: e.plano,
      prescricoes_ids: e.prescricoes_ids || [],
      home_care_ficha_id: e.home_care_ficha_id || null,
      home_care_ficha: e.home_care_ficha || null,
      prescricoes_detalhes: linkedPrescs,
      payload_hash: e.payload_hash || undefined,
      algoritmo: e.algoritmo || undefined,
      assinado_em: e.assinado_em || undefined,
      created_at: e.created_at,
    };
  });
}

/**
 * Carregador otimizado e sob demanda do Prontuário Clínico:
 * - Executa apenas UMA verificação de autenticação/sessão por chamada.
 * - Prioriza exclusivamente os dados da aba ativa com projeção enxuta de colunas.
 * - Opcionalmente traz contadores leves (head: true) das abas inativas em paralelo via Promise.all.
 */
export async function getClinicalTabBundleAction(
  pacienteId: string,
  activeTab: ClinicalTabSection,
  options?: {
    includeCounts?: boolean;
    skipVitals?: boolean;
  }
): Promise<ClinicalTabBundleResult> {
  try {
    if (!pacienteId || !UUID_REGEX.test(pacienteId)) {
      return { success: false, message: "ID de paciente inválido." };
    }

    const auth = await verifyProfissionalOrOwnPaciente(pacienteId);
    if (!auth.authorized) {
      return { success: false, message: auth.message };
    }

    const supabase = auth.supabase;
    const isAdminRole = auth.user.role === "administrador";
    const isPatientRole = !auth.isProfissional;
    const includeCounts = options?.includeCounts ?? false;
    const skipVitals = options?.skipVitals ?? false;

    // 1. Validação de paciente ativo (soft delete) em paralelo com consultas da aba + contadores
    const pacientePromise = supabase
      .from("pacientes")
      .select("id, nome, cpf, email, telefone")
      .eq("id", pacienteId)
      .is("deleted_at", null)
      .maybeSingle();

    const counts: Partial<ClinicalTabCounts> = {};
    const section: ClinicalSectionPayload = {};

    // Contadores leves (somente para abas inativas quando includeCounts = true)
    const countPromises: Promise<void>[] = [];

    if (includeCounts) {
      if (activeTab !== "evolucoes" && !isPatientRole) {
        countPromises.push(
          Promise.resolve(
            supabase
              .from("evolucoes_clinicas")
              .select("id", { count: "exact", head: true })
              .eq("paciente_id", pacienteId)
          )
            .then(({ count }) => {
              counts.evolucoes = count ?? 0;
            })
            .catch(() => {
              counts.evolucoes = 0;
            })
        );
      }

      if (activeTab !== "historico" && !isPatientRole) {
        countPromises.push(
          Promise.resolve(
            supabase
              .from("historico_clinico")
              .select("alergias")
              .eq("paciente_id", pacienteId)
              .maybeSingle()
          )
            .then(({ data }) => {
              counts.hasAlergias = Array.isArray(data?.alergias) && data.alergias.length > 0;
            })
            .catch(() => {
              counts.hasAlergias = false;
            })
        );
      }

      if (activeTab !== "prescricoes" && activeTab !== "evolucoes") {
        countPromises.push(
          Promise.resolve(
            supabase
              .from("prescricoes")
              .select("id", { count: "exact", head: true })
              .eq("paciente_id", pacienteId)
              .eq("status", "Ativo")
          )
            .then(({ count }) => {
              counts.prescricoesAtivas = count ?? 0;
            })
            .catch(() => {
              counts.prescricoesAtivas = 0;
            })
        );
      }

      if (activeTab !== "termos" && !isPatientRole) {
        countPromises.push(
          Promise.resolve(
            supabase
              .from("termos")
              .select("id", { count: "exact", head: true })
              .eq("paciente_id", pacienteId)
          )
            .then(({ count }) => {
              counts.termos = count ?? 0;
            })
            .catch(() => {
              counts.termos = 0;
            })
        );
      }

      if (activeTab !== "propostas") {
        countPromises.push(
          Promise.resolve(
            supabase
              .from("propostas")
              .select("id", { count: "exact", head: true })
              .eq("paciente_id", pacienteId)
              .eq("status", "Ativo")
          )
            .then(({ count }) => {
              counts.propostasAtivas = count ?? 0;
            })
            .catch(() => {
              counts.propostasAtivas = 0;
            })
        );
      }
    }

    // 2. Consultas enxutas e paralelas exclusivas da aba ativa
    let activeTabPromise: Promise<void>;

    if (activeTab === "evolucoes") {
      activeTabPromise = Promise.all([
        supabase
          .from("evolucoes_clinicas")
          .select(isAdminRole ? EVOLUCOES_LIST_COLUMNS_ADMIN : EVOLUCOES_LIST_COLUMNS_STAFF)
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("prescricoes")
          .select(PRESCRICOES_SUMMARY_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("data_prescricao", { ascending: false }),
      ]).then(([evRes, rxSummaryRes]) => {
        const summaryList = !rxSummaryRes.error && rxSummaryRes.data ? rxSummaryRes.data : [];
        const mapped = !evRes.error
          ? mapEvolutions(evRes.data, summaryList, isAdminRole)
          : [];
        section.evolutions = mapped;
        section.vitalEvolutions = mapped.filter((e) => Boolean(e.sinaisVitais));
        counts.evolucoes = mapped.length;
        counts.prescricoesAtivas = summaryList.filter((p: any) => p.status === "Ativo").length;
      });
    } else if (activeTab === "historico") {
      activeTabPromise = Promise.all([
        supabase
          .from("historico_clinico")
          .select(
            isAdminRole
              ? HISTORICO_CLINICO_COLUMNS_ADMIN
              : HISTORICO_CLINICO_COLUMNS_STAFF
          )
          .eq("paciente_id", pacienteId)
          .maybeSingle(),
        supabase
          .from("avaliacoes_faciais")
          .select(AVALIACAO_FACIAL_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("avaliacoes_corporais")
          .select(AVALIACAO_CORPORAL_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        skipVitals || isPatientRole
          ? Promise.resolve({ data: null, error: null })
          : supabase
              .from("evolucoes_clinicas")
              .select("id, paciente_id, data, horario, tipo, profissional, especialidade, sinais_vitais, created_at")
              .eq("paciente_id", pacienteId)
              .not("sinais_vitais", "is", null)
              .order("created_at", { ascending: false }),
      ]).then(([histRes, facialRes, corporalRes, vitalsRes]) => {
        const mappedHistory = mapMedicalHistory(
          !histRes.error ? histRes.data : null,
          isAdminRole
        );
        section.medicalHistory = mappedHistory;
        counts.hasAlergias = mappedHistory.alergias.length > 0;
        section.aestheticData = {
          facial: !facialRes.error ? facialRes.data || null : null,
          corporal: !corporalRes.error ? corporalRes.data || null : null,
        };
        if (!skipVitals && !isPatientRole && !vitalsRes.error && Array.isArray(vitalsRes.data)) {
          section.vitalEvolutions = vitalsRes.data.map((v: any) => ({
            id: v.id,
            client_id: v.paciente_id,
            data: v.data,
            horario: v.horario || "",
            tipo: v.tipo || "Consulta",
            profissional: v.profissional || "",
            especialidade: v.especialidade || "",
            subjetivo: "",
            objetivo: "",
            avaliacao: "",
            plano: "",
            sinaisVitais: v.sinais_vitais || undefined,
            created_at: v.created_at,
          }));
        }
      });
    } else if (activeTab === "prescricoes") {
      activeTabPromise = Promise.all([
        supabase
          .from("prescricoes")
          .select(PRESCRICOES_LIST_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("data_prescricao", { ascending: false }),
        supabase
          .from("home_care_fichas")
          .select(HOME_CARE_FICHAS_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("data_home_care", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("prescricoes_exames")
          .select(PRESCRICOES_EXAMES_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("data", { ascending: false })
          .order("created_at", { ascending: false }),
      ]).then(async ([rxRes, fichasRes, examesRes]) => {
        const mappedPrescs = !rxRes.error ? mapPrescriptions(rxRes.data, pacienteId) : [];
        section.prescriptions = mappedPrescs;
        counts.prescricoesAtivas = mappedPrescs.filter(
          (rx) => rx.status !== "Suspenso" && rx.ativo !== false
        ).length;

        const fichas = !fichasRes.error && fichasRes.data ? fichasRes.data : [];
        if (fichas.length > 0) {
          const fichaIds = fichas.map((f: any) => f.id);
          const [topicosRes, cronoRes] = await Promise.all([
            supabase
              .from("home_care_ficha_topicos")
              .select(`
                ficha_id,
                topico_id,
                grupo,
                ordem,
                topico:home_care_topicos (id, titulo, texto)
              `)
              .in("ficha_id", fichaIds)
              .order("ordem", { ascending: true }),
            supabase
              .from("home_care_cronograma")
              .select("id, ficha_id, ordem, dia_inicio, dia_fim, fase_titulo, formula_id, nome_formula, posologia, objetivo_clinico")
              .in("ficha_id", fichaIds)
              .order("ordem", { ascending: true }),
          ]);

          const topicosByFicha = new Map<string, any[]>();
          for (const ft of topicosRes.data || []) {
            const list = topicosByFicha.get(ft.ficha_id) || [];
            list.push(ft);
            topicosByFicha.set(ft.ficha_id, list);
          }

          const cronoByFicha = new Map<string, any[]>();
          for (const cr of cronoRes.data || []) {
            const list = cronoByFicha.get(cr.ficha_id) || [];
            list.push(cr);
            cronoByFicha.set(cr.ficha_id, list);
          }

          section.homeCareFichas = fichas.map((f: any) => {
            const topicosDaFicha = topicosByFicha.get(f.id) || [];
            const cuidados = topicosDaFicha
              .filter((ft: any) => ft.grupo === "CUIDADOS")
              .map((ft: any) => ({
                topico_id: ft.topico_id,
                grupo: "CUIDADOS" as const,
                ordem: ft.ordem,
                titulo: ft.topico?.titulo || "",
                texto: ft.topico?.texto || "",
              }));
            const recomendacoes = topicosDaFicha
              .filter((ft: any) => ft.grupo === "RECOMENDACOES")
              .map((ft: any) => ({
                topico_id: ft.topico_id,
                grupo: "RECOMENDACOES" as const,
                ordem: ft.ordem,
                titulo: ft.topico?.titulo || "",
                texto: ft.topico?.texto || "",
              }));

            return {
              ...f,
              cuidados,
              cronograma: cronoByFicha.get(f.id) || [],
              recomendacoes,
            } as HomeCareFichaCompleta;
          });
        } else {
          section.homeCareFichas = [];
        }

        section.prescricoesExames = (!examesRes.error && examesRes.data ? examesRes.data : []) as PrescricaoExame[];
      });
    } else if (activeTab === "termos") {
      activeTabPromise = isPatientRole
        ? Promise.resolve().then(() => {
            section.termos = [];
            counts.termos = 0;
          })
        : Promise.resolve(
            supabase
              .from("termos")
              .select(TERMOS_LIST_COLUMNS)
              .eq("paciente_id", pacienteId)
              .order("data", { ascending: false })
              .order("created_at", { ascending: false })
          ).then(({ data, error }) => {
            const list = !error && data ? (data as TermoConsentimento[]) : [];
            section.termos = list;
            counts.termos = list.length;
          });
    } else {
      // "propostas"
      activeTabPromise = Promise.resolve(
        supabase
          .from("propostas")
          .select(PROPOSTAS_LIST_COLUMNS)
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false })
      ).then(({ data, error }) => {
        const list = !error && data ? (data as Proposta[]) : [];
        section.propostas = list;
        counts.propostasAtivas = list.filter((p) => p.status === "Ativo").length;
      });
    }

    const [pacienteRes] = await Promise.all([
      pacientePromise,
      activeTabPromise,
      ...countPromises,
    ]);

    if (pacienteRes.error || !pacienteRes.data) {
      return {
        success: false,
        message: "Paciente não encontrado ou inativo.",
      };
    }

    // Enriquece exames com dados básicos do paciente sem consulta adicional
    if (section.prescricoesExames && section.prescricoesExames.length > 0) {
      const pac = pacienteRes.data;
      section.prescricoesExames = section.prescricoesExames.map((row) => ({
        ...row,
        paciente: {
          id: pac.id,
          nome: pac.nome,
          cpf: pac.cpf,
          email: pac.email,
          telefone: pac.telefone,
        },
      }));
    }

    return {
      success: true,
      data: {
        clientId: pacienteId,
        tab: activeTab,
        counts,
        section,
      },
    };
  } catch (err: any) {
    console.error("Erro em getClinicalTabBundleAction:", err);
    return {
      success: false,
      message: err?.message || "Falha ao carregar dados do prontuário clínico.",
    };
  }
}
