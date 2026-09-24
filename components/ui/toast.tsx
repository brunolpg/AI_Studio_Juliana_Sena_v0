"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (msg: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, description }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description }]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toast, removeToast }}>
      {children}
      <div
        id="toast-container"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
            error: <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
            info: <Info className="w-5 h-5 text-sky-600 flex-shrink-0" />,
          };

          const bgColors = {
            success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-100",
            error: "border-rose-200 bg-rose-50 text-rose-950 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-100",
            warning: "border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-100",
            info: "border-sky-200 bg-sky-50 text-sky-950 dark:bg-sky-950/90 dark:border-sky-800 dark:text-sky-100",
          };

          return (
            <div
              key={t.id}
              id={`toast-${t.id}`}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg transition-all animate-in slide-in-from-bottom-3 duration-200 ${bgColors[t.type]}`}
            >
              {icons[t.type]}
              <div className="flex-1 min-w-0">
                <h5 className="font-semibold text-sm leading-tight">{t.title}</h5>
                {t.description && (
                  <p className="text-xs mt-1 opacity-90 leading-normal">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
