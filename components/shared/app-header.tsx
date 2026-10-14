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
    <header className="w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-50 overflow-visible shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 overflow-visible">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3 overflow-visible">
          
          {/* Linha 1 no Mobile / Lado Esquerdo no Desktop: Identidade + Perfil Mobile */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3 shrink-0 overflow-visible">
            {/* Logo & Identidade */}
            <div className="flex items-center gap-2.5 shrink-0 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/10">
                <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5"/>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                    Juliana Sena
                    <span className="hidden lg:inline font-normal text-slate-500 dark:text-slate-400">
                      {" "}– Gestão de Pacientes
                    </span>
                  </h1>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                    Produção
                  </span>
                </div>
              </div>
            </div>

            {/* UserMenu no Mobile (posicionado à direita) */}
            <div className="md:hidden shrink-0 relative overflow-visible z-50">
              <UserMenu/>
            </div>
          </div>

          {/* Linha 2 no Mobile / Centro no Desktop: Abas de Navegação (rolagem horizontal estritamente aqui) */}
          <div className="flex items-center justify-center w-full md:w-auto overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <nav className="flex items-center gap-1 p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <button
                id="nav-tab-pacientes"
                type="button"
                onClick={() => onTabChange("pacientes")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
                  currentTab === "pacientes"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Users className="shrink-0 w-3.5 h-3.5"/>
                <span>Pacientes</span>
              </button>

              <button
                id="nav-tab-prontuarios"
                type="button"
                onClick={() => onTabChange("prontuarios")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
                  currentTab === "prontuarios"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Stethoscope className="shrink-0 w-3.5 h-3.5"/>
                <span className="hidden sm:inline">Prontuários &amp; Evoluções</span>
                <span className="sm:hidden">Prontuários</span>
              </button>

              <button
                id="nav-tab-agendamentos"
                type="button"
                onClick={() => onTabChange("agendamentos")}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer relative shrink-0 ${
                  currentTab === "agendamentos"
                    ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Calendar className="shrink-0 w-3.5 h-3.5"/>
                <span>Agendamentos</span>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block animate-pulse shrink-0" />
              </button>
            </nav>
          </div>

          {/* Lado Direito no Desktop: UserMenu com z-50 e overflow-visible */}
          <div className="hidden md:flex items-center shrink-0 relative overflow-visible z-50">
            <UserMenu/>
          </div>

        </div>
      </div>
    </header>
  );
}
