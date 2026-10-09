"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  FileHeart,
  Activity,
  Pill,
  Gauge,
  Plus,
  Edit2,
  Calendar,
  Clock,
  User,
  ShieldAlert,
  Heart,
  Scale,
  Thermometer,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  FileText,
  BadgeAlert,
  Sparkles,
  Image as ImageIcon,
  Printer,
  X,
} from "lucide-react";
import {
  getPatientClinicalRecordAction,
  togglePrescriptionStatusAction,
  getAestheticEvaluationAction,
} from "@/actions/clinical-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { EvolutionFormModal } from "./evolution-form-modal";
import { MedicalHistoryModal } from "./medical-history-modal";
import { PrescriptionModal } from "./prescription-modal";
import { PrintPrescriptionModal } from "./print-prescription-modal";
import { AestheticEvaluationModal } from "./aesthetic-evaluation-modal";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type {
  PatientClinicalRecord,
  ClinicalEvolution,
  PrescriptionItem,
} from "@/types/clinical-record";

interface PatientClinicalTabsProps {
  client: Client;
  onRefreshClient?: () => void;
}

export type ClinicalSubTab = "historico" | "evolucoes" | "prescricoes" | "metricas";

export function PatientClinicalTabs({ client, onRefreshClient }: PatientClinicalTabsProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<ClinicalSubTab>("evolucoes");
  const [isPending, startTransition] = useTransition();

  const [clinicalRecord, setClinicalRecord] = useState<PatientClinicalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modais e Lightbox
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedRxForPrint, setSelectedRxForPrint] = useState<PrescriptionItem | null>(null);

  // Modal de suspensão de receita
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const [justificativaTexto, setJustificativaTexto] = useState("");
  const [selectedRxForSuspension, setSelectedRxForSuspension] = useState<string | null>(null);
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false);

  // Avaliação Estética Integrada
  const [isAestheticModalOpen, setIsAestheticModalOpen] = useState(false);
  const [aestheticData, setAestheticData] = useState<{ facial: any; corporal: any } | null>(null);

  // Carrega prontuário do paciente
  const loadClinicalData = useCallback(() => {
    const isValidUUID = (id?: string | null) => 
      typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isValidUUID(client?.id)) {
      setClinicalRecord(null);
      setIsLoading(false);
      return;
    }

    startTransition(async () => {
      try {
        setIsLoading(true);
        const res = await getPatientClinicalRecordAction(client.id);
        if (res.success && res.data) {
          const record = { ...res.data };
          try {
            const supabase = getSupabaseClient();
            if (supabase) {
              const { data: dbPrescs, error: dbErr } = await supabase
                .from("prescricoes")
                .select(`
                  id,
                  paciente_id,
                  data_prescricao,
                  status,
                  justificativa_suspensao,
                  data_suspensao,
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
                `)
                .eq("paciente_id", client.id);

              if (dbPrescs && !dbErr) {
                const mappedPrescriptions: PrescriptionItem[] = dbPrescs.map((p: any) => {
                  const item = p.prescricao_itens && p.prescricao_itens[0];
                  const componentsList = item?.componentes_snapshot || [];
                  
                  // Reconstrução da dosagem formatada
                  const listAtivos = Array.isArray(componentsList)
                    ? componentsList.map((c: any) => `${c.nome}: ${c.quantidade}${c.unidade || ""}`).join(" + ")
                    : "";
                  
                  const formattedDosagem = item?.via?.toLowerCase() === "oral"
                    ? `${listAtivos} em ${item?.veiculo} (Dose: ${item?.dosagem} | Total: ${item?.duracao} ${item?.tipo_veiculo})`
                    : `${listAtivos} em ${item?.veiculo} q.s.p. ${item?.dosagem}g (Total: ${item?.duracao}${item?.tipo_veiculo || "un"})`;

                  const combinedInstrucoes = [
                    item?.orient_paciente ? `[Orientações ao Paciente]\n${item.orient_paciente}` : "",
                    item?.orient_farmacia ? `[Observações à Farmácia Magistral]\n${item.orient_farmacia}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n\n");

                  return {
                    id: p.id,
                    client_id: p.paciente_id,
                    data: p.data_prescricao,
                    medicamento: item?.nome_formula || "Fórmula Magistral",
                    dosagem: formattedDosagem || item?.dosagem || "",
                    via: item?.via === "oral" ? "Oral" : "Tópico",
                    posologia: item?.posologia || "",
                    duracao: item?.via === "oral" ? `${item?.duracao} ${item?.tipo_veiculo}` : "Uso recomendado",
                    ativo: p.status === "Ativo",
                    instrucoes: combinedInstrucoes || undefined,
                    status: p.status,
                    justificativa_suspensao: p.justificativa_suspensao,
                    data_suspensao: p.data_suspensao,
                  };
                });

                record.prescriptions = mappedPrescriptions;
              }
            }
          } catch (err) {
            console.warn("Erro ao buscar prescrições do Supabase:", err);
          }

          // Busca avaliação estética
          try {
            const aesRes = await getAestheticEvaluationAction(client.id);
            if (aesRes.success && aesRes.data) {
              setAestheticData(aesRes.data);
            }
          } catch (aesErr) {
            console.warn("Erro ao buscar avaliações estéticas:", aesErr);
          }

          setClinicalRecord(record);
        } else {
          toast({
            type: "error",
            title: "Erro ao carregar prontuário",
            description: res.message,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    });
  }, [client?.id, toast]);

  useEffect(() => {
    loadClinicalData();
  }, [loadClinicalData]);

  // Função para suspender receita com persistência real
  const handleConfirmSuspension = async () => {
    if (!selectedRxForSuspension || !justificativaTexto.trim()) return;

    try {
      setIsSubmittingSuspension(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          type: "error",
          title: "Erro de conexão",
          description: "Não foi possível conectar ao Supabase.",
        });
        return;
      }

      const { error } = await supabase
        .from("prescricoes")
        .update({
          status: "Suspenso",
          justificativa_suspensao: justificativaTexto.trim(),
          data_suspensao: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedRxForSuspension);

      if (error) {
        toast({
          type: "error",
          title: "Erro ao suspender receita",
          description: error.message,
        });
      } else {
        toast({
          type: "success",
          title: "Receita suspensa",
          description: "A receita foi suspensa com sucesso.",
        });
        setIsSuspensionModalOpen(false);
        setJustificativaTexto("");
        setSelectedRxForSuspension(null);
        
        // Atualização otimista no estado local
        if (clinicalRecord) {
          const updatedPrescriptions = clinicalRecord.prescriptions.map((rx) => {
            if (rx.id === selectedRxForSuspension) {
              return {
                ...rx,
                ativo: false,
                status: "Suspenso" as const,
                justificativa_suspensao: justificativaTexto.trim(),
                data_suspensao: new Date().toISOString(),
              };
            }
            return rx;
          });
          setClinicalRecord({
            ...clinicalRecord,
            prescriptions: updatedPrescriptions,
          });
        }

        loadClinicalData();
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: err.message || "Ocorreu um erro ao suspender a receita.",
      });
    } finally {
      setIsSubmittingSuspension(false);
    }
  };

  // Alterna status de prescrição (legado/fallback)
  const handleTogglePrescription = async (prescriptionId: string) => {
    try {
      const res = await togglePrescriptionStatusAction(client.id, prescriptionId);
      if (res.success) {
        toast({
          type: "success",
          title: "Status atualizado",
          description: res.message,
        });
        loadClinicalData();
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Erro",
        description: "Não foi possível alterar a prescrição.",
      });
    }
  };

  const history = clinicalRecord?.medicalHistory;
  const evolutions = clinicalRecord?.evolutions || [];
  const prescriptions = clinicalRecord?.prescriptions || [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Barra de Navegação Interna das Abas Clínicas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 gap-3">
        {/* Abas */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("evolucoes")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "evolucoes"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Evoluções & Consultas</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60">
              {evolutions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("historico")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "historico"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <FileHeart className="w-3.5 h-3.5" />
            <span>Histórico & Anamnese</span>
            {history?.alergias && history.alergias.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Alergias
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("prescricoes")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "prescricoes"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Prescrições</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {prescriptions.filter((p) => p.ativo).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("metricas")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === "metricas"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Sinais Vitais & Biometria</span>
          </button>
        </div>

        {/* Botão de Ação Primária Contextual */}
        <div className="flex items-center gap-2 shrink-0">
          {activeSubTab === "evolucoes" && (
            <button
              type="button"
              onClick={() => setIsEvolutionModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Evolução Clínica</span>
            </button>
          )}

          {activeSubTab === "historico" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAestheticModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500 text-teal-600 dark:text-teal-400 text-xs sm:text-sm font-semibold hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors shadow-2xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Avaliação Estética</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 rounded-xl transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Histórico Clínico</span>
              </button>
            </div>
          )}

          {activeSubTab === "prescricoes" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  console.log("Abrir cuidados & orientações");
                  toast({
                    type: "info",
                    title: "Em desenvolvimento",
                    description: "Módulo de Cuidados & Orientações será disponibilizado em breve.",
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <span>+ Cuidados & Orientações</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrescriptionModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Prescrever Receita</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="p-6">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Carregando prontuário médico de {client.nome}...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* ABA 1: EVOLUÇÕES CLÍNICAS (SOAP) */}
            {/* ======================================================== */}
            {activeSubTab === "evolucoes" && (
              <div className="space-y-5">
                {evolutions.length === 0 ? (
                  <div className="py-12 text-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Nenhuma evolução registrada
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Inicie o prontuário deste paciente adicionando a primeira consulta ou evolução no padrão SOAP.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEvolutionModalOpen(true)}
                      className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer"
                    >
                      + Adicionar Primeira Evolução
                    </button>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 sm:ml-4 pl-4 sm:pl-6 space-y-6">
                    {evolutions.map((evo) => {
                      const [year, month, day] = evo.data.split("-");
                      const dateFormatted = `${day}/${month}/${year}`;

                      return (
                        <div
                          key={evo.id}
                          className="relative group bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs hover:shadow-xs transition-all"
                        >
                          {/* Marcador na Timeline */}
                          <div className="absolute -left-[27px] sm:-left-[35px] top-6 w-5 h-5 rounded-full bg-teal-600 border-4 border-white dark:border-slate-900 text-white flex items-center justify-center shadow-xs" />

                          {/* Topo do Cartão de Evolução */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {dateFormatted} às {evo.horario}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  evo.tipo === "Consulta"
                                    ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                                    : evo.tipo === "Retorno"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                    : evo.tipo === "Urgência"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200"
                                }`}
                              >
                                {evo.tipo}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <User className="w-3.5 h-3.5 text-teal-600" />
                              <span className="font-medium">{evo.profissional}</span>
                              <span>•</span>
                              <span>{evo.especialidade}</span>
                            </div>
                          </div>

                          {/* Faixa de Sinais Vitais se houver */}
                          {evo.sinaisVitais && (
                            <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-4 text-xs">
                              {evo.sinaisVitais.pressaoArterial && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="text-slate-500">PA:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.pressaoArterial} mmHg
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.frequenciaCardiaca && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                                  <span className="text-slate-500">FC:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.frequenciaCardiaca} bpm
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.temperatura && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                  <span className="text-slate-500">Tax:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.temperatura} °C
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.peso && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Scale className="w-3.5 h-3.5 text-sky-500" />
                                  <span className="text-slate-500">Peso:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.peso} kg
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.imc && (
                                <div className="flex items-center gap-1 font-mono">
                                  <span className="text-slate-500">IMC:</span>
                                  <strong className="text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded border border-teal-200/50">
                                    {evo.sinaisVitais.imc} kg/m²
                                  </strong>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Estrutura SOAP em 4 Blocos */}
                          <div className="space-y-3 pt-2 text-xs">
                            {/* S */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wide text-[10px] bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded border border-teal-200/60">
                                S • Subjetivo
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.subjetivo}
                              </p>
                            </div>

                            {/* O */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide text-[10px] bg-sky-50 dark:bg-sky-950/80 px-2 py-0.5 rounded border border-sky-200/60">
                                O • Objetivo
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.objetivo}
                              </p>
                            </div>

                            {/* A */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[10px] bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-200/60">
                                A • Avaliação / Diagnóstico
                              </span>
                              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                                {evo.avaliacao}
                              </p>
                            </div>

                            {/* P */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide text-[10px] bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200/60">
                                P • Plano & Conduta Terapêutica
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.plano}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 2: HISTÓRICO CLÍNICO & ANAMNESE */}
            {/* ======================================================== */}
            {activeSubTab === "historico" && (
              <div className="space-y-6">
                {/* Alerta de Alergias */}
                <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                        Alergias e Advertências
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="text-xs text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {history?.alergias && history.alergias.length > 0 ? (
                      history.alergias.map((al, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-rose-800 dark:text-rose-300 border border-rose-200 shadow-2xs"
                        >
                          <BadgeAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>{al}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Nenhuma alergia conhecida ou declarada.
                      </span>
                    )}
                  </div>
                </div>

                {/* Comorbidades & Medicamentos Contínuos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Comorbidades */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" />
                      <span>Comorbidades e Condições Crônicas</span>
                    </h4>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {history?.comorbidades && history.comorbidades.length > 0 ? (
                        history.comorbidades.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Nenhuma comorbidade relatada no prontuário.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Medicamentos em Uso */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-teal-600" />
                      <span>Medicamentos de Uso Contínuo</span>
                    </h4>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {history?.medicamentosUsoContinuo &&
                      history.medicamentosUsoContinuo.length > 0 ? (
                        history.medicamentosUsoContinuo.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                          >
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Paciente não faz uso regular de medicamentos.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acompanhamento Médico (Especialidade) */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    <span>Acompanhamento Médico</span>
                  </h4>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {history?.acompanhamentoMedico && history.acompanhamentoMedico.length > 0 ? (
                      history.acompanhamentoMedico.map((ac, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200"
                        >
                          {ac}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Nenhum acompanhamento médico relatado.
                      </span>
                    )}
                  </div>
                </div>

                {/* Tipo Sanguíneo & Hábitos de Vida */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Tipo Sanguíneo
                    </span>
                    <span className="text-base font-bold text-teal-700 dark:text-teal-400">
                      {history?.tipoSanguineo || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Tabagismo
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.tabagismo || "Não fuma"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Etilismo
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.etilismo || "Não consome"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Atividade Física
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.atividadeFisica || "Sedentário"}
                    </span>
                  </div>
                </div>

                {/* Grade de Hábitos de Vida & Fatores de Risco Adicionais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Isotretinoína (6m)
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${history?.isotretinoina6Meses ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                      {history?.isotretinoina6Meses ? "Sim" : "Não"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Implantes / Marcapasso
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {history?.implantesDispositivos && history.implantesDispositivos.length > 0 ? (
                        history.implantesDispositivos.map((imp, idx) => (
                          <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                            {imp}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Nenhum relatado</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Ingestão de Água
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.ingestaoAgua || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Qualidade do Sono
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.qualidadeSono || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Intestino
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.funcionamentoIntestino || "Não informado"}
                    </span>
                  </div>
                </div>

                {/* Histórico Cirúrgico, Familiar e Lesões */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Histórico Cirúrgico
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {history?.historicoCirurgico || "Nenhuma cirurgia prévia registrada."}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Histórico Familiar & Antecedentes
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {history?.historicoFamiliar || "Sem histórico familiar relevante."}
                    </p>
                  </div>
                </div>

                {/* Lesões (Local, Tratamento e Frequência) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Lesões (Local, Tratamento e Frequência)
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {history?.lesoesDetalhes || "Nenhuma lesão relatada."}
                  </p>
                </div>

                {/* Observações Gerais */}
                {history?.observacoesGerais && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Observações Gerais
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {history.observacoesGerais}
                    </p>
                  </div>
                )}

                {/* Fotos da Área a Ser Tratada */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Fotos da Área a Ser Tratada
                    </span>
                  </div>
                  {history?.fotosAreaTratada && history.fotosAreaTratada.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {history.fotosAreaTratada.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 group">
                          <img
                            src={url}
                            alt={`Área tratada ${idx + 1}`}
                            className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform"
                            onClick={() => setLightboxUrl(url)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhuma foto anexada ao histórico.</p>
                  )}
                </div>

                {/* Seção: Avaliação Estética Integrada */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Ficha de Avaliação Estética (Facial & Corporal)
                    </span>
                  </div>

                  {(!aestheticData || (
                    (!aestheticData.facial || (
                      !aestheticData.facial.tipo_pele &&
                      !aestheticData.facial.textura &&
                      !aestheticData.facial.fototipo &&
                      !aestheticData.facial.glogau &&
                      !aestheticData.facial.acne_grau &&
                      (!aestheticData.facial.discromias || aestheticData.facial.discromias.length === 0) &&
                      (!aestheticData.facial.textura_relevo || aestheticData.facial.textura_relevo.length === 0) &&
                      (!aestheticData.facial.vascularizacao || aestheticData.facial.vascularizacao.length === 0) &&
                      (!aestheticData.facial.outros || aestheticData.facial.outros.length === 0) &&
                      !aestheticData.facial.avaliacao_lupa &&
                      !aestheticData.facial.exames_laboratoriais &&
                      aestheticData.facial.hidratacao_cutanea === null &&
                      aestheticData.facial.oleosidade_sebo === null
                    )) &&
                    (!aestheticData.corporal || (
                      !aestheticData.corporal.fototipo &&
                      !aestheticData.corporal.hidratacao_local &&
                      (!aestheticData.corporal.estrias_localizacao || aestheticData.corporal.estrias_localizacao.length === 0) &&
                      !aestheticData.corporal.estrias_localizacao_outro &&
                      (!aestheticData.corporal.estrias_tipo_coloracao || aestheticData.corporal.estrias_tipo_coloracao.length === 0) &&
                      (!aestheticData.corporal.estrias_espessura_profundidade || aestheticData.corporal.estrias_espessura_profundidade.length === 0) &&
                      !aestheticData.corporal.estrias_tempo_surgimento &&
                      (!aestheticData.corporal.estrias_fator_desencadeante || aestheticData.corporal.estrias_fator_desencadeante.length === 0) &&
                      (!aestheticData.corporal.alteracoes_associadas || aestheticData.corporal.alteracoes_associadas.length === 0)
                    ))
                  )) ? (
                    <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 py-6">
                      <p className="text-xs italic">Nenhuma avaliação estética registrada para este paciente.</p>
                      <button
                        type="button"
                        onClick={() => setIsAestheticModalOpen(true)}
                        className="mt-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Iniciar Avaliação Estética</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* CARD FACIAL */}
                      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                            Avaliação Facial
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAestheticModalOpen(true)}
                            className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-teal-600 hover:underline"
                          >
                            Editar
                          </button>
                        </div>

                        {(!aestheticData?.facial || (
                          !aestheticData.facial.tipo_pele &&
                          !aestheticData.facial.textura &&
                          !aestheticData.facial.fototipo &&
                          !aestheticData.facial.glogau &&
                          !aestheticData.facial.acne_grau &&
                          (!aestheticData.facial.discromias || aestheticData.facial.discromias.length === 0) &&
                          (!aestheticData.facial.textura_relevo || aestheticData.facial.textura_relevo.length === 0) &&
                          (!aestheticData.facial.vascularizacao || aestheticData.facial.vascularizacao.length === 0) &&
                          (!aestheticData.facial.outros || aestheticData.facial.outros.length === 0) &&
                          !aestheticData.facial.avaliacao_lupa &&
                          !aestheticData.facial.exames_laboratoriais &&
                          aestheticData.facial.hidratacao_cutanea === null &&
                          aestheticData.facial.oleosidade_sebo === null
                        )) ? (
                          <p className="text-xs text-slate-400 italic">Sem dados de avaliação facial registrados.</p>
                        ) : (
                          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                            {/* Linha 1: Tipo de Pele, Textura, Fototipo */}
                            <div className="flex flex-wrap gap-2">
                              {aestheticData.facial.tipo_pele && (
                                <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/50 font-semibold">
                                  Pele: {aestheticData.facial.tipo_pele}
                                </span>
                              )}
                              {aestheticData.facial.textura && (
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200/50 font-semibold">
                                  Textura: {aestheticData.facial.textura}
                                </span>
                              )}
                              {aestheticData.facial.fototipo && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 font-bold">
                                  Fototipo: {aestheticData.facial.fototipo}
                                </span>
                              )}
                            </div>

                            {/* Biometria Cutânea */}
                            {(aestheticData.facial.hidratacao_cutanea !== null || aestheticData.facial.oleosidade_sebo !== null) && (
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px]">
                                {aestheticData.facial.hidratacao_cutanea !== null && (
                                  <div>
                                    <span className="text-slate-500 font-semibold">Hidratação: </span>
                                    <strong className="text-teal-700 dark:text-teal-300 font-mono">{aestheticData.facial.hidratacao_cutanea}%</strong>
                                  </div>
                                )}
                                {aestheticData.facial.oleosidade_sebo !== null && (
                                  <div>
                                    <span className="text-slate-500 font-semibold">Oleosidade: </span>
                                    <strong className="text-amber-700 dark:text-amber-300 font-mono">{aestheticData.facial.oleosidade_sebo}%</strong>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Escalas Clínicas */}
                            <div className="space-y-1.5">
                              {aestheticData.facial.glogau && (
                                <div className="text-[11px]">
                                  <span className="text-slate-500 font-semibold">Escala Glogau: </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {aestheticData.facial.glogau === "I" ? "I (Sem rugas / Estágio Inicial)" :
                                     aestheticData.facial.glogau === "II" ? "II (Rugas dinâmicas)" :
                                     aestheticData.facial.glogau === "III" ? "III (Rugas estáticas)" :
                                     "IV (Rugas apenas / Severo)"}
                                  </span>
                                </div>
                              )}
                              {aestheticData.facial.acne_grau && (
                                <div className="text-[11px]">
                                  <span className="text-slate-505 font-semibold">Grau de Acne: </span>
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {aestheticData.facial.acne_grau === "I" ? "I (Comedônica)" :
                                     aestheticData.facial.acne_grau === "II" ? "II (Pápulo-pustulosa)" :
                                     aestheticData.facial.acne_grau === "III" ? "III (Nódulo-cística)" :
                                     "IV (Conglobata)"}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Badges de Alterações */}
                            <div className="space-y-2">
                              {aestheticData.facial.discromias && aestheticData.facial.discromias.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Discromias</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.facial.discromias.map((d: string) => (
                                      <span key={d} className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 text-[10px] font-medium">
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {aestheticData.facial.textura_relevo && aestheticData.facial.textura_relevo.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Textura e Relevo</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.facial.textura_relevo.map((tr: string) => (
                                      <span key={tr} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-slate-800 dark:text-slate-300 border border-slate-200/50 text-[10px] font-medium">
                                        {tr}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {aestheticData.facial.vascularizacao && aestheticData.facial.vascularizacao.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Vascularização</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.facial.vascularizacao.map((v: string) => (
                                      <span key={v} className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200/50 text-[10px] font-medium">
                                        {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {aestheticData.facial.outros && aestheticData.facial.outros.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Outras Observações</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.facial.outros.map((o: string) => (
                                      <span key={o} className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50 text-[10px] font-medium">
                                        {o}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Avaliação com Lupa */}
                            {aestheticData.facial.avaliacao_lupa && (
                              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Avaliação com Lupa / Wood:</span>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">"{aestheticData.facial.avaliacao_lupa}"</p>
                              </div>
                            )}

                            {/* Exames Laboratoriais */}
                            {aestheticData.facial.exames_laboratoriais && (
                              <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Exames Laboratoriais:</span>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic">"{aestheticData.facial.exames_laboratoriais}"</p>
                              </div>
                            )}

                          </div>
                        )}
                      </div>

                      {/* CARD CORPORAL */}
                      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 space-y-3.5 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-400 block uppercase tracking-wider">
                            Avaliação Corporal
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsAestheticModalOpen(true)}
                            className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-teal-600 hover:underline"
                          >
                            Editar
                          </button>
                        </div>

                        {(!aestheticData?.corporal || (
                          !aestheticData.corporal.fototipo &&
                          !aestheticData.corporal.hidratacao_local &&
                          (!aestheticData.corporal.estrias_localizacao || aestheticData.corporal.estrias_localizacao.length === 0) &&
                          !aestheticData.corporal.estrias_localizacao_outro &&
                          (!aestheticData.corporal.estrias_tipo_coloracao || aestheticData.corporal.estrias_tipo_coloracao.length === 0) &&
                          (!aestheticData.corporal.estrias_espessura_profundidade || aestheticData.corporal.estrias_espessura_profundidade.length === 0) &&
                          !aestheticData.corporal.estrias_tempo_surgimento &&
                          (!aestheticData.corporal.estrias_fator_desencadeante || aestheticData.corporal.estrias_fator_desencadeante.length === 0) &&
                          (!aestheticData.corporal.alteracoes_associadas || aestheticData.corporal.alteracoes_associadas.length === 0)
                        )) ? (
                          <p className="text-xs text-slate-400 italic">Sem dados de avaliação corporal registrados.</p>
                        ) : (
                          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                            {/* Linha 1: Fototipo e Hidratação Local */}
                            <div className="flex flex-wrap gap-2">
                              {aestheticData.corporal.fototipo && (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 font-bold">
                                  Fototipo: {aestheticData.corporal.fototipo}
                                </span>
                              )}
                              {aestheticData.corporal.hidratacao_local && (
                                <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/50 font-semibold">
                                  Hidratação local: {aestheticData.corporal.hidratacao_local}
                                </span>
                              )}
                            </div>

                            {/* Características de Estrias */}
                            <div className="space-y-2.5">
                              {/* Localização */}
                              {(aestheticData.corporal.estrias_localizacao?.length > 0 || aestheticData.corporal.estrias_localizacao_outro) && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Localização das Estrias</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.corporal.estrias_localizacao?.map((l: string) => (
                                      <span key={l} className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200/50 text-[10px]">
                                        {l}
                                      </span>
                                    ))}
                                    {aestheticData.corporal.estrias_localizacao_outro && (
                                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 text-[10px] italic">
                                        Outro: {aestheticData.corporal.estrias_localizacao_outro}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Coloração */}
                              {aestheticData.corporal.estrias_tipo_coloracao?.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Tipo & Coloração</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.corporal.estrias_tipo_coloracao.map((tc: string) => (
                                      <span key={tc} className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200/50 text-[10px]">
                                        {tc}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Espessura e Profundidade */}
                              {aestheticData.corporal.estrias_espessura_profundidade?.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Espessura & Profundidade</span>
                                  <div className="flex flex-wrap gap-1">
                                    {aestheticData.corporal.estrias_espessura_profundidade.map((ep: string) => (
                                      <span key={ep} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200/50 text-[10px]">
                                        {ep}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Tempo de Surgimento */}
                              {aestheticData.corporal.estrias_tempo_surgimento && (
                                <div className="text-[11px]">
                                  <span className="text-slate-400 font-semibold">Tempo de surgimento: </span>
                                  <strong className="text-slate-800 dark:text-slate-200">{aestheticData.corporal.estrias_tempo_surgimento}</strong>
                                </div>
                              )}
                            </div>

                            {/* Fator Desencadeante */}
                            {aestheticData.corporal.estrias_fator_desencadeante?.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Fator Desencadeante Provável</span>
                                <div className="flex flex-wrap gap-1">
                                  {aestheticData.corporal.estrias_fator_desencadeante.map((fd: string) => (
                                    <span key={fd} className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/50 text-[10px]">
                                      {fd}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Alterações Associadas */}
                            {aestheticData.corporal.alteracoes_associadas?.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Alterações Corporais Associadas</span>
                                <div className="flex flex-wrap gap-1">
                                  {aestheticData.corporal.alteracoes_associadas.map((aa: string) => (
                                    <span key={aa} className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50 text-[10px]">
                                      {aa}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 3: RECEITUÁRIO & TRATAMENTOS */}
            {/* ======================================================== */}
            {activeSubTab === "prescricoes" && (
              <div className="space-y-4">
                {prescriptions.length === 0 ? (
                  <div className="py-12 text-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center mx-auto mb-3">
                      <Pill className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Nenhuma prescrição registrada
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Emita receitas e prescrições médicas para ficarem arquivadas no histórico do paciente.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsPrescriptionModalOpen(true)}
                      className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all cursor-pointer"
                    >
                      + Prescrever Receita
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {prescriptions.map((rx) => {
                      const [year, month, day] = rx.data.split("-");
                      const dateFormatted = `${day}/${month}/${year}`;

                      return (
                        <div
                          key={rx.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            rx.ativo || rx.status === "Ativo"
                              ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                              : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 opacity-60"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                    {rx.medicamento}
                                  </h4>
                                  <span className="inline-block max-w-full text-xs font-plus-jakarta font-medium px-3 py-2 rounded-lg bg-teal-50/80 border border-teal-200/80 text-teal-900 dark:bg-teal-950/60 dark:border-teal-800/60 dark:text-teal-300 break-words whitespace-normal leading-relaxed">
                                    {rx.dosagem}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  Via {rx.via} • Prescrito em {dateFormatted}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedRxForPrint(rx)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 hover:bg-teal-50/50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Gerar Relatório</span>
                              </button>

                              {rx.ativo || rx.status === "Ativo" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRxForSuspension(rx.id);
                                    setJustificativaTexto("");
                                    setIsSuspensionModalOpen(true);
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                  title="Suspender receita"
                                >
                                  Em Uso (Ativo)
                                </button>
                              ) : (
                                <span
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300 cursor-default"
                                  title="Receita suspensa"
                                >
                                  Suspenso
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            <div>
                              <strong>Posologia:</strong> {rx.posologia}
                            </div>
                            <div>
                              <strong>Duração:</strong> {rx.duracao}
                            </div>
                            {rx.instrucoes && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                                <em>Obs: {rx.instrucoes}</em>
                              </div>
                            )}
                            {(!rx.ativo || rx.status === "Suspenso") && rx.justificativa_suspensao && (
                              <div className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                                Motivo da suspensão: {rx.justificativa_suspensao}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 4: SINAIS VITAIS & BIOMETRIA */}
            {/* ======================================================== */}
            {activeSubTab === "metricas" && (
              <div className="space-y-6">
                {/* Resumo da Última Medição */}
                {evolutions.length > 0 && evolutions[0].sinaisVitais ? (
                  <div className="p-4 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold text-teal-950 dark:text-teal-100 uppercase tracking-wider">
                          Última Aferição de Sinais Vitais ({evolutions[0].data})
                        </h4>
                      </div>
                      <span className="text-[11px] text-teal-700 dark:text-teal-300">
                        {evolutions[0].profissional}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Pressão Arterial
                        </span>
                        <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.pressaoArterial || "--/--"} mmHg
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Frequência Cardíaca
                        </span>
                        <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.frequenciaCardiaca || "--"} bpm
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">Peso</span>
                        <span className="text-base font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.peso || "--"} kg
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">IMC</span>
                        <span className="text-base font-bold text-teal-600 dark:text-teal-400 font-mono">
                          {evolutions[0].sinaisVitais.imc || "--"} kg/m²
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                    Nenhum sinal vital registrado recentemente. Ao adicionar uma evolução clínica, informe os sinais vitais para acompanhamento gráfico.
                  </div>
                )}

                {/* Tabela Histórica de Medições */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Histórico Cronológico de Biometria
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 font-bold text-slate-500">
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">PA (mmHg)</th>
                          <th className="py-2.5 px-3">FC (bpm)</th>
                          <th className="py-2.5 px-3">Temp (°C)</th>
                          <th className="py-2.5 px-3">Peso (kg)</th>
                          <th className="py-2.5 px-3">IMC (kg/m²)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                        {evolutions
                          .filter((e) => e.sinaisVitais)
                          .map((e) => (
                            <tr key={e.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                {e.data}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600">{e.tipo}</td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.pressaoArterial || "-"}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.frequenciaCardiaca || "-"}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.temperatura ? `${e.sinaisVitais.temperatura}°C` : "-"}
                              </td>
                              <td className="py-2 px-3">{e.sinaisVitais?.peso || "-"}</td>
                              <td className="py-2 px-3 font-bold text-teal-600">
                                {e.sinaisVitais?.imc || "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modais Vinculados */}
      <EvolutionFormModal
        isOpen={isEvolutionModalOpen}
        onClose={() => setIsEvolutionModalOpen(false)}
        onSuccess={loadClinicalData}
        client={client}
      />

      {history && (
        <MedicalHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onSuccess={loadClinicalData}
          client={client}
          initialHistory={history}
        />
      )}

      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        onSuccess={loadClinicalData}
        client={client}
      />

      {selectedRxForPrint && (
        <PrintPrescriptionModal
          isOpen={true}
          onClose={() => setSelectedRxForPrint(null)}
          prescription={selectedRxForPrint}
          client={client}
        />
      )}

      {/* Modal de Confirmação de Suspensão de Receita */}
      {isSuspensionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-950 dark:text-white text-base">Suspender Receita</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSuspensionModalOpen(false);
                  setJustificativaTexto("");
                  setSelectedRxForSuspension(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Deseja suspender o uso desta receita? Informe a justificativa clínica abaixo:
              </p>
              
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Justificativa Clínica *
                </label>
                <textarea
                  value={justificativaTexto}
                  onChange={(e) => setJustificativaTexto(e.target.value)}
                  placeholder="Ex: Reação adversa observada, troca de abordagem clínica, alcance do objetivo terapêutico..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                  required
                />
              </div>
            </div>
            
            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsSuspensionModalOpen(false);
                  setJustificativaTexto("");
                  setSelectedRxForSuspension(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                disabled={isSubmittingSuspension}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspension}
                disabled={!justificativaTexto.trim() || isSubmittingSuspension}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
              >
                {isSubmittingSuspension ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Suspendendo...</span>
                  </>
                ) : (
                  <span>Confirmar Suspensão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox para fotos da área tratada */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl w-full max-h-screen flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Visualização ampliada"
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl border border-slate-800"
            />
          </div>
        </div>
      )}

      {/* Modal de Avaliação Estética */}
      {isAestheticModalOpen && (
        <AestheticEvaluationModal
          pacienteId={client.id}
          pacienteNome={client.nome}
          initialFacial={aestheticData?.facial}
          initialCorporal={aestheticData?.corporal}
          onClose={() => setIsAestheticModalOpen(false)}
          onSuccess={() => {
            loadClinicalData();
          }}
        />
      )}
    </div>
  );
}
