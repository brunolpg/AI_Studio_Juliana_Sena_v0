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
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { PatientClinicalTabs } from "@/components/clinical/patient-clinical-tabs";
import { AppointmentTableView } from "@/components/appointments/appointment-table-view";

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatientRecord() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setErrorMessage("Não foi possível conectar ao banco de dados.");
          return;
        }

        const userEmail = (user?.email || "").toLowerCase().trim();
        const userId = user?.id;

        let query = supabase.from("pacientes").select("*");
        if (userId) {
          query = query.or(`user_id.eq.${userId},email.ilike.${userEmail}`);
        } else {
          query = query.ilike("email", userEmail);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Erro ao consultar tabela de pacientes:", error.message);
          setErrorMessage("Erro ao consultar seus dados cadastrais.");
        } else if (data) {
          setPatientData(data);
        } else {
          setPatientData(null);
        }
      } catch (err: any) {
        console.error("Falha inesperada:", err);
        setErrorMessage("Falha na sincronização dos dados do paciente.");
      } finally {
        setIsLoading(false);
      }
    }

    if (user?.email || user?.id) {
      loadPatientRecord();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Header Dedicado do Portal do Paciente */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="w-9 h-9 rounded-2xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Dra. Juliana Sena
              </h1>
              <p className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold tracking-wide">
                Portal do Paciente • Acesso Restrito
              </p>
            </div>
          </div>

          {/* Navegação entre Abas */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("prontuario")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "prontuario"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Documentos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agendamentos")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "agendamentos"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendamentos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ficha")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "ficha"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Minha Ficha</span>
            </button>
          </div>

          {/* Botão Sair */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          )}
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
            {/* ABA: PRONTUÁRIO & EVOLUÇÕES */}
            {activeTab === "prontuario" && (
              <div className="space-y-4">
                <PatientClinicalTabs
                  client={patientData}
                  isPatientView={true}
                  onBack={() => {}}
                />
              </div>
            )}

            {/* ABA: MINHA FICHA (Somente Leitura) */}
            {activeTab === "ficha" && (
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Nome Completo</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.nome}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">CPF</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.cpf}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Data de Nascimento / Idade</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatBirthDate(patientData.data_nascimento)} ({patientData.idade} anos)
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Sexo</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.sexo}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Telefone</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.telefone}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">E-mail Cadastrado</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{patientData.email}</span>
                  </div>
                  <div className="sm:col-span-2 md:col-span-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 block font-medium">Endereço</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {patientData.logradouro}, {patientData.numero} {patientData.complemento ? `- ${patientData.complemento}` : ""} • {patientData.cidade}/{patientData.estado} {patientData.cep ? `(CEP: ${patientData.cep})` : ""}
                    </span>
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
    </div>
  );
}