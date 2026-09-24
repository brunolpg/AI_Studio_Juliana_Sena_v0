"use client";

import React, { useState } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AppHeader } from "@/components/shared/app-header";
import { StatsOverview } from "@/components/shared/stats-overview";
import { ClientTableView } from "@/components/clients/client-table-view";
import { DeliverablesView } from "@/components/clients/deliverables-view";
import {
  ShieldCheck,
  Calculator,
  MapPin,
  Trash2,
  Database,
  FileCode2,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"app" | "deliverables">("app");

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
        {/* Top Header */}
        <AppHeader currentTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Functional Highlights Banner */}
          <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white p-6 rounded-2xl border border-teal-800/40 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-teal-500/10 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Requisitos Funcionais & Técnicos 100% Implementados</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Sistema de Gestão & Cadastro de Pacientes
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1.5 leading-relaxed">
                Desenvolvido por <strong>Bruno Gonçalves</strong>
              </p>

              {/* Badges de Destaque */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Calculator className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span>Idade Automática & Bloqueada</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span>CPF com Dígito Verificador Real</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span>27 UFs & Cidades Dinâmicas</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Trash2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span>Soft Delete + Lixeira + RLS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <StatsOverview />

          {/* Views Condicionais */}
          {activeTab === "app" ? (
            <div className="space-y-4">
              <ClientTableView />
            </div>
          ) : (
            <div className="space-y-4">
              <DeliverablesView />
            </div>
          )}
        </main>

        {/* Rodapé do Sistema */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              Aplicação Full-Stack de Cadastro e Gestão de Clientes • Next.js 15 App Router & Supabase PostgreSQL
            </p>
            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
              <button
                onClick={() => setActiveTab("deliverables")}
                className="hover:underline flex items-center gap-1 font-medium"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Ver Schema Zod & Scripts SQL</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </ToastProvider>
  );
}
