"use client";

import React, { useState } from "react";
import { X, Pill, Check, AlertCircle, Calendar } from "lucide-react";
import { addPrescriptionAction } from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type { PrescriptionItem } from "@/types/clinical-record";

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
}

const VIAS: PrescriptionItem["via"][] = ["Oral", "Tópico"];

export function PrescriptionModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: PrescriptionModalProps) {
  const { toast } = useToast();

  const todayStr = new Date().toISOString().split("T")[0];

  const [medicamento, setMedicamento] = useState("");
  const [dosagem, setDosagem] = useState("");
  const [via, setVia] = useState<PrescriptionItem["via"]>("Oral");
  const [posologia, setPosologia] = useState("");
  const [duracao, setDuracao] = useState("Uso contínuo");
  const [instrucoes, setInstrucoes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicamento.trim() || !dosagem.trim() || !posologia.trim()) {
      setErrorMsg("Informe o nome do medicamento, dosagem e posologia.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await addPrescriptionAction(client.id, {
        client_id: client.id,
        data: todayStr,
        medicamento: medicamento.trim(),
        dosagem: dosagem.trim(),
        via,
        posologia: posologia.trim(),
        duracao: duracao.trim() || "Uso contínuo",
        ativo: true,
        instrucoes: instrucoes.trim() || undefined,
      });

      if (res.success) {
        toast({
          type: "success",
          title: "Prescrição adicionada!",
          description: `${medicamento} adicionado ao receituário de ${client.nome}.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao prescrever.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Nova Prescrição
              </h3>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{client.nome}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Nome do Medicamento *
            </label>
            <input
              type="text"
              placeholder="Ex: Losartana Potássica, Amoxicilina, Omeprazol..."
              value={medicamento}
              onChange={(e) => setMedicamento(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Dosagem / Concentração *
              </label>
              <input
                type="text"
                placeholder="Ex: 50mg, 500mg, 10ml..."
                value={dosagem}
                onChange={(e) => setDosagem(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                Via de Administração
              </label>
              <select
                value={via}
                onChange={(e) => setVia(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {VIAS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Posologia (Frequência & Horários) *
            </label>
            <input
              type="text"
              placeholder="Ex: Tomar 1 comprimido por via oral a cada 12 horas..."
              value={posologia}
              onChange={(e) => setPosologia(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Duração do Tratamento
            </label>
            <input
              type="text"
              placeholder="Ex: 7 dias, 14 dias, Uso contínuo..."
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              Instruções Especiais / Orientações ao Paciente
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Ingerir junto com alimentos; não suspender sem orientação médica..."
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Adicionar Prescrição</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
