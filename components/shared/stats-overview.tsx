"use client";

import React, { useEffect, useState } from "react";
import { Users, UserCheck, Calendar, CalendarCheck2, Loader2 } from "lucide-react";
import { getDashboardStatsAction } from "@/actions/stats-actions";
import type { DashboardTab } from "@/components/shared/app-header";

interface StatsOverviewProps {
  activeTab?: DashboardTab | string;
}

export function StatsOverview({ activeTab = "pacientes" }: StatsOverviewProps) {
  const [stats, setStats] = useState({
    totalPacientes: 0,
    pacientesAtivos: 0,
    consultasHoje: 0,
    proximosAtendimentos: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await getDashboardStatsAction();
        if (res.success && res.data) {
          setStats(res.data);
        }
      } catch (err) {
        console.error("Erro ao carregar estatísticas do dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const isAgendamentos = activeTab === "agendamentos";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-6 max-lg:landscape:grid-cols-2 max-lg:landscape:gap-3 box-border">
      {!isAgendamentos ? (
        <>
          {/* 1. Pacientes Ativos */}
          <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">Pacientes Ativos</span>
              <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 leading-none">
                  {stats.pacientesAtivos}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">em acompanhamento</span>
            </div>
          </div>

          {/* 2. Consultas Hoje */}
          <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">Consultas Hoje</span>
              <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-teal-700 dark:text-teal-400 leading-none">
                  {stats.consultasHoje}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">na agenda de hoje</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* 1. Consultas Hoje */}
          <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">Consultas Hoje</span>
              <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-teal-700 dark:text-teal-400 leading-none">
                  {stats.consultasHoje}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">na agenda de hoje</span>
            </div>
          </div>

          {/* 2. Próximos Atendimentos */}
          <div className="p-5 lg:p-6 max-lg:landscape:p-2.5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30 min-w-0 box-border overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate min-w-0 flex-1">Próximos Atendimentos</span>
              <div className="p-2 sm:p-2.5 landscape:p-1.5 rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400 shrink-0 ml-1 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 landscape:w-7 landscape:h-7">
                <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5 landscape:w-3.5 landscape:h-3.5" />
              </div>
            </div>
            <div className="mt-3 landscape:mt-1 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl lg:text-4xl landscape:text-xl font-extrabold tracking-tight text-sky-700 dark:text-sky-400 leading-none">
                  {stats.proximosAtendimentos}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">Google Calendar</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
