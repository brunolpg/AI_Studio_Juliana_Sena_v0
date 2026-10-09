"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { PatientDashboard } from "@/components/clients/patient-dashboard";
import { loginSchema, registerSchema } from "@/lib/validations/auth-schema";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  Stethoscope,
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  User,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

export default function HomePage() {
  const { user, isLoading, login, register } = useAuth();
  const { toast } = useToast();

  // "entrar" ou "criar"
  const [activeTab, setActiveTab] = useState<"entrar" | "criar">("entrar");

  // Estado Geral de Submissão
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inputs Comuns
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Inputs de Registro
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(false); // para alternar visibilidade
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [role, setRole] = useState<"paciente" | "profissional" | "administrador">("paciente");

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
    } catch (err) {
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

      // Garantir termo exato "Campo obrigatório" para vazios
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
    } catch (err) {
      setErrors({ general: "Falha ao conectar com o servidor. Tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit de Cadastro
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword: confirmPasswordValue,
      role,
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

      // Validar individualmente campos vazios com mensagem padrão requerida
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
      });

      if (!res.success) {
        setErrors({ general: res.message || "Erro ao realizar cadastro. Tente com outro e-mail." });
      }
    } catch (err) {
      setErrors({ general: "Falha na comunicação com o servidor. Tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Tela de Carregamento
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-[20px] bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center animate-pulse">
              <Sparkles className="w-8 h-8 text-[#3B9E8C]" />
            </div>
            <div className="absolute inset-0 rounded-[20px] border-2 border-[#3B9E8C] border-t-transparent animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Carregando portal de saúde...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Dra. Juliana Sena • Gestão Clínica
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Se logado, exibe o Painel de Pacientes
  if (user) {
    return <PatientDashboard />;
  }

  // 3. Se não logado, exibe a Tela de Login (Idêntica à imagem "Tela_Login.png")
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-[440px] space-y-6">
        
        {/* Logotipo e Nomes no Topo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-[56px] h-[56px] rounded-[18px] bg-[#3B9E8C] text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-[28px] h-[28px]" />
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
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-850 p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6">
          
          {/* Abas Superiores */}
          <div className="relative border-b border-slate-100 dark:border-slate-800 flex w-full">
            <button
              type="button"
              onClick={() => {
                setActiveTab("entrar");
                setErrors({});
              }}
              className={`w-1/2 text-center pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "entrar"
                  ? "text-[#3B9E8C] border-[#3B9E8C]"
                  : "text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600"
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
              className={`w-1/2 text-center pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
                activeTab === "criar"
                  ? "text-[#3B9E8C] border-[#3B9E8C]"
                  : "text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600"
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Erro Geral */}
          {errors.general && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
              <div className="flex-1 font-medium">{errors.general}</div>
            </div>
          )}

          {/* Botão Google OAuth */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleOAuth}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-[12px] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>Continuar com Google OAuth</span>
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
              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                    }}
                    placeholder="ex: seu.email@clinica.com"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.email
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
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
              <div className="space-y-1">
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Sua senha secreta"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.password
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md p-1"
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
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#3B9E8C] hover:bg-[#2d8272] disabled:opacity-50 transition-all shadow-md shadow-teal-600/10 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Carregando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4.5 h-4.5" />
                    <span>Entrar / Avançar</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* FORMULÁRIO DE CADASTRO (Criar Conta) */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              
              {/* Nome Completo */}
              <div className="space-y-1">
                <label htmlFor="regName" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="regName"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                    }}
                    placeholder="ex: Dr. Carlos Silva"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.name
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
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
              <div className="space-y-1">
                <label htmlFor="regEmail" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="regEmail"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                    }}
                    placeholder="ex: seu.email@clinica.com"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.email
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
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
              <div className="space-y-1">
                <label htmlFor="regPassword" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="regPassword"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                    }}
                    placeholder="Sua senha secreta (min. 6 dígitos)"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.password
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md p-1"
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
              <div className="space-y-1">
                <label htmlFor="regConfirmPassword" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="regConfirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPasswordValue}
                    onChange={(e) => {
                      setConfirmPasswordValue(e.target.value);
                      if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }));
                    }}
                    placeholder="Confirme sua senha secreta"
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-[#3B9E8C]/20 transition-all ${
                      errors.confirmPassword
                        ? "border-rose-500 bg-rose-50/10 focus:border-rose-500 text-rose-900 dark:text-rose-300"
                        : "border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-[#3B9E8C]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isSubmitting}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md p-1"
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

              {/* Botão Cadastrar */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#3B9E8C] hover:bg-[#2d8272] disabled:opacity-50 transition-all shadow-md shadow-teal-600/10 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Criando Conta...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4.5 h-4.5" />
                    <span>Avançar / Cadastrar</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Consentimento Legal */}
          <p className="text-[11px] leading-normal text-center text-slate-400 dark:text-slate-500 max-w-[290px] mx-auto">
            Ao clicar em &quot;Avançar/Cadastrar&quot;, você aceita nossos{" "}
            <Link
              href="/termos-de-uso"
              className="text-[#3B9E8C] hover:underline font-semibold"
            >
              Termos de Uso
            </Link>{" "}
            e nossa{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-[#3B9E8C] hover:underline font-semibold"
            >
              Política de Privacidade
            </Link>
            .
          </p>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          {/* Rodapé Interno com alternância rápida */}
          <div className="text-center">
            {activeTab === "entrar" ? (
              <p className="text-[11px] text-slate-500">
                Não tem conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("criar");
                    setErrors({});
                  }}
                  className="text-[#3B9E8C] font-semibold hover:underline cursor-pointer"
                >
                  Cadastre-se aqui.
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Já possui uma conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("entrar");
                    setErrors({});
                  }}
                  className="text-[#3B9E8C] font-semibold hover:underline cursor-pointer"
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
    </div>
  );
}
