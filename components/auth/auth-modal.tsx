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
  KeyRound,
  Sparkles,
  Shield,
} from "lucide-react";
import { useAuth } from "./auth-context";

interface AuthModalContentProps {
  initialTab: "login" | "register";
  onClose: () => void;
}

function AuthModalContent({ initialTab, onClose }: AuthModalContentProps) {
  const { login, register } = useAuth();
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
  const [regRole, setRegRole] = useState<"medico" | "recepcionista" | "admin">("medico");

  const handleQuickLogin = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setFormErrors({});
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

    const res = await register({
      name: regName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      role: regRole,
    });

    setIsSubmitting(false);
    if (!res.success && res.errors) {
      setFormErrors(res.errors);
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
              <KeyRound className="w-3 h-3" />
              <span>JWT Session Authentication</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {activeTab === "login" ? "Acesso ao Sistema Clínico" : "Cadastrar Novo Usuário"}
            </h3>
          </div>
        </div>

        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {activeTab === "login"
            ? "Autentique-se para obter o token de sessão e gerenciar os dados dos pacientes."
            : "Crie uma nova conta com perfil profissional para realizar operações de cadastro e edição."}
        </p>
      </div>

      {/* Abas Alternadoras */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 p-1.5 gap-1.5">
        <button
          id="tab-auth-login"
          type="button"
          onClick={() => {
            setActiveTab("login");
            setFormErrors({});
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === "login"
              ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Entrar com Conta</span>
        </button>

        <button
          id="tab-auth-register"
          type="button"
          onClick={() => {
            setActiveTab("register");
            setFormErrors({});
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === "register"
              ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-xs border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Criar Nova Conta</span>
        </button>
      </div>

      <div className="p-6 max-h-[80vh] overflow-y-auto">
        {activeTab === "login" ? (
          /* Formulário de Login */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Botões de Preenchimento Rápido (Demonstração / Testes) */}
            <div className="p-3 bg-teal-50/60 dark:bg-teal-950/30 rounded-2xl border border-teal-200/60 dark:border-teal-800/60 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-teal-900 dark:text-teal-200 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Acesso Rápido de Teste (1 clique)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("juliana.sena@clinica.com", "Clinica@2025")}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:border-teal-400 border border-slate-200 dark:border-slate-700 transition-all text-[11px]"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                    👩‍⚕️ Dra. Juliana Sena
                  </span>
                  <span className="text-slate-500 text-[10px] block truncate">
                    juliana.sena@clinica.com
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("admin@clinica.com", "Admin@1234")}
                  className="text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:border-teal-400 border border-slate-200 dark:border-slate-700 transition-all text-[11px]"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                    👨‍💼 Bruno Gonçalves
                  </span>
                  <span className="text-slate-500 text-[10px] block truncate">
                    admin@clinica.com
                  </span>
                </button>
              </div>
            </div>

            {/* Erro Geral */}
            {formErrors.geral && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs border border-rose-200 dark:border-rose-900">
                {formErrors.geral.join(" ")}
              </div>
            )}

            {/* Campo E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ex: seu.email@clinica.com"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                    formErrors.email
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.email.join(", ")}</p>
              )}
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Sua senha secreta"
                  className={`w-full pl-9 pr-10 py-2 text-xs rounded-xl border ${
                    formErrors.password
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Validando JWT e Sessão...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Formulário de Registro */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-name-input"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="ex: Dr. Carlos Eduardo"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                    formErrors.name
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                />
              </div>
              {formErrors.name && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.name.join(", ")}</p>
              )}
            </div>

            {/* E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-mail Profissional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="register-email-input"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="ex: carlos@clinica.com"
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border ${
                    formErrors.email
                      ? "border-rose-500 bg-rose-50/30"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                />
              </div>
              {formErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1">{formErrors.email.join(", ")}</p>
              )}
            </div>

            {/* Perfil / Função */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Perfil de Acesso
              </label>
              <select
                id="register-role-select"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as "medico" | "recepcionista" | "admin")}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="medico">Médico(a) / Especialista</option>
                <option value="recepcionista">Recepção / Atendimento</option>
                <option value="admin">Administrador(a) Geral</option>
              </select>
            </div>

            {/* Senha e Confirmação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Senha (mínimo 6 dígitos)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-9 py-2 text-xs rounded-xl border ${
                      formErrors.password
                        ? "border-rose-500 bg-rose-50/30"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {formErrors.password && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    {formErrors.password.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="register-confirm-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full pl-9 pr-9 py-2 text-xs rounded-xl border ${
                      formErrors.confirmPassword
                        ? "border-rose-500 bg-rose-50/30"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    } text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {formErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    {formErrors.confirmPassword.join(", ")}
                  </p>
                )}
              </div>
            </div>

            {/* Botão de Registro */}
            <button
              id="submit-register-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Criptografando senha com Bcrypt...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Criar Conta e Iniciar Sessão</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Rodapé de Segurança e Conformidade */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span>JWT HS256 + Cookie HttpOnly</span>
          </span>
          <span>Bcrypt Salt 10 Rounds</span>
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
