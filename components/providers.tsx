"use client";

import React from "react";
import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/components/auth/auth-context";
import { MobileThemeSync } from "@/components/shared/mobile-theme-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <MobileThemeSync />
        {children}
      </AuthProvider>
    </ToastProvider>
  );
}
