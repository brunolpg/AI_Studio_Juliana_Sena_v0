"use client";

import React from "react";
import { Users, Calendar, Stethoscope, Sparkles } from "lucide-react";
import { UserMenu } from "@/components/shared/user-menu";

export type DashboardTab = "pacientes" | "prontuarios" | "agendamentos";

interface AppHeaderProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function AppHeader({ currentTab, onTabChange }: AppHeaderProps) {
  return (
    <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 overflow-visible">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 w-full overflow-x-auto no-scrollbar">
        {/* Logo & Info */}
        <div className="shrink-0 min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/10">
            <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                Juliana Sena<span className="hidden lg:inline"> – Gestão de Pacientes</span>
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                Produção
              </span>
            </div>
          </div>
        </div>

        {/* Menu Central de Navegação */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink min-w-0">
          <button
            id="nav-tab-pacientes"
            onClick={() => onTabChange("pacientes")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer shrink-0 ${
              currentTab === "pacientes"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users className="shrink-0 w-3.5 h-3.5" />
            <span className="truncate">Pacientes</span>
          </button>

          <button
            id="nav-tab-prontuarios"
            onClick={() => onTabChange("prontuarios")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer shrink-0 ${
              currentTab === "prontuarios"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Stethoscope className="shrink-0 w-3.5 h-3.5" />
            <span className="hidden xl:inline">Prontuários & Evoluções</span>
            <span className="xl:hidden">Prontuários</span>
          </button>

          <button
            id="nav-tab-agendamentos"
            onClick={() => onTabChange("agendamentos")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer relative shrink-0 ${
              currentTab === "agendamentos"
                ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Calendar className="shrink-0 w-3.5 h-3.5" />
            <span className="truncate">Agendamentos</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block animate-pulse shrink-0" />
          </button>
        </div>

        {/* Lado Direito (Perfil / Avatar do Usuário) */}
        <div className="shrink-0 flex items-center gap-2 pl-1">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
