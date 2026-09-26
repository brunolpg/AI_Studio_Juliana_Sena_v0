"use client";

import React, { useState } from "react";
import {
  X,
  FileHeart,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Heart,
  ShieldAlert,
  Activity,
  Pill,
} from "lucide-react";
import { updateMedicalHistoryAction } from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type { MedicalHistory } from "@/types/clinical-record";

interface MedicalHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
  initialHistory: MedicalHistory;
}

const BLOOD_TYPES: MedicalHistory["tipoSanguineo"][] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Não informado",
];

export function MedicalHistoryModal({
  isOpen,
  onClose,
  onSuccess,
  client,
  initialHistory,
}: MedicalHistoryModalProps) {
  const { toast } = useToast();

  const [alergias, setAlergias] = useState<string[]>(initialHistory.alergias || []);
  const [novaAlergia, setNovaAlergia] = useState("");

  const [comorbidades, setComorbidades] = useState<string[]>(initialHistory.comorbidades || []);
  const [novaComorbidade, setNovaComorbidade] = useState("");

  const [medicamentos, setMedicamentos] = useState<string[]>(
    initialHistory.medicamentosUsoContinuo || []
  );
  const [novoMedicamento, setNovoMedicamento] = useState("");

  const [tipoSanguineo, setTipoSanguineo] = useState(initialHistory.tipoSanguineo || "Não informado");
  const [historicoCirurgico, setHistoricoCirurgico] = useState(
    initialHistory.historicoCirurgico || ""
  );
  const [historicoFamiliar, setHistoricoFamiliar] = useState(initialHistory.historicoFamiliar || "");

  const [tabagismo, setTabagismo] = useState(initialHistory.habitosVida?.tabagismo || "Não fuma");
  const [etilismo, setEtilismo] = useState(initialHistory.habitosVida?.etilismo || "Não consome");
  const [atividadeFisica, setAtividadeFisica] = useState(
    initialHistory.habitosVida?.atividadeFisica || "Sedentário"
  );
  const [observacoesGerais, setObservacoesGerais] = useState(
    initialHistory.observacoesGerais || ""
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handlers para adicionar itens
  const handleAddAlergia = () => {
    if (novaAlergia.trim()) {
      setAlergias([...alergias, novaAlergia.trim()]);
      setNovaAlergia("");
    }
  };

  const handleRemoveAlergia = (idx: number) => {
    setAlergias(alergias.filter((_, i) => i !== idx));
  };

  const handleAddComorbidade = () => {
    if (novaComorbidade.trim()) {
      setComorbidades([...comorbidades, novaComorbidade.trim()]);
      setNovaComorbidade("");
    }
  };

  const handleRemoveComorbidade = (idx: number) => {
    setComorbidades(comorbidades.filter((_, i) => i !== idx));
  };

  const handleAddMedicamento = () => {
    if (novoMedicamento.trim()) {
      setMedicamentos([...medicamentos, novoMedicamento.trim()]);
      setNovoMedicamento("");
    }
  };

  const handleRemoveMedicamento = (idx: number) => {
    setMedicamentos(medicamentos.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: MedicalHistory = {
        alergias,
        comorbidades,
        medicamentosUsoContinuo: medicamentos,
        tipoSanguineo,
        historicoCirurgico,
        historicoFamiliar,
        habitosVida: {
          tabagismo,
          etilismo,
          atividadeFisica,
        },
        observacoesGerais,
      };

      const res = await updateMedicalHistoryAction(client.id, payload);

      if (res.success) {
        toast({
          type: "success",
          title: "Histórico atualizado!",
          description: "Os dados de saúde e anamnese foram gravados no prontuário.",
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao atualizar histórico.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de comunicação ao salvar histórico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <FileHeart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Editar Histórico Clínico & Anamnese
              </h3>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{client.nome}</strong> • {client.idade} anos
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Alergias Conhecidas */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Alergias Conhecidas (Medicamentosas ou Alimentares)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Dipirona, Penicilina, Iodo, Frutos do mar..."
                value={novaAlergia}
                onChange={(e) => setNovaAlergia(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlergia();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleAddAlergia}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {alergias.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhuma alergia cadastrada.</span>
              ) : (
                alergias.map((alergia, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                  >
                    <span>{alergia}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAlergia(idx)}
                      className="text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Comorbidades */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Comorbidades / Condições Crônicas</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Hipertensão, Diabetes Tipo 2, Hipotireoidismo..."
                value={novaComorbidade}
                onChange={(e) => setNovaComorbidade(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddComorbidade();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleAddComorbidade}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {comorbidades.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhuma comorbidade relatada.</span>
              ) : (
                comorbidades.map((c, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveComorbidade(idx)}
                      className="text-amber-500 hover:text-amber-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Medicamentos de uso contínuo */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-teal-600" />
              <span>Medicamentos de Uso Contínuo</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Losartana 50mg (1x/dia), Levotiroxina 75mcg..."
                value={novoMedicamento}
                onChange={(e) => setNovoMedicamento(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMedicamento();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleAddMedicamento}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {medicamentos.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhum medicamento contínuo.</span>
              ) : (
                medicamentos.map((m, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicamento(idx)}
                      className="text-teal-600 hover:text-teal-800 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Tipo Sanguíneo e Hábitos */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tipo Sanguíneo
              </label>
              <select
                value={tipoSanguineo}
                onChange={(e) => setTipoSanguineo(e.target.value as MedicalHistory["tipoSanguineo"])}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Tabagismo
              </label>
              <select
                value={tabagismo}
                onChange={(e) => setTabagismo(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Não fuma">Não fuma</option>
                <option value="Fumante">Fumante</option>
                <option value="Ex-fumante">Ex-fumante</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Etilismo
              </label>
              <select
                value={etilismo}
                onChange={(e) => setEtilismo(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Não consome">Não consome</option>
                <option value="Consumo social">Consumo social</option>
                <option value="Consumo frequente">Consumo frequente</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Atividade Física
              </label>
              <select
                value={atividadeFisica}
                onChange={(e) => setAtividadeFisica(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              >
                <option value="Sedentário">Sedentário</option>
                <option value="Moderada (1-3x/sem)">Moderada (1-3x/sem)</option>
                <option value="Intensa (4-7x/sem)">Intensa (4-7x/sem)</option>
              </select>
            </div>
          </div>

          {/* Cirúrgico e Familiar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Histórico Cirúrgico
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Apendicectomia (2018), Colecistectomia..."
                value={historicoCirurgico}
                onChange={(e) => setHistoricoCirurgico(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Histórico Familiar
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Mãe diabética e hipertensa; Pai sem histórico de cardiopatias..."
                value={historicoFamiliar}
                onChange={(e) => setHistoricoFamiliar(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
              />
            </div>
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Observações Gerais de Saúde
            </label>
            <textarea
              rows={2}
              placeholder="Notas adicionais sobre o histórico do paciente..."
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Histórico Clínico</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
