"use client";

import React, { useEffect, useState } from "react";
import { Users, UserCheck, UserX, Archive, ShieldCheck, Database } from "lucide-react";
import { getClientsAction } from "@/actions/client-actions";

export function StatsOverview() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    inTrash: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const [allRes, activeRes, inactiveRes, trashRes] = await Promise.all([
        getClientsAction({ status: "todos", pageSize: 100 }),
        getClientsAction({ status: "Ativo", pageSize: 100 }),
        getClientsAction({ status: "Inativo", pageSize: 100 }),
        getClientsAction({ status: "excluidos", pageSize: 100 }),
      ]);

      setStats({
        total: allRes.data?.total || 0,
        active: activeRes.data?.total || 0,
        inactive: inactiveRes.data?.total || 0,
        inTrash: trashRes.data?.total || 0,
      });
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
          <span className="text-[11px] text-slate-400">registros ativos</span>
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
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pacientes Inativos</span>
          <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <UserX className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.inactive}</span>
          <span className="text-[11px] text-slate-400">cadastros suspensos</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lixeira (Soft Delete)</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Archive className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.inTrash}</span>
          <span className="text-[11px] text-slate-400">restauráveis</span>
        </div>
      </div>
    </div>
  );
}
