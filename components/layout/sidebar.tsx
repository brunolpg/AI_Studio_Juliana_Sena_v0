"use client";

import React from "react";
import Image from "next/image";
import { Users, Calendar, Stethoscope } from "lucide-react";
import { UserMenu } from "@/components/shared/user-menu";
import { motion } from "motion/react";
import type { DashboardTab } from "@/components/shared/app-header";

export interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  className?: string;
}

export function Sidebar({ currentTab, onTabChange, className = "" }: SidebarProps) {
  const navItems = [
    {
      id: "pacientes" as DashboardTab,
      label: "Pacientes",
      shortLabel: "Pacientes",
      icon: Users,
      badge: null,
    },
    {
      id: "prontuarios" as DashboardTab,
      label: "Prontuários & Evoluções",
      shortLabel: "Prontuários",
      icon: Stethoscope,
      badge: null,
    },
    {
      id: "agendamentos" as DashboardTab,
      label: "Agendamentos",
      shortLabel: "Agenda",
      icon: Calendar,
      badge: "Ativo",
    },
  ];

  return (
    <aside
      aria-label="Navegação Lateral do Sistema"
      className={`md4-desktop-drawer hidden lg:flex flex-col fixed top-0 bottom-0 left-0 w-64 h-dvh max-h-screen z-40 bg-slate-100/95 dark:bg-[#0f1929]/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-200 shadow-xs select-none ${className}`}
    >
      {/* Topo da Sidebar: Logo & Identidade Clínica */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-3 shrink-0">
        <div className="relative flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-[#004d40] overflow-hidden p-1.5 shrink-0 shadow-sm transition-transform duration-200 hover:scale-105">
          <Image
            src="/logo-clinica.png"
            alt="Logo Clínica Dra. Juliana Sena"
            width={44}
            height={44}
            priority
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              Juliana Sena
            </h1>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70 shrink-0">
              MD4
            </span>
          </div>
          <p className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold tracking-wide truncate mt-0.5">
            Gestão Clínica Integrada
          </p>
        </div>
      </div>

      {/* Lista de Navegação Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Menu Principal
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-semibold transition-all cursor-pointer group ${
                isActive
                  ? "bg-teal-100/90 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border border-teal-200/70 dark:border-teal-800/70 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="md4-desktop-drawer-indicator-sidebar"
                  className="absolute inset-0 rounded-full bg-teal-100/90 dark:bg-teal-950/80 -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon
                className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? "text-teal-700 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
                }`}
              />
              <span className="truncate flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé da Sidebar: Menu do Usuário com abertura para cima */}
      <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 relative shrink-0 overflow-visible">
        <UserMenu direction="up" variant="sidebar" align="left" />
      </div>
    </aside>
  );
}

export default Sidebar;
