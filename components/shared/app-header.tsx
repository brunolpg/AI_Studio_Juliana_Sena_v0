"use client";

import React from "react";
import { Users, Calendar, Stethoscope, Sparkles } from "lucide-react";
import { UserMenu } from "@/components/auth/user-menu";

export type DashboardTab = "pacientes" | "prontuarios" | "agendamentos";

interface AppHeaderProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function AppHeader({ currentTab, onTabChange }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40 w-full overflow-x-hidden">
      <div className="w-full max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
          {/* Logo & Info */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  Juliana Sena - Gestão de Pacientes
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                  Produção
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs & User Profile */}
          <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end overflow-x-auto no-scrollbar max-w-full pb-1 md:pb-0">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar max-w-full shrink-0">
              <button
                id="nav-tab-pacientes"
                onClick={() => onTabChange("pacientes")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                  currentTab === "pacientes"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Pacientes</span>
              </button>

              <button
                id="nav-tab-prontuarios"
                onClick={() => onTabChange("prontuarios")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer shrink-0 ${
                  currentTab === "prontuarios"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Prontuários & Evoluções</span>
              </button>

              <button
                id="nav-tab-agendamentos"
                onClick={() => onTabChange("agendamentos")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer relative shrink-0 ${
                  currentTab === "agendamentos"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Agendamentos</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block animate-pulse" />
              </button>
            </div>

            {/* Menu de Autenticação / Perfil */}
            <div className="shrink-0">
              <UserMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
