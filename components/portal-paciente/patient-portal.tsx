'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  Calendar as CalendarIcon, 
  ClipboardList, 
  User as UserIcon, 
  LogOut, 
  Sparkles, 
  Clock, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Loader2, 
  Moon, 
  Sun,
  ShieldCheck,
  CalendarDays,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PatientClinicalTabs } from '@/components/clinical/patient-clinical-tabs';
import { getSupabaseClient } from '@/lib/supabase/client';
import { 
  getAppointmentsAction, 
  getTimeSlotsForDateAction, 
  createAppointmentAction, 
  getProcedimentosAction 
} from '@/actions/appointment-actions';
import type { Appointment, TimeSlot } from '@/types/appointment';
import type { Procedimento } from '@/lib/procedimentos-mock';
import type { Client } from '@/types/client';

interface PatientPortalProps {
  user: any;
  onLogout?: () => void;
}

export function PatientPortal({ user, onLogout }: PatientPortalProps) {
  const [activeTab, setActiveTab] = useState<'ficha' | 'prontuario' | 'agendamentos'>('prontuario');
  const [patientData, setPatientData] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  // Sincroniza estado de tema inicial com classe html
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setThemeState(isDark ? 'dark' : 'light');
    }
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setThemeState('light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setThemeState('dark');
    }
  };

  useEffect(() => {
    async function loadPatientData() {
      try {
        setIsLoading(true);
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error("Supabase não pôde ser inicializado.");
        }

        // Busca dados do paciente vinculados ao e-mail do usuário logado
        const { data, error } = await supabase
          .from('pacientes')
          .select('*')
          .eq('email', user.email)
          .is('deleted_at', null)
          .maybeSingle();

        if (error) {
          console.error("Erro ao buscar prontuário do paciente:", error.message);
        } else if (data) {
          setPatientData(data as Client);
        } else {
          console.warn("Nenhum prontuário de paciente ativo correspondente ao e-mail encontrado.");
        }
      } catch (err) {
        console.error("Erro ao carregar dados do paciente:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (user?.email) {
      loadPatientData();
    }
  }, [user?.email]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Cabeçalho Superior */}
      <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 overflow-visible">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Dra. Juliana Sena
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Portal do Paciente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Alternar Tema */}
            <button
              onClick={toggleTheme}
              type="button"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Alternar Modo Escuro/Claro"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>

            {/* Nome/Perfil */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
                {patientData?.nome || user?.nome || 'Paciente'}
              </span>
              <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400">
                Prontuário Ativo
              </span>
            </div>

            {/* Logout */}
            {onLogout && (
              <button
                onClick={onLogout}
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-200/80 hover:border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Container Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Banner de Boas-Vindas */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-teal-600 to-[#2d8272] rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-teal-600/10 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-36 h-36" />
          </div>
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              Ambiente Seguro LGPD
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Olá, {patientData?.nome?.split(' ')[0] || user?.nome?.split(' ')[0] || 'Paciente'}!
            </h2>
            <p className="text-xs sm:text-sm text-teal-50 max-w-2xl font-medium leading-relaxed">
              Bem-vindo ao seu portal de saúde e bem-estar. Aqui você pode conferir o seu histórico clínico completo, visualizar prescrições ativas e realizar novos agendamentos de forma rápida e segura.
            </p>
          </div>
        </motion.div>

        {/* Abas de Navegação */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('prontuario')}
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'prontuario'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/10'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <ClipboardList className="w-4.5 h-4.5" />
            <span>Meu Prontuário</span>
          </button>

          <button
            onClick={() => setActiveTab('agendamentos')}
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'agendamentos'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/10'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <CalendarIcon className="w-4.5 h-4.5" />
            <span>Agendamentos</span>
          </button>

          <button
            onClick={() => setActiveTab('ficha')}
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'ficha'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-500/10'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <UserIcon className="w-4.5 h-4.5" />
            <span>Ficha de Cadastro</span>
          </button>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-4"
              >
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Carregando informações com segurança...
                </p>
              </motion.div>
            ) : !patientData ? (
              <motion.div
                key="no-data"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center max-w-md mx-auto space-y-4 my-8"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900/30 shadow-xs">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Prontuário Não Vinculado</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Não encontramos um prontuário de paciente ativo com o e-mail <strong>{user?.email}</strong> no sistema. Entre em contato com a clínica para regularizar seu cadastro.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col"
              >
                {activeTab === 'prontuario' && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm flex-1">
                    <div className="flex flex-col gap-1 mb-6">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-teal-600" />
                        Histórico Clínico do Paciente
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Consulte abaixo sua anamnese, evoluções clínicas de cada sessão e receitas emitidas.
                      </p>
                    </div>
                    <PatientClinicalTabs client={patientData} />
                  </div>
                )}

                {activeTab === 'agendamentos' && (
                  <PatientSchedulingView patient={patientData} />
                )}

                {activeTab === 'ficha' && (
                  <PatientProfileView patient={patientData} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Rodapé */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 py-6 mt-12 text-center text-xs text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
        Dra. Juliana Sena • Prontuário Eletrônico Seguro em Conformidade com a LGPD • RLS Habilitada
      </footer>
    </div>
  );
}

/**
 * ============================================================================
 * COMPONENTE INTERNO: VISUALIZAÇÃO DE PERFIL / FICHA CADASTRAL
 * ============================================================================
 */
interface PatientProfileViewProps {
  patient: Client;
}

function PatientProfileView({ patient }: PatientProfileViewProps) {
  // Formata o CPF para exibição mascarada segura
  const formatCPF = (cpfStr?: string) => {
    if (!cpfStr) return '-';
    const digits = cpfStr.replace(/\D/g, '');
    if (digits.length !== 11) return cpfStr;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  // Formata data de nascimento
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Formata Telefone
  const formatPhone = (phoneStr?: string) => {
    if (!phoneStr) return '-';
    const digits = phoneStr.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    } else if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    return phoneStr;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Coluna Esquerda: Cartão Resumo */}
      <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-teal-50 dark:bg-teal-950/40 border-2 border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-xs relative">
          <UserIcon className="w-10 h-10" />
          <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" title="Paciente Ativo" />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
            {patient.nome}
          </h4>
          <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mt-1">
            Status: {patient.status}
          </p>
        </div>
        <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3 text-left">
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{patient.email}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{formatPhone(patient.telefone)}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">
              {patient.cidade && patient.estado ? `${patient.cidade} - ${patient.estado}` : 'Cidade não cadastrada'}
            </span>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Dados Detalhados */}
      <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Dados de Registro</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Informações gerais cadastradas na clínica.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">CPF</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{formatCPF(patient.cpf)}</span>
          </div>

          <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sexo</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{patient.sexo}</span>
          </div>

          <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data de Nascimento</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{formatDate(patient.data_nascimento)}</span>
          </div>

          <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Idade Calculada</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{patient.idade} anos</span>
          </div>
        </div>

        <div>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm border-t border-slate-100 dark:border-slate-800 pt-5">Informações de Endereço</h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Dados de localização para faturamento e prontuário.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1 p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">CEP</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{patient.cep || '-'}</span>
          </div>

          <div className="sm:col-span-2 p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logradouro</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{patient.logradouro || '-'}</span>
          </div>

          <div className="sm:col-span-1 p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número / Complemento</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {patient.numero || '-'} {patient.complemento ? `• ${patient.complemento}` : ''}
            </span>
          </div>

          <div className="sm:col-span-1 p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bairro</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{patient.bairro || '-'}</span>
          </div>

          <div className="sm:col-span-1 p-3.5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cidade / Estado</span>
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
              {patient.cidade && patient.estado ? `${patient.cidade} - ${patient.estado}` : '-'}
            </span>
          </div>
        </div>

        <div className="p-3 bg-teal-50/30 dark:bg-teal-950/10 border border-teal-100/50 dark:border-teal-900/20 rounded-2xl flex items-start gap-2.5">
          <Info className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
            Caso precise atualizar qualquer informação do seu prontuário ou dados cadastrais, informe a recepção durante sua próxima consulta presencial.
          </p>
        </div>
      </div>

    </div>
  );
}

/**
 * ============================================================================
 * COMPONENTE INTERNO: VISUALIZAÇÃO DE AGENDAMENTOS (BUILT-IN SCHEDULING VIEW)
 * ============================================================================
 */
interface PatientSchedulingViewProps {
  patient: Client;
}

function PatientSchedulingView({ patient }: PatientSchedulingViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [procedures, setProcedures] = useState<Procedimento[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Estados do formulário de novo agendamento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedProcedimento, setSelectedProcedimento] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [syncGoogle, setSyncGoogle] = useState(false);
  const [slotsErrorMsg, setSlotsErrorMsg] = useState('');
  const [submitErrorMsg, setSubmitErrorMsg] = useState('');

  // Carrega agendamentos existentes e procedimentos
  const loadAppointmentsAndProcs = async () => {
    try {
      setIsLoading(true);
      
      // 1. Carrega procedimentos cadastrados
      const procRes = await getProcedimentosAction();
      if (procRes.success && procRes.data) {
        setProcedures(procRes.data);
      }

      // 2. Busca agendamentos do paciente logado
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id,
            client_id,
            data,
            horario_inicio,
            horario_fim,
            procedimento,
            procedimento_id,
            observacoes,
            status,
            google_event_id,
            google_html_link,
            synced_with_google,
            created_at,
            updated_at,
            pacientes (
              id,
              nome,
              email,
              telefone
            )
          `)
          .eq('client_id', patient.id)
          .order('data', { ascending: false })
          .order('horario_inicio', { ascending: false });

        if (error) {
          console.error("Erro ao carregar agendamentos:", error);
        } else if (data) {
          const mapped = data.map((row: any) => {
            const pat = Array.isArray(row.pacientes) ? row.pacientes[0] : row.pacientes;
            return {
              id: row.id,
              client_id: row.client_id,
              client_nome: pat?.nome || patient.nome,
              client_email: pat?.email || patient.email || '',
              client_telefone: pat?.telefone || patient.telefone,
              data: row.data,
              horario_inicio: row.horario_inicio,
              horario_fim: row.horario_fim,
              procedimento: row.procedimento,
              procedimento_id: row.procedimento_id || null,
              observacoes: row.observacoes || null,
              status: row.status,
              google_event_id: row.google_event_id || null,
              google_html_link: row.google_html_link || null,
              synced_with_google: Boolean(row.synced_with_google),
              created_at: row.created_at,
              updated_at: row.updated_at,
            } as Appointment;
          });
          setAppointments(mapped);
        }
      }
    } catch (err) {
      console.error("Erro de conexão ao carregar agendamentos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAppointmentsAndProcs();
  }, [patient.id]);

  // Carrega horários livres sempre que a data mudar
  useEffect(() => {
    async function loadTimeSlots() {
      if (!selectedDate) {
        setAvailableSlots([]);
        setSlotsErrorMsg('');
        return;
      }
      
      try {
        setAvailableSlots([]);
        setSlotsErrorMsg('');
        setSelectedSlot('');
        
        const res = await getTimeSlotsForDateAction(selectedDate);
        if (res.success && res.data) {
          setAvailableSlots(res.data);
          if (res.message) {
            setSlotsErrorMsg(res.message);
          }
        } else {
          setSlotsErrorMsg(res.message || 'Falha ao consultar grade de horários.');
        }
      } catch (err) {
        setSlotsErrorMsg('Erro de conexão ao buscar horários livres.');
      }
    }

    loadTimeSlots();
  }, [selectedDate]);

  // Manipula submit de agendamento
  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErrorMsg('');

    if (!selectedDate) {
      setSubmitErrorMsg('Por favor, selecione uma data.');
      return;
    }
    if (!selectedProcedimento) {
      setSubmitErrorMsg('Por favor, escolha o procedimento desejado.');
      return;
    }
    if (!selectedSlot) {
      setSubmitErrorMsg('Por favor, selecione um horário livre.');
      return;
    }

    startTransition(async () => {
      try {
        const procObj = procedures.find(p => p.procedimento === selectedProcedimento);
        const res = await createAppointmentAction({
          client_id: patient.id,
          client_nome: patient.nome,
          client_email: patient.email || '',
          client_telefone: patient.telefone,
          data: selectedDate,
          horario_inicio: selectedSlot,
          horario_fim: '', // Calculado no servidor
          procedimento: selectedProcedimento,
          procedimento_id: procObj?.id || null,
          observacoes: observacoes || null,
          sync_google: syncGoogle
        });

        if (res.success) {
          setIsModalOpen(false);
          // Reseta campos
          setSelectedDate('');
          setSelectedProcedimento('');
          setSelectedSlot('');
          setObservacoes('');
          setSyncGoogle(false);
          // Recarrega listagem
          loadAppointmentsAndProcs();
        } else {
          setSubmitErrorMsg(res.message || 'Ocorreu um erro ao registrar sua consulta.');
        }
      } catch (err) {
        setSubmitErrorMsg('Erro interno de conexão. Tente novamente em alguns instantes.');
      }
    });
  };

  // Cores de status formatadas
  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'Confirmado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 shadow-3xs uppercase tracking-wider">
            <CheckCircle className="w-3 h-3" />
            Confirmado
          </span>
        );
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 shadow-3xs uppercase tracking-wider">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 shadow-3xs uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 shadow-3xs uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            Agendado
          </span>
        );
    }
  };

  // Formata data brasileira
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Topo da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-600" />
            Meus Agendamentos
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Visualize o histórico de suas consultas ou agende uma nova sessão com 2 dias de antecedência.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          type="button"
          className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/10 transition-all cursor-pointer select-none active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Agendar Nova Consulta</span>
        </button>
      </div>

      {/* Tabela / Lista de Agendamentos */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Buscando seus agendamentos...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800 shadow-3xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Nenhum agendamento encontrado</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Você ainda não possui consultas marcadas. Toque em &quot;Agendar Nova Consulta&quot; para reservar um horário.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data / Hora</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Procedimento</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Observações</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-6 py-4.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 flex items-center justify-center text-teal-600 dark:text-teal-400">
                          <CalendarDays className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                            {formatDateBR(appt.data)}
                          </span>
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                            {appt.horario_inicio} às {appt.horario_fim}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {appt.procedimento}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 max-w-xs">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate leading-relaxed">
                        {appt.observacoes || 'Sem observações'}
                      </p>
                    </td>
                    <td className="px-6 py-4.5 whitespace-nowrap">
                      {getStatusBadge(appt.status)}
                    </td>
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      {appt.google_html_link ? (
                        <a
                          href={appt.google_html_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-all"
                        >
                          Google Calendar
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold italic">Local</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Agendamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => !isPending && setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">Reservar Novo Horário</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Informe os dados para agendar com Dra. Juliana</p>
              </div>
              <button
                disabled={isPending}
                onClick={() => setIsModalOpen(false)}
                type="button"
                className="p-1.5 rounded-lg border border-slate-200/80 hover:border-slate-300 dark:border-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                &times;
              </button>
            </div>

            {submitErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-2xl text-xs border border-rose-200/50 dark:border-rose-900/30 flex items-start gap-2.5 font-bold">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 text-rose-500" />
                <span>{submitErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              
              {/* Escolha do Procedimento */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Procedimento Desejado
                </label>
                <select
                  disabled={isPending}
                  value={selectedProcedimento}
                  onChange={(e) => setSelectedProcedimento(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-teal-500/20 outline-hidden"
                >
                  <option value="">Selecione um procedimento...</option>
                  {procedures.map((proc) => (
                    <option key={proc.id || proc.procedimento} value={proc.procedimento}>
                      {proc.procedimento} ({proc.duracao}h - {proc.categoria})
                    </option>
                  ))}
                </select>
              </div>

              {/* Escolha da Data */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Data do Atendimento
                </label>
                <input
                  type="date"
                  disabled={isPending}
                  value={selectedDate}
                  min={new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // Mínimo 2 dias de antecedência
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-teal-500/20 outline-hidden"
                />
                <span className="block text-[10px] text-slate-400 font-semibold leading-relaxed">
                  * Atendimentos disponíveis às segundas, quintas (09h-16h) e sábados (13h-18h). Mínimo 2 dias de antecedência requerida.
                </span>
              </div>

              {/* Mensagem informativa/de erro de horários */}
              {slotsErrorMsg && (
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/50 dark:border-amber-900/20 text-amber-700 dark:text-amber-400 rounded-2xl text-[10px] leading-relaxed font-semibold">
                  {slotsErrorMsg}
                </div>
              )}

              {/* Escolha do Horário */}
              {selectedDate && availableSlots.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Horários Livres Disponíveis
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => {
                      const isOccupied = slot.isOccupied;
                      return (
                        <button
                          key={slot.slot}
                          disabled={isOccupied || isPending}
                          type="button"
                          onClick={() => setSelectedSlot(slot.slot)}
                          className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition-all border ${
                            isOccupied
                              ? 'bg-slate-100/50 dark:bg-slate-800/20 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                              : selectedSlot === slot.slot
                              ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-500/10'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-500'
                          }`}
                        >
                          {slot.slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações Clínicas / Sintomas (Opcional)
                </label>
                <textarea
                  disabled={isPending}
                  value={observacoes}
                  rows={2}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Se desejar, descreva o que está sentindo ou observações gerais..."
                  className="w-full text-xs font-semibold p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl focus:ring-2 focus:ring-teal-500/20 outline-hidden resize-none"
                />
              </div>

              {/* Sincronização Google */}
              <div className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  id="syncGoogleCheckbox"
                  disabled={isPending}
                  checked={syncGoogle}
                  onChange={(e) => setSyncGoogle(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-200 dark:border-slate-850 accent-teal-600 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="syncGoogleCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                  Sincronizar e reservar na minha Google Agenda
                </label>
              </div>

              {/* Ações do Formulário */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer select-none text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 px-4 rounded-2xl bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white shadow-md shadow-teal-500/10 transition-all cursor-pointer select-none flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Agendando...</span>
                    </>
                  ) : (
                    <span>Confirmar Agendamento</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
