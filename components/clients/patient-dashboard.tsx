"use client";

import React, { useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
import { AppHeader, DashboardTab } from "@/components/shared/app-header";
import { StatsOverview } from "@/components/shared/stats-overview";
import { ClientTableView } from "@/components/clients/client-table-view";
import { AppointmentTableView } from "@/components/appointments/appointment-table-view";
import { PatientClinicalDashboardView } from "@/components/clinical/patient-clinical-dashboard-view";
import { DeliverablesView } from "@/components/clients/deliverables-view";
import { ShieldCheck, CalendarCheck2, FileCode2, Calendar, Stethoscope, Users } from "lucide-react";

export function PatientDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("pacientes");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Top Header com navegação por abas */}
      <AppHeader currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="md4-main-content flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-8 sm:pt-6 sm:pb-8 lg:pt-6 lg:pb-10 space-y-6 landscape:pt-2">
        {/* MD4 Functional Highlights Banner */}
        <div className="bg-gradient-to-br from-teal-950 via-slate-900 to-slate-900 dark:from-slate-900 dark:via-teal-950/70 dark:to-slate-950 text-white p-6 sm:p-7 rounded-3xl border border-teal-800/40 dark:border-teal-700/30 shadow-xs relative overflow-hidden transition-all duration-300">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/15 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-3.5 backdrop-blur-xs">
              {activeTab === "prontuarios" ? (
                <>
                  <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
                  <span>Prontuário Eletrônico & Evoluções Clínicas Ativas</span>
                </>
              ) : activeTab === "agendamentos" ? (
                <>
                  <CalendarCheck2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Google Calendar API & Grade de Horários Ativa</span>
                </>
              ) : activeTab === "deliverables" ? (
                <>
                  <FileCode2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Documentação Técnica & Scripts DDL</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Segurança JWT & Sessão Protegida Ativa</span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight">
              {activeTab === "prontuarios"
                ? "Prontuário Médico, Anamnese & Evoluções"
                : activeTab === "agendamentos"
                ? "Agendamento de Consultas & Google Agenda"
                : activeTab === "deliverables"
                ? "Entregáveis Técnicos, Zod & Schemas SQL"
                : "Sistema de Gestão & Cadastro de Pacientes"}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
              {activeTab === "prontuarios"
                ? "Dra. Juliana Sena • Gestão de histórico clínico, alergias com alertas, anotações de evolução no padrão SOAP, sinais vitais e receituário integrado."
                : activeTab === "agendamentos"
                ? "Dra. Juliana Sena • Gestão de atendimentos com intervalos de 1 hora (08:00 às 17:00), detecção de horários ocupados e sincronização integrada ao Google Agenda."
                : activeTab === "deliverables"
                ? "Consulte os códigos do Schema Zod estrito, scripts DDL do Supabase PostgreSQL com RLS, índices otimizados e autenticação JWT."
                : "Dra. Juliana Sena • Controle de acesso com autenticação JWT, sessões seguras em cookies HTTP-Only e proteção estrita nas mutações CRUD."}
            </p>
          </div>
        </div>

        {/* Quick Metrics */}
        <StatsOverview activeTab={activeTab} />

        {/* Views Condicionais por Aba */}
        {activeTab === "pacientes" && (
          <div className="space-y-4">
            <ClientTableView />
          </div>
        )}

        {activeTab === "prontuarios" && (
          <div className="space-y-4">
            <PatientClinicalDashboardView
              onOpenAppointments={() => setActiveTab("agendamentos")}
            />
          </div>
        )}

        {activeTab === "agendamentos" && (
          <div className="space-y-4">
            <AppointmentTableView />
          </div>
        )}

        {activeTab === "deliverables" && (
          <div className="space-y-4">
            <DeliverablesView />
          </div>
        )}
      </main>

      {/* Rodapé do Sistema */}
      <footer className="md4-main-content border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-6 pb-24 sm:py-6 landscape:py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <p>
            Dra. Juliana Sena • Gestão de Pacientes & Agendamentos • Next.js 15 & Supabase
          </p>
        </div>
      </footer>

      {/* Modal Global de Autenticação */}
      <AuthModal />
    </div>
  );
}

