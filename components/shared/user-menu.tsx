"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Sun, Moon, Monitor, ShieldCheck, FlaskConical, KeyRound } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

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
  direction?: "down" | "up" | "auto";
  align?: "left" | "right";
  variant?: "default" | "sidebar" | "compact";
  className?: string;
}

export function UserMenu({
  user: propUser,
  onLogout: propLogout,
  direction = "down",
  align,
  variant = "default",
  className = "",
}: UserMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [userName, setUserName] = useState("Bruno Gonçalves");
  const [userEmail, setUserEmail] = useState("brunolpgbackup@gmail.com");
  const [userRole, setUserRole] = useState("Administrador(a)");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const applyTheme = (mode: "system" | "light" | "dark") => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement("meta");
      metaThemeColor.setAttribute("name", "theme-color");
      document.head.appendChild(metaThemeColor);
    }

    if (mode === "dark") {
      root.classList.add("dark");
      metaThemeColor.setAttribute("content", "#090d16");
    } else if (mode === "light") {
      root.classList.remove("dark");
      metaThemeColor.setAttribute("content", "#f8fafc");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
        metaThemeColor.setAttribute("content", "#090d16");
      } else {
        root.classList.remove("dark");
        metaThemeColor.setAttribute("content", "#f8fafc");
      }
    }
  };

  const handleSelectTheme = (mode: "system" | "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("theme", mode);
    applyTheme(mode);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const stored = localStorage.getItem("theme");
      if (stored === "system" || !stored) {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("theme") as "system" | "light" | "dark") || "system";
    setThemeMode(stored);
    applyTheme(stored);

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
          setSupabaseUser(user);
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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

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
  const providers = supabaseUser?.app_metadata?.providers || (supabaseUser?.app_metadata?.provider ? [supabaseUser.app_metadata.provider] : []);
  const isGoogleOnly = providers.includes("google") && !providers.includes("email");

  const isUp = direction === "up";
  const isLeft = align === "left" || (align === undefined && direction === "up");
  const positionClasses = isUp
    ? `${isLeft ? "left-0" : "right-0"} bottom-full mb-2`
    : `${isLeft ? "left-0" : "right-0"} top-full mt-2`;

  return (
    <>
      <div className={`relative ${variant === "sidebar" ? "w-full" : "inline-block"} ${className}`} ref={containerRef}>
        {/* Variação 1: Sidebar Drawer (Ocupa largura total com card refinado) */}
        {variant === "sidebar" && (
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className="w-full flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-all cursor-pointer shadow-xs text-left group select-none"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-2xs">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="font-bold text-xs text-slate-700 dark:text-slate-200">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[130px]">
                    {displayName}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                </div>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium leading-tight truncate">
                  {userRole}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Variação 2: Compacto (Para Navigation Rail em landscape mobile) */}
        {variant === "compact" && (
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all cursor-pointer relative"
            aria-expanded={isOpen}
            aria-haspopup="true"
            title={`${displayName} (${userRole})`}
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-300 dark:border-slate-600 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="font-bold text-[10px] text-slate-700 dark:text-slate-200">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </button>
        )}

        {/* Variação 3: Padrão (Pill para Header superior em mobile/tablet) */}
        {variant === "default" && (
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2 py-1 pl-1.5 pr-2.5 rounded-full border border-teal-500/40 dark:border-teal-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-900 shadow-2xs"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="font-bold text-xs text-slate-700 dark:text-slate-200">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

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
        )}

        {/* Dropdown Menu Popup (Abre para cima no sidebar e para baixo no header) */}
        {mounted && isOpen && (
          <div
            ref={dropdownRef}
            className={`absolute ${positionClasses} w-80 max-w-[calc(100vw-24px)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/30 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 font-['Plus_Jakarta_Sans',sans-serif] select-none`}
          >
            {/* Header do dropdown: Badge de Status da Sessão */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full border border-emerald-200/70 dark:border-emerald-800/70">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Sessão Autenticada
              </span>
              <span className="px-2 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200/60 dark:border-slate-700/50">
                JWT HS256
              </span>
            </div>

            {/* Informações do Usuário com avatar */}
            <div className="pt-3 pb-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {userEmail}
                </p>
              </div>
            </div>

            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

            {/* Ações Padronizadas com Lucide Icons e hover refinado */}
            <div className="space-y-1 py-0.5">
              {!userRole.toLowerCase().includes("paciente") && (
                <a
                  href="/formulas"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer group"
                  onClick={() => setIsOpen(false)}
                >
                  <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform group-hover:scale-105 shrink-0" />
                  <span className="truncate">Catálogo de Fórmulas</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsPasswordModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer group text-left"
              >
                <KeyRound className="w-4 h-4 text-teal-600 dark:text-teal-400 transition-transform group-hover:scale-105 shrink-0" />
                <span className="truncate">{isGoogleOnly ? "Criar palavra-passe de acesso" : "Alterar palavra-passe"}</span>
              </button>
            </div>

            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

            {/* Seletor de Tema Triplo (Sistema / Claro / Escuro) */}
            <div className="py-1">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Tema do Sistema
                </span>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize">
                  {themeMode === "system" ? "Automático" : themeMode === "light" ? "Claro" : "Escuro"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleSelectTheme("system")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                    themeMode === "system"
                      ? "bg-white shadow-sm dark:bg-slate-700 font-semibold text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                  }`}
                  title="Seguir preferência do sistema operacional"
                >
                  <Monitor className="w-3.5 h-3.5 shrink-0" />
                  <span>Sistema</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTheme("light")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                    themeMode === "light"
                      ? "bg-white shadow-sm dark:bg-slate-700 font-semibold text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                  }`}
                  title="Tema Claro"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTheme("dark")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs transition-all cursor-pointer ${
                    themeMode === "dark"
                      ? "bg-white shadow-sm dark:bg-slate-700 font-semibold text-slate-900 dark:text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                  }`}
                  title="Tema Escuro"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Escuro</span>
                </button>
              </div>
            </div>

            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

            {/* Botão Encerrar Sessão (Logout) */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer group text-left"
            >
              <LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400 transition-transform group-hover:scale-105 shrink-0" />
              <span>Encerrar Sessão (Logout)</span>
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        isGoogleOnly={isGoogleOnly}
      />
    </>
  );
}
