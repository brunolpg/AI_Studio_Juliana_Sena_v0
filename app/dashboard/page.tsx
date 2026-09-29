"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { PatientDashboard } from "@/components/clients/patient-dashboard";
import { HeartPulse } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-600 animate-spin" />
            <HeartPulse className="w-6 h-6 text-teal-600 absolute animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Acessando ambiente clínico seguro...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return <PatientDashboard />;
}
