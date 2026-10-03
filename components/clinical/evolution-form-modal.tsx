"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Client } from "@/types/client";
import type { EvolutionType } from "@/types/clinical-record";
import { PROCEDIMENTOS_CADASTRAIS } from "@/lib/procedimentos-mock";

interface EvolutionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: Client;
  initialAppointmentId?: string;
}

export function EvolutionFormModal({
  isOpen,
  onClose,
  onSuccess,
  client,
  initialAppointmentId,
}: EvolutionFormModalProps) {
  const { toast } = useToast();

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentTimeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const [tipo, setTipo] = useState<EvolutionType>("");
  const [procedimentoId, setProcedimentoId] = useState<string>("");
  const [procedimentos, setProcedimentos] = useState<any[]>(PROCEDIMENTOS_CADASTRAIS);
  const [isLoadingProcedimentos, setIsLoadingProcedimentos] = useState(false);

  // Estados de agendamentos e vínculo
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");

  // Estados de upload de arquivos
  const [examesFiles, setExamesFiles] = useState<File[]>([]);
  const [fotosFiles, setFotosFiles] = useState<File[]>([]);
  const [fotosPreviews, setFotosPreviews] = useState<{ file: File; url: string }[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Efeito para criar e limpar URLs de visualização prévia das fotos (evita vazamento de memória)
  useEffect(() => {
    const previews = fotosFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setFotosPreviews(previews);

    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [fotosFiles]);

  // Função helper resiliente de upload para o Supabase Storage
  const uploadToSupabase = async (bucket: string, folder: string, file: File): Promise<string> => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase não configurado.");

      // Garante a existência do bucket criando-o de forma resiliente ou pulando se houver erro de permissão
      try {
        await supabase.storage.createBucket(bucket, { public: true });
      } catch (e) {
        // Ignora erro se o bucket já existir ou se a conta de serviço não tiver permissão de criação direta
      }

      // Limpa caracteres especiais do nome do arquivo
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${folder}/${Date.now()}_${sanitizedName}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.warn(`[Supabase Storage] Erro ao enviar arquivo para o bucket ${bucket}:`, error.message);
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (err) {
      console.error(`[Supabase Storage] Exceção no upload do arquivo ${file.name}:`, err);
      // Fallback para não travar o salvamento da evolução SOAP
      return `https://supabase-storage-fallback.local/${bucket}/${folder}/${file.name}`;
    }
  };

  const [data, setData] = useState(todayStr);
  const [horario, setHorario] = useState(currentTimeStr);
  const [profissional, setProfissional] = useState("Dra. Juliana Sena");
  const [especialidade, setEspecialidade] = useState("Clínica Geral");

  // Carrega procedimentos dinâmicos do Supabase com fallback
  useEffect(() => {
    async function loadProcedimentos() {
      setIsLoadingProcedimentos(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: dbData, error } = await supabase
            .from("procedimentos")
            .select("id, procedimento, categoria")
            .order("categoria", { ascending: true })
            .order("procedimento", { ascending: true });
          
          if (!error && dbData) {
            setProcedimentos(dbData);
            return;
          }
        }
        
        // Fallback dinâmico seguro
        const { getProcedimentosAction } = await import("@/actions/appointment-actions");
        const res = await getProcedimentosAction();
        if (res.success && res.data) {
          setProcedimentos(res.data);
        }
      } catch (err) {
        console.error("Erro ao carregar procedimentos na evolução clínica:", err);
        setProcedimentos(PROCEDIMENTOS_CADASTRAIS);
      } finally {
        setIsLoadingProcedimentos(false);
      }
    }
    if (isOpen) {
      loadProcedimentos();
    }
  }, [isOpen]);

  // Carrega agendamentos do paciente atual
  useEffect(() => {
    async function loadAppointments() {
      setIsLoadingAppointments(true);
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: dbData, error } = await supabase
            .from("appointments")
            .select("id, data, horario_inicio, horario_fim, procedimento, status")
            .eq("client_id", client.id)
            .neq("status", "Cancelado")
            .order("data", { ascending: false });
          
          if (!error && dbData) {
            setAppointments(dbData);
            if (initialAppointmentId) {
              setSelectedAppointmentId(initialAppointmentId);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar agendamentos do paciente na evolução:", err);
      } finally {
        setIsLoadingAppointments(false);
      }
    }
    if (isOpen && client?.id) {
      loadAppointments();
    }
  }, [isOpen, client?.id, initialAppointmentId]);

  // Preenche e bloqueia os campos quando um agendamento for selecionado
  useEffect(() => {
    if (selectedAppointmentId) {
      const apt = appointments.find((a) => a.id === selectedAppointmentId);
      if (apt) {
        setData(apt.data);
        setHorario(apt.horario_inicio);
        
        // Vínculo Automático pelo ID do procedimento ou pelo nome
        const proc = procedimentos.find((p) => 
          (apt.procedimento_id && p.id === apt.procedimento_id) || 
          (apt.procedimento && p.procedimento === apt.procedimento)
        );
        
        if (proc) {
          setTipo(proc.procedimento);
          setProcedimentoId(proc.id);
        } else {
          setTipo(apt.procedimento || "");
          setProcedimentoId("");
        }
      }
    } else {
      setData(todayStr);
      setHorario(currentTimeStr);
      setTipo("");
      setProcedimentoId("");
    }
  }, [selectedAppointmentId, appointments, procedimentos, todayStr, currentTimeStr]);

  // Agrupa os procedimentos por categoria para <optgroup> em ordem alfabética
  const groupedProcedimentos = useMemo(() => {
    const groups: Record<string, typeof procedimentos> = {};
    procedimentos.forEach((p) => {
      if (!groups[p.categoria]) {
        groups[p.categoria] = [];
      }
      groups[p.categoria].push(p);
    });

    // Ordenar categorias em ordem alfabética
    const sortedCategories = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    
    // Criar um novo objeto ordenado
    const sortedGroups = {};
    sortedCategories.forEach((cat) => {
      // Ordenar os itens dentro de cada categoria em ordem alfabética por procedimento
      sortedGroups[cat] = [...groups[cat]].sort((a, b) => a.procedimento.localeCompare(b.procedimento));
    });

    return sortedGroups;
  }, [procedimentos]);

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
    if (!tipo) {
      setErrorMsg("Selecione o procedimento / tipo de atendimento antes de salvar a evolução.");
      return;
    }
    if (!subjetivo.trim() || !avaliacao.trim() || !plano.trim()) {
      setErrorMsg("Preencha ao menos o relato subjetivo, a avaliação e o plano conduta.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Upload dos arquivos de exames para o bucket prontuarios-documentos
      const examesUrls: string[] = [];
      for (const file of examesFiles) {
        const url = await uploadToSupabase("prontuarios-documentos", client.id, file);
        examesUrls.push(url);
      }

      // 2. Upload das fotos do paciente para o bucket prontuarios-fotos
      const fotosUrls: string[] = [];
      for (const file of fotosFiles) {
        const url = await uploadToSupabase("prontuarios-fotos", client.id, file);
        fotosUrls.push(url);
      }

      const res = await addClinicalEvolutionAction(client.id, {
        client_id: client.id,
        data,
        horario,
        tipo,
        tipo_atendimento: tipo,
        procedimento_id: procedimentoId || undefined,
        appointment_id: selectedAppointmentId || null,
        exames_anexos: examesUrls,
        fotos_paciente: fotosUrls,
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
                  Nova Evolução do Paciente
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
          {/* Seletor de Vínculo de Agendamento */}
          <div className="space-y-1.5 p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/40 bg-teal-50/10 dark:bg-teal-950/10">
            <label className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center justify-between">
              <span>Vincular a um Agendamento (Opcional)</span>
              {isLoadingAppointments && (
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal animate-pulse">
                  Carregando agendamentos...
                </span>
              )}
            </label>
            <select
              value={selectedAppointmentId}
              onChange={(e) => setSelectedAppointmentId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none"
            >
              <option value="">Atendimento Avulso / Sem agendamento prévio</option>
              {appointments.map((apt) => {
                const parts = apt.data.split("-");
                const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : apt.data;
                return (
                  <option key={apt.id} value={apt.id}>
                    [{formattedDate}] às {apt.horario_inicio} - {apt.procedimento} ({apt.status})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Tipo de Atendimento & Metadados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                Tipo de Atendimento
              </label>
              <select
                value={tipo}
                onChange={(e) => {
                  const val = e.target.value;
                  setTipo(val);
                  const found = procedimentos.find((p) => p.procedimento === val);
                  setProcedimentoId(found?.id || "");
                }}
                required
                disabled={Boolean(selectedAppointmentId)}
                className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none ${
                  selectedAppointmentId
                    ? "bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed text-slate-500 dark:text-slate-400"
                    : "bg-slate-50 dark:bg-slate-800"
                }`}
              >
                <option value="" disabled>
                  {isLoadingProcedimentos ? "Carregando procedimentos..." : "Selecione o procedimento / tipo de atendimento..."}
                </option>
                {Object.entries(groupedProcedimentos).map(([categoria, items]) => (
                  <optgroup key={categoria} label={categoria}>
                    {items.map((item: any) => (
                      <option key={item.id} value={item.procedimento}>
                        {item.procedimento}
                      </option>
                    ))}
                  </optgroup>
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
                readOnly={Boolean(selectedAppointmentId)}
                className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none ${
                  selectedAppointmentId
                    ? "bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed text-slate-500 dark:text-slate-400"
                    : "bg-slate-50 dark:bg-slate-800"
                }`}
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
                readOnly={Boolean(selectedAppointmentId)}
                className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none ${
                  selectedAppointmentId
                    ? "bg-slate-100 dark:bg-slate-800/60 cursor-not-allowed text-slate-500 dark:text-slate-400"
                    : "bg-slate-50 dark:bg-slate-800"
                }`}
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

          {/* Seção de Anexos da Consulta */}
          <div className="space-y-4 pt-5 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1.5 uppercase tracking-wider">
              <FileText className="w-4 h-4" />
              <span>Anexos e Documentos Clínicos</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Exames Apresentados */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  Exames Apresentados (PDF, PNG, JPG, JPEG, BMP)
                </label>
                <div className="border border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-500 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40 text-center relative transition-colors">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.bmp,application/pdf,image/*"
                    onChange={(e) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files);
                        setExamesFiles((prev) => [...prev, ...files]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Selecionar exames / laudos
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Arraste ou clique para selecionar múltiplos arquivos
                    </p>
                  </div>
                </div>

                {/* Lista de arquivos anexados */}
                {examesFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {examesFiles.map((file, idx) => {
                      const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className={`w-4 h-4 shrink-0 ${isPdf ? "text-rose-500" : "text-blue-500"}`} />
                            <span className="truncate font-medium text-slate-700 dark:text-slate-300" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExamesFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Fotos do Paciente */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  Fotos do Paciente (Antes/Depois ou Lesões)
                </label>
                <div className="border border-dashed border-slate-200 dark:border-slate-700 hover:border-teal-500 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/40 text-center relative transition-colors">
                  <input
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.bmp,image/png,image/jpeg,image/bmp"
                    onChange={(e) => {
                      if (e.target.files) {
                        const files = Array.from(e.target.files);
                        setFotosFiles((prev) => [...prev, ...files]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Adicionar fotos do paciente
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Formatos aceitos: PNG, JPG, JPEG, BMP
                    </p>
                  </div>
                </div>

                {/* Grid de thumbnails das fotos */}
                {fotosPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                    {fotosPreviews.map((preview, idx) => (
                      <div
                        key={idx}
                        className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100"
                      >
                        <img
                          src={preview.url}
                          alt={`Anexo ${idx + 1}`}
                          className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => setLightboxUrl(preview.url)}
                        />
                        <button
                          type="button"
                          onClick={() => setFotosFiles((prev) => prev.filter((_, i) => i !== idx))}
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
            </div>
          </div>

          {/* Lightbox para fotos em tamanho ampliado */}
          {lightboxUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
              <div className="relative max-w-4xl w-full max-h-screen flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <img
                  src={lightboxUrl}
                  alt="Visualização ampliada"
                  className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl border border-slate-800"
                />
              </div>
            </div>
          )}

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
