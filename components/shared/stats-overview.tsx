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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
      {!isAgendamentos ? (
        <>
          {/* 1. Pacientes Ativos */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">Pacientes Ativos</span>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 ml-1">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {stats.pacientesAtivos}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">em acompanhamento</span>
            </div>
          </div>

          {/* 2. Consultas Hoje */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">Consultas Hoje</span>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 shrink-0 ml-1">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-700 dark:text-teal-400">
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
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">Consultas Hoje</span>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400 shrink-0 ml-1">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-700 dark:text-teal-400">
                  {stats.consultasHoje}
                </span>
              )}
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">na agenda de hoje</span>
            </div>
          </div>

          {/* 2. Próximos Atendimentos */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs transition-all duration-200 hover:shadow-md hover:border-teal-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 truncate">Próximos Atendimentos</span>
              <div className="p-2 sm:p-2.5 rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400 shrink-0 ml-1">
                <CalendarCheck2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 flex-wrap">
              {loading ? (
                <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : (
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-sky-700 dark:text-sky-400">
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
