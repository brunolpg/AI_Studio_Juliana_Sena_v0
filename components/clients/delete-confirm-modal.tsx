"use client";

import React, { useTransition } from "react";
import { AlertTriangle, Trash2, ShieldAlert, X } from "lucide-react";
import { softDeleteClientAction, permanentDeleteClientAction } from "@/actions/client-actions";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSuccess: () => void;
  isPermanent?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  client,
  onSuccess,
  isPermanent = false,
}: DeleteConfirmModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  if (!isOpen || !client) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      let result;
      if (isPermanent) {
        result = await permanentDeleteClientAction(client.id);
      } else {
        result = await softDeleteClientAction(client.id);
      }

      if (result.success) {
        toast({
          type: isPermanent ? "warning" : "info",
          title: isPermanent ? "Exclusão definitiva concluída" : "Exclusão lógica realizada",
          description: result.message,
        });
        onSuccess();
        onClose();
      } else {
        toast({
          type: "error",
          title: "Erro na exclusão",
          description: result.message || "Não foi possível concluir a ação.",
        });
      }
    });
  };

  return (
    <div
      id="delete-confirm-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div
        id="delete-confirm-modal-dialog"
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl flex-shrink-0 ${
              isPermanent
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
            }`}
          >
            {isPermanent ? <ShieldAlert className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight">
              {isPermanent ? "Excluir Definitivamente?" : "Mover para Lixeira (Soft Delete)?"}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {isPermanent ? (
                <>
                  Você está prestes a apagar fisicamente o registro de{" "}
                  <strong className="text-slate-900 dark:text-slate-100 font-semibold">{client.nome}</strong> (CPF: {client.cpf}).
                  Esta ação é irreversível e removerá todos os dados do banco.
                </>
              ) : (
                <>
                  O paciente <strong className="text-slate-900 dark:text-slate-100 font-semibold">{client.nome}</strong> será
                  inativado e o campo <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">deleted_at</code>{" "}
                  será preenchido. O histórico é mantido para fins de auditoria e pode ser restaurado a qualquer momento.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                id="cancel-delete-btn"
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                id="confirm-delete-btn"
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors ${
                  isPermanent
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    {isPermanent ? "Excluir Definitivamente" : "Confirmar Exclusão Lógica"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
