"use client";

import React, { useState, useEffect } from "react";
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

  const userId = user?.id;
  const userEmail = (user?.email || "").toLowerCase().trim();

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Header Dedicado do Portal do Paciente */}
      <header className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 overflow-visible shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 overflow-visible">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3 overflow-visible">
            
            {/* Linha 1 no Mobile / Lado Esquerdo no Desktop: Identidade + Perfil Mobile */}
            <div className="flex items-center justify-between w-full md:w-auto gap-2 overflow-visible">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    Dra. Juliana Sena
                  </h1>
                  <p className="text-[10px] sm:text-[11px] text-teal-600 dark:text-teal-400 font-semibold tracking-wide truncate">
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

            {/* Linha 2 no Mobile / Centro no Desktop: Navegação entre Abas */}
            <div className="flex items-center justify-center w-full md:w-auto overflow-x-auto no-scrollbar py-0.5 shrink-0">
              <nav className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 w-full sm:w-auto justify-between sm:justify-center shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("prontuario")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    activeTab === "prontuario"
                      ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                  <span>Documentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("agendamentos")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    activeTab === "agendamentos"
                      ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Agendamentos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ficha")}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    activeTab === "ficha"
                      ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
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
            {/* ABA: DOCUMENTOS (RECEITUÁRIO & HOME CARE) */}
            {activeTab === "prontuario" && (
              <div className="space-y-4">
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
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer">
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
                            onClick={async () => {
                              const supabase = getSupabaseClient();
                              if (supabase && patientData?.id) {
                                await supabase
                                  .from('pacientes')
                                  .update({ foto_perfil: null, updated_at: new Date().toISOString() })
                                  .eq('id', patientData.id);
                                setPatientData((prev: any) => ({ ...prev, foto_perfil: null }));
                              }
                            }}
                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:border-rose-300 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl transition-all cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-2xs cursor-pointer shrink-0"
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
    </div>
  );
}