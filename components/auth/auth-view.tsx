"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { loginSchema, registerSchema } from "@/lib/validations/auth-schema";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  User,
  AlertCircle,
  ShieldAlert,
  MapPin,
} from "lucide-react";
import { BRAZILIAN_STATES, CITIES_BY_STATE } from "@/lib/brazil-data";

interface AuthViewProps {
  initialTab?: "entrar" | "criar";
}

export function AuthView({ initialTab = "entrar" }: AuthViewProps) {
  const { login, register } = useAuth();
  const { toast } = useToast();

  // "entrar" ou "criar"
  const [activeTab, setActiveTab] = useState<"entrar" | "criar">(initialTab);

  // Estado Geral de Submissão
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inputs Comuns
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Inputs de Registro
  const [name, setName] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [role, setRole] = useState<"paciente" | "profissional" | "administrador">("paciente");
  const [estado, setEstado] = useState("BA");
  const [cidade, setCidade] = useState("Salvador");

  const availableCities = CITIES_BY_STATE[estado] || ["Outra"];
  const isPredefinedCity = availableCities.includes(cidade) && cidade !== "Outra";

  const handleEstadoChange = (newEstado: string) => {
    setEstado(newEstado);
    const cities = CITIES_BY_STATE[newEstado] || ["Outra"];
    if (newEstado === "BA") {
      setCidade("Salvador");
    } else {
      setCidade(cities[0] || "Outra");
    }
  };

  // Estados para "Esqueci minha senha"
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Estados para definir nova senha (quando acessa pelo link de recuperação)
  const [isUpdatePasswordModalOpen, setIsUpdatePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Listener para detectar retorno do link de recuperação (PASSWORD_RECOVERY)
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsUpdatePasswordModalOpen(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Função para disparar o e-mail de redefinição
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast({
        type: "error",
        title: "E-mail obrigatório",
        description: "Por favor, digite seu e-mail cadastrado.",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cliente Supabase não inicializado.");

      const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/`;
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo,
      });

      if (error) {
        toast({
          type: "error",
          title: "Erro ao solicitar recuperação",
          description: error.message,
        });
      } else {
        setResetEmailSent(true);
        toast({
          type: "success",
          title: "E-mail enviado!",
          description: "Enviamos as instruções de redefinição para o seu e-mail.",
        });
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro",
        description: err?.message || "Não foi possível enviar o e-mail de recuperação.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  // Função para salvar a nova senha
  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({
        type: "error",
        title: "Senha inválida",
        description: "A nova senha deve ter no mínimo 6 caracteres.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        type: "error",
        title: "Senhas divergentes",
        description: "A confirmação de senha não confere com a nova senha.",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cliente Supabase não inicializado.");

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          type: "error",
          title: "Erro ao atualizar senha",
          description: error.message,
        });
      } else {
        toast({
          type: "success",
          title: "Senha atualizada com sucesso!",
          description: "Sua senha foi redefinida. Você já pode acessar sua conta.",
        });
        setIsUpdatePasswordModalOpen(false);
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro",
        description: err?.message || "Falha ao atualizar a senha.",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Função para Google OAuth
  const handleGoogleOAuth = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          type: "error",
          title: "Erro de Configuração",
          description: "O cliente Supabase não pôde ser iniciado.",
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
          title: "Erro no Google OAuth",
          description: error.message,
        });
      }
    } catch {
      toast({
        type: "error",
        title: "Erro de Conexão",
        description: "Falha ao iniciar autenticação com o Google.",
      });
    }
  };

  // Submit de Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = "Campo obrigatório";
      });

      if (!email.trim()) fieldErrors.email = "Campo obrigatório";
      if (!password.trim()) fieldErrors.password = "Campo obrigatório";

      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({ email, password });
      if (!res.success) {
        setErrors({ general: res.message || "Credenciais inválidas. Verifique seu e-mail e senha." });
      }
    } catch {
      setErrors({ general: "Falha ao conectar com o servidor. Tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit de Cadastro
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const finalCidade = cidade.trim() || (estado === "BA" ? "Salvador" : "Outra");

    const validation = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword: confirmPasswordValue,
      role,
      estado,
      cidade: finalCidade,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (err.message.toLowerCase().includes("obrigat") || !err.message) {
          fieldErrors[field] = "Campo obrigatório";
        } else {
          fieldErrors[field] = err.message;
        }
      });

      if (!name.trim()) fieldErrors.name = "Campo obrigatório";
      if (!email.trim()) fieldErrors.email = "Campo obrigatório";
      if (!password.trim()) fieldErrors.password = "Campo obrigatório";
      if (!confirmPasswordValue.trim()) fieldErrors.confirmPassword = "Campo obrigatório";

      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        name,
        email,
        password,
        confirmPassword: confirmPasswordValue,
        role,
        estado,
        cidade: finalCidade,
      });

      if (!res.success) {
        setErrors({ general: res.message || "Erro ao realizar cadastro. Tente com outro e-mail." });
      }
    } catch {
      setErrors({ general: "Falha na comunicação com o servidor. Tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 select-none transition-colors duration-200">
      <div className="w-full max-w-[440px] space-y-6">
        
        {/* Logotipo e Nomes no Topo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-700/20 transition-transform hover:scale-105">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Dra. Juliana Sena
            </h1>
            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Gestão Clínica & Prontuários Inteligentes
            </p>
          </div>
        </div>

        {/* Card Principal */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/20 space-y-6">
          
          {/* Seletor Superior Segmentado (Material Design 4 Pill Switch) */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-full border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab("entrar");
                setErrors({});
              }}
              className={`w-full py-2.5 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === "entrar"
                  ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm border border-slate-200/50 dark:border-slate-600/50 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("criar");
                setErrors({});
              }}
              className={`w-full py-2.5 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === "criar"
                  ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-sm border border-slate-200/50 dark:border-slate-600/50 font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Erro Geral */}
          {errors.general && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-2xl text-xs border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div className="flex-1 font-medium">{errors.general}</div>
            </div>
          )}

          {/* Botão Google OAuth */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleOAuth}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-xs active:scale-[0.99] group"
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

            {/* Separador "OU COM E-MAIL" */}
            <div className="relative flex items-center py-2">
              <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
              <span className="px-3.5 text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-widest">
                OU COM E-MAIL
              </span>
              <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
            </div>
          </div>

          {/* Formulário Dinâmico */}
          {activeTab === "entrar" ? (
            /* FORMULÁRIO DE LOGIN (Entrar) */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              
              {/* E-mail */}
              <div className="space-y-1.5">
                <label htmlFor="auth-email-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                    }}
                    placeholder="ex: seu.email@clinica.com"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border transition-all ${
                      errors.email
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setResetEmailSent(false);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline transition-colors cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Sua senha secreta"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-11 py-3 text-xs rounded-2xl border transition-all ${
                      errors.password
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Botão Entrar / Avançar */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 transition-all shadow-md shadow-teal-700/20 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Carregando...</span>
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
            /* FORMULÁRIO DE CADASTRO (Criar Conta) */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              {/* Nome Completo */}
              <div className="space-y-1.5">
                <label htmlFor="auth-reg-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                    }}
                    placeholder="ex: Dr. Carlos Silva"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border transition-all ${
                      errors.name
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.name}</span>
                  </p>
                )}
              </div>

              {/* E-mail */}
              <div className="space-y-1.5">
                <label htmlFor="auth-reg-email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                    }}
                    placeholder="ex: seu.email@clinica.com"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-4 py-3 text-xs rounded-2xl border transition-all ${
                      errors.email
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label htmlFor="auth-reg-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reg-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Sua senha secreta (min. 6 dígitos)"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-11 py-3 text-xs rounded-2xl border transition-all ${
                      errors.password
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-1.5">
                <label htmlFor="auth-reg-confirm-password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPasswordValue}
                    onChange={(e) => {
                      setConfirmPasswordValue(e.target.value);
                      if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }));
                    }}
                    placeholder="Confirme sua senha secreta"
                    disabled={isSubmitting}
                    className={`w-full pl-11 pr-11 py-3 text-xs rounded-2xl border transition-all ${
                      errors.confirmPassword
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg p-1.5 cursor-pointer transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errors.confirmPassword}</span>
                  </p>
                )}
              </div>

              {/* Estado (UF) e Cidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Estado */}
                <div className="space-y-1.5">
                  <label htmlFor="auth-reg-estado" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Estado (UF) *
                  </label>
                  <select
                    id="auth-reg-estado"
                    value={estado}
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
                  <label htmlFor="auth-reg-cidade" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cidade (Associada à seleção da UF) *
                  </label>
                  <select
                    id="auth-reg-cidade"
                    value={isPredefinedCity ? cidade : "Outra"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "Outra") {
                        setCidade("");
                      } else {
                        setCidade(val);
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
                    {!isPredefinedCity && Boolean(cidade && cidade !== "Outra") && (
                      <option value="Outra">{cidade} (Personalizada)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Campo de digitação manual quando 'Outra' ou personalizada */}
              {(!isPredefinedCity || cidade === "Outra") && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label htmlFor="auth-reg-custom-cidade" className="block text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    Nome da sua cidade *
                  </label>
                  <input
                    id="auth-reg-custom-cidade"
                    type="text"
                    required
                    placeholder="Digite o nome da sua cidade"
                    value={cidade === "Outra" ? "" : cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-teal-500/50 bg-teal-50/20 dark:bg-teal-950/20 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Insira o nome do seu município caso não conste na lista acima.
                  </span>
                </div>
              )}

              {/* Botão Cadastrar */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-5 rounded-full text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 transition-all shadow-md shadow-teal-700/20 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Criando Conta...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Avançar / Cadastrar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Consentimento Legal */}
          <p className="text-[11px] leading-relaxed text-center text-slate-400 dark:text-slate-500 max-w-[320px] mx-auto">
            Ao clicar em &quot;Avançar/Cadastrar&quot;, você aceita nossos{" "}
            <Link
              href="/termos-de-uso"
              className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold hover:underline"
            >
              Termos de Uso
            </Link>{" "}
            e nossa{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </p>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Rodapé Interno com alternância rápida */}
          <div className="text-center">
            {activeTab === "entrar" ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("criar");
                    setErrors({});
                  }}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold hover:underline cursor-pointer"
                >
                  Cadastre-se aqui.
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Já possui uma conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("entrar");
                    setErrors({});
                  }}
                  className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-semibold hover:underline cursor-pointer"
                >
                  Entre aqui.
                </button>
              </p>
            )}
          </div>

        </div>

        {/* Rodapé Seguro */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide">
          Dra. Juliana Sena • Sistema em conformidade com a LGPD e RLS do PostgreSQL.
        </p>
      </div>

      {/* Modal: Solicitar Recuperação de Senha */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Lock className="w-4 h-4"/>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Recuperação de Senha
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {resetEmailSent ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6"/>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Verifique seu e-mail
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                  Enviamos um link de redefinição de senha para <strong>{forgotEmail}</strong>. Verifique sua caixa de entrada e pasta de spam.
                </p>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-full mt-4 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-full text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-teal-700/20 active:scale-[0.99]"
                >
                  Entendido / Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 pt-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Informe o e-mail cadastrado em sua conta para receber um link seguro de recuperação de senha.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"/>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="seu.email@provedor.com"
                      className="w-full pl-11 pr-4 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingReset}
                    className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-full shadow-sm shadow-teal-700/20 transition-all cursor-pointer active:scale-[0.99]"
                  >
                    {isSendingReset ? "Enviando link..." : "Enviar link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Definir Nova Senha (Acionado ao retornar do link do e-mail) */}
      {isUpdatePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Lock className="w-4 h-4"/>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Definir Nova Senha
              </h3>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4 pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Digite e confirme sua nova senha de acesso à conta.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"/>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"/>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 text-xs rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 dark:focus:border-teal-400 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full mt-2 py-3 px-4 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-full shadow-md shadow-teal-700/20 transition-all cursor-pointer active:scale-[0.99]"
              >
                {isUpdatingPassword ? "Salvando nova senha..." : "Salvar Nova Senha"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
