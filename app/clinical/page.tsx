"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { PatientDashboard } from "@/components/clients/patient-dashboard";
import { HeartPulse } from "lucide-react";

export default function ClinicalPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/");
      } else {
        const rawRole = String(user.role || (user as any).profile?.role || "").toLowerCase().trim();
        if (rawRole === "paciente") {
          router.push("/");
        } else if (rawRole === "administrador" || rawRole === "admin") {
          router.replace("/appointments");
        }
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-surface flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <HeartPulse className="w-6 h-6 text-primary absolute animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-on-surface-variant">
            Acessando módulo de Prontuários & Evoluções Clínicas...
          </p>
        </div>
      </div>
    );
  }

  const rawRole = String(user?.role || (user as any)?.profile?.role || "").toLowerCase().trim();
  if (!user || rawRole !== "profissional") {
    return null;
  }

  return <PatientDashboard initialTab="prontuarios" />;
}
