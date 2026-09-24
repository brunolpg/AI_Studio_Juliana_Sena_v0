"use client";

import React from "react";
import { Users, FileCode2, ShieldCheck, Database, Layers } from "lucide-react";

interface AppHeaderProps {
  currentTab: "app" | "deliverables";
  onTabChange: (tab: "app" | "deliverables") => void;
}

export function AppHeader({ currentTab, onTabChange }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
          {/* Logo & Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/10">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                  Juliana Sena - Gestão de Pacientes
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Produção
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Next.js App Router • Supabase PostgreSQL • Zod Validation • Server Actions
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start md:self-auto">
            <button
              id="nav-tab-app"
              onClick={() => onTabChange("app")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                currentTab === "app"
                  ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Painel de Gestão</span>
            </button>

            <button
              id="nav-tab-deliverables"
              onClick={() => onTabChange("deliverables")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                currentTab === "deliverables"
                  ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Entregáveis Técnicos & Scripts</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
