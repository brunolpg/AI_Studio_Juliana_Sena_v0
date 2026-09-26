"use client";

import React, { useEffect, useState } from "react";
import { Users, UserCheck, Calendar, CalendarCheck2 } from "lucide-react";
import { getClientsAction } from "@/actions/client-actions";
import { getAppointmentsAction } from "@/actions/appointment-actions";

export function StatsOverview() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    todayAppointments: 0,
    upcomingAppointments: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [allRes, activeRes, todayAptRes, upcomingAptRes] = await Promise.all([
          getClientsAction({ status: "todos", pageSize: 1 }),
          getClientsAction({ status: "Ativo", pageSize: 1 }),
          getAppointmentsAction({ tab: "hoje", pageSize: 1 }),
          getAppointmentsAction({ tab: "proximos", pageSize: 1 }),
        ]);

        setStats({
          total: allRes.data?.total || 0,
          active: activeRes.data?.total || 0,
          todayAppointments: todayAptRes.data?.total || 0,
          upcomingAppointments: upcomingAptRes.data?.total || 0,
        });
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de Pacientes</span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
          <span className="text-[11px] text-slate-400">cadastros</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pacientes Ativos</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
          <span className="text-[11px] text-slate-400">em acompanhamento</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Consultas Hoje</span>
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-teal-600 dark:text-teal-400">{stats.todayAppointments}</span>
          <span className="text-[11px] text-slate-400">na agenda de hoje</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Próximos Atendimentos</span>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <CalendarCheck2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">{stats.upcomingAppointments}</span>
          <span className="text-[11px] text-slate-400">Google Calendar</span>
        </div>
      </div>
    </div>
  );
}

