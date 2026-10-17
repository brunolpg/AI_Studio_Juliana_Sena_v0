"use client";

import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2, X, AlertTriangle, Loader2 } from "lucide-react";
import { changePasswordAction } from "@/app/actions/password";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGoogleOnly?: boolean;
}

export function ChangePasswordModal({ isOpen, onClose, isGoogleOnly = false }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Critérios de validação em tempo real
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[\!@#\$%\^&\*\(\)_\+\-\=\[\]\{\}\|;\:,.<>\?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isFormValid) {
      setErrorMessage("Por favor, preencha todos os requisitos de segurança da palavra-passe e confirme corretamente.");
      return;
    }

    setLoading(true);
    try {
      const res = await changePasswordAction(newPassword);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(
          isGoogleOnly
            ? "Palavra-passe de acesso criada com sucesso! Agora pode aceder também por e-mail e palavra-passe."
            : "Palavra-passe alterada com sucesso!"
        );
        setTimeout(() => {
          onClose();
          setNewPassword("");
          setConfirmPassword("");
          setSuccessMessage(null);
        }, 2000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao comunicar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-md bg-white dark:bg-[#0c1626] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-slate-800 dark:text-slate-100 overflow-hidden">
        
        {/* Botão de Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho do Modal */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/10 dark:bg-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {isGoogleOnly ? "Criar Palavra-passe de Acesso" : "Alterar Palavra-passe"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isGoogleOnly
                ? "Sua conta é vinculada ao Google. Definir uma palavra-passe permite o acesso alternativo."
                : "Proteja a sua conta definindo uma nova palavra-passe forte."}
            </p>
          </div>
        </div>

        {/* Alerta Google OAuth */}
        {isGoogleOnly && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-amber-800 dark:text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Conta Google Detetada</span>
              Pode continuar a iniciar sessão com o Google normalmente. Criar uma palavra-passe é opcional, mas ativa o login direto por e-mail.
            </div>
          </div>
        )}

        {/* Mensagens de Sucesso ou Erro */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Nova Palavra-passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova palavra-passe"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border transition-all text-sm font-['Plus_Jakarta_Sans',sans-serif] bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
              Confirmar Nova Palavra-passe
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova palavra-passe"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border transition-all text-sm font-['Plus_Jakarta_Sans',sans-serif] bg-slate-50/70 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Requisitos de Senha Fortes (Indicadores Visuais) */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px]">
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Requisitos de Segurança:
            </span>
            <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>Mínimo de 8 caracteres</span>
            </div>
            <div className={`flex items-center gap-2 ${hasUpper ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {hasUpper ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>Pelo menos 1 letra maiúscula (A-Z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasLower ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {hasLower ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>Pelo menos 1 letra minúscula (a-z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>Pelo menos 1 número (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasSpecial ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>Pelo menos 1 caractere especial (!@#$%^&*...)</span>
            </div>
            <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}`}>
              {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-600 inline-block" />}
              <span>As palavras-passe coincidem</span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isGoogleOnly ? "Criar Palavra-passe" : "Atualizar Palavra-passe"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
