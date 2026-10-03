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
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Top Header com navegação por abas */}
      <AppHeader currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Functional Highlights Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white p-6 rounded-2xl border border-teal-800/40 shadow-xs relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-3">
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

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {activeTab === "prontuarios"
                ? "Prontuário Médico, Anamnese & Evoluções"
                : activeTab === "agendamentos"
                ? "Agendamento de Consultas & Google Agenda"
                : activeTab === "deliverables"
                ? "Entregáveis Técnicos, Zod & Schemas SQL"
                : "Sistema de Gestão & Cadastro de Pacientes"}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1.5 leading-relaxed">
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
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            Dra. Juliana Sena • Gestão de Pacientes & Agendamentos com Google Calendar • Next.js 15 & Supabase
          </p>
          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab("pacientes")}
              className="hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pacientes</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("prontuarios")}
              className="hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Prontuários</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setActiveTab("agendamentos")}
              className="hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agendamentos</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Global de Autenticação */}
      <AuthModal />
    </div>
  );
}

