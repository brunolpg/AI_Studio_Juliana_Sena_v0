"use client";

import React from "react";
import Image from "next/image";
import { Users, Calendar, Stethoscope } from "lucide-react";
import { UserMenu } from "@/components/shared/user-menu";
import { motion } from "motion/react";

export type DashboardTab = "pacientes" | "prontuarios" | "agendamentos";

interface AppHeaderProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function AppHeader({ currentTab, onTabChange }: AppHeaderProps) {
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
    <>
      {/* ====================================================================
          1. DESKTOP (PC): MD4 Navigation Drawer (Sidebar Tonal)
          Superfície: surface-container-low, Indicadores: rounded-full pill
          ==================================================================== */}
      <aside
        aria-label="Navegação Lateral do Sistema"
        className="md4-desktop-drawer hidden lg:flex flex-col fixed top-0 bottom-0 left-0 w-64 h-dvh max-h-screen z-40 bg-slate-100/95 dark:bg-[#0f1929]/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-colors duration-200 shadow-xs select-none"
      >
        {/* Topo do Drawer: Logo & Identidade Clínica */}
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

        {/* Lista de Navegação Principal MD4 */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overscroll-contain">
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
                    layoutId="md4-desktop-drawer-indicator"
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

        {/* Rodapé do Drawer: Menu do Usuário */}
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-800/60 relative shrink-0 overflow-visible">
          <UserMenu direction="up" variant="sidebar" align="left" />
        </div>
      </aside>

      {/* ====================================================================
          2. MOBILE HORIZONTAL (LANDSCAPE): MD4 Navigation Rail Lateral Compacta
          Largura fixa: w-16 (64px), altura fixa à viewport (h-dvh max-h-screen)
          ==================================================================== */}
      <aside
        aria-label="Barra Lateral de Navegação Móvel"
        className="md4-nav-rail hidden fixed top-0 bottom-0 left-0 w-16 h-dvh max-h-screen z-40 bg-slate-100/95 dark:bg-[#0f1929]/95 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 flex-col items-center justify-between py-2 shadow-sm select-none"
      >
        {/* Topo do Rail: Logo Compacta */}
        <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-[#004d40] overflow-hidden p-1.5 shrink-0 mb-1 shadow-sm transition-transform hover:scale-105">
          <Image
            src="/logo-clinica.png"
            alt="Logo Clínica Dra. Juliana Sena"
            width={40}
            height={40}
            priority
            className="w-full h-full object-contain"
          />
        </div>

        {/* Itens do Rail (Ícones com Indicador Pílula Vertical) */}
        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-1 overflow-y-auto no-scrollbar overscroll-contain min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all cursor-pointer ${
                  isActive
                    ? "text-teal-700 dark:text-teal-400 font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                }`}
                title={item.label}
              >
                <div
                  className={`px-3 py-1 rounded-full transition-colors relative ${
                    isActive
                      ? "bg-teal-100 dark:bg-teal-950/80 border border-teal-200/70 dark:border-teal-800/70 shadow-2xs"
                      : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.badge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <span className="text-[9px] leading-tight truncate max-w-[52px] text-center">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Base do Rail: Perfil Compacto */}
        <div className="shrink-0 flex items-center justify-center pt-1 border-t border-slate-200/50 dark:border-slate-800/50 w-full relative overflow-visible">
          <UserMenu direction="up" variant="compact" align="left" />
        </div>
      </aside>

      {/* ====================================================================
          3. TOP APP BAR (Compact Header apenas para Mobile Retrato/Portrait - Oculto no Desktop e Mobile Paisagem)
          No Desktop (lg:) e Mobile Paisagem (landscape:) fica oculto pois o Drawer / Navigation Rail já cumprem a navegação e perfil
          ==================================================================== */}
      <header className="md4-top-bar lg:hidden landscape:hidden w-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-all duration-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 overflow-visible">
          <div className="flex items-center justify-between gap-3 overflow-visible">
            {/* Lado Esquerdo: Identidade Visível no Mobile (no Desktop o Drawer já exibe) */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-[#004d40] overflow-hidden p-1 shrink-0 shadow-xs">
                <Image
                  src="/logo-clinica.png"
                  alt="Logo Clínica Dra. Juliana Sena"
                  width={36}
                  height={36}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
                  Juliana Sena
                  <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400">
                    {" "}– Gestão de Pacientes
                  </span>
                </h1>
                <p className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold tracking-wide truncate">
                  {currentTab === "pacientes"
                    ? "Painel de Pacientes & Cadastros"
                    : currentTab === "prontuarios"
                    ? "Prontuário Eletrônico & Evoluções"
                    : "Grade de Consultas & Agendamentos"}
                </p>
              </div>
            </div>


            {/* Lado Direito: UserMenu (visível no mobile portrait/landscape) */}
            <div className="flex items-center gap-2 shrink-0 relative overflow-visible z-50">
              <UserMenu direction="down" align="right" />
            </div>
          </div>
        </div>
      </header>

      {/* ====================================================================
          4. MOBILE VERTICAL (PORTRAIT): MD4 Bottom Navigation Bar
          Alvos de toque mínimos de 48x48px, indicador pílula e rótulos concisos
          ==================================================================== */}
      <nav
        aria-label="Navegação Inferior Móvel"
        className="md4-bottom-nav flex fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0f1929]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 shadow-lg items-center justify-around select-none safe-area-pb"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl py-1 transition-all cursor-pointer relative ${
                isActive
                  ? "text-teal-700 dark:text-teal-400 font-bold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <div
                className={`px-4 py-1 rounded-full transition-colors relative ${
                  isActive
                    ? "bg-teal-100 dark:bg-teal-950/80 border border-teal-200/70 dark:border-teal-800/70 shadow-2xs"
                    : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <span className="text-[11px] leading-tight">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
