"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Shield,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { BRAZILIAN_STATES, CITIES_BY_STATE } from "@/lib/brazil-data";

interface AuthModalContentProps {
  initialTab: "login" | "register";
  onClose: () => void;
}

function AuthModalContent({ initialTab, onClose }: AuthModalContentProps) {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Campos de Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Campos de Registro
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regRole, setRegRole] = useState<"paciente" | "profissional" | "administrador">("paciente");
  const [regEstado, setRegEstado] = useState("BA");
  const [regCidade, setRegCidade] = useState("Salvador");

  const availableCities = CITIES_BY_STATE[regEstado] || ["Outra"];
  const isPredefinedCity = availableCities.includes(regCidade) && regCidade !== "Outra";

  const handleEstadoChange = (newEstado: string) => {
    setRegEstado(newEstado);
    const cities = CITIES_BY_STATE[newEstado] || ["Outra"];
    if (newEstado === "BA") {
      setRegCidade("Salvador");
    } else {
      setRegCidade(cities[0] || "Outra");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    const res = await login({
      email: loginEmail,
      password: loginPassword,
    });
    setIsSubmitting(false);
    if (!res.success && res.errors) {
      setFormErrors(res.errors);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    const finalCidade = regCidade.trim() || (regEstado === "BA" ? "Salvador" : "Outra");
    const res = await register({
      name: regName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      role: regRole,
      estado: regEstado,
      cidade: finalCidade,
    });
    setIsSubmitting(false);
    if (!res.success && res.errors) {
      setFormErrors(res.errors);
    }
  };

  const handleGoogleOAuth = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          type: "error",
          title: "Erro",
          description: "Sistema de conexão não disponível.",
        });
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (error) {
        toast({
          type: "error",
          title: "Erro de Conexão",
          description: error.message,
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Erro",
        description: "Falha ao iniciar acesso com o Google.",
      });
    }
  };

  return (
    <div
      className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Banner Topo */}
      <div className="relative bg-gradient-to-r from-teal-900 via-slate-900 to-slate-900 text-white p-6 pb-5">
        <button
          id="close-auth-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <span>Identificação</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {activeTab === "login" ? "Acesso ao Consultório" : "Criar Nova Conta"}
            </h3>
          </div>
        </div>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {activeTab === "login"
            ? "Identifique-se com sua conta cadastrada para acessar os seus dados."
            : "Preencha os campos abaixo para criar sua conta de acesso."}
        </p>
      </div>

      {/* Abas Alternadoras (Pill Switch MD4) */}
      <div className="p-3 bg-slate-50/70 dark:bg-slate-850 border-b border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-full border border-slate-200/60 dark:border-slate-700/60">
          <button
            id="tab-auth-login"
            type="button"
            onClick={() => {
              setActiveTab("login");
              setFormErrors({});
            }}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === "login"
                ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm border border-slate-200/50 dark:border-slate-600/50"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Entrar</span>
          </button>
          <button
            id="tab-auth-register"
            type="button"
            onClick={() => {
              setActiveTab("register");
              setFormErrors({});
            }}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeTab === "register"
                ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm border border-slate-200/50 dark:border-slate-600/50"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-h-[80vh] overflow-y-auto">
        {/* Botão de Google OAuth */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleOAuth}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-xs active:scale-[0.99] group cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.2v3.15C3.17 21.36 7.24 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.25c-.25-.72-.38-1.5-.38-2.25s.13-1.53.38-2.25V6.6H1.2C.44 8.13 0 9.87 0 12s.44 3.87 1.2 5.4l4.08-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.24 0 3.17 2.64 1.2 6.6l4.08 3.15c.95-2.84 3.6-4.95 6.72-4.95z"
              />
            </svg>
            <span>Continuar com Google</span>
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400">ou com e-mail</span>
            </div>
          </div>
        </div>

        {activeTab === "login" ? (
          /* Formulário de Login */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {formErrors.geral && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl text-xs border border-rose-200 dark:border-rose-900">
                {formErrors.geral.join(" ")}
              </div>
            )}

            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ex: seu.email@provedor.com"
                  className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border ${
                    formErrors.email
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.email.join(", ")}</p>
              )}
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Sua senha"
                  className={`w-full pl-11 pr-11 py-3 text-xs rounded-2xl border ${
                    formErrors.password
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.password.join(", ")}</p>
              )}
            </div>

            {/* Botão de Entrar */}
            <button
              id="submit-login-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 transition-all shadow-md shadow-teal-700/20 active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Acessando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar / Avançar</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Formulário de Registro */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {formErrors.geral && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl text-xs border border-rose-200 dark:border-rose-900">
                {formErrors.geral.join(" ")}
              </div>
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-name-input"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Seu nome"
                  className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border ${
                    formErrors.name
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                />
              </div>
              {formErrors.name && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.name.join(", ")}</p>
              )}
            </div>

            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-email-input"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ex: seu.email@provedor.com"
                  className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border ${
                    formErrors.email
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                  } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.email.join(", ")}</p>
              )}
            </div>

            {/* Perfil / Função (3 Perfis) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Perfil de Acesso
              </label>
              <select
                id="register-role-select"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as "paciente" | "profissional" | "administrador")}
                className="w-full px-4 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all cursor-pointer"
              >
                <option value="paciente">Paciente</option>
                <option value="profissional">Profissional / Especialista</option>
                <option value="administrador">Administrador(a)</option>
              </select>
            </div>

            {/* Senha e Confirmação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha (mín. 6 dígitos)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-11 pr-10 py-3 text-xs rounded-2xl border ${
                      formErrors.password
                        ? "border-rose-500 bg-rose-50/30"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.password.join(", ")}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-11 pr-10 py-3 text-xs rounded-2xl border ${
                      formErrors.confirmPassword
                        ? "border-rose-500 bg-rose-50/30"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60"
                    } text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {formErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-500 mt-1">{formErrors.confirmPassword.join(", ")}</p>
                )}
              </div>
            </div>

            {/* Estado (UF) e Cidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Estado */}
              <div className="space-y-1.5">
                <label htmlFor="modal-reg-estado" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Estado (UF) *
                </label>
                <select
                  id="modal-reg-estado"
                  value={regEstado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 cursor-pointer"
                >
                  {BRAZILIAN_STATES.map((st) => (
                    <option key={st.uf} value={st.uf}>
                      {st.uf} — {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cidade */}
              <div className="space-y-1.5">
                <label htmlFor="modal-reg-cidade" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Cidade (Associada à seleção da UF) *
                </label>
                <select
                  id="modal-reg-cidade"
                  value={isPredefinedCity ? regCidade : "Outra"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Outra") {
                      setRegCidade("");
                    } else {
                      setRegCidade(val);
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 cursor-pointer"
                >
                  {availableCities.map((cityName) => (
                    <option key={cityName} value={cityName}>
                      {cityName === "Outra" ? "Outra (especificar cidade)" : cityName}
                    </option>
                  ))}
                  {!isPredefinedCity && Boolean(regCidade && regCidade !== "Outra") && (
                    <option value="Outra">{regCidade} (Personalizada)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Campo de digitação manual quando 'Outra' ou personalizada */}
            {(!isPredefinedCity || regCidade === "Outra") && (
              <div className="space-y-1.5 animate-fadeIn">
                <label htmlFor="modal-reg-custom-cidade" className="block text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                  Nome da sua cidade *
                </label>
                <input
                  id="modal-reg-custom-cidade"
                  type="text"
                  required
                  placeholder="Digite o nome da sua cidade"
                  value={regCidade === "Outra" ? "" : regCidade}
                  onChange={(e) => setRegCidade(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-teal-500/50 bg-teal-50/20 dark:bg-teal-950/20 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                />
                <span className="text-[10px] text-slate-400 block">
                  Insira o nome do seu município caso não conste na lista acima.
                </span>
              </div>
            )}

            {/* Botão de Registro */}
            <button
              id="submit-register-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 transition-all shadow-md shadow-teal-700/20 active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Cadastrando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Avançar / Cadastrar</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Rodapé */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>Acesso Protegido</span>
          </span>
          <span>Juliana Sena • Consultório</span>
        </div>
      </div>
    </div>
  );
}

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalMode } = useAuth();
  if (!isAuthModalOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <AuthModalContent
        key={authModalMode}
        initialTab={authModalMode}
        onClose={closeAuthModal}
      />
    </div>
  );
}
