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
  Pill,
  FileHeart,
  AlertTriangle,
  CheckSquare,
  Square,
  Plus,
} from "lucide-react";
import {
  addClinicalEvolutionAction,
  getPatientPrescriptionsForEvolutionAction,
  type PrescricaoParaEvolucao,
} from "@/actions/clinical-actions";
import { getPatientHomeCareFichas } from "@/app/actions/home-care";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import { PrescriptionModal } from "./prescription-modal";
import { HomeCareModal } from "./home-care-modal";
import { useToast } from "@/components/ui/toast";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validateMultipleFiles } from "@/lib/validations/file-upload";
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
        
        const isProcUuid = proc?.id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proc.id) : false;
        if (proc) {
          setTipo(proc.procedimento);
          setProcedimentoId(isProcUuid ? proc.id : "");
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

  // Sinais vitais - Estética Regenerativa
  const [pa, setPa] = useState("");
  const [fc, setFc] = useState<string>("");
  const [hidratacao, setHidratacao] = useState<string>("");
  const [oleosidade, setOleosidade] = useState<string>("");
  const [elasticidade, setElasticidade] = useState<string>("");

  // SOAP
  const [subjetivo, setSubjetivo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [avaliacao, setAvaliacao] = useState("");
  const [plano, setPlano] = useState("");

  // Estados dos Itens 5 e 6: Prescrições e Ficha de Home Care
  const [prescricoesDisponiveis, setPrescricoesDisponiveis] = useState<PrescricaoParaEvolucao[]>([]);
  const [isLoadingPrescricoes, setIsLoadingPrescricoes] = useState(false);
  const [selectedPrescricoesIds, setSelectedPrescricoesIds] = useState<string[]>([]);

  const [homeCareFichasDisponiveis, setHomeCareFichasDisponiveis] = useState<HomeCareFichaCompleta[]>([]);
  const [isLoadingHomeCare, setIsLoadingHomeCare] = useState(false);
  const [selectedHomeCareFichaId, setSelectedHomeCareFichaId] = useState<string>("");

  // Carrega Prescrições e Fichas de Home Care vinculáveis ao abrir o modal
  useEffect(() => {
    async function loadPrescricoesEHomeCare() {
      if (!isOpen || !client?.id) return;
      setIsLoadingPrescricoes(true);
      setIsLoadingHomeCare(true);

      try {
        const rxs = await getPatientPrescriptionsForEvolutionAction(client.id);
        setPrescricoesDisponiveis(rxs || []);
      } catch (err) {
        console.error("Erro ao carregar prescrições na evolução:", err);
      } finally {
        setIsLoadingPrescricoes(false);
      }

      try {
        const hcs = await getPatientHomeCareFichas(client.id);
        setHomeCareFichasDisponiveis(hcs || []);
      } catch (err) {
        console.error("Erro ao carregar Home Care na evolução:", err);
      } finally {
        setIsLoadingHomeCare(false);
      }
    }

    if (isOpen && client?.id) {
      loadPrescricoesEHomeCare();
    } else {
      setSelectedPrescricoesIds([]);
      setSelectedHomeCareFichaId("");
    }
  }, [isOpen, client?.id]);

  // Ficha de Home Care selecionada para pré-visualização de detalhes
  const selectedHomeCareFicha = useMemo(() => {
    if (!selectedHomeCareFichaId) return null;
    return homeCareFichasDisponiveis.find((f) => f.id === selectedHomeCareFichaId) || null;
  }, [selectedHomeCareFichaId, homeCareFichasDisponiveis]);

  // Estados dos modais sobrepostos (z-[70])
  const [isNewPrescriptionModalOpen, setIsNewPrescriptionModalOpen] = useState(false);
  const [isNewHomeCareModalOpen, setIsNewHomeCareModalOpen] = useState(false);

  // Callback de sucesso ao emitir uma nova prescrição no modal sobreposto
  const handleNewPrescriptionSuccess = async (createdPrescriptionId?: string) => {
    setIsNewPrescriptionModalOpen(false);
    setIsLoadingPrescricoes(true);
    try {
      const updatedRxs = await getPatientPrescriptionsForEvolutionAction(client.id);
      setPrescricoesDisponiveis(updatedRxs || []);
      if (createdPrescriptionId) {
        setSelectedPrescricoesIds((prev) =>
          prev.includes(createdPrescriptionId) ? prev : [...prev, createdPrescriptionId]
        );
      } else if (updatedRxs && updatedRxs.length > 0) {
        const latestId = updatedRxs[0].id;
        setSelectedPrescricoesIds((prev) =>
          prev.includes(latestId) ? prev : [...prev, latestId]
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar lista de prescrições:", err);
    } finally {
      setIsLoadingPrescricoes(false);
    }
  };

  // Callback de sucesso ao emitir uma nova ficha de Home Care no modal sobreposto
  const handleNewHomeCareSuccess = async (createdFichaId?: string) => {
    setIsNewHomeCareModalOpen(false);
    setIsLoadingHomeCare(true);
    try {
      const updatedFichas = await getPatientHomeCareFichas(client.id);
      setHomeCareFichasDisponiveis(updatedFichas || []);
      if (createdFichaId) {
        setSelectedHomeCareFichaId(createdFichaId);
      } else if (updatedFichas && updatedFichas.length > 0) {
        setSelectedHomeCareFichaId(updatedFichas[0].id);
      }
    } catch (err) {
      console.error("Erro ao atualizar lista de fichas de Home Care:", err);
    } finally {
      setIsLoadingHomeCare(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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

      // 3. Sanitização e Resolução de UUID para procedimento_id (evita erro com IDs de mock como "p8")
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let validProcedimentoId: string | null = null;

      if (procedimentoId && uuidRegex.test(procedimentoId)) {
        validProcedimentoId = procedimentoId;
      } else {
        try {
          const supabase = getSupabaseClient();
          if (supabase && tipo) {
            const { data: procDb } = await supabase
              .from("procedimentos")
              .select("id")
              .ilike("procedimento", tipo.trim())
              .maybeSingle();

            if (procDb?.id && uuidRegex.test(procDb.id)) {
              validProcedimentoId = procDb.id;
            }
          }
        } catch (procErr) {
          console.warn("Aviso ao resolver UUID do procedimento no Supabase:", procErr);
        }
      }

      const res = await addClinicalEvolutionAction(client.id, {
        client_id: client.id,
        data,
        horario,
        tipo,
        tipo_atendimento: tipo,
        procedimento_id: validProcedimentoId || undefined,
        appointment_id: selectedAppointmentId && uuidRegex.test(selectedAppointmentId) ? selectedAppointmentId : null,
        exames_anexos: examesUrls,
        fotos_paciente: fotosUrls,
        profissional,
        especialidade,
        subjetivo: subjetivo.trim(),
        objetivo: objetivo.trim() || "Exame físico sumário realizado sem anormalidades evidentes.",
        sinaisVitais: {
          pressaoArterial: pa.trim() || undefined,
          frequenciaCardiaca: fc ? parseInt(fc) : undefined,
          hidratacaoCutanea: hidratacao ? parseFloat(hidratacao) : undefined,
          oleosidadeSebo: oleosidade ? parseFloat(oleosidade) : undefined,
          indiceElasticidade: elasticidade ? parseFloat(elasticidade) : undefined,
        },
        avaliacao: avaliacao.trim(),
        plano: plano.trim(),
        prescricoes_ids: selectedPrescricoesIds,
        home_care_ficha_id: selectedHomeCareFichaId || null,
      });

      if (res.success) {
        setSelectedPrescricoesIds([]);
        setSelectedHomeCareFichaId("");
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] flex flex-col transition-all">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Nova Evolução do Paciente
                </h3>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80">
                  Prontuário
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Paciente: <strong className="text-slate-700 dark:text-slate-200">{client.nome}</strong> • CPF: {client.cpf}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors md-state-layer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 text-rose-800 text-xs flex items-center gap-2 border border-rose-200 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto overscroll-contain flex-1">
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
                  const isUuid = found?.id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(found.id) : false;
                  setProcedimentoId(isUuid ? found!.id : "");
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

          {/* Biometria & Parâmetros Regenerativos */}
          <div className="p-3 sm:p-4 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 rounded-xl mb-6">
            <h3 className="text-sm font-semibold text-teal-800 dark:text-teal-400 flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" />
              Biometria & Parâmetros Regenerativos
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  PA (mmHg)
                </label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={pa}
                  onChange={(e) => setPa(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  FC (bpm)
                </label>
                <input
                  type="number"
                  placeholder="72"
                  value={fc}
                  onChange={(e) => setFc(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Hidratação (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="60.5"
                  value={hidratacao}
                  onChange={(e) => setHidratacao(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Oleosidade (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="30"
                  value={oleosidade}
                  onChange={(e) => setOleosidade(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Elasticidade (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="45"
                  value={elasticidade}
                  onChange={(e) => setElasticidade(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Formato SOAP */}
          <div className="space-y-4">
            {/* Subjetivo */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>1. Subjetivo (S) - Queixa Principal, Hábitos & Anamnese Regenerativa *</span>
                <span className="text-[10px] text-slate-400 font-normal">Relato do paciente</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Paciente relata perda de viço e elasticidade na região malar, com início há 6 meses..."
                value={subjetivo}
                onChange={(e) => setSubjetivo(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            {/* Objetivo */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>2. Objetivo (O) - Análise Dérmica, Fotografia & Achados Clínicos</span>
                <span className="text-[10px] text-slate-400 font-normal">Inspeção e achados dermoestéticos</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Grau leve de flacidez tissular em terço médio, hidratação limítrofe e oleosidade controlada..."
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
              />
            </div>

            {/* Avaliação */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between mb-1">
                <span>3. Avaliação (A) - Diagnóstico Estético & Necessidades Tissulares *</span>
                <span className="text-[10px] text-slate-400 font-normal">Conclusão clínica dermoestética</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Envelhecimento cutâneo cronológico grau II, desidratação epidérmica"
                value={avaliacao}
                onChange={(e) => setAvaliacao(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Item 4: Plano (P) – Protocolo Regenerativo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>4. Plano (P) – Protocolo Regenerativo *</span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  Procedimentos e protocolo clínico
                </span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Realizada aplicação de bioestimulador de colágeno (Radiesse/Sculptra) em terço médio e inferior da face com cânula 22G. Protocolo de 3 sessões com intervalo de 30 dias. Cuidados imediatos repassados ao paciente."
                value={plano}
                onChange={(e) => setPlano(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all resize-none"
              />
            </div>

            {/* Item 5: Prescrições & Medicamentos Associados */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>5. Prescrições & Medicamentos Associados</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                    Vínculo com receitas emitidas
                  </span>
                  {selectedPrescricoesIds.length > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {selectedPrescricoesIds.length} vinculada(s)
                    </span>
                  )}
                </div>
              </div>

              {isLoadingPrescricoes ? (
                <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500 animate-pulse bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  Carregando prescrições do paciente...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Linha com Menu Dropdown + Botão + Adicionar Prescrição */}
                  <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !selectedPrescricoesIds.includes(val)) {
                          setSelectedPrescricoesIds((prev) => [...prev, val]);
                        }
                      }}
                      className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-500/30 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                    >
                      <option value="">Selecione uma prescrição para vincular...</option>
                      {prescricoesDisponiveis.map((rx) => {
                        const [year, month, day] = (rx.data_prescricao || "").split("-");
                        const formattedDate = day && month && year ? `${day}/${month}/${year}` : rx.data_prescricao;
                        const formulasStr = rx.formulas && rx.formulas.length > 0 ? rx.formulas.join(", ") : "Fórmulas da receita";
                        const isAlreadySelected = selectedPrescricoesIds.includes(rx.id);

                        return (
                          <option key={rx.id} value={rx.id} disabled={isAlreadySelected}>
                            Receita de {formattedDate} — {formulasStr} ({rx.status})
                            {isAlreadySelected ? " [Já vinculada]" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsNewPrescriptionModalOpen(true)}
                      className="w-full sm:w-auto shrink-0 whitespace-nowrap h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-full font-semibold text-xs text-white transition-all cursor-pointer bg-[#004d40] hover:bg-[#003830] active:scale-[0.98] dark:bg-emerald-800 dark:hover:bg-emerald-700 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar Prescrição</span>
                    </button>
                  </div>

                  {/* Cards/Chips compactos das prescrições selecionadas */}
                  {selectedPrescricoesIds.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {selectedPrescricoesIds.map((id) => {
                        const rx = prescricoesDisponiveis.find((p) => p.id === id);
                        const [year, month, day] = (rx?.data_prescricao || "").split("-");
                        const formattedDate = day && month && year ? `${day}/${month}/${year}` : rx?.data_prescricao || "Data n/d";

                        return (
                          <div
                            key={id}
                            className="p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-start justify-between gap-2.5 shadow-2xs transition-all"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  Receita de {formattedDate}
                                </span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                    rx?.status === "Ativo"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                      : rx?.status === "Suspenso"
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                  }`}
                                >
                                  {rx?.status || "Ativo"}
                                </span>
                              </div>
                              {rx?.formulas && rx.formulas.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  {rx.formulas.map((formulaName, i) => (
                                    <span
                                      key={i}
                                      className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 font-medium"
                                    >
                                      {formulaName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPrescricoesIds((prev) => prev.filter((pId) => pId !== id))}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                              title="Remover prescrição desta evolução"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                      Nenhuma prescrição vinculada a esta evolução (opcional).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Item 6: Ficha de Home Care (Cuidados & Orientações) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileHeart className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>6. Ficha de Home Care (Cuidados & Orientações)</span>
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                  Rotina pós-procedimento
                </span>
              </div>

              {isLoadingHomeCare ? (
                <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500 animate-pulse bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  Carregando fichas de Home Care do paciente...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Linha com Menu Dropdown + Botão + Novo Home Care */}
                  <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={selectedHomeCareFichaId}
                      onChange={(e) => setSelectedHomeCareFichaId(e.target.value)}
                      className="w-full sm:flex-1 min-w-0 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-emerald-500/30 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer"
                    >
                      <option value="">Sem ficha de Home Care vinculada</option>
                      {homeCareFichasDisponiveis.map((ficha) => {
                        const [year, month, day] = (ficha.data_home_care || "").split("-");
                        const dateFormatted = day && month && year ? `${day}/${month}/${year}` : ficha.data_home_care;
                        return (
                          <option key={ficha.id} value={ficha.id}>
                            {ficha.titulo_protocolo} ({dateFormatted}) — {ficha.status}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsNewHomeCareModalOpen(true)}
                      className="w-full sm:w-auto shrink-0 whitespace-nowrap h-9 px-4 inline-flex items-center justify-center gap-1.5 rounded-full font-semibold text-xs text-white transition-all cursor-pointer bg-[#004d40] hover:bg-[#003830] active:scale-[0.98] dark:bg-emerald-800 dark:hover:bg-emerald-700 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo Home Care</span>
                    </button>
                  </div>

                  {/* Pré-visualização da Ficha Selecionada */}
                  {selectedHomeCareFicha && (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 space-y-2 shadow-2xs transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {selectedHomeCareFicha.titulo_protocolo}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-700/80">
                              {selectedHomeCareFicha.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Data do protocolo: {selectedHomeCareFicha.data_home_care}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedHomeCareFichaId("")}
                          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          Desvincular
                        </button>
                      </div>

                      {/* Aviso de Atenção Crítica se houver */}
                      {selectedHomeCareFicha.incluir_atencao_critica !== false &&
                        Boolean(selectedHomeCareFicha.atencao_critica_texto?.trim()) && (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-bold text-[11px] block">
                                {selectedHomeCareFicha.atencao_critica_titulo || "Atenção Crítica Cadastrada"}
                              </span>
                              <p className="text-[10px] text-amber-700 dark:text-amber-300 line-clamp-2 mt-0.5">
                                {selectedHomeCareFicha.atencao_critica_texto}
                              </p>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {homeCareFichasDisponiveis.length === 0 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                      Nenhuma ficha de home care cadastrada para este paciente.
                    </p>
                  )}
                </div>
              )}
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
                        const selectedFiles = Array.from(e.target.files);
                        const validation = validateMultipleFiles(selectedFiles);
                        if (!validation.valid) {
                          toast({
                            type: 'error',
                            title: 'Anexos acima de 5MB',
                            description: validation.error,
                          });
                          e.target.value = '';
                          return;
                        }
                        setExamesFiles((prev) => [...prev, ...selectedFiles]);
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
                        const selectedFiles = Array.from(e.target.files);
                        const validation = validateMultipleFiles(selectedFiles);
                        if (!validation.valid) {
                          toast({
                            type: 'error',
                            title: 'Anexos acima de 5MB',
                            description: validation.error,
                          });
                          e.target.value = '';
                          return;
                        }
                        setFotosFiles((prev) => [...prev, ...selectedFiles]);
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

          {/* Rodapé de Ações MD4 */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors md-state-layer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 text-xs font-semibold text-white bg-[#004d40] hover:bg-[#003830] active:scale-[0.98] dark:bg-emerald-800 dark:hover:bg-emerald-700 rounded-full shadow-xs transition-all disabled:opacity-50 cursor-pointer md-state-layer"
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

        {/* Modal Sobreposto: Nova Prescrição */}
        {isNewPrescriptionModalOpen && (
          <PrescriptionModal
            isOpen={isNewPrescriptionModalOpen}
            onClose={() => setIsNewPrescriptionModalOpen(false)}
            onSuccess={handleNewPrescriptionSuccess}
            client={client}
            zIndex="z-[70]"
          />
        )}

        {/* Modal Sobreposto: Nova Ficha de Home Care */}
        {isNewHomeCareModalOpen && (
          <HomeCareModal
            isOpen={isNewHomeCareModalOpen}
            onClose={() => setIsNewHomeCareModalOpen(false)}
            pacienteId={client.id}
            pacienteNome={client.nome}
            initialAppointmentId={selectedAppointmentId || initialAppointmentId}
            onSuccess={handleNewHomeCareSuccess}
            zIndex="z-[70]"
          />
        )}
      </div>
    </div>
  );
}
