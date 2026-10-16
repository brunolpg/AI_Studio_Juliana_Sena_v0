"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LogOut, Sun, Moon, ShieldCheck, FlaskConical } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

function getFirstAndLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

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
        if (r === "admin" || r === "administrador" || r === "administrador(a)") {
          setUserRole("Administrador(a)");
        } else if (r === "paciente") {
          setUserRole("Paciente");
        } else {
          setUserRole(propUser.role);
        }
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
          if ((meta?.avatar_url || meta?.picture) && !propUser?.avatar_url && !propUser?.foto_perfil) {
            setAvatarUrl(meta.avatar_url || meta.picture);
          }
          if (meta?.role && !propUser?.role && !propUser?.roleLabel) {
            const r = String(meta.role).toLowerCase();
            if (r === "admin" || r === "administrador" || r === "administrador(a)") {
              setUserRole("Administrador(a)");
            } else if (r === "paciente") {
              setUserRole("Paciente");
            } else {
              setUserRole(meta.role);
            }
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

  const displayName = getFirstAndLastName(userName);

  return (
    <div className="relative inline-block">
      {/* Botão Pill Completo visível em Mobile e Desktop */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 py-1 pl-1.5 pr-2.5 rounded-full border border-teal-500/40 dark:border-teal-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-2xs"
        aria-expanded={isOpen}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Nome/Sobrenome + Indicador Verde + Tipo do Perfil sempre visíveis */}
        <div className="flex flex-col text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[115px] sm:max-w-[140px] truncate leading-tight">
              {displayName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium leading-tight truncate">
            {userRole}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

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

            {!userRole.toLowerCase().includes("paciente") && (
              <>
                <a
                  href="/formulas"
                  className="w-full flex items-center gap-2 px-2.5 py-2 mb-2 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl transition-colors cursor-pointer"
                  onClick={() => setIsOpen(false)}
                >
                  <FlaskConical className="w-4 h-4"/>
                  <span>Catálogo de Fórmulas</span>
                </a>
                <hr className="my-3 border-slate-100 dark:border-slate-800" />
              </>
            )}

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
