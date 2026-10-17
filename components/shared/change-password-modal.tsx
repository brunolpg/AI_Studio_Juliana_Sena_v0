"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, X, AlertCircle } from "lucide-react";
import { changePasswordAction } from "@/app/actions/password";
import { useToast } from "@/components/ui/toast";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGoogleOnly?: boolean;
}

export function ChangePasswordModal({ isOpen, onClose, isGoogleOnly = false }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setError("A palavra-passe não cumpre todos os requisitos de segurança.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePasswordAction(password);
      if (res.success) {
        toast({
          type: "success",
          title: "Palavra-passe atualizada com sucesso",
          description: "As suas credenciais de acesso foram guardadas com segurança.",
        });
        setPassword("");
        setConfirmPassword("");
        onClose();
      } else {
        setError(res.error || "Não foi possível atualizar a palavra-passe.");
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/10 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isGoogleOnly ? "Criar Palavra-passe de Acesso" : "Alterar Palavra-passe"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Proteja a sua conta com uma senha forte.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isGoogleOnly && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              A sua conta está atualmente associada ao Google. Definir uma palavra-passe permitir-lhe-á aceder também por e-mail e senha.
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nova Palavra-passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres, maiúsculas, números e símbolos"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Confirmar Nova Palavra-passe
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repita a nova palavra-passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Requisitos Checklist */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px]">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Requisitos de Segurança:</p>
            <ul className="grid grid-cols-1 gap-1 text-slate-500 dark:text-slate-400">
              <li className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                <span>{hasMinLength ? "✓" : "•"}</span> Mínimo de 8 carateres
              </li>
              <li className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                <span>{hasUpper ? "✓" : "•"}</span> Pelo menos 1 letra maiúscula (A-Z)
              </li>
              <li className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                <span>{hasLower ? "✓" : "•"}</span> Pelo menos 1 letra minúscula (a-z)
              </li>
              <li className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                <span>{hasNumber ? "✓" : "•"}</span> Pelo menos 1 número (0-9)
              </li>
              <li className={`flex items-center gap-1.5 ${hasSpecial ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                <span>{hasSpecial ? "✓" : "•"}</span> Pelo menos 1 símbolo especial (!@#$%...)
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasMinLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial || !passwordsMatch}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "A guardar..." : "Guardar Palavra-passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
