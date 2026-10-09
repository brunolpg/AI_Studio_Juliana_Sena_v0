'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Sun, Moon, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-context';

export interface UserMenuProps {
  user?: {
    nome?: string;
    name?: string;
    role: string;
    email?: string;
    foto_perfil?: string | null;
    avatar?: string | null;
    roleLabel?: string;
  } | null;
  onLogout?: () => Promise<void>;
}

export function UserMenu({ user: propUser, onLogout: propLogout }: UserMenuProps = {}) {
  const { user: authUser, isLoading, openAuthModal, logout: authLogout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    if (typeof window !== 'undefined') {
      const current = document.documentElement.classList.contains('dark');
      if (current) {
        document.documentElement.classList.remove('dark');
        setIsDark(false);
      } else {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      }
    }
  };

  // Determine active user & logout handler
  const user = propUser !== undefined ? propUser : authUser;
  const onLogout = propLogout !== undefined ? propLogout : authLogout;

  if (isLoading && propUser === undefined) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 animate-pulse">
        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="w-20 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          id="header-login-btn"
          type="button"
          onClick={() => openAuthModal && openAuthModal("login")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 rounded-xl transition-all shadow-2xs cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Entrar</span>
        </button>

        <button
          id="header-register-btn"
          type="button"
          onClick={() => openAuthModal && openAuthModal("register")}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Registrar</span>
        </button>
      </div>
    );
  }

  const userDisplayName = user.nome || user.name || "Usuário";
  const userRole = user.role || "paciente";
  const userEmail = user.email || "";
  const userAvatar = user.foto_perfil || user.avatar || null;
  const userRoleLabel = user.roleLabel || (
    userRole === "administrador" ? "Administrador" : 
    userRole === "profissional" ? "Profissional" : "Paciente"
  );

  const initials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        id="user-profile-menu-btn"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 bg-white dark:bg-slate-800 transition-all text-left shadow-2xs group cursor-pointer font-sans"
      >
        {userAvatar ? (
          <img
            src={userAvatar}
            alt={userDisplayName}
            className="w-7 h-7 rounded-lg object-cover shadow-2xs"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            {initials || "U"}
          </div>
        )}
        <div className="hidden sm:block leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
              {userDisplayName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-[10px] text-teal-700 dark:text-teal-400 block truncate max-w-[120px] font-medium">
            {userRoleLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-[9999] animate-in fade-in zoom-in-95 duration-150 font-sans">
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                Sessão Autenticada
              </span>
              <span className="text-[10px] text-slate-400 font-mono">JWT HS256</span>
            </div>
            <p className="font-semibold text-xs text-slate-900 dark:text-white mt-1.5 truncate">
              {userDisplayName}
            </p>
            {userEmail && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {userEmail}
              </p>
            )}
          </div>

          <div className="py-1">
            <div className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Nível de Acesso:</span>
              <span className="font-semibold text-teal-700 dark:text-teal-400 capitalize">
                {userRole}
              </span>
            </div>
            
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
            >
              <span>Tema do Sistema:</span>
              <div className="flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400">
                {isDark ? (
                  <>
                    <Sun className="w-3 h-3 text-amber-500" />
                    <span>Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3 h-3 text-indigo-400" />
                    <span>Escuro</span>
                  </>
                )}
              </div>
            </button>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              id="user-logout-btn"
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onLogout) {
                  onLogout();
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Encerrar Sessão (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
