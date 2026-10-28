"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  ClipboardList,
  User as UserIcon,
  LogOut,
  Sparkles,
  AlertCircle,
  Clock,
  FileHeart,
  ShieldAlert,
  Activity,
  Pill,
  Stethoscope,
  Heart,
  Image as ImageIcon,
  Plus,
  Edit2,
  CheckCircle2,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { PatientClinicalTabs } from "@/components/clinical/patient-clinical-tabs";
import { AppointmentTableView } from "@/components/appointments/appointment-table-view";
import { UserMenu } from "@/components/shared/user-menu";
import { MedicalHistoryModal } from "@/components/clinical/medical-history-modal";
import { validateFileSize } from "@/lib/validations/file-upload";
import type { MedicalHistory } from "@/types/clinical-record";

interface PatientPortalProps {
  user: any;
  onLogout?: () => void;
}

const formatBirthDate = (dateString?: string | null) => {
  if (!dateString) return 'Não informado';
  const clean = dateString.split('T')[0];
  const parts = clean.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateString;
};

export function PatientPortal({ user, onLogout }: PatientPortalProps) {
  const [activeTab, setActiveTab] = useState<"ficha" | "prontuario" | "agendamentos">("prontuario");
  const [patientData, setPatientData] = useState<any>(null);
  const [clinicalHistory, setClinicalHistory] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmDeletePhoto, setShowConfirmDeletePhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);

  const userId = user?.id;
  const userEmail = (user?.email || "").toLowerCase().trim();

  const handleConfirmDeletePhoto = async () => {
    if (!patientData?.id) return;
    setIsDeletingPhoto(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase
          .from("pacientes")
          .update({ foto_perfil: null, updated_at: new Date().toISOString() })
          .eq("id", patientData.id);

        if (error) {
          console.error("Erro ao remover foto de perfil:", error);
          alert("Não foi possível remover a foto de perfil. Tente novamente.");
        } else {
          setPatientData((prev: any) => ({ ...prev, foto_perfil: null }));
          setShowConfirmDeletePhoto(false);
        }
      }
    } catch (err) {
      console.error("Erro ao remover foto:", err);
      alert("Ocorreu um erro ao remover a foto.");
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const refreshClinicalHistory = async () => {
    if (!patientData?.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data: historyData } = await supabase
      .from('historico_clinico')
      .select('*')
      .eq('paciente_id', patientData.id)
      .maybeSingle();
    setClinicalHistory(historyData || null);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPatientRecord() {
      if (!userId && !userEmail) {
        if (isMounted) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          if (isMounted) setErrorMessage("Não foi possível conectar ao banco de dados.");
          return;
        }

        let query = supabase.from("pacientes").select("id, nome, cpf, data_nascimento, idade, email, sexo, telefone, logradouro, numero, complemento, estado, cidade, cep, foto_perfil, user_id, status");
        if (userId) {
          query = query.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
        } else {
          query = query.ilike("email", userEmail);
        }

        const { data, error } = await query.maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error("Erro ao consultar tabela de pacientes:", error.message);
          setErrorMessage("Erro ao consultar seus dados cadastrais.");
        } else if (data) {
          setPatientData(data);

          // Busca do histórico clínico do paciente
          const { data: historyData } = await supabase
            .from('historico_clinico')
            .select('*')
            .eq('paciente_id', data.id)
            .maybeSingle();

          if (isMounted) {
            setClinicalHistory(historyData || null);
          }
        } else {
          setPatientData(null);
          setClinicalHistory(null);
        }
      } catch (err: any) {
        console.error("Falha inesperada:", err);
        if (isMounted) setErrorMessage("Falha na sincronização dos dados do paciente.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPatientRecord();

    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      // Valida se o ID do usuário de fato mudou antes de re-inicializar
      if (session?.user?.id && session.user.id !== userId) {
        // ID mudou, o componente receberá novas props via auth-context
      }
    }) || { data: { subscription: null } };

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [userId, userEmail]);

  const initialHistoryForModal: MedicalHistory = clinicalHistory ? {
    alergias: Array.isArray(clinicalHistory.alergias) ? clinicalHistory.alergias : [],
    comorbidades: Array.isArray(clinicalHistory.comorbidades) ? clinicalHistory.comorbidades : [],
    medicamentosUsoContinuo: Array.isArray(clinicalHistory.medicamentos_uso_continuo)
      ? clinicalHistory.medicamentos_uso_continuo
      : Array.isArray(clinicalHistory.medicamentosUsoContinuo)
      ? clinicalHistory.medicamentosUsoContinuo
      : [],
    acompanhamentoMedico: Array.isArray(clinicalHistory.acompanhamento_medico)
      ? clinicalHistory.acompanhamento_medico
      : [],
    isotretinoina6Meses: Boolean(clinicalHistory.isotretinoina_6_meses),
    implantesDispositivos: Array.isArray(clinicalHistory.implantes_dispositivos)
      ? clinicalHistory.implantes_dispositivos
      : [],
    ingestaoAgua: clinicalHistory.ingestao_agua || "",
    qualidadeSono: clinicalHistory.qualidade_sono || "",
    funcionamentoIntestino: clinicalHistory.funcionamento_intestino || "",
    tipoSanguineo: clinicalHistory.tipo_sanguineo || "Não informado",
    historicoCirurgico: clinicalHistory.historico_cirurgico || "",
    historicoFamiliar: clinicalHistory.historico_familiar || "",
    lesoesDetalhes: clinicalHistory.lesoes_detalhes || "",
    habitosVida: {
      tabagismo: clinicalHistory.tabagismo || clinicalHistory.habitos_vida?.tabagismo || "Não fuma",
      etilismo: clinicalHistory.etilismo || clinicalHistory.habitos_vida?.etilismo || "Não consome",
      atividadeFisica: clinicalHistory.atividade_fisica || clinicalHistory.habitos_vida?.atividadeFisica || "Sedentário",
    },
    observacoesGerais: clinicalHistory.observacoes_gerais || "",
    fotosAreaTratada: Array.isArray(clinicalHistory.fotos_area_tratada) ? clinicalHistory.fotos_area_tratada : [],
  } : {
    alergias: [],
    comorbidades: [],
    medicamentosUsoContinuo: [],
    acompanhamentoMedico: [],
    isotretinoina6Meses: false,
    implantesDispositivos: [],
    ingestaoAgua: "",
    qualidadeSono: "",
    funcionamentoIntestino: "",
    tipoSanguineo: "Não informado",
    historicoCirurgico: "",
    historicoFamiliar: "",
    lesoesDetalhes: "",
    habitosVida: {
      tabagismo: "Não fuma",
      etilismo: "Não consome",
      atividadeFisica: "Sedentário",
    },
    observacoesGerais: "",
    fotosAreaTratada: [],
  };

  const userPhotoUrl = 
    patientData?.foto_perfil || 
    (user as any)?.foto_perfil || 
    (user as any)?.user_metadata?.avatar_url || 
    (user as any)?.user_metadata?.picture || 
    null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col box-border w-full max-w-full min-w-0 overflow-x-hidden antialiased lg:pl-64">
      {/* ====================================================================
          1. DESKTOP (PC): MD4 Navigation Drawer (Sidebar Tonal Fixa)
          Largura fixa (w-64), visível apenas em desktop (hidden lg:flex)
          Superfície: bg-white/90 dark:bg-slate-950/90 backdrop-blur-md
          ==================================================================== */}
      <aside
        aria-label="Barra Lateral de Navegação do Paciente"
        className="hidden lg:flex flex-col fixed top-0 bottom-0 left-0 w-64 h-dvh max-h-screen z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-200 shadow-xs select-none"
      >
        {/* Topo do Drawer: Logo & Identidade Institucional */}
        <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-[#004d40] dark:bg-emerald-950 dark:border dark:border-emerald-800/50 text-white shrink-0 shadow-sm transition-transform duration-200 hover:scale-105">
            <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              Dra. Juliana Sena
            </h1>
            <p className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold tracking-wide truncate mt-0.5">
              Portal do Paciente
            </p>
          </div>
        </div>

        {/* Lista de Navegação Principal MD4 */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overscroll-contain">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Menu Principal
          </div>
          
          <button
            type="button"
            onClick={() => setActiveTab("prontuario")}
            className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer group ${
              activeTab === "prontuario"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60"
            }`}
          >
            <FileText
              className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                activeTab === "prontuario"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span className="truncate flex-1 text-left">Documentos</span>
            {activeTab === "prontuario" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agendamentos")}
            className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer group ${
              activeTab === "agendamentos"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60"
            }`}
          >
            <Calendar
              className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                activeTab === "agendamentos"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span className="truncate flex-1 text-left">Agendamentos</span>
            {activeTab === "agendamentos" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ficha")}
            className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer group ${
              activeTab === "ficha"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60"
            }`}
          >
            <UserIcon
              className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                activeTab === "ficha"
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span className="truncate flex-1 text-left">Minha Ficha</span>
            {activeTab === "ficha" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
            )}
          </button>
        </nav>

        {/* Rodapé do Drawer: Avatar e Dados do Paciente */}
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 relative shrink-0 overflow-visible">
          <UserMenu
            user={{
              nome: patientData?.nome || user?.name || user?.nome || "Paciente",
              email: patientData?.email || user?.email,
              role: "paciente",
              foto_perfil: userPhotoUrl,
              avatar: userPhotoUrl,
              avatar_url: userPhotoUrl,
              roleLabel: "Paciente"
            }}
            onLogout={onLogout ? async () => onLogout() : undefined}
            direction="up"
            variant="sidebar"
            align="left"
          />
        </div>
      </aside>

      {/* ====================================================================
          Navigation Rail Lateral Fixa para o Ambiente do Paciente (Landscape)
          Compacta (w-16 / w-20), visível apenas em orientação paisagem
          ==================================================================== */}
      <aside
        aria-label="Barra Lateral de Navegação do Paciente"
        className="hidden max-lg:landscape:flex fixed top-0 bottom-0 left-0 w-16 sm:w-20 h-dvh max-h-screen z-50 bg-white/95 dark:bg-[#0f1929]/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 flex-col items-center justify-between py-2.5 shadow-sm select-none"
      >
        {/* Topo do Rail: Logo da Clínica com fundo verde */}
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#004d40] dark:bg-emerald-950 dark:border dark:border-emerald-800/50 text-white shrink-0 mb-1 shadow-sm transition-transform hover:scale-105">
          <Sparkles className="w-5 h-5 text-white" />
        </div>

        {/* Itens do Rail (Ícones com Indicador Pílula Vertical) */}
        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-1 overflow-y-auto no-scrollbar overscroll-contain min-h-0">
          <button
            type="button"
            onClick={() => setActiveTab("prontuario")}
            className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all cursor-pointer ${
              activeTab === "prontuario"
                ? "text-emerald-800 dark:text-emerald-300 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            }`}
            title="Documentos"
          >
            <div
              className={`px-3 py-1 rounded-full transition-colors relative ${
                activeTab === "prontuario"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-2xs"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
            </div>
            <span className="text-[9px] leading-tight truncate max-w-[56px] text-center">
              Documentos
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agendamentos")}
            className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all cursor-pointer ${
              activeTab === "agendamentos"
                ? "text-emerald-800 dark:text-emerald-300 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            }`}
            title="Agenda"
          >
            <div
              className={`px-3 py-1 rounded-full transition-colors relative ${
                activeTab === "agendamentos"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-2xs"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-[9px] leading-tight truncate max-w-[56px] text-center">
              Agenda
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ficha")}
            className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all cursor-pointer ${
              activeTab === "ficha"
                ? "text-emerald-800 dark:text-emerald-300 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            }`}
            title="Minha Ficha"
          >
            <div
              className={`px-3 py-1 rounded-full transition-colors relative ${
                activeTab === "ficha"
                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shadow-2xs"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              <UserIcon className="w-4 h-4" />
            </div>
            <span className="text-[9px] leading-tight truncate max-w-[56px] text-center">
              Minha Ficha
            </span>
          </button>
        </nav>

        {/* Base do Rail: Avatar do Paciente com Menu de Logout */}
        <div className="shrink-0 flex items-center justify-center pt-1 border-t border-slate-200/50 dark:border-slate-800/50 w-full relative overflow-visible">
          <UserMenu
            user={{
              nome: patientData?.nome || user?.name || user?.nome || "Paciente",
              email: patientData?.email || user?.email,
              role: "paciente",
              foto_perfil: userPhotoUrl,
              avatar: userPhotoUrl,
              avatar_url: userPhotoUrl,
              roleLabel: "Paciente"
            }}
            onLogout={onLogout ? async () => onLogout() : undefined}
            direction="up"
            variant="compact"
            align="left"
          />
        </div>
      </aside>

      {/* Header Dedicado do Portal do Paciente (Oculto no Desktop e em Mobile Landscape, visível no Mobile Retrato) */}
      <header className="lg:hidden max-lg:landscape:hidden w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-40 overflow-visible shadow-xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 overflow-visible">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3 overflow-visible">
            
            {/* Linha 1 no Mobile / Lado Esquerdo no Desktop: Identidade + Perfil Mobile */}
            <div className="flex items-center justify-between w-full md:w-auto gap-2 overflow-visible">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#004d40] dark:bg-emerald-950 dark:border dark:border-emerald-800/50 text-white shrink-0 shadow-sm transition-transform hover:scale-105">
                  <Sparkles className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    Dra. Juliana Sena
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-teal-700 dark:text-teal-400 font-semibold tracking-wide truncate">
                    Portal do Paciente
                  </p>
                </div>
              </div>

              {/* UserMenu no Mobile (posicionado à direita na Linha 1) */}
              <div className="md:hidden shrink-0 relative overflow-visible z-50">
                <UserMenu
                  user={{
                    nome: patientData?.nome || user?.name || user?.nome || "Paciente",
                    email: patientData?.email || user?.email,
                    role: "paciente",
                    foto_perfil: userPhotoUrl,
                    avatar: userPhotoUrl,
                    avatar_url: userPhotoUrl,
                    roleLabel: "Paciente"
                  }}
                  onLogout={onLogout ? async () => onLogout() : undefined}
                />
              </div>
            </div>

            {/* Linha 2 no Desktop: MD4 Segmented Navigation Bar (Oculto em telas menores para evitar duplicação com a barra inferior) */}
            <div className="hidden md:flex items-center justify-center w-full md:w-auto overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <nav className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-full border border-slate-200/80 dark:border-slate-700/80 w-full sm:w-auto justify-between sm:justify-center shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("prontuario")}
                  className={`flex-1 sm:flex-initial min-h-[38px] md:min-h-[40px] flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 md-state-layer ${
                    activeTab === "prontuario"
                      ? "bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                  <span>Documentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("agendamentos")}
                  className={`flex-1 sm:flex-initial min-h-[38px] md:min-h-[40px] flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 md-state-layer ${
                    activeTab === "agendamentos"
                      ? "bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Agendamentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ficha")}
                  className={`flex-1 sm:flex-initial min-h-[38px] md:min-h-[40px] flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 md-state-layer ${
                    activeTab === "ficha"
                      ? "bg-teal-700 dark:bg-teal-500 text-white dark:text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Minha Ficha</span>
                </button>
              </nav>
            </div>

            {/* Lado Direito no Desktop */}
            <div className="hidden md:flex items-center shrink-0 relative overflow-visible z-50">
              <UserMenu
                user={{
                  nome: patientData?.nome || user?.name || user?.nome || "Paciente",
                  email: patientData?.email || user?.email,
                  role: "paciente",
                  foto_perfil: userPhotoUrl,
                  avatar: userPhotoUrl,
                  avatar_url: userPhotoUrl,
                  roleLabel: "Paciente"
                }}
                onLogout={onLogout ? async () => onLogout() : undefined}
              />
            </div>

          </div>
        </div>
      </header>

      {/* Conteúdo Central com Simetria Perfeita */}
      <main className="md4-main-content flex-1 min-w-0 w-full px-4 sm:px-8 py-4 sm:py-6 lg:px-10 lg:py-8 space-y-4 sm:space-y-6 box-border overflow-x-hidden pb-24 md:pb-8 max-lg:landscape:space-y-3 max-lg:landscape:py-3 max-lg:landscape:pl-20 max-lg:landscape:pr-5 max-lg:landscape:pb-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-teal-500/20 border-t-teal-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
              Carregando registros do paciente...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : !patientData ? (
          <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-3xl text-center space-y-2">
            <Clock className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Cadastro em fase de vinculação
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Sua conta ({user?.email}) está ativa, mas ainda não localizamos uma ficha clínica vinculada.
              Entre em contato com a clínica para sincronizar seu histórico.
            </p>
          </div>
        ) : (
          <>
            {/* Banner MD4 no Topo de Cada Aba (Mobile Retrato, Paisagem e Desktop) */}
            <div className="w-full min-w-0 box-border rounded-2xl md:rounded-3xl bg-gradient-to-r from-[#003830] via-[#004d40] to-[#022c22] text-white p-4 sm:p-5 lg:p-8 landscape:max-md:py-3 landscape:max-md:px-4 shadow-sm dark:border dark:border-emerald-900/40">
              <div className="flex items-center gap-2.5 sm:gap-3">
                {activeTab === "prontuario" ? (
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-300 shrink-0" />
                ) : activeTab === "agendamentos" ? (
                  <Calendar className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-300 shrink-0" />
                ) : (
                  <UserIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-emerald-300 shrink-0" />
                )}
                <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold tracking-tight text-white">
                  {activeTab === "prontuario"
                    ? "Documentos & Prescrições Clínicas"
                    : activeTab === "agendamentos"
                    ? "Agendamentos & Consultas"
                    : "Meus Dados Cadastrais"}
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs md:text-sm text-emerald-200/85 font-medium mt-0.5 sm:mt-1 leading-snug">
                {activeTab === "prontuario"
                  ? "Receituários, fórmulas e orientações pós-procedimento ativas."
                  : activeTab === "agendamentos"
                  ? "Histórico e marcação de atendimentos presenciais."
                  : "Informações de cadastro e contato do paciente."}
              </p>
            </div>

            {/* ABA: DOCUMENTOS (Receituário & Fórmulas Magistrais & Home Care) */}
            {activeTab === "prontuario" && (
              <div className="w-full">
                <PatientClinicalTabs
                  client={patientData}
                  isPatientView={true}
                  onBack={() => {}}
                />
              </div>
            )}

            {/* ABA: MINHA FICHA */}
            {activeTab === "ficha" && (
              <div className="space-y-6">
                {/* 1. DADOS CADASTRAIS DO PACIENTE */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Dados Cadastrais do Paciente
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Visualização protegida em modo estrito de leitura. Alterações devem ser solicitadas à administração.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60">
                      {patientData.status || "Ativo"}
                    </span>
                  </div>

                  {/* FOTO DE PERFIL COM UPLOAD E REMOÇÃO */}
                  <div className="flex items-center gap-4 py-4 my-2 border-y border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center shadow-xs">
                      {patientData?.foto_perfil ? (
                        <img
                          src={patientData.foto_perfil}
                          alt={patientData?.nome || "Foto de Perfil"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold text-lg flex items-center justify-center">
                          {(patientData?.nome || "P")[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Foto de Perfil do Paciente
                      </p>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-full transition-all shadow-xs cursor-pointer md-state-layer">
                          <span>+ Foto</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const check = validateFileSize(file);
                              if (!check.valid) {
                                alert(check.error || "A foto de perfil deve possuir no máximo 5MB.");
                                e.target.value = "";
                                return;
                              }
                              const supabase = getSupabaseClient();
                              if (supabase && patientData?.id) {
                                const fileExt = file.name.split('.').pop() || 'png';
                                const filePath = `pacientes/${patientData.id}_${Date.now()}.${fileExt}`;
                                const { error: uploadError } = await supabase.storage
                                  .from('avatars')
                                  .upload(filePath, file, { upsert: true });

                                if (!uploadError) {
                                  const { data: publicData } = supabase.storage
                                    .from('avatars')
                                    .getPublicUrl(filePath);
                                  await supabase
                                    .from('pacientes')
                                    .update({ foto_perfil: publicData.publicUrl, updated_at: new Date().toISOString() })
                                    .eq('id', patientData.id);
                                  setPatientData((prev: any) => ({ ...prev, foto_perfil: publicData.publicUrl }));
                                }
                              }
                            }}
                          />
                        </label>

                        {patientData?.foto_perfil && (
                          <button
                            type="button"
                            onClick={() => setShowConfirmDeletePhoto(true)}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:border-rose-300 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-full transition-all cursor-pointer md-state-layer shadow-2xs"
                          >
                            Remover foto
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        PNG ou JPG de até 5 MB (crop 1:1 automático).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Nome Completo</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.nome}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">CPF</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.cpf}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Data de Nascimento / Idade</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatBirthDate(patientData.data_nascimento)} ({patientData.idade} anos)
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Sexo</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.sexo}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Telefone</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.telefone}</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">E-mail Cadastrado</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.email}</span>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block font-medium">Endereço</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {patientData.logradouro}, {patientData.numero} {patientData.complemento ? `- ${patientData.complemento}` : ""} • {patientData.cidade}/{patientData.estado} {patientData.cep ? `(CEP: ${patientData.cep})` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. CARD COMPLETO: HISTÓRICO CLÍNICO & ANAMNESE */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xs space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                        <FileHeart className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span>Histórico Clínico & Anamnese</span>
                          {clinicalHistory ? (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              Preenchido
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                              Pendente (Onboarding)
                            </span>
                          )}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Informações de saúde, alergias, condições crônicas e hábitos declarados pelo paciente.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-xs cursor-pointer shrink-0 md-state-layer"
                    >
                      {clinicalHistory ? (
                        <>
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Editar / Atualizar Anamnese</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Preencher Anamnese Inicial</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!clinicalHistory && (
                    <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Seu histórico clínico inicial ainda não foi cadastrado. Por favor, preencha sua anamnese inicial antes da consulta.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-3.5 py-1.5 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors cursor-pointer shrink-0"
                      >
                        Preencher Anamnese Agora
                      </button>
                    </div>
                  )}

                  {/* SEÇÃO 1: ALERGIAS, COMORBIDADES E MEDICAMENTOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Alergias e Advertências */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Alergias e Advertências</span>
                      </div>
                      {Array.isArray(clinicalHistory?.alergias) && clinicalHistory.alergias.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {clinicalHistory.alergias.map((item: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 text-[11px] font-semibold">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          Nenhuma alergia conhecida ou declarada
                        </p>
                      )}
                    </div>

                    {/* Comorbidades e Condições Crônicas */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                        <Activity className="w-4 h-4" />
                        <span>Comorbidades e Condições Crônicas</span>
                      </div>
                      {Array.isArray(clinicalHistory?.comorbidades) && clinicalHistory.comorbidades.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {clinicalHistory.comorbidades.map((item: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-[11px] font-semibold">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          Nenhuma comorbidade relatada no prontuário
                        </p>
                      )}
                    </div>

                    {/* Medicamentos de Uso Contínuo */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold">
                        <Pill className="w-4 h-4" />
                        <span>Medicamentos de Uso Contínuo</span>
                      </div>
                      {Array.isArray(clinicalHistory?.medicamentos_uso_continuo) && clinicalHistory.medicamentos_uso_continuo.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {clinicalHistory.medicamentos_uso_continuo.map((item: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800 text-[11px] font-semibold">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          Paciente não faz uso regular de medicamentos
                        </p>
                      )}
                    </div>

                    {/* Acompanhamento Médico */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                      <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold">
                        <Stethoscope className="w-4 h-4" />
                        <span>Acompanhamento Médico</span>
                      </div>
                      {Array.isArray(clinicalHistory?.acompanhamento_medico) && clinicalHistory.acompanhamento_medico.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {clinicalHistory.acompanhamento_medico.map((item: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800 text-[11px] font-semibold">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : typeof clinicalHistory?.acompanhamento_medico === 'string' && clinicalHistory.acompanhamento_medico.trim() ? (
                        <p className="text-slate-700 dark:text-slate-300 font-medium">
                          {clinicalHistory.acompanhamento_medico}
                        </p>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          Nenhum acompanhamento médico relatado
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SEÇÃO 2: GRADE DE HÁBITOS E SINAIS VITAIS */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Grade de Hábitos e Sinais Vitais
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Tipo Sanguíneo</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.tipo_sanguineo || 'Não informado'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Tabagismo</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.tabagismo || clinicalHistory?.habitos_vida?.tabagismo || 'Não fuma'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Etilismo</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.etilismo || clinicalHistory?.habitos_vida?.etilismo || 'Não consome'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Atividade Física</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.atividade_fisica || clinicalHistory?.habitos_vida?.atividadeFisica || 'Sedentário'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Isotretinoína (Últimos 6 meses)</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.isotretinoina_6_meses ? 'Sim' : 'Não'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Implantes / Marcapasso</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {Array.isArray(clinicalHistory?.implantes_dispositivos)
                            ? clinicalHistory.implantes_dispositivos.join(', ')
                            : clinicalHistory?.implantes_dispositivos || 'Nenhum relatado'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Ingestão de Água</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.ingestao_agua || 'Não informado'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Qualidade do Sono</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.qualidade_sono || 'Não informado'}
                        </span>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                        <span className="text-[10px] text-slate-400 block font-medium">Funcionamento Intestinal</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {clinicalHistory?.funcionamento_intestino || 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 3: ANTECEDENTES & LESÕES */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                        Histórico Familiar & Antecedentes
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {clinicalHistory?.historico_familiar || 'Sem histórico familiar relevante'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                        Lesões ou Detalhes Dermatológicos
                      </span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {clinicalHistory?.lesoes_detalhes || 'Nenhuma lesão relatada'}
                      </p>
                    </div>
                  </div>

                  {/* SEÇÃO 4: FOTOS DA ÁREA A SER TRATADA */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Fotos da Área a Ser Tratada
                      </h3>
                    </div>

                    {Array.isArray(clinicalHistory?.fotos_area_tratada) && clinicalHistory.fotos_area_tratada.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {clinicalHistory.fotos_area_tratada.map((url: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => setLightboxUrl(url)}
                            className="group relative h-28 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                          >
                            <img
                              src={url}
                              alt={`Foto da área a ser tratada ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                              Ampliar
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Nenhuma foto anexada ao histórico
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ABA: AGENDAMENTOS */}
            {activeTab === "agendamentos" && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-2xs">
                <AppointmentTableView />
              </div>
            )}
          </>
        )}
      </main>

      {/* LIGHTBOX MODAL PARA FOTOS */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center">
            <img
              src={lightboxUrl}
              alt="Foto Ampliada"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-4 -right-4 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE ANAMNESE E HISTÓRICO CLÍNICO (Preenchimento Inicial / Edição) */}
      {patientData && (
        <MedicalHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onSuccess={() => {
            setIsHistoryModalOpen(false);
            refreshClinicalHistory();
          }}
          client={patientData}
          initialHistory={initialHistoryForModal}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA REMOÇÃO DE FOTO DE PERFIL MD4 */}
      {showConfirmDeletePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-['Plus_Jakarta_Sans',sans-serif]"
          onClick={() => {
            if (!isDeletingPhoto) setShowConfirmDeletePhoto(false);
          }}
        >
          <div
            className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2 shrink-0" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Remover Foto de Perfil
                </h3>
              </div>
              <button
                type="button"
                disabled={isDeletingPhoto}
                onClick={() => setShowConfirmDeletePhoto(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer md-state-layer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tem certeza de que deseja remover sua foto de perfil? Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingPhoto}
                onClick={() => setShowConfirmDeletePhoto(false)}
                className="flex-1 min-h-[42px] px-5 py-2 text-xs font-semibold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-50 md-state-layer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeletingPhoto}
                onClick={handleConfirmDeletePhoto}
                className="flex-1 min-h-[42px] px-5 py-2 text-xs font-semibold rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-xs md-state-layer"
              >
                {isDeletingPhoto ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <span>Confirmar Remoção</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MD4 Mobile Bottom Navigation Bar (Portrait Ergonômica - Oculta em Landscape) */}
      <nav aria-label="Navegação do Paciente Móvel" className="md:hidden landscape:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-3 py-2 shadow-lg flex items-center justify-around safe-area-pb">
        <button
          type="button"
          onClick={() => setActiveTab("prontuario")}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all cursor-pointer md-state-layer ${
            activeTab === "prontuario"
              ? "text-teal-700 dark:text-teal-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-colors ${activeTab === "prontuario" ? "bg-teal-100 dark:bg-teal-950/80" : ""}`}>
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[11px] leading-tight">Documentos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("agendamentos")}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all cursor-pointer md-state-layer ${
            activeTab === "agendamentos"
              ? "text-teal-700 dark:text-teal-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-colors ${activeTab === "agendamentos" ? "bg-teal-100 dark:bg-teal-950/80" : ""}`}>
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[11px] leading-tight">Agenda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ficha")}
          className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all cursor-pointer md-state-layer ${
            activeTab === "ficha"
              ? "text-teal-700 dark:text-teal-400 font-bold"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          }`}
        >
          <div className={`px-4 py-1 rounded-full transition-colors ${activeTab === "ficha" ? "bg-teal-100 dark:bg-teal-950/80" : ""}`}>
            <UserIcon className="w-5 h-5" />
          </div>
          <span className="text-[11px] leading-tight">Minha Ficha</span>
        </button>
      </nav>
    </div>
  );
}