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
} from "lucide-react";
import {
  getPatientClinicalRecordAction,
  togglePrescriptionStatusAction,
} from "@/actions/clinical-actions";
import { EvolutionFormModal } from "./evolution-form-modal";
import { MedicalHistoryModal } from "./medical-history-modal";
import { PrescriptionModal } from "./prescription-modal";
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

  // Carrega prontuário do paciente
  const loadClinicalData = useCallback(() => {
    startTransition(async () => {
      try {
        setIsLoading(true);
        const res = await getPatientClinicalRecordAction(client.id);
        if (res.success && res.data) {
          setClinicalRecord(res.data);
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
  }, [client.id, toast]);

  useEffect(() => {
    loadClinicalData();
  }, [loadClinicalData]);

  // Alterna status de prescrição
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
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 rounded-xl transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar Histórico Clínico</span>
            </button>
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
                            rx.ativo
                              ? "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs"
                              : "bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {rx.medicamento}
                                </h4>
                                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded border border-teal-200/60">
                                  {rx.dosagem}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 block mt-0.5">
                                Via {rx.via} • Prescrito em {dateFormatted}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleTogglePrescription(rx.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                                rx.ativo
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                  : "bg-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                              title={rx.ativo ? "Suspender medicamento" : "Reativar prescrição"}
                            >
                              {rx.ativo ? "Em Uso (Ativo)" : "Suspenso"}
                            </button>
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
    </div>
  );
}
