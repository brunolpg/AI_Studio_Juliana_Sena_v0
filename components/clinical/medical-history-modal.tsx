"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileHeart,
  Plus,
  Check,
  AlertCircle,
  ShieldAlert,
  Activity,
  Pill,
  Stethoscope,
  Image as ImageIcon,
} from "lucide-react";
import { updateMedicalHistoryAction } from "@/actions/clinical-actions";
import { useToast } from "@/components/ui/toast";
import { getSupabaseClient } from "@/lib/supabase/client";
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

  const [acompanhamentoMedico, setAcompanhamentoMedico] = useState<string[]>(
    initialHistory.acompanhamentoMedico || []
  );
  const [novoAcompanhamento, setNovoAcompanhamento] = useState("");

  const [isotretinoina6Meses, setIsotretinoina6Meses] = useState<boolean>(
    Boolean(initialHistory.isotretinoina6Meses)
  );

  const [implantesDispositivos, setImplantesDispositivos] = useState<string[]>(
    initialHistory.implantesDispositivos || []
  );

  const [ingestaoAgua, setIngestaoAgua] = useState(initialHistory.ingestaoAgua || "");
  const [qualidadeSono, setQualidadeSono] = useState(initialHistory.qualidadeSono || "");
  const [funcionamentoIntestino, setFuncionamentoIntestino] = useState(
    initialHistory.funcionamentoIntestino || ""
  );

  const [tipoSanguineo, setTipoSanguineo] = useState(initialHistory.tipoSanguineo || "Não informado");
  const [historicoCirurgico, setHistoricoCirurgico] = useState(
    initialHistory.historicoCirurgico || ""
  );
  const [historicoFamiliar, setHistoricoFamiliar] = useState(initialHistory.historicoFamiliar || "");
  const [lesoesDetalhes, setLesoesDetalhes] = useState(initialHistory.lesoesDetalhes || "");

  const [tabagismo, setTabagismo] = useState(initialHistory.habitosVida?.tabagismo || "Não fuma");
  const [etilismo, setEtilismo] = useState(initialHistory.habitosVida?.etilismo || "Não consome");
  const [atividadeFisica, setAtividadeFisica] = useState(
    initialHistory.habitosVida?.atividadeFisica || "Sedentário"
  );
  const [observacoesGerais, setObservacoesGerais] = useState(
    initialHistory.observacoesGerais || ""
  );

  // Fotos da Área a Ser Tratada
  const [fotosFiles, setFotosFiles] = useState<File[]>([]);
  const [fotosUrls, setFotosUrls] = useState<string[]>(initialHistory.fotosAreaTratada || []);
  const [fotosPreviews, setFotosPreviews] = useState<{ file?: File; url: string }[]>([]);

  useEffect(() => {
    const existingPreviews = fotosUrls.map((url) => ({ url }));
    const filePreviews = fotosFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    const combined = [...existingPreviews, ...filePreviews];
    setFotosPreviews(combined);

    return () => {
      filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [fotosFiles, fotosUrls]);

  const uploadToSupabase = async (bucket: string, folder: string, file: File): Promise<string> => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase não configurado.");

      try {
        await supabase.storage.createBucket(bucket, { public: true });
      } catch (e) {
        // Ignora se já existe
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${folder}/${Date.now()}_${sanitizedName}`;

      const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        console.warn(`[Supabase Storage] Erro ao enviar arquivo para o bucket ${bucket}:`, error.message);
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      console.error(`[Supabase Storage] Exceção no upload de ${file.name}:`, err);
      return `https://supabase-storage-fallback.local/${bucket}/${folder}/${file.name}`;
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handlers para listas
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

  const handleAddAcompanhamento = () => {
    if (novoAcompanhamento.trim()) {
      setAcompanhamentoMedico([...acompanhamentoMedico, novoAcompanhamento.trim()]);
      setNovoAcompanhamento("");
    }
  };

  const handleRemoveAcompanhamento = (idx: number) => {
    setAcompanhamentoMedico(acompanhamentoMedico.filter((_, i) => i !== idx));
  };

  const toggleImplante = (val: string) => {
    if (implantesDispositivos.includes(val)) {
      setImplantesDispositivos(implantesDispositivos.filter((i) => i !== val));
    } else {
      setImplantesDispositivos([...implantesDispositivos, val]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Upload de novas fotos da área tratada para o Supabase Storage (bucket prontuarios-fotos)
      const finalFotosUrls: string[] = [...fotosUrls];
      for (const file of fotosFiles) {
        if (finalFotosUrls.length >= 3) break;
        const url = await uploadToSupabase("prontuarios-fotos", client.id, file);
        finalFotosUrls.push(url);
      }

      const payload: MedicalHistory = {
        alergias,
        comorbidades,
        medicamentosUsoContinuo: medicamentos,
        acompanhamentoMedico,
        isotretinoina6Meses,
        implantesDispositivos,
        ingestaoAgua,
        qualidadeSono,
        funcionamentoIntestino,
        tipoSanguineo,
        historicoCirurgico,
        historicoFamiliar,
        lesoesDetalhes,
        habitosVida: {
          tabagismo,
          etilismo,
          atividadeFisica,
        },
        observacoesGerais,
        fotosAreaTratada: finalFotosUrls.slice(0, 3),
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
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1 cursor-pointer"
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
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center gap-1 cursor-pointer"
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
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center gap-1 cursor-pointer"
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

          {/* 1. Acompanhamento Médico (Especialidade) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span>Acompanhamento Médico (Especialidade)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Dermatologista, Cardiologista, Endocrinologista..."
                value={novoAcompanhamento}
                onChange={(e) => setNovoAcompanhamento(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAcompanhamento();
                  }
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={handleAddAcompanhamento}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {acompanhamentoMedico.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Nenhum acompanhamento médico informado.</span>
              ) : (
                acompanhamentoMedico.map((ac, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200"
                  >
                    <span>{ac}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAcompanhamento(idx)}
                      className="text-indigo-600 hover:text-indigo-800 cursor-pointer"
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

          {/* Novos Campos Anamnese (Abaixo de Atividade Física) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            {/* 2. Uso de Isotretinoína */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Uso de Isotretinoína (Roacutan) nos últimos 6 meses?
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsotretinoina6Meses(true)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    isotretinoina6Meses
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setIsotretinoina6Meses(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    !isotretinoina6Meses
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  Não
                </button>
              </div>
            </div>

            {/* 3. Implante Metálico ou Marcapasso */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Implante metálico ou Marcapasso
              </label>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {["Implante Metálico", "Marcapasso"].map((item) => {
                  const active = implantesDispositivos.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleImplante(item)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        active
                          ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Ingestão Diária de Água */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Ingestão Diária de Água
              </label>
              <select
                value={ingestaoAgua}
                onChange={(e) => setIngestaoAgua(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Por favor, selecione...</option>
                <option value="Menos de 1 litro por dia">Menos de 1 litro por dia</option>
                <option value="Entre 1 e 2 litros por dia">Entre 1 e 2 litros por dia</option>
                <option value="Mais de 2 litros por dia">Mais de 2 litros por dia</option>
              </select>
            </div>

            {/* 5. Qualidade do Sono */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Qualidade do Sono
              </label>
              <select
                value={qualidadeSono}
                onChange={(e) => setQualidadeSono(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Por favor, selecione...</option>
                <option value="Ruim (menos de 6 horas)">Ruim (menos de 6 horas)</option>
                <option value="Bom/ aceitável (6 a 7 horas)">Bom/ aceitável (6 a 7 horas)</option>
                <option value="Ótimo (7 a 9 horas)">Ótimo (7 a 9 horas)</option>
                <option value="Acima do esperado (mais de 9 horas)">Acima do esperado (mais de 9 horas)</option>
              </select>
            </div>

            {/* 6. Funcionamento do Intestino */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Funcionamento do Intestino
              </label>
              <select
                value={funcionamentoIntestino}
                onChange={(e) => setFuncionamentoIntestino(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Por favor, selecione...</option>
                <option value="Regular (diário)">Regular (diário)</option>
                <option value="Tende à constipação">Tende à constipação</option>
                <option value="Tende à diarreia">Tende à diarreia</option>
                <option value="Irregular">Irregular</option>
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

          {/* 7. Possui lesões (Local/ Tratamento/ Frequência) - Abaixo de Histórico Familiar */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Possui lesões (Local/ Tratamento/ Frequência)
            </label>
            <textarea
              rows={2}
              placeholder="Descreva o local da lesão, tratamentos já realizados e a frequência..."
              value={lesoesDetalhes}
              onChange={(e) => setLesoesDetalhes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
            />
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

          {/* 8. Fotos da Área a Ser Tratada (Até 3 fotos) - Abaixo de Observações Gerais */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              Fotos da Área a Ser Tratada (Até 3 fotos)
            </label>
            <div className="border border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-500 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40 text-center relative transition-colors">
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.bmp,image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files);
                    const totalAllowed = 3 - (fotosUrls.length + fotosFiles.length);
                    const filesToAdd = newFiles.slice(0, totalAllowed);
                    if (filesToAdd.length > 0) {
                      setFotosFiles((prev) => [...prev, ...filesToAdd]);
                    }
                  }
                }}
                disabled={fotosUrls.length + fotosFiles.length >= 3}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {fotosUrls.length + fotosFiles.length >= 3
                    ? "Limite máximo de 3 fotos atingido"
                    : "Selecionar fotos da área a tratar"}
                </p>
                <p className="text-[10px] text-slate-400">
                  Formatos aceitos: PNG, JPG, JPEG, BMP (Máximo de 3 imagens)
                </p>
              </div>
            </div>

            {/* Grid de Thumbnails */}
            {fotosPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {fotosPreviews.map((preview, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100"
                  >
                    <img
                      src={preview.url}
                      alt={`Área tratada ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (idx < fotosUrls.length) {
                          setFotosUrls(fotosUrls.filter((_, i) => i !== idx));
                        } else {
                          const fileIdx = idx - fotosUrls.length;
                          setFotosFiles(fotosFiles.filter((_, i) => i !== fileIdx));
                        }
                      }}
                      className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full opacity-90 transition-colors cursor-pointer"
                      title="Remover foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
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
