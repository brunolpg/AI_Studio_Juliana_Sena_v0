"use client";

import React, { useEffect, useState } from "react";
import { Users, UserCheck, Calendar, CalendarCheck2, Loader2 } from "lucide-react";
import { getDashboardStatsAction } from "@/actions/stats-actions";

export function StatsOverview() {
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

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {/* 1. Total de Pacientes */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de Pacientes</span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalPacientes}
            </span>
          )}
          <span className="text-[11px] text-slate-400">cadastros</span>
        </div>
      </div>

      {/* 2. Pacientes Ativos */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pacientes Ativos</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.pacientesAtivos}
            </span>
          )}
          <span className="text-[11px] text-slate-400">em acompanhamento</span>
        </div>
      </div>

      {/* 3. Consultas Hoje */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Consultas Hoje</span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {stats.consultasHoje}
            </span>
          )}
          <span className="text-[11px] text-slate-400">na agenda de hoje</span>
        </div>
      </div>

      {/* 4. Próximos Atendimentos */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Próximos Atendimentos</span>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <CalendarCheck2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          {loading ? (
            <div className="h-8 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {stats.proximosAtendimentos}
            </span>
          )}
          <span className="text-[11px] text-slate-400">Google Calendar</span>
        </div>
      </div>
    </div>
  );
}
