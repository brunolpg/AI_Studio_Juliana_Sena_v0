"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AuthView } from "@/components/auth/auth-view";
import { Sparkles } from "lucide-react";

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

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

  return <AuthView />;
}
