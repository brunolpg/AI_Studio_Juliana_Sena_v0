"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut, Sun, Moon, ShieldCheck } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface UserMenuProps {
  user?: {
    nome?: string;
    name?: string;
    role?: string;
    email?: string;
    foto_perfil?: string | null;
    avatar?: string | null;
    avatar_url?: string | null;
    roleLabel?: string;
  } | null;
  onLogout?: () => Promise<void> | void;
}

export function UserMenu({ user: propUser, onLogout: propLogout }: UserMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userName, setUserName] = useState("Bruno Gonçalves");
  const [userEmail, setUserEmail] = useState("brunolpgbackup@gmail.com");
  const [userRole, setUserRole] = useState("Administrador(a)");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 60, right: 16 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    if (propUser) {
      if (propUser.nome || propUser.name) setUserName(propUser.nome || propUser.name || "Bruno Gonçalves");
      if (propUser.email) setUserEmail(propUser.email);
      if (propUser.roleLabel) {
        setUserRole(propUser.roleLabel);
      } else if (propUser.role) {
        const r = String(propUser.role).toLowerCase();
        setUserRole(r === "admin" || r === "administrador" ? "Administrador(a)" : r === "paciente" ? "Paciente" : propUser.role);
      }
      if (propUser.avatar_url || propUser.foto_perfil || propUser.avatar) {
        setAvatarUrl(propUser.avatar_url || propUser.foto_perfil || propUser.avatar || null);
      }
    }

    async function loadUserData() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (user.email && !propUser?.email) setUserEmail(user.email);
          const meta = user.user_metadata;
          if ((meta?.nome || meta?.full_name) && !propUser?.nome && !propUser?.name) {
            setUserName(meta.nome || meta.full_name);
          }
          if (meta?.avatar_url && !propUser?.avatar_url && !propUser?.foto_perfil) {
            setAvatarUrl(meta.avatar_url);
          }
          if (meta?.role && !propUser?.role && !propUser?.roleLabel) {
            const r = String(meta.role).toLowerCase();
            setUserRole(r === "admin" || r === "administrador" ? "Administrador(a)" : r === "paciente" ? "Paciente" : meta.role);
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar dados do usuário:", e);
      }
    }
    loadUserData();
  }, [propUser]);

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen((prev) => !prev);
  };

  // Fecha ao clicar fora ou ao rolar/redimensionar a janela
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updateDropdownPosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleLogout = async () => {
    setIsOpen(false);
    if (propLogout) {
      try {
        await propLogout();
      } catch (err) {
        console.warn("Aviso ao tentar realizar logout do prop:", err);
      }
    } else {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {}
      try {
        const supabase = getSupabaseClient();
        if (supabase) await supabase.auth.signOut();
      } catch {}
      window.location.href = "/";
    }
  };

  return (
    <div className="relative inline-block overflow-visible">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-2xl border border-teal-500/40 dark:border-teal-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-2xs"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="hidden sm:flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[130px] truncate leading-tight">
              {userName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 leading-tight">
            {userRole}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 ml-0.5 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Renderiza o Dropdown no document.body via Portal para nunca ser cortado nem gerar scrollbar */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              right: `${coords.right}px`,
              zIndex: 99999,
            }}
            className="w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 font-sans"
          >
            {/* Header da Sessão */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400"/>
                Sessão Autenticada
              </span>
              <span className="text-[10px] text-slate-400 font-mono">JWT HS256</span>
            </div>

            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {userName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {userEmail}
            </p>

            <hr className="my-3 border-slate-100 dark:border-slate-800" />

            {/* Seletor de Tema */}
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Tema do Sistema:</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {theme === "dark" ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400"/>
                    <span>Escuro</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500"/>
                    <span>Claro</span>
                  </>
                )}
              </button>
            </div>

            <hr className="my-3 border-slate-100 dark:border-slate-800" />

            {/* Botão Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4"/>
              <span>Encerrar Sessão (Logout)</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
