"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  FileHeart,
  Activity,
  Pill,
  Gauge,
  Plus,
  Edit2,
  Pencil,
  Calendar,
  Clock,
  User,
  ShieldAlert,
  Heart,
  Scale,
  Thermometer,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Stethoscope,
  FileText,
  BadgeAlert,
  Sparkles,
  Image as ImageIcon,
  Printer,
  X,
  FileCheck,
  ExternalLink,
  UploadCloud,
  Download,
} from "lucide-react";
import {
  getPatientClinicalRecordAction,
  togglePrescriptionStatusAction,
  getAestheticEvaluationAction,
} from "@/actions/clinical-actions";
import { getSupabaseClient } from "@/lib/supabase/client";
import { validateFileSize } from "@/lib/validations/file-upload";
import { EvolutionFormModal } from "./evolution-form-modal";
import { MedicalHistoryModal } from "./medical-history-modal";
import { PrescriptionModal } from "./prescription-modal";
import { PrintPrescriptionModal } from "./print-prescription-modal";
import { AestheticEvaluationModal } from "./aesthetic-evaluation-modal";
import { HomeCareCards } from "./home-care-cards";
import { HomeCareModal } from "./home-care-modal";
import { getPatientHomeCareFichas } from "@/app/actions/home-care";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import { useToast } from "@/components/ui/toast";
import type { Client } from "@/types/client";
import type {
  PatientClinicalRecord,
  ClinicalEvolution,
  PrescriptionItem,
} from "@/types/clinical-record";

interface PatientClinicalTabsProps {
  client: Client;
  onRefreshClient?: () => void;
  isPatientView?: boolean;
}

export type ClinicalSubTab = "historico" | "evolucoes" | "prescricoes" | "metricas";

export function PatientClinicalTabs({ client, onRefreshClient, isPatientView = false }: PatientClinicalTabsProps) {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<ClinicalSubTab>(
    isPatientView ? "prescricoes" : "evolucoes"
  );
  const [isPending, startTransition] = useTransition();

  const [clinicalRecord, setClinicalRecord] = useState<PatientClinicalRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modais e Lightbox
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [selectedRxForPrint, setSelectedRxForPrint] = useState<PrescriptionItem | null>(null);
  const [signingRx, setSigningRx] = useState<PrescriptionItem | null>(null);
  const [isUploadingSignedPdf, setIsUploadingSignedPdf] = useState(false);

  // Modal de suspensão de receita
  const [isSuspensionModalOpen, setIsSuspensionModalOpen] = useState(false);
  const [justificativaTexto, setJustificativaTexto] = useState("");
  const [selectedRxForSuspension, setSelectedRxForSuspension] = useState<string | null>(null);
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false);

  // Avaliação Estética Integrada
  const [isAestheticModalOpen, setIsAestheticModalOpen] = useState(false);
  const [aestheticData, setAestheticData] = useState<{ facial: any; corporal: any } | null>(null);

  // Fichas de Home Care (Cuidados & Orientações)
  const [homeCareFichas, setHomeCareFichas] = useState<HomeCareFichaCompleta[]>([]);
  const [isHomeCareModalOpen, setIsHomeCareModalOpen] = useState(false);
  const [selectedHomeCareForEdit, setSelectedHomeCareForEdit] = useState<HomeCareFichaCompleta | null>(null);

  // --- Assinatura digital (VIDaaS) ---------------------------------------
  const [signError, setSignError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [isDraggingSigned, setIsDraggingSigned] = useState(false);
  const [signedNotificationPrompt, setSignedNotificationPrompt] = useState<{
    isOpen: boolean;
    rxId: string;
    formulaName: string;
    pdfUrl: string;
  } | null>(null);

  const openSigningModal = (rx: PrescriptionItem) => {
    setSignError(null);
    setPdfDownloaded(false);
    setIsDraggingSigned(false);
    setSignedNotificationPrompt(null);
    setSigningRx(rx);
  };

  const closeSigningModal = () => {
    if (isUploadingSignedPdf) return;
    setSigningRx(null);
    setSignError(null);
    setPdfDownloaded(false);
    setIsDraggingSigned(false);
    setSignedNotificationPrompt(null);
  };

  // Dispara e-mail em 2º plano e abre o WhatsApp do paciente
  const handleNotifyPatientAfterSigning = (promptData: {
    rxId: string;
    formulaName: string;
    pdfUrl: string;
  }) => {
    const selectedPatient = client;
    const patientName = selectedPatient?.nome || (selectedPatient as any)?.name || "Paciente";
    const patientEmail = selectedPatient?.email || "";
    const rawPhone = (selectedPatient?.telefone || (selectedPatient as any)?.phone || "").replace(/\D/g, "");

    // 1. Dispara o e-mail com o PDF assinado em segundo plano (sem bloquear a UI)
    if (patientEmail) {
      fetch("/api/prescricoes/notify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientEmail,
          formulaName: promptData.formulaName,
          pdfUrl: promptData.pdfUrl,
        }),
      })
        .then((res) => {
          if (res.ok) {
            toast({
              type: "success",
              title: "E-mail enviado",
              description: `O PDF assinado foi enviado em segundo plano para ${patientEmail}.`,
            });
          }
        })
        .catch((err) => {
          console.warn("Falha no envio de e-mail em segundo plano:", err);
        });
    } else {
      toast({
        type: "warning",
        title: "Paciente sem e-mail",
        description: "Não foi possível enviar o e-mail pois o paciente não possui endereço cadastrado.",
      });
    }

    // 2. Abre o WhatsApp do Paciente com a mensagem de disponibilidade no site
    if (rawPhone) {
      const phoneWithDdi = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;
      const portalUrl = typeof window !== "undefined" ? window.location.origin : "";
      const firstName = patientName.trim().split(/\s+/)[0];

      const whatsappMessage = [
        `Olá, *${firstName}*! Tudo bem? ✨`,
        ``,
        `Sua prescrição *${promptData.formulaName}* já foi assinada digitalmente pela *Dra. Juliana Sena* e está disponível para acesso e download no seu *Portal do Paciente*:`,
        `🔗 ${portalUrl}`,
        ``,
        patientEmail
          ? `📩 Também enviamos uma cópia da receita em PDF diretamente para o seu e-mail (${patientEmail}).`
          : ``,
        ``,
        `Qualquer dúvida, estamos à disposição!`,
      ]
        .filter(Boolean)
        .join("\n");

      const waUrl = `https://wa.me/${phoneWithDdi}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    } else {
      toast({
        type: "warning",
        title: "Telefone não cadastrado",
        description: "O paciente não possui telefone válido para abertura do WhatsApp.",
      });
    }

    // Fecha os modais
    setSignedNotificationPrompt(null);
    setSigningRx(null);
    setPdfDownloaded(false);
    setIsDraggingSigned(false);
  };

  // Baixa o PDF gerado no servidor (o mesmo arquivo que será assinado e conferido no envio)
  const handleDownloadPrescriptionPdf = async (rx: PrescriptionItem) => {
    setSignError(null);
    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/prescricoes/${rx.id}/pdf`, { credentials: "same-origin" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Não foi possível gerar o PDF da receita.");
      }
      const fileName =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `Receita_${rx.id}.pdf`;
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setPdfDownloaded(true);
    } catch (err: any) {
      setSignError(err?.message || "Não foi possível gerar o PDF da receita.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Envia o PDF assinado: o servidor confere assinatura + receita e só então vincula ao prontuário
  const handleSignedFile = async (file?: File | null) => {
    if (!file || !signingRx) return;
    setSignError(null);
    const check = validateFileSize(file);
    if (!check.valid) {
      const errMsg = check.error || "O arquivo do PDF assinado não pode exceder 5MB.";
      setSignError(errMsg);
      toast({
        type: 'error',
        title: 'Arquivo excede 5MB',
        description: errMsg,
      });
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSignError("Selecione um arquivo em formato PDF.");
      return;
    }
    setIsUploadingSignedPdf(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/prescricoes/${signingRx.id}/assinado`, {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setSignError(data?.message || "Não foi possível anexar a receita assinada.");
        return;
      }
      const warnings: string[] = data.warnings || [];
      toast({
        type: warnings.length > 0 ? "warning" : "success",
        title: "Receita assinada registrada!",
        description: warnings.length > 0 ? warnings[0] : "O documento assinado com ICP-Brasil foi vinculado ao prontuário.",
      });
      
      const uploadedPdfUrl = data.pdf_assinado_url || data.url || signingRx.pdf_assinado_url || `/api/prescricoes/${signingRx.id}/pdf`;
      loadClinicalData();

      // Em vez de fechar imediatamente o modal, abre a confirmação para comunicar o paciente:
      setSignedNotificationPrompt({
        isOpen: true,
        rxId: signingRx.id,
        formulaName: signingRx.medicamento || (signingRx as any).nome_formula || "Prescrição Magistral",
        pdfUrl: uploadedPdfUrl,
      });
    } catch {
      setSignError("Falha de conexão ao enviar o arquivo. Tente novamente.");
    } finally {
      setIsUploadingSignedPdf(false);
    }
  };

  const openVidaasStore = () => {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) {
      window.open("https://play.google.com/store/apps/details?id=br.com.valid.vidaas", "_blank");
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      window.open("https://apps.apple.com/br/app/vidaas/id1458896089", "_blank");
    }
  };

  // Carrega prontuário do paciente
  const loadClinicalData = useCallback(() => {
    const isValidUUID = (id?: string | null) => 
      typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (!isValidUUID(client?.id)) {
      setClinicalRecord(null);
      setIsLoading(false);
      return;
    }

    startTransition(async () => {
      try {
        setIsLoading(true);
        const res = await getPatientClinicalRecordAction(client.id);
        if (res.success && res.data) {
          const record = { ...res.data };
          try {
            const supabase = getSupabaseClient();
            if (supabase) {
              const { data: dbPrescs, error: dbErr } = await supabase
                .from("prescricoes")
                .select(`
                  id,
                  paciente_id,
                  data_prescricao,
                  status,
                  justificativa_suspensao,
                  data_suspensao,
                  pdf_assinado_url,
                  data_assinatura,
                  prescricao_itens (
                    id,
                    nome_formula,
                    via,
                    veiculo,
                    dosagem,
                    tipo_veiculo,
                    posologia,
                    duracao,
                    orient_paciente,
                    orient_farmacia,
                    componentes_snapshot
                  )
                `)
                .eq("paciente_id", client.id);

              if (dbPrescs && !dbErr) {
                const mappedPrescriptions: PrescriptionItem[] = dbPrescs.map((p: any) => {
                  const item = p.prescricao_itens && p.prescricao_itens[0];
                  const componentsList = item?.componentes_snapshot || [];
                  
                  // Reconstrução da dosagem formatada
                  const listAtivos = Array.isArray(componentsList)
                    ? componentsList.map((c: any) => `${c.nome}: ${c.quantidade}${c.unidade || ""}`).join(" + ")
                    : "";
                  
                  const formattedDosagem = item?.via?.toLowerCase() === "oral"
                    ? `${listAtivos} em ${item?.veiculo} (Dose: ${item?.dosagem} | Total: ${item?.duracao} ${item?.tipo_veiculo})`
                    : `${listAtivos} em ${item?.veiculo} q.s.p. ${item?.dosagem}g (Total: ${item?.duracao}${item?.tipo_veiculo || "un"})`;

                  const combinedInstrucoes = [
                    item?.orient_paciente ? `[Orientações ao Paciente]\n${item.orient_paciente}` : "",
                    item?.orient_farmacia ? `[Observações à Farmácia Magistral]\n${item.orient_farmacia}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n\n");

                  return {
                    id: p.id,
                    client_id: p.paciente_id,
                    data: p.data_prescricao,
                    medicamento: item?.nome_formula || "Fórmula Magistral",
                    dosagem: formattedDosagem || item?.dosagem || "",
                    via: item?.via === "oral" ? "Oral" : "Tópico",
                    posologia: item?.posologia || "",
                    duracao: item?.via === "oral" ? `${item?.duracao} ${item?.tipo_veiculo}` : "Uso recomendado",
                    ativo: p.status === "Ativo",
                    instrucoes: combinedInstrucoes || undefined,
                    status: p.status,
                    justificativa_suspensao: p.justificativa_suspensao,
                    data_suspensao: p.data_suspensao,
                    pdf_assinado_url: p.pdf_assinado_url ?? null,
                    data_assinatura: p.data_assinatura ?? null,
                  };
                });

                record.prescriptions = mappedPrescriptions;
              }
            }
          } catch (err) {
            console.warn("Erro ao buscar prescrições do Supabase:", err);
          }

          // Busca avaliação estética
          try {
            const aesRes = await getAestheticEvaluationAction(client.id);
            if (aesRes.success && aesRes.data) {
              setAestheticData(aesRes.data);
            }
          } catch (aesErr) {
            console.warn("Erro ao buscar avaliações estéticas:", aesErr);
          }

          // Busca Fichas de Home Care (Cuidados & Orientações)
          try {
            const hcareRes = await getPatientHomeCareFichas(client.id);
            setHomeCareFichas(hcareRes || []);
          } catch (hcareErr) {
            console.warn("Erro ao buscar fichas de Home Care:", hcareErr);
          }

          setClinicalRecord(record);
        } else {
          toast({
            type: "error",
            title: "Erro ao carregar prontuário",
            description: res.message,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    });
  }, [client?.id, toast]);

  useEffect(() => {
    loadClinicalData();
  }, [loadClinicalData]);

  // Função para suspender receita com persistência real
  const handleConfirmSuspension = async () => {
    if (!selectedRxForSuspension || !justificativaTexto.trim()) return;

    try {
      setIsSubmittingSuspension(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        toast({
          type: "error",
          title: "Erro de conexão",
          description: "Não foi possível conectar ao Supabase.",
        });
        return;
      }

      const { error } = await supabase
        .from("prescricoes")
        .update({
          status: "Suspenso",
          justificativa_suspensao: justificativaTexto.trim(),
          data_suspensao: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedRxForSuspension);

      if (error) {
        toast({
          type: "error",
          title: "Erro ao suspender receita",
          description: error.message,
        });
      } else {
        toast({
          type: "success",
          title: "Receita suspensa",
          description: "A receita foi suspensa com sucesso.",
        });
        setIsSuspensionModalOpen(false);
        setJustificativaTexto("");
        setSelectedRxForSuspension(null);
        
        // Atualização otimista no estado local
        if (clinicalRecord) {
          const updatedPrescriptions = clinicalRecord.prescriptions.map((rx) => {
            if (rx.id === selectedRxForSuspension) {
              return {
                ...rx,
                ativo: false,
                status: "Suspenso" as const,
                justificativa_suspensao: justificativaTexto.trim(),
                data_suspensao: new Date().toISOString(),
              };
            }
            return rx;
          });
          setClinicalRecord({
            ...clinicalRecord,
            prescriptions: updatedPrescriptions,
          });
        }

        loadClinicalData();
      }
    } catch (err: any) {
      toast({
        type: "error",
        title: "Erro inesperado",
        description: err.message || "Ocorreu um erro ao suspender a receita.",
      });
    } finally {
      setIsSubmittingSuspension(false);
    }
  };

  // Alterna status de prescrição (legado/fallback)
  const handleTogglePrescription = async (prescriptionId: string) => {
    try {
      const res = await togglePrescriptionStatusAction(client.id, prescriptionId);
      if (res.success) {
        toast({
          type: "success",
          title: "Status atualizado",
          description: res.message,
        });
        loadClinicalData();
      }
    } catch (err) {
      toast({
        type: "error",
        title: "Erro",
        description: "Não foi possível alterar a prescrição.",
      });
    }
  };

  const history = clinicalRecord?.medicalHistory;
  const evolutions = clinicalRecord?.evolutions || [];
  const prescriptions = clinicalRecord?.prescriptions || [];

  return (
    <div className={isPatientView ? "space-y-6" : "bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200"}>
      {/* Barra de Navegação Interna das Abas Clínicas (Apenas para Administrador / Profissional) */}
      {!isPatientView && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 gap-3">
          {/* Abas MD4 Segmented */}
          <div className="flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-full border border-slate-200/80 dark:border-slate-700/80 text-xs overflow-x-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveSubTab("evolucoes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap md-state-layer ${
                activeSubTab === "evolucoes"
                  ? "bg-[#0d6e64] dark:bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Evoluções & Consultas</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeSubTab === "evolucoes"
                  ? "bg-white/20 text-white"
                  : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60"
              }`}>
                {evolutions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("historico")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap md-state-layer ${
                activeSubTab === "historico"
                  ? "bg-[#0d6e64] dark:bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <FileHeart className="w-3.5 h-3.5" />
              <span>Histórico & Anamnese</span>
              {history?.alergias && history.alergias.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  Alergias
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("prescricoes")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap md-state-layer ${
                activeSubTab === "prescricoes"
                  ? "bg-[#0d6e64] dark:bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Prescrições</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                activeSubTab === "prescricoes"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>
                {prescriptions.filter((p) => p.ativo).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("metricas")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap md-state-layer ${
                activeSubTab === "metricas"
                  ? "bg-[#0d6e64] dark:bg-teal-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Sinais Vitais & Biometria</span>
            </button>
          </div>

          {/* Botão de Ação Primária Contextual MD4 */}
          <div className="flex items-center gap-2 shrink-0">
            {activeSubTab === "evolucoes" && (
              <button
                type="button"
                onClick={() => setIsEvolutionModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs transition-all cursor-pointer md-state-layer active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Nova Evolução Clínica</span>
              </button>
            )}

            {activeSubTab === "historico" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAestheticModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-teal-700/30 dark:border-teal-500/40 text-[#0d6e64] dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 text-xs font-semibold transition-all shadow-2xs cursor-pointer md-state-layer active:scale-[0.98]"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Avaliação Estética</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-teal-700/30 dark:border-teal-500/40 text-[#0d6e64] dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 text-xs font-semibold transition-all shadow-2xs cursor-pointer md-state-layer active:scale-[0.98]"
                >
                  <Pencil className="w-3.5 h-3.5 shrink-0" />
                  <span>Editar Histórico Clínico</span>
                </button>
              </div>
            )}

            {activeSubTab === "prescricoes" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedHomeCareForEdit(null);
                    setIsHomeCareModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border border-teal-700/30 dark:border-teal-500/40 text-[#0d6e64] dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 transition-all cursor-pointer shadow-2xs md-state-layer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Cuidados & Orientações</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrescriptionModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full shadow-xs transition-all cursor-pointer md-state-layer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Prescrever Receita</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo das Abas */}
      <div className={isPatientView ? "p-0" : "p-6"}>
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Carregando prontuário médico de {client.nome}...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ======================================================== */}
            {/* ABA 1: EVOLUÇÕES CLÍNICAS (SOAP) */}
            {/* ======================================================== */}
            {activeSubTab === "evolucoes" && (
              <div className="space-y-5">
                {evolutions.length === 0 ? (
                  <div className="py-12 text-center max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Nenhuma evolução registrada
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Inicie o prontuário deste paciente adicionando a primeira consulta ou evolução no padrão SOAP.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEvolutionModalOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full transition-all cursor-pointer shadow-xs md-state-layer active:scale-[0.98]"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span>Adicionar Primeira Evolução</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 sm:ml-4 pl-4 sm:pl-6 space-y-6">
                    {evolutions.map((evo) => {
                      const [year, month, day] = evo.data.split("-");
                      const dateFormatted = `${day}/${month}/${year}`;

                      return (
                        <div
                          key={evo.id}
                          className="relative group bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-2xs hover:shadow-xs transition-all"
                        >
                          {/* Marcador na Timeline */}
                          <div className="absolute -left-[27px] sm:-left-[35px] top-6 w-5 h-5 rounded-full bg-teal-600 border-4 border-white dark:border-slate-900 text-white flex items-center justify-center shadow-xs" />

                          {/* Topo do Cartão de Evolução */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60 gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {dateFormatted} às {evo.horario}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  evo.tipo === "Consulta"
                                    ? "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                                    : evo.tipo === "Retorno"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                    : evo.tipo === "Urgência"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                    : "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200"
                                }`}
                              >
                                {evo.tipo}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <User className="w-3.5 h-3.5 text-teal-600" />
                              <span className="font-medium">{evo.profissional}</span>
                              <span>•</span>
                              <span>{evo.especialidade}</span>
                            </div>
                          </div>

                          {/* Faixa de Sinais Vitais se houver */}
                          {evo.sinaisVitais && (
                            <div className="my-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-4 text-xs">
                              {evo.sinaisVitais.pressaoArterial && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="text-slate-500">PA:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.pressaoArterial} mmHg
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.frequenciaCardiaca && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                                  <span className="text-slate-500">FC:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.frequenciaCardiaca} bpm
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.temperatura && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                  <span className="text-slate-500">Tax:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.temperatura} °C
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.peso && (
                                <div className="flex items-center gap-1 font-mono">
                                  <Scale className="w-3.5 h-3.5 text-sky-500" />
                                  <span className="text-slate-500">Peso:</span>
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {evo.sinaisVitais.peso} kg
                                  </strong>
                                </div>
                              )}

                              {evo.sinaisVitais.imc && (
                                <div className="flex items-center gap-1 font-mono">
                                  <span className="text-slate-500">IMC:</span>
                                  <strong className="text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 rounded border border-teal-200/50">
                                    {evo.sinaisVitais.imc} kg/m²
                                  </strong>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Estrutura SOAP em 4 Blocos */}
                          <div className="space-y-3 pt-2 text-xs">
                            {/* S */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wide text-[10px] bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded border border-teal-200/60">
                                S • Subjetivo
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.subjetivo}
                              </p>
                            </div>

                            {/* O */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wide text-[10px] bg-sky-50 dark:bg-sky-950/80 px-2 py-0.5 rounded border border-sky-200/60">
                                O • Objetivo
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.objetivo}
                              </p>
                            </div>

                            {/* A */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide text-[10px] bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-200/60">
                                A • Avaliação / Diagnóstico
                              </span>
                              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                                {evo.avaliacao}
                              </p>
                            </div>

                            {/* 4. Plano (P) • Protocolo Regenerativo */}
                            <div>
                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide text-[10px] bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200/60">
                                4. Plano (P) • Protocolo Regenerativo
                              </span>
                              <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {evo.plano}
                              </p>
                            </div>

                            {/* 5. Prescrições & Medicamentos Associados */}
                            {((evo.prescricoes_detalhes && evo.prescricoes_detalhes.length > 0) ||
                              (evo.prescricoes_ids && evo.prescricoes_ids.length > 0)) && (
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Pill className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-[10px]">
                                    5. Prescrições & Medicamentos Associados
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {evo.prescricoes_detalhes && evo.prescricoes_detalhes.length > 0 ? (
                                    evo.prescricoes_detalhes.map((rx) => {
                                      const [y, m, d] = (rx.data_prescricao || "").split("-");
                                      const rxDate = d && m && y ? `${d}/${m}/${y}` : rx.data_prescricao;
                                      return (
                                        <div
                                          key={rx.id}
                                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                                        >
                                          <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                                              Receita de {rxDate}
                                            </span>
                                            <span
                                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                                rx.status === "Ativo"
                                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                              }`}
                                            >
                                              {rx.status}
                                            </span>
                                          </div>
                                          {rx.formulas && rx.formulas.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {rx.formulas.map((f, i) => (
                                                <span
                                                  key={i}
                                                  className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 font-medium"
                                                >
                                                  {f}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {evo.prescricoes_ids?.length} receita(s) vinculada(s)
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 6. Ficha de Home Care Vinculada */}
                            {Boolean(evo.home_care_ficha || evo.home_care_ficha_id) && (() => {
                              const ficha =
                                evo.home_care_ficha ||
                                homeCareFichas.find((f) => f.id === evo.home_care_ficha_id);
                              if (!ficha) return null;
                              const [y, m, d] = (ficha.data_home_care || "").split("-");
                              const hcDate = d && m && y ? `${d}/${m}/${y}` : ficha.data_home_care;

                              return (
                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <FileHeart className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-[10px]">
                                      6. Ficha de Home Care (Cuidados & Orientações)
                                    </span>
                                  </div>
                                  <div className="p-3 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/70 dark:border-teal-800/70 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-xs text-slate-900 dark:text-white">
                                        {ficha.titulo_protocolo}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-700">
                                        {ficha.status || "Ativo"}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      Início do protocolo: {hcDate}
                                    </p>
                                    {ficha.incluir_atencao_critica !== false &&
                                      Boolean(ficha.atencao_critica_texto?.trim()) && (
                                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                          <div className="min-w-0">
                                            <span className="font-bold text-[11px] block">
                                              {ficha.atencao_critica_titulo || "Atenção Crítica Cadastrada"}
                                            </span>
                                            <p className="text-[10px] text-amber-700 dark:text-amber-300 line-clamp-2 mt-0.5">
                                              {ficha.atencao_critica_texto}
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 2: HISTÓRICO CLÍNICO & ANAMNESE */}
            {/* ======================================================== */}
            {activeSubTab === "historico" && (
              <div className="space-y-6">
                {/* Alerta de Alergias */}
                <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                        Alergias e Advertências
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="text-xs text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Editar
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {history?.alergias && history.alergias.length > 0 ? (
                      history.alergias.map((al, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-rose-800 dark:text-rose-300 border border-rose-200 shadow-2xs"
                        >
                          <BadgeAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>{al}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 italic">
                        Nenhuma alergia conhecida ou declarada.
                      </span>
                    )}
                  </div>
                </div>

                {/* Comorbidades & Medicamentos Contínuos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Comorbidades */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" />
                      <span>Comorbidades e Condições Crônicas</span>
                    </h4>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {history?.comorbidades && history.comorbidades.length > 0 ? (
                        history.comorbidades.map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Nenhuma comorbidade relatada no prontuário.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Medicamentos em Uso */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Pill className="w-4 h-4 text-teal-600" />
                      <span>Medicamentos de Uso Contínuo</span>
                    </h4>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {history?.medicamentosUsoContinuo &&
                      history.medicamentosUsoContinuo.length > 0 ? (
                        history.medicamentosUsoContinuo.map((m, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200"
                          >
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          Paciente não faz uso regular de medicamentos.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acompanhamento Médico (Especialidade) */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-teal-600" />
                    <span>Acompanhamento Médico</span>
                  </h4>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {history?.acompanhamentoMedico && history.acompanhamentoMedico.length > 0 ? (
                      history.acompanhamentoMedico.map((ac, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200"
                        >
                          {ac}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Nenhum acompanhamento médico relatado.
                      </span>
                    )}
                  </div>
                </div>

                {/* Tipo Sanguíneo & Hábitos de Vida */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Tipo Sanguíneo
                    </span>
                    <span className="text-base font-bold text-teal-700 dark:text-teal-400">
                      {history?.tipoSanguineo || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Tabagismo
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.tabagismo || "Não fuma"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Etilismo
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.etilismo || "Não consome"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Atividade Física
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.habitosVida?.atividadeFisica || "Sedentário"}
                    </span>
                  </div>
                </div>

                {/* Grade de Hábitos de Vida & Fatores de Risco Adicionais */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Isotretinoína (6m)
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${history?.isotretinoina6Meses ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                      {history?.isotretinoina6Meses ? "Sim" : "Não"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Implantes / Marcapasso
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {history?.implantesDispositivos && history.implantesDispositivos.length > 0 ? (
                        history.implantesDispositivos.map((imp, idx) => (
                          <span key={idx} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                            {imp}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Nenhum relatado</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Ingestão de Água
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.ingestaoAgua || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Qualidade do Sono
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.qualidadeSono || "Não informado"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                      Intestino
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {history?.funcionamentoIntestino || "Não informado"}
                    </span>
                  </div>
                </div>

                {/* Histórico Cirúrgico, Familiar e Lesões */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Histórico Cirúrgico
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {history?.historicoCirurgico || "Nenhuma cirurgia prévia registrada."}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Histórico Familiar & Antecedentes
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                      {history?.historicoFamiliar || "Sem histórico familiar relevante."}
                    </p>
                  </div>
                </div>

                {/* Lesões (Local, Tratamento e Frequência) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Lesões (Local, Tratamento e Frequência)
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {history?.lesoesDetalhes || "Nenhuma lesão relatada."}
                  </p>
                </div>

                {/* Observações Gerais */}
                {history?.observacoesGerais && (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Observações Gerais
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {history.observacoesGerais}
                    </p>
                  </div>
                )}

                {/* Fotos da Área a Ser Tratada */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-teal-600" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Fotos da Área a Ser Tratada
                    </span>
                  </div>
                  {history?.fotosAreaTratada && history.fotosAreaTratada.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {history.fotosAreaTratada.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 group">
                          <img
                            src={url}
                            alt={`Área tratada ${idx + 1}`}
                            className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform"
                            onClick={() => setLightboxUrl(url)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhuma foto anexada ao histórico.</p>
                  )}
                </div>

                {/* ========================================================
                    SEÇÃO: AVALIAÇÃO ESTÉTICA (FACIAL & CORPORAL)
                    ======================================================== */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Avaliação Estética Integrada
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAestheticModalOpen(true)}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline cursor-pointer font-medium"
                    >
                      Editar Avaliação
                    </button>
                  </div>

                  {/* Grade com 2 Cartões: Facial e Corporal */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Card Facial */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850/60 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-300">Avaliação Facial</span>
                        {aestheticData?.facial?.fototipo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200/60">
                            Fototipo {aestheticData.facial.fototipo}
                          </span>
                        )}
                      </div>

                      {aestheticData?.facial ? (
                        <div className="space-y-2 text-xs">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                              <span className="text-[10px] text-slate-400 block">Tipo de Pele / Textura</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {aestheticData.facial.tipo_pele || "—"} / {aestheticData.facial.textura || "—"}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                              <span className="text-[10px] text-slate-400 block">Hidratação / Oleosidade</span>
                              <span className="font-semibold text-teal-700 dark:text-teal-300">
                                {aestheticData.facial.hidratacao !== null && aestheticData.facial.hidratacao !== undefined ? `${aestheticData.facial.hidratacao}%` : "—"} / {aestheticData.facial.oleosidade !== null && aestheticData.facial.oleosidade !== undefined ? `${aestheticData.facial.oleosidade}%` : "—"}
                              </span>
                            </div>
                          </div>

                          {aestheticData.facial.escala_glogau && (
                            <div className="text-slate-600 dark:text-slate-300">
                              <span className="text-slate-400 mr-1">Escala Glogau:</span>
                              <span className="font-medium">{aestheticData.facial.escala_glogau}</span>
                            </div>
                          )}

                          {/* Tags de Alterações Dérmicas */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {aestheticData.facial.acne_grau && (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/80">
                                Acne: {aestheticData.facial.acne_grau}
                              </span>
                            )}
                            {Array.isArray(aestheticData.facial.discromias) && aestheticData.facial.discromias.map((d: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80">
                                {d}
                              </span>
                            ))}
                            {Array.isArray(aestheticData.facial.textura_relevo) && aestheticData.facial.textura_relevo.map((t: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {t}
                              </span>
                            ))}
                            {Array.isArray(aestheticData.facial.vascularizacao) && aestheticData.facial.vascularizacao.map((v: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                {v}
                              </span>
                            ))}
                          </div>

                          {aestheticData.facial.avaliacao_lupa && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
                              <span className="font-medium not-italic text-slate-700 dark:text-slate-300">Lupa:</span> {aestheticData.facial.avaliacao_lupa}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2">
                          Nenhuma avaliação facial registrada para este paciente.
                        </p>
                      )}
                    </div>

                    {/* Card Corporal */}
                    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850/60 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-300">Avaliação Corporal</span>
                        {aestheticData?.corporal?.fototipo && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold border border-teal-200/60">
                            Fototipo {aestheticData.corporal.fototipo}
                          </span>
                        )}
                      </div>

                      {aestheticData?.corporal ? (
                        <div className="space-y-2 text-xs">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span className="text-[10px] text-slate-400 block">Hidratação na Região</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                              {aestheticData.corporal.hidratacao_pele || "Não informado"}
                            </span>
                          </div>

                          {/* Estrias e Regiões */}
                          {Array.isArray(aestheticData.corporal.estrias_localizacao) && aestheticData.corporal.estrias_localizacao.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Localização das Estrias</span>
                              <div className="flex flex-wrap gap-1">
                                {aestheticData.corporal.estrias_localizacao.map((loc: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60">
                                    {loc}
                                  </span>
                                ))}
                                {aestheticData.corporal.estrias_localizacao_outros && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {aestheticData.corporal.estrias_localizacao_outros}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Tipos e Fatores */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Array.isArray(aestheticData.corporal.estrias_tipo_coloracao) && aestheticData.corporal.estrias_tipo_coloracao.map((tipo: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/80">
                                {tipo}
                              </span>
                            ))}
                            {Array.isArray(aestheticData.corporal.alteracoes_associadas) && aestheticData.corporal.alteracoes_associadas.map((alt: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80">
                                {alt}
                              </span>
                            ))}
                          </div>

                          {aestheticData.corporal.tempo_estimado_surgimento && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                              <span className="font-medium text-slate-700 dark:text-slate-300">Surgimento:</span> {aestheticData.corporal.tempo_estimado_surgimento}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2">
                          Nenhuma avaliação corporal registrada para este paciente.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 3: RECEITUÁRIO & TRATAMENTOS */}
            {/* ======================================================== */}
            {activeSubTab === "prescricoes" && (
              <div className="w-full">
                {prescriptions.length === 0 && homeCareFichas.length === 0 ? (
                  <div className="py-12 text-center max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center mx-auto mb-3">
                      <Pill className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Nenhuma prescrição ou ficha de home care registrada
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {isPatientView 
                        ? "Não há prescrições ou orientações de home care registradas para você no momento." 
                        : "Emita receitas e orientações de home care para ficarem arquivadas no histórico do paciente."}
                    </p>
                    {!isPatientView && (
                      <div className="flex items-center justify-center gap-2.5 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHomeCareForEdit(null);
                            setIsHomeCareModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full border border-teal-700/30 dark:border-teal-500/40 text-[#0d6e64] dark:text-teal-300 bg-teal-50/60 dark:bg-teal-950/40 hover:bg-teal-100/80 dark:hover:bg-teal-900/50 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Cuidados & Orientações</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPrescriptionModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0d6e64] hover:bg-[#0b5c54] dark:bg-teal-600 dark:hover:bg-teal-500 rounded-full transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span>Prescrever Receita</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* COLUNA 1: RECEITUÁRIO */}
                    <div className="w-full flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                            <Pill className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              Receituário & Fórmulas Magistrais ({prescriptions.length})
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Receituário e formulações magistrais prescritas para o tratamento
                            </p>
                          </div>
                        </div>
                      </div>

                      {prescriptions.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3.5">
                    {prescriptions.map((rx) => {
                      const [year, month, day] = (rx.data || "").split("-");
                      const dateFormatted = year && month && day ? `${day}/${month}/${year}` : rx.data;
                      const formulaName = rx.item?.nome_formula || rx.nome_formula || (rx.medicamento && rx.medicamento !== "Fórmula Magistral" ? rx.medicamento : null);
                      const viaLabel = rx.item?.via ? (rx.item.via.toLowerCase() === "oral" ? "Oral" : "Tópico") : (rx.via === "oral" || rx.via === "Oral" ? "Oral" : "Tópico");

                      return (
                        <div
                          key={rx.id}
                          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-teal-500/30 transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Cabeçalho do Card: Estrutura Flexível md:flex-row totalmente responsiva */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800/70">
                              
                              {/* Título Principal, Subtítulo (Nome da Fórmula) e Metadados */}
                              <div className="min-w-0 flex-1 w-full md:w-auto">
                                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-words leading-snug">
                                  Fórmula Magistral
                                </h4>

                                {/* Subtítulo em Destaque Sutil: Nome da Fórmula */}
                                {formulaName && (
                                  <p className="text-xs sm:text-sm font-medium text-slate-700/80 dark:text-slate-300/80 mt-0.5 break-words leading-snug">
                                    {formulaName}
                                  </p>
                                )}

                                {/* Metadados: Via + Data + Dose */}
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                                  <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">
                                    (Uso {viaLabel})
                                  </span>
                                  <span>•</span>
                                  <span className="shrink-0">Prescrito em {dateFormatted}</span>
                                  {rx.item?.dosagem && (
                                    <>
                                      <span>•</span>
                                      <span>Dose: {rx.item.dosagem} {rx.item.tipo_veiculo || ""}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Ações e Badges (Container Flexível com flex-wrap) */}
                              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0 w-full md:w-auto justify-start md:justify-end">
                                {!isPatientView && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRxForPrint(rx)}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-200 dark:border-slate-700 hover:bg-teal-50/70 dark:hover:bg-slate-800/80 rounded-full cursor-pointer transition-colors shadow-2xs md-state-layer"
                                      title="Visualizar e imprimir relatório da receita"
                                    >
                                      <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                      <span>Gerar Relatório</span>
                                    </button>

                                    {rx.pdf_assinado_url ? (
                                      <a
                                        href={rx.pdf_assinado_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 rounded-full transition-colors shadow-2xs md-state-layer"
                                        title="Ver receita assinada digitalmente"
                                      >
                                        <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span>PDF Assinado</span>
                                        <ExternalLink className="w-3 h-3 text-emerald-500" />
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => openSigningModal(rx)}
                                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100/70 rounded-full transition-colors cursor-pointer shadow-2xs md-state-layer"
                                        title="Assinar com certificado digital VIDaaS"
                                      >
                                        <FileCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                        <span>Assinar (VIDaaS)</span>
                                      </button>
                                    )}
                                  </>
                                )}

                                {isPatientView && (
                                  rx.pdf_assinado_url ? (
                                    <a
                                      href={rx.pdf_assinado_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-full transition-all shadow-2xs md-state-layer"
                                      title="Baixar receituário assinado digitalmente"
                                    >
                                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                      <span>Baixar Receita Assinada</span>
                                    </a>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toast({
                                          type: "warning",
                                          title: "Prescrição em Processamento",
                                          description:
                                            "Este documento ainda está aguardando a assinatura digital qualificada. Por favor, solicite a liberação à profissional.",
                                        })
                                      }
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-full cursor-pointer hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shadow-2xs md-state-layer"
                                      title="Documento pendente de assinatura"
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                      <span>Receita Assinada (Pendente)</span>
                                    </button>
                                  )
                                )}

                                {rx.ativo || rx.status === "Ativo" ? (
                                  isPatientView ? (
                                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default select-none shadow-2xs">
                                      Em Uso (Ativo)
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedRxForSuspension(rx.id);
                                        setJustificativaTexto("");
                                        setIsSuspensionModalOpen(true);
                                      }}
                                      className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:border-rose-800 shadow-2xs md-state-layer"
                                      title="Clique para suspender esta receita"
                                    >
                                      Em Uso (Ativo)
                                    </button>
                                  )
                                ) : (
                                  <span
                                    className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 cursor-default shadow-2xs"
                                    title="Receita suspensa"
                                  >
                                    Suspenso
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Bloco em Destaque: Dosagem e Veículo (Composição / Apresentação) */}
                            {(rx.dosagem || rx.item?.dosagem) && (
                              <div className="mb-3 p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/50">
                                <p className="text-xs font-semibold text-teal-950 dark:text-teal-200 leading-snug">
                                  {rx.dosagem || rx.item?.dosagem}
                                </p>
                              </div>
                            )}

                            {/* Detalhes da Prescrição: Posologia, Duração e Observações */}
                            <div className="space-y-2.5">
                              {rx.componentes && rx.componentes.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium">
                                  <strong className="text-slate-900 dark:text-white block mb-1">Composição:</strong>
                                  {rx.componentes.map((c: any) => `${c.nome}: ${c.quantidade}${c.unidade || ""}`).join(" | ")}
                                </div>
                              )}

                              {(rx.posologia || rx.item?.posologia || rx.duracao || rx.item?.duracao || rx.orient_paciente || rx.item?.orient_paciente) && (
                                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                                  {(rx.posologia || rx.item?.posologia) && (
                                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                      <strong className="text-slate-900 dark:text-white">Posologia:</strong> {rx.posologia || rx.item?.posologia}
                                    </p>
                                  )}
                                  {(rx.duracao || rx.item?.duracao) && (
                                    <p className="text-slate-600 dark:text-slate-400">
                                      <strong className="text-slate-800 dark:text-slate-200">Duração:</strong> {rx.duracao || rx.item?.duracao}
                                    </p>
                                  )}
                                  {(rx.orient_paciente || rx.item?.orient_paciente) && (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                                      <strong>Obs:</strong> {rx.orient_paciente || rx.item?.orient_paciente}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center">
                          <p className="text-xs text-slate-400 italic">
                            Nenhuma fórmula magistral ou receita registrada no momento.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* COLUNA 2: HOME CARE */}
                    <div className="w-full flex flex-col gap-4">
                      {homeCareFichas.length > 0 ? (
                        <HomeCareCards
                          fichas={homeCareFichas}
                          client={client}
                          isPatientView={isPatientView}
                          onEdit={(f) => {
                            setSelectedHomeCareForEdit(f);
                            setIsHomeCareModalOpen(true);
                          }}
                          onRefresh={loadClinicalData}
                        />
                      ) : (
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0">
                                <HeartHandshake className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                  Fichas de Home Care & Orientações (0)
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Protocolos e cronogramas de cuidados domiciliares assinados digitalmente
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-center">
                            <p className="text-xs text-slate-400 italic">
                              Nenhuma ficha de home care ou orientação domiciliar registrada.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ABA 4: SINAIS VITAIS & BIOMETRIA */}
            {/* ======================================================== */}
            {activeSubTab === "metricas" && !isPatientView && (
              <div className="space-y-6">
                {/* Resumo da Última Medição */}
                {evolutions.length > 0 && evolutions[0].sinaisVitais ? (
                  <div className="p-4 rounded-2xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold text-teal-950 dark:text-teal-100 uppercase tracking-wider">
                          Última Aferição de Sinais Vitais ({evolutions[0].data})
                        </h4>
                      </div>
                      <span className="text-[11px] text-teal-700 dark:text-teal-300">
                        {evolutions[0].profissional}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">PA (mmHg)</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.pressaoArterial || "--/--"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">FC (bpm)</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.frequenciaCardiaca ? `${evolutions[0].sinaisVitais.frequenciaCardiaca}` : "--"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">Hidratação (%)</span>
                        <span className="text-sm font-bold text-teal-600 dark:text-teal-400 font-mono">
                          {evolutions[0].sinaisVitais.hidratacaoCutanea != null ? `${evolutions[0].sinaisVitais.hidratacaoCutanea}%` : "--"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">Oleosidade (%)</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.oleosidadeSebo != null ? `${evolutions[0].sinaisVitais.oleosidadeSebo}%` : "--"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-teal-200/50">
                        <span className="text-[10px] text-slate-400 font-semibold block">Elasticidade (%)</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          {evolutions[0].sinaisVitais.indiceElasticidade != null ? `${evolutions[0].sinaisVitais.indiceElasticidade}%` : "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                    Nenhum sinal vital registrado recentemente. Ao adicionar uma evolução clínica, informe os sinais vitais para acompanhamento gráfico.
                  </div>
                )}

                {/* Tabela Histórica de Medições */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Histórico Cronológico de Biometria
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 font-bold text-slate-500">
                          <th className="py-2.5 px-3">Data</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">PA (mmHg)</th>
                          <th className="py-2.5 px-3">FC (bpm)</th>
                          <th className="py-2.5 px-3">Hidratação (%)</th>
                          <th className="py-2.5 px-3">Oleosidade (%)</th>
                          <th className="py-2.5 px-3">Elasticidade (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                        {evolutions
                          .filter((e) => e.sinaisVitais)
                          .map((e) => (
                            <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2 px-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                                {e.data}
                              </td>
                              <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-400">
                                {e.tipo}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.pressaoArterial || "-"}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.frequenciaCardiaca ? `${e.sinaisVitais.frequenciaCardiaca}` : "-"}
                              </td>
                              <td className="py-2 px-3 text-teal-600 dark:text-teal-400 font-semibold">
                                {e.sinaisVitais?.hidratacaoCutanea != null ? `${e.sinaisVitais.hidratacaoCutanea}%` : "-"}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.oleosidadeSebo != null ? `${e.sinaisVitais.oleosidadeSebo}%` : "-"}
                              </td>
                              <td className="py-2 px-3">
                                {e.sinaisVitais?.indiceElasticidade != null ? `${e.sinaisVitais.indiceElasticidade}%` : "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modais Vinculados */}
      <EvolutionFormModal
        isOpen={isEvolutionModalOpen}
        onClose={() => setIsEvolutionModalOpen(false)}
        onSuccess={loadClinicalData}
        client={client}
      />

      {history && (
        <MedicalHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          onSuccess={loadClinicalData}
          client={client}
          initialHistory={history}
        />
      )}

      <PrescriptionModal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        onSuccess={loadClinicalData}
        client={client}
      />

      {selectedRxForPrint && (
        <PrintPrescriptionModal
          isOpen={true}
          onClose={() => setSelectedRxForPrint(null)}
          prescription={selectedRxForPrint}
          client={client}
        />
      )}

      {/* Modal de Confirmação de Suspensão de Receita MD4 */}
      {isSuspensionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Drag Handle Mobile */}
            <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-950 dark:text-white text-base">Suspender Receita</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSuspensionModalOpen(false);
                  setJustificativaTexto("");
                  setSelectedRxForSuspension(null);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors md-state-layer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Deseja suspender o uso desta receita? Informe a justificativa clínica abaixo:
              </p>
              
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Justificativa Clínica *
                </label>
                <textarea
                  value={justificativaTexto}
                  onChange={(e) => setJustificativaTexto(e.target.value)}
                  placeholder="Ex: Reação adversa observada, troca de abordagem clínica, alcance do objetivo terapêutico..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all"
                  required
                />
              </div>
            </div>
            
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsSuspensionModalOpen(false);
                  setJustificativaTexto("");
                  setSelectedRxForSuspension(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors md-state-layer"
                disabled={isSubmittingSuspension}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspension}
                disabled={!justificativaTexto.trim() || isSubmittingSuspension}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full cursor-pointer flex items-center gap-1.5 transition-all shadow-xs md-state-layer"
              >
                {isSubmittingSuspension ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Suspendendo...</span>
                  </>
                ) : (
                  <span>Confirmar Suspensão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ASSINATURA DIGITAL ICP-BRASIL (VIDAAS) MD4 */}
      {signingRx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center landscape:items-center justify-center p-0 sm:p-4 landscape:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 font-['Plus_Jakarta_Sans',sans-serif] overflow-y-auto">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl landscape:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 space-y-4 max-h-[92dvh] sm:max-h-[85dvh] landscape:max-h-[85dvh] overflow-y-auto flex flex-col">
            {/* Drag Handle Mobile */}
            <div className="sm:hidden landscape:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Assinatura Digital ICP-Brasil
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Fluxo com Certificado Digital VIDaaS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSigningModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors md-state-layer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {signedNotificationPrompt?.isOpen ? (
              <div className="py-4 space-y-5 text-center animate-in fade-in zoom-in-95 duration-200 flex-1">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <FileCheck className="w-7 h-7"/>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Receita Assinada Anexada com Sucesso!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Deseja comunicar <strong>{client?.nome || (client as any)?.name || "o paciente"}</strong> agora sobre a liberação da prescrição{" "}
                    <strong>{signedNotificationPrompt.formulaName}</strong>?
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 text-left text-xs space-y-2">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    Ao confirmar, o sistema irá:
                  </p>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span>Enviar e-mail em segundo plano com o PDF assinado em anexo ({client?.email || "e-mail cadastrado"}).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                      <span>Abrir o WhatsApp do paciente ({client?.telefone || (client as any)?.phone || "telefone cadastrado"}) com o aviso de disponibilidade no site.</span>
                    </li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSignedNotificationPrompt(null);
                      setSigningRx(null);
                      setPdfDownloaded(false);
                      setIsDraggingSigned(false);
                    }}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md-state-layer"
                  >
                    Agora não
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNotifyPatientAfterSigning(signedNotificationPrompt)}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 md-state-layer"
                  >
                    <span>Sim, Comunicar Paciente</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Prescrição: <strong className="text-slate-800 dark:text-slate-100">{signingRx.medicamento}</strong>
                </div>

                {/* Passo 1: baixar o PDF */}
                <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    1º Passo: Baixar a receita em PDF
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Baixe o PDF, assine no aplicativo VIDaaS ou no portal VIDaaS Connect e volte aqui.
                  </p>
                  <button
                    type="button"
                    disabled={isDownloadingPdf}
                    onClick={() => handleDownloadPrescriptionPdf(signingRx)}
                    className="w-full py-2.5 px-4 text-xs font-bold rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer md-state-layer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isDownloadingPdf ? "Gerando PDF..." : pdfDownloaded ? "Baixar novamente" : "Baixar Receita em PDF"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openVidaasStore}
                    className="block mx-auto text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline-offset-2 hover:underline cursor-pointer"
                  >
                    Não tem o app? Instalar o VIDaaS
                  </button>
                </div>

                {/* Passo 2: anexar o PDF assinado (conferido pelo servidor) */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingSigned(true);
                  }}
                  onDragLeave={() => setIsDraggingSigned(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingSigned(false);
                    handleSignedFile(e.dataTransfer.files?.[0]);
                  }}
                  className={`p-3.5 rounded-2xl border space-y-2 transition-colors ${
                    isDraggingSigned || pdfDownloaded
                      ? "bg-teal-50 dark:bg-teal-950/30 border-teal-400"
                      : "bg-teal-50/40 dark:bg-slate-800/60 border-teal-200/60 dark:border-slate-700"
                  }`}
                >
                  <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                    2º Passo: Anexar o PDF assinado
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Selecione (ou arraste) o arquivo assinado. O sistema confere a assinatura e se é desta receita antes de salvar.
                  </p>
                  <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer md-state-layer">
                    <UploadCloud className="w-4 h-4" />
                    <span>{isUploadingSignedPdf ? "Conferindo e salvando..." : "Selecionar PDF Assinado"}</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={isUploadingSignedPdf}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = ""; // permite reenviar o mesmo arquivo após corrigir
                        handleSignedFile(file);
                      }}
                    />
                  </label>
                  {signError && (
                    <div role="alert" className="flex items-start gap-2 p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-800 dark:text-rose-200 leading-relaxed">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{signError}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={closeSigningModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-full cursor-pointer md-state-layer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox para fotos da área tratada */}
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

      {/* Modal de Avaliação Estética */}
      <AestheticEvaluationModal
        isOpen={isAestheticModalOpen}
        onClose={() => setIsAestheticModalOpen(false)}
        patientId={client.id}
        initialFacial={aestheticData?.facial}
        initialCorporal={aestheticData?.corporal}
        onSuccess={() => {
          loadClinicalData();
          setIsAestheticModalOpen(false);
        }}
      />

      {/* Modal de Ficha de Home Care (Cuidados & Orientações) */}
      <HomeCareModal
        isOpen={isHomeCareModalOpen}
        onClose={() => {
          setIsHomeCareModalOpen(false);
          setSelectedHomeCareForEdit(null);
        }}
        pacienteId={client.id}
        pacienteNome={client.nome}
        initialData={selectedHomeCareForEdit}
        onSuccess={() => {
          loadClinicalData();
          setIsHomeCareModalOpen(false);
          setSelectedHomeCareForEdit(null);
        }}
      />
    </div>
  );
}
