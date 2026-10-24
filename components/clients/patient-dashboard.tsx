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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col box-border w-full max-w-full min-w-0 overflow-x-hidden antialiased lg:pl-64">
      {/* Top Header com navegação por abas */}
      <AppHeader currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area Padronizada com Largura Total Fluida e Simetria Perfeita */}
      <main className="md4-main-content flex-1 min-w-0 w-full px-8 py-6 lg:px-10 lg:py-8 space-y-6 box-border overflow-x-hidden max-lg:landscape:space-y-3 max-lg:landscape:pt-2 max-lg:landscape:pl-20 max-lg:landscape:pr-5">
        {/* MD4 Functional Highlights Banner */}
        <div className="w-full min-w-0 box-border bg-gradient-to-br from-teal-950 via-slate-900 to-slate-900 dark:from-slate-900 dark:via-teal-950/70 dark:to-slate-950 text-white p-6 sm:p-7 lg:p-8 max-lg:landscape:py-3 max-lg:landscape:px-4 rounded-3xl border border-teal-800/40 dark:border-teal-700/30 shadow-xs relative overflow-hidden transition-all duration-300">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/15 to-transparent pointer-events-none" />
          <div className="relative z-10">
            {activeTab === "prontuarios" ? (
              <>
                <div className="flex items-center gap-3">
                  <Stethoscope className="w-7 h-7 md:w-8 md:h-8 text-emerald-300 shrink-0" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    Prontuário Médico, Anamnese & Evoluções
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-emerald-200/85 font-medium mt-1">
                  Prontuário Eletrônico & Evoluções Clínicas Ativas
                </p>
              </>
            ) : activeTab === "agendamentos" ? (
              <>
                <div className="flex items-center gap-3">
                  <Calendar className="w-7 h-7 md:w-8 md:h-8 text-emerald-300 shrink-0" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    Agendamento de Consultas & Google Agenda
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-emerald-200/85 font-medium mt-1">
                  Google Calendar API & Grade de Horários Ativa
                </p>
              </>
            ) : activeTab === "deliverables" ? (
              <>
                <div className="flex items-center gap-3">
                  <FileCode2 className="w-7 h-7 md:w-8 md:h-8 text-emerald-300 shrink-0" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    Entregáveis Técnicos, Zod & Schemas SQL
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-emerald-200/85 font-medium mt-1">
                  Documentação Técnica & Scripts DDL
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Users className="w-7 h-7 md:w-8 md:h-8 text-emerald-300 shrink-0" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                    Sistema de Gestão & Cadastro de Pacientes
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-emerald-200/85 font-medium mt-1">
                  Segurança JWT & Sessão Protegida Ativa
                </p>
              </>
            )}
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
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-6 pb-24 sm:py-6 max-lg:landscape:py-6 max-lg:landscape:pl-20 max-lg:landscape:pr-5 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="w-full px-8 lg:px-10 flex items-center justify-center">
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

