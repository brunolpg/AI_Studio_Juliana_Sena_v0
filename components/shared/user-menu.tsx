"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Sun, Moon, Monitor, ShieldCheck, FlaskConical, KeyRound } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { useAuth } from "@/components/auth/auth-context";

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
    profile?: {
      id?: string;
      nome?: string;
      role?: string;
      avatar_url?: string;
    } | null;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{ id?: string; nome?: string; role?: string; avatar_url?: string } | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Contexto de autenticação global do sistema
  let authContext: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuth();
  } catch {
    authContext = null;
  }

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
      if (propUser.profile) {
        setProfileData(propUser.profile);
      } else if (propUser.role) {
        setProfileData({ role: propUser.role });
      }
      if (propUser.avatar_url || propUser.foto_perfil || propUser.avatar) {
        setAvatarUrl(propUser.avatar_url || propUser.foto_perfil || propUser.avatar || null);
      }
    }

    async function loadUserData() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setSupabaseUser(authUser);
          if (authUser.email && !propUser?.email) setUserEmail(authUser.email);
          const meta = authUser.user_metadata;
          if ((meta?.nome || meta?.full_name) && !propUser?.nome && !propUser?.name) {
            setUserName(meta.nome || meta.full_name);
          }
          if ((meta?.avatar_url || meta?.picture) && !propUser?.avatar_url && !propUser?.foto_perfil) {
            setAvatarUrl(meta.avatar_url || meta.picture);
          }

          // Busca perfil dinâmico diretamente de public.profiles
          const { data: pData } = await supabase
            .from("profiles")
            .select("id, nome, role, avatar_url")
            .eq("id", authUser.id)
            .maybeSingle();

          if (pData) {
            setProfileData(pData);
            if (pData.nome && !propUser?.nome && !propUser?.name) {
              setUserName(pData.nome);
            }
            if (pData.avatar_url && !propUser?.avatar_url && !propUser?.foto_perfil) {
              setAvatarUrl(pData.avatar_url);
            }
          } else {
            const isEmailAdmin =
              authUser.email?.toLowerCase() === "brunolpg@gmail.com" ||
              authUser.email?.toLowerCase().includes("admin");
            if (isEmailAdmin) {
              setProfileData({
                id: authUser.id,
                nome: meta?.nome || meta?.full_name || "Bruno Gonçalves",
                role: "admin",
                avatar_url: meta?.avatar_url || meta?.picture || null,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar dados do usuário:", e);
      }
    }
    loadUserData();

    const supabase = getSupabaseClient();
    let authSub: any = null;
    if (supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange(async (event) => {
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
            await loadUserData();
          }
        });
        authSub = data?.subscription;
      } catch (authErr) {
        console.warn("Aviso ao registrar listener de autenticação no UserMenu:", authErr);
      }
    }

    return () => {
      try {
        authSub?.unsubscribe();
      } catch {}
    };
  }, [propUser]);

  // Sincronização em tempo real do perfil do usuário via Supabase Realtime
  useEffect(() => {
    const activeUserId =
      propUser?.id ||
      (propUser as any)?.user_id ||
      supabaseUser?.id ||
      authContext?.user?.id;

    if (!activeUserId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    let channel: any = null;

    try {
      // 1. Criação do canal com listener definido estritamente ANTES do subscribe
      // Inclui identificador único para prevenir colisão entre múltiplas instâncias no DOM (Sidebar, Rail, Header)
      const channelId = `user-menu-profile-sync-${activeUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      channel = supabase
        .channel(channelId)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${activeUserId}`,
          },
          (payload: any) => {
            // Atualiza o estado local do perfil
            if (payload?.new) {
              setProfileData((prev: any) => ({ ...prev, ...payload.new }));
              if (payload.new.nome && !propUser?.nome && !propUser?.name) {
                setUserName(payload.new.nome);
              }
              if (payload.new.avatar_url && !propUser?.avatar_url && !propUser?.foto_perfil) {
                setAvatarUrl(payload.new.avatar_url);
              }
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "CHANNEL_ERROR") {
            console.warn(`Aviso no canal Realtime ${channelId} (recuperação automática).`);
          }
        });
    } catch (err) {
      // 2. Prevenção de falhas críticas (Tratamento com Fallback): erros no Realtime nunca quebram o componente
      console.warn("Aviso ao conectar canal Realtime no UserMenu (resiliente):", err);
    }

    // 2. Cleanup essencial para desmontagem ou re-render
    return () => {
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch (cleanupErr) {
          console.warn("Aviso ao remover canal Realtime no UserMenu:", cleanupErr);
        }
      }
    };
  }, [propUser?.id, (propUser as any)?.user_id, supabaseUser?.id, authContext?.user?.id]);

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


  // Objeto unificado do usuário
  const user = {
    nome: propUser?.nome || propUser?.name || profileData?.nome || authContext?.user?.name || userName,
    email: propUser?.email || profileData?.email || authContext?.user?.email || userEmail,
  };

  const displayName = getFirstAndLastName(user.nome);

  // Perfil dinâmico sincronizado com public.profiles
  const activeProfileData = profileData || propUser?.profile || authContext?.user?.profile || null;
  const rawRoleStr = String(activeProfileData?.role || propUser?.role || authContext?.user?.role || "").toLowerCase().trim();

  const isEmailAdmin =
    (user.email && user.email.toLowerCase() === "brunolpg@gmail.com") ||
    (user.email && user.email.toLowerCase().includes("admin"));

  const isAdminOrProf =
    rawRoleStr === "admin" ||
    rawRoleStr === "administrador" ||
    rawRoleStr === "profissional" ||
    isEmailAdmin;

  const profile = {
    ...activeProfileData,
    role: rawRoleStr === "profissional"
      ? "profissional"
      : (rawRoleStr === "admin" || rawRoleStr === "administrador" || isEmailAdmin)
      ? "admin"
      : "paciente",
  };

  // Rótulo dinâmico para o botão recolhido (Rodapé da Sidebar, Rail e Header):
  // Se role === 'profissional' ou role === 'admin': Exiba Administrador(a) ou Profissional.
  // Evite rótulos estáticos de fallback ("Paciente") quando o usuário autenticado for um administrador/profissional.
  const userRole = profile.role === "profissional"
    ? "Profissional"
    : profile.role === "admin"
    ? "Administrador(a)"
    : "Paciente";

  const resolvedAvatar =
    propUser?.avatar_url ||
    propUser?.foto_perfil ||
    propUser?.avatar ||
    profileData?.avatar_url ||
    authContext?.user?.avatar ||
    avatarUrl;

  const providers = supabaseUser?.app_metadata?.providers || (supabaseUser?.app_metadata?.provider ? [supabaseUser.app_metadata.provider] : []);
  const isGoogleOnly = providers.includes("google") && !providers.includes("email");

  const isCompact = variant === "compact";
  const isSidebar = variant === "sidebar";

  let positionClasses = "";
  if (isCompact) {
    // Projeção lateral à direita do avatar e acima da base (modo rail / mobile landscape)
    positionClasses = "absolute left-full ml-3 bottom-2 z-[60]";
  } else if (direction === "up") {
    const isLeft = align === "left" || (align === undefined && direction === "up");
    positionClasses = `absolute ${isLeft ? "left-0" : "right-0"} bottom-full mb-2 z-50`;
  } else {
    const isRight = align === "right" || align === undefined;
    positionClasses = `absolute ${isRight ? "right-0" : "left-0"} top-full mt-2 z-50`;
  }

  return (
    <>
      <div className={`relative ${isSidebar ? "w-full" : "inline-block"} ${className}`} ref={containerRef}>
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
                {resolvedAvatar ? (
                  <img src={resolvedAvatar} alt={displayName} className="w-full h-full object-cover" />
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
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt={displayName} className="w-full h-full object-cover" />
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
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt={displayName} className="w-full h-full object-cover" />
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

        {/* Dropdown Menu Popup (Lateral no rail, para cima no drawer e para baixo no header) */}
        {mounted && isOpen && (
          <div
            ref={dropdownRef}
            className={`${positionClasses} w-72 sm:w-80 min-w-[280px] max-w-[calc(100vw-80px)] max-h-[85vh] overflow-y-auto overscroll-contain bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 font-['Plus_Jakarta_Sans',sans-serif] select-none`}
          >
            {/* Header do dropdown: Badge de Status da Sessão */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full border border-emerald-200/70 dark:border-emerald-800/70">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Sessão Autenticada
              </span>
              <span className="px-2 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200/60 dark:border-slate-700/50 shrink-0">
                JWT HS256
              </span>
            </div>

            {/* Detalhamento no Menu Dropdown Aberto com Identificação Visual do Perfil */}
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                  {resolvedAvatar ? (
                    <img src={resolvedAvatar} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.nome}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-full px-2 py-0.5 capitalize">
                    {profile?.role === 'profissional' || profile?.role === 'admin'
                      ? 'Administrador(a)'
                      : 'Paciente'}
                  </span>
                </div>
              </div>
            </div>

            <div className="my-2 border-t border-slate-100 dark:border-slate-800 shrink-0" />

            {/* Ações Padronizadas com Lucide Icons e hover refinado */}
            <div className="space-y-1 py-0.5 shrink-0">
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

            <div className="my-2 border-t border-slate-100 dark:border-slate-800 shrink-0" />

            {/* Seletor de Tema Triplo (Sistema / Claro / Escuro) */}
            <div className="py-1 shrink-0">
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

            <div className="my-2 border-t border-slate-100 dark:border-slate-800 shrink-0" />

            {/* Botão Encerrar Sessão (Logout) */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer group text-left shrink-0"
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
