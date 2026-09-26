"use client";

import React, { useState } from "react";
import {
  X,
  Stethoscope,
  Activity,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  FileText,
  User,
  Heart,
  Scale,
} from "lucide-react";
import { addClinicalEvolutionAction } from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type { EvolutionType } from "@/types/clinical-record";

interface EvolutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
}

const EVOLUTION_TYPES: EvolutionType[] = [
  "Consulta",
  "Retorno",
  "Procedimento",
  "Urgência",
  "Teleatendimento",
];

export function EvolutionFormModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: EvolutionFormModalProps) {
  const { toast } = useToast();

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTimeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const [tipo, setTipo] = useState<EvolutionType>("Consulta");
  const [data, setData] = useState(todayStr);
  const [horario, setHorario] = useState(currentTimeStr);
  const [profissional, setProfissional] = useState("Dra. Juliana Sena");
  const [especialidade, setEspecialidade] = useState("Clínica Geral");

  // Sinais vitais
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState<string>("");
  const [temp, setTemp] = useState<string>("");
  const [peso, setPeso] = useState<string>("");
  const [altura, setAltura] = useState<string>("");

  // SOAP
  const [subjetivo, setSubjetivo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [avaliacao, setAvaliacao] = useState("");
  const [plano, setPlano] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Cálculo dinâmico do IMC
  const pesoNum = parseFloat(peso);
  const alturaNum = parseFloat(altura);
  let calculatedImc: number | undefined;
  if (pesoNum > 0 && alturaNum > 0) {
    const alturaM = alturaNum > 3 ? alturaNum / 100 : alturaNum;
    calculatedImc = Number((pesoNum / (alturaM * alturaM)).toFixed(1));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjetivo.trim() || !avaliacao.trim() || !plano.trim()) {
      setErrorMsg("Preencha ao menos o relato subjetivo, a avaliação e o plano conduta.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await addClinicalEvolutionAction(client.id, {
        client_id: client.id,
        data,
        horario,
        tipo,
        profissional,
        especialidade,
        subjetivo: subjetivo.trim(),
        objetivo: objetivo.trim() || "Exame físico sumário realizado sem anormalidades evidentes.",
        sinaisVitais: {
          pressaoArterial: pa.trim() || undefined,
          frequenciaCardiaca: fc ? parseInt(fc) : undefined,
          temperatura: temp ? parseFloat(temp) : undefined,
          peso: pesoNum || undefined,
          altura: alturaNum || undefined,
          imc: calculatedImc,
        },
        avaliacao: avaliacao.trim(),
        plano: plano.trim(),
      });

      if (res.success) {
        toast({
          type: "success",
          title: "Evolução registrada!",
          description: `Nova evolução clínica arquivada no prontuário de ${client.nome}.`,
        });
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || "Erro ao registrar evolução clínica.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocorreu um erro interno de conexão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Nova Evolução Clínica (SOAP)
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200">
                  Prontuário
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{client.nome}</strong> • CPF: {client.cpf}
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Tipo de Atendimento & Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Tipo de Atendimento
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as EvolutionType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {EVOLUTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Data do Atendimento
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Horário
              </label>
              <input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Sinais Vitais (Opcionais mas altamente recomendados) */}
          <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-600" />
                <span>Sinais Vitais e Biometria</span>
              </span>
              {calculatedImc && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-200">
                  IMC: {calculatedImc} kg/m²
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  PA (mmHg)
                </label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={pa}
                  onChange={(e) => setPa(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  FC (bpm)
                </label>
                <input
                  type="number"
                  placeholder="72"
                  value={fc}
                  onChange={(e) => setFc(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  Temp (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="36.5"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="70.5"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 block mb-1">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  placeholder="170"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Formato SOAP */}
          <div className="space-y-4">
            {/* Subjetivo */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>1. Subjetivo (S) - Queixa Principal & Anamnese Atual *</span>
                <span className="text-[10px] text-slate-400 font-normal">Relato do paciente</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Paciente relata dor abdominal em queimação iniciada há 3 dias. Refere piora pós-prandial..."
                value={subjetivo}
                onChange={(e) => setSubjetivo(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            {/* Objetivo */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>2. Objetivo (O) - Exame Físico & Achados Clínicos</span>
                <span className="text-[10px] text-slate-400 font-normal">Inspeção, palpação, ausculta</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: BEG, corado, anictérico. Abdome plano, flácido, com dor à palpação profunda em epigástrio..."
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            {/* Avaliação */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>3. Avaliação (A) - Hipótese Diagnóstica & CID-10 *</span>
                <span className="text-[10px] text-slate-400 font-normal">Conclusão médica</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Dispepsia Funcional / Gastrite Aguda (CID-10 K29.1)"
                value={avaliacao}
                onChange={(e) => setAvaliacao(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Plano */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>4. Plano (P) - Conduta Terapêutica, Prescrições & Orientações *</span>
                <span className="text-[10px] text-slate-400 font-normal">Tratamento e retornos</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: 1. Prescrito Omeprazol 20mg em jejum por 28 dias. 2. Orientações dietéticas. 3. Retorno em 30 dias com EDA se refratário."
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>
          </div>

          {/* Rodapé de Ações */}
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando no Prontuário...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvar Evolução Clínica</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
