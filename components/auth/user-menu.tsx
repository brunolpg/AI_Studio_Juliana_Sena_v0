"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User as UserIcon,
  LogIn,
  LogOut,
  ShieldCheck,
  ChevronDown,
  UserPlus,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "./auth-context";

export function UserMenu() {
  const { user, isLoading, openAuthModal, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
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
          onClick={() => openAuthModal("login")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 border border-teal-200/80 dark:border-teal-800 rounded-xl transition-all shadow-2xs"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Entrar</span>
        </button>

        <button
          id="header-register-btn"
          onClick={() => openAuthModal("register")}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all shadow-2xs"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Registrar</span>
        </button>
      </div>
    );
  }

  const initials = user.name
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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 bg-white dark:bg-slate-800 transition-all text-left shadow-2xs group"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
          {initials || "U"}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
              {user.name}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-[10px] text-teal-700 dark:text-teal-400 block truncate max-w-[120px] font-medium">
            {user.roleLabel}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                Sessão Autenticada
              </span>
              <span className="text-[10px] text-slate-400 font-mono">JWT HS256</span>
            </div>
            <p className="font-semibold text-xs text-slate-900 dark:text-white mt-1.5 truncate">
              {user.name}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user.email}
            </p>
          </div>

          <div className="py-1">
            <div className="px-2.5 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Nível de Acesso:</span>
              <span className="font-semibold text-teal-700 dark:text-teal-400 capitalize">
                {user.role}
              </span>
            </div>
            <div className="px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Permissão CRUD:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Totalmente Liberado
              </span>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              id="user-logout-btn"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
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
