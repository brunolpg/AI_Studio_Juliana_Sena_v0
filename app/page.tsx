"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-context";
import { PatientDashboard } from "@/components/clients/patient-dashboard";
import { loginSchema } from "@/lib/validations/auth-schema";
import { Stethoscope, Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldAlert } from "lucide-react";

export default function HomePage() {
  const { user, isLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validação local com Zod
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      
      validation.error.errors.forEach((err) => {
        const field = err.path[0] as "email" | "password";
        if (err.message.toLowerCase().includes("obrigat") || !err.message) {
          fieldErrors[field] = "Campo obrigatório";
        } else {
          fieldErrors[field] = err.message;
        }
      });

      // Garantir termos exatos "Campo obrigatório" para campos vazios
      if (!email.trim()) {
        fieldErrors.email = "Campo obrigatório";
      }
      if (!password.trim()) {
        fieldErrors.password = "Campo obrigatório";
      }

      setErrors(fieldErrors);
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await login({ email, password });
      if (!res.success) {
        setErrors({ general: res.message || "Credenciais inválidas. Verifique seu e-mail e senha." });
      }
    } catch (err) {
      setErrors({ general: "Falha ao conectar com o servidor. Tente novamente." });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 1. Tela de Carregamento
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center animate-pulse">
              <Stethoscope className="w-8 h-8 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
              Carregando portal de saúde...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Dra. Juliana S. • Gestão de Pacientes
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

  // 3. Se não logado, exibe a Tela de Login (Inspirada em sistemas de saúde)
  return (
    <div className="min-h-screen bg-linear-to-tr from-slate-100 via-slate-50 to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 select-none">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo e Nome do Consultório */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 ring-4 ring-teal-50 dark:ring-teal-950/50">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
              Dra. Juliana Sena
            </h1>
            <p className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-400 mt-1.5 uppercase tracking-wider">
              Gestão de Pacientes & Prontuários
            </p>
          </div>
        </div>

        {/* Card do Formulário */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-850 p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
              Acesso Restrito ao Sistema
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Entre com suas credenciais de acesso clínico autorizadas.
            </p>
          </div>

          {/* Erro Geral (Credenciais Inválidas, Supabase Offline, etc.) */}
          {errors.general && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl text-xs border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 font-medium">{errors.general}</div>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo E-mail */}
            <div className="space-y-1">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                E-mail Profissional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="seu.email@julianasena.com.br"
                  disabled={isLoggingIn}
                  className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 transition-all ${
                    errors.email
                      ? "border-rose-500 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-teal-500"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* Campo Senha */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha de Acesso
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Sua senha secreta"
                  disabled={isLoggingIn}
                  className={`w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 transition-all ${
                    errors.password
                      ? "border-rose-500 bg-rose-50/20 text-rose-900 focus:border-rose-500"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-teal-500"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoggingIn}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-hidden rounded-md p-1 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-md shadow-teal-600/25 active:scale-[0.98] cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          {/* Aviso Legal de consentimento de LGPD */}
          <p className="text-[11px] leading-relaxed text-center text-slate-400 dark:text-slate-500 max-w-[280px] mx-auto">
            Ao clicar em &apos;Entrar&apos;, você aceita nossos{" "}
            <Link href="/termos-de-uso" className="text-teal-600 dark:text-teal-400 hover:underline font-semibold">
              Termos de Uso
            </Link>{" "}
            e{" "}
            <Link href="/politica-de-privacidade" className="text-teal-600 dark:text-teal-400 hover:underline font-semibold">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>

        {/* Rodapé Seguro */}
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          Dra. Juliana Sena • Sistema em conformidade com a LGPD e RLS do PostgreSQL.
        </p>
      </div>
    </div>
  );
}
