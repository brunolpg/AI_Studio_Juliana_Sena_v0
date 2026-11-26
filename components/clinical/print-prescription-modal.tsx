"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  Pill,
  Edit2,
  Archive,
  AlertTriangle,
  Share2,
  Loader2,
} from "lucide-react";
import type { PrescriptionItem } from "@/types/clinical-record";
import type { Client } from "@/types/client";
import {
  sanitizePdfFileName,
  sharePdfViaWhatsApp,
  downloadPdfFile,
  generatePrescriptionPdfClient,
} from "@/lib/utils/whatsapp-share-pdf";
import { parsePrescriptionDetails } from "@/lib/prescricoes/format";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

interface PrintPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: PrescriptionItem;
  client: Client;
  userRole?: string;
  onEdit?: (prescription: PrescriptionItem) => void;
  onSuccessSuspend?: () => void;
}

function formatCPF(cpf?: string): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

function formatDateToPortuguese(dateStr?: string): string {
  const clean = dateStr ? dateStr.split("T")[0] : null;
  const date = clean ? new Date(`${clean}T12:00:00-03:00`) : new Date();
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(Number.isNaN(date.getTime()) ? new Date() : date);
  const capitalized = formatted.replace(/ de ([a-zç])/i, (_, ch: string) => ` de ${ch.toUpperCase()}`);
  return `Salvador - BA, ${capitalized}`;
}

export function PrintPrescriptionModal({
  isOpen,
  onClose,
  prescription,
  client,
  userRole = "profissional",
  onEdit,
  onSuccessSuspend,
}: PrintPrescriptionModalProps) {
  const { toast } = useToast();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);
  const [justificativa, setJustificativa] = useState("Prescrição substituída ou ajustada");

  if (!isOpen) return null;

  const rxDetails = parsePrescriptionDetails(prescription);

  const isProfissionalOrAdmin =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const statusLabel =
    prescription.status || (prescription.ativo === false ? "Suspenso" : "Ativo");
  const isAtivo = statusLabel === "Ativo" && prescription.ativo !== false;

  const viaRaw = prescription.item?.via || prescription.via || "";
  const viaLabel = viaRaw.toLowerCase() === "oral" ? "Oral" : "Tópico";
  const patientName = client?.nome || "Paciente";
  const isOfficeUse =
    (client?.nome || "").trim().toLowerCase() === "uso em consultório" ||
    (client?.cpf || "").trim().toLowerCase() === "uso interno / clínica" ||
    (client?.cpf || "").trim().toLowerCase() === "não aplicável";

  const buildPrescriptionPdfFile = async (): Promise<File> => {
    const fileName = isOfficeUse
      ? sanitizePdfFileName("Receituario_Consultorio", prescription.medicamento || "Formula_Magistral")
      : sanitizePdfFileName("Receituario", client.nome);
    const targetId = (prescription as any).prescricao_id || prescription.id;

    if (targetId && !isOfficeUse) {
      try {
        const res = await fetch(`/api/prescricoes/${targetId}/pdf`, {
          credentials: "same-origin",
        });
        if (res.ok) {
          const blob = await res.blob();
          return new File([blob], fileName, { type: "application/pdf" });
        }
      } catch (e) {
        console.warn("Falha ao obter PDF do servidor, gerando em memória via pdf-lib:", e);
      }
    }

    return generatePrescriptionPdfClient({
      fileName,
      id: targetId,
      patientName: isOfficeUse ? "" : client.nome,
      patientCpf: isOfficeUse ? "" : client.cpf,
      manualFill: isOfficeUse,
      dataPrescricao: prescription.data || (prescription as any).data_prescricao || undefined,
      medicamento: prescription.medicamento,
      via: prescription.via,
      componentes: rxDetails.componentes,
      veiculo: rxDetails.veiculo,
      dosagem: rxDetails.dosagem,
      total: rxDetails.total,
      posologia: prescription.posologia,
      orientPaciente: rxDetails.orientPaciente,
      orientFarmacia: rxDetails.orientFarmacia,
    });
  };

  const handleShareWhatsApp = async () => {
    try {
      setIsSharingWhatsApp(true);
      const pdfFile = await buildPrescriptionPdfFile();

      await sharePdfViaWhatsApp({
        file: pdfFile,
        documentTitle: `Receituário - ${prescription.medicamento}`,
        patientName: client.nome,
        patientPhone: client.telefone || (client as any).whatsapp,
      });
    } catch (err) {
      console.error("Erro ao compartilhar prescrição via WhatsApp:", err);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await buildPrescriptionPdfFile();
      downloadPdfFile(pdfFile);
    } catch (err) {
      console.error("Erro ao gerar PDF do receituário:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!justificativa.trim()) {
      toast({
        type: "warning",
        title: "Justificativa Obrigatória",
        description: "Informe a justificativa para suspender esta receita.",
      });
      return;
    }

    const targetId = prescription.prescricao_id || prescription.id;
    if (!targetId) {
      toast({
        type: "error",
        title: "Erro ao Suspender",
        description: "Identificador da prescrição não encontrado.",
      });
      return;
    }

    setIsSuspending(true);
    try {
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
          justificativa_suspensao: justificativa.trim(),
          data_suspensao: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetId);

      if (error) {
        toast({
          type: "error",
          title: "Erro ao Suspender",
          description: error.message || "Não foi possível suspender a prescrição.",
        });
        return;
      }

      toast({
        type: "success",
        title: "Receita Suspensa",
        description: "A prescrição foi arquivada no histórico de suspensas.",
      });

      setShowSuspendPrompt(false);
      if (onSuccessSuspend) onSuccessSuspend();
      onClose();
    } catch (err: any) {
      toast({
        type: "error",
        title: "Falha",
        description: err?.message || "Erro inesperado ao suspender.",
      });
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-on-surface/50 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-surface print:fixed print:inset-0">
      {/* Link de carregamento direto e à prova de falhas para a fonte Plus Jakarta Sans */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
      />

      {/* Injeção à prova de falhas da fonte Plus Jakarta Sans */}
      <style dangerouslySetInnerHTML={{ __html: `
        .metropolis-font,
        .metropolis-font * {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
      `}} />

      <div className="w-full max-w-4xl max-h-[85dvh] bg-surface rounded-md-2xl sm:rounded-md-3xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:border-none print:shadow-none print:max-h-none print:rounded-none">
        {/* Barra Superior de Ações (Oculta na Impressão) */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low shrink-0 print:hidden flex-wrap gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-md-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                Receituário / Prescrição Magistral
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant flex-wrap">
                <span>{patientName}</span>
                <span>•</span>
                <span>Uso {viaLabel}</span>
                <span>•</span>
                <span
                  className={`px-2 py-0.5 rounded-md-full font-semibold ${
                    isAtivo
                      ? "bg-success-container text-on-success-container border border-success/30"
                      : "bg-error-container text-on-error-container border border-error/30"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Ações Restritas a Administrador e Profissional */}
            {isProfissionalOrAdmin && isAtivo && (
              <>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(prescription);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                    <span>Editar Receita</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowSuspendPrompt(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-error/30 bg-error-container/60 text-on-error-container hover:bg-error-container transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5 text-error" />
                  <span>Suspender</span>
                </button>
              </>
            )}

            {/* Botão Compartilhar (WhatsApp com PDF) */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharingWhatsApp || isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
              title="Compartilhar receituário em PDF pelo WhatsApp"
            >
              {isSharingWhatsApp ? (
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-primary" />
              )}
              <span>{isSharingWhatsApp ? "Compartilhando..." : "Compartilhar"}</span>
            </button>

            {/* Botão Imprimir / Gerar PDF */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGeneratingPdf || isSharingWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-transparent bg-primary text-on-primary hover:brightness-105 transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingPdf ? "Gerando PDF..." : "Imprimir / Gerar PDF"}</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-[44px] min-w-[44px] rounded-md-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Confirmação Inline de Suspensão */}
        {showSuspendPrompt && (
          <div className="p-4 bg-error-container text-on-error-container border-b border-error/30 space-y-2 shrink-0 print:hidden animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-error shrink-0" />
              <h4 className="text-xs font-bold">Suspender Prescrição Magistral</h4>
            </div>
            <p className="text-xs">
              Informe a justificativa clínica para descontinuar/suspender esta receita. Ela será arquivada no histórico de suspensas.
            </p>
            <input
              type="text"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Reação adversa, ajuste de concentração ou troca de protocolo"
              className="w-full min-h-[44px] px-3 rounded-md-md border border-error/40 bg-surface text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-error"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSuspendPrompt(false)}
                disabled={isSuspending}
                className="px-3 py-1.5 min-h-[44px] rounded-md-md text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                disabled={isSuspending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 min-h-[44px] rounded-md-md bg-error text-on-error text-xs font-semibold hover:brightness-110 transition-all cursor-pointer shadow-sm disabled:opacity-60"
              >
                {isSuspending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suspendendo...</span>
                  </>
                ) : (
                  "Confirmar Suspensão"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Pré-visualização da Folha A4 */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-surface-container/40 print:p-0 print:overflow-visible">
          <div
            id="receituario-print-area"
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[16mm] sm:p-[16mm] shadow-lg border border-slate-200 flex flex-col justify-between space-y-6 mx-auto metropolis-font"
            style={{
              boxSizing: "border-box",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <div>
              {/* Cabeçalho do Relatório */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-6 w-full print-avoid-break break-inside-avoid">
                {/* Lado Esquerdo: Logo + Coluna com Título, Nome e Especialidade */}
                <div className="flex items-center gap-4">
                  {/* Logo da Clínica */}
                  <img
                    src="/logo-clinica.png"
                    alt="Logo Clínica"
                    className="h-16 w-auto object-contain flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />

                  {/* Coluna de Textos Alinhados à Esquerda */}
                  <div className="flex flex-col justify-center">
                    {/* Título do Documento (Acima do nome) */}
                    <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase whitespace-nowrap leading-tight mb-0.5">
                      RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL
                    </span>
                    
                    {/* Nome da Profissional (Alinhado logo abaixo do título) */}
                    <span className="text-base font-bold text-slate-900 whitespace-nowrap leading-tight">
                      Juliana Sena de Souza Vieira
                    </span>
                    
                    {/* Especialidade */}
                    <span className="text-xs text-slate-500 font-medium leading-tight">
                      Enfermeira Esteta
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Apenas o Registro Profissional */}
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">
                    COREN-BA 366.344
                  </span>
                </div>
              </div>

              {/* Identificação do Paciente */}
              {isOfficeUse ? (
                <div className="flex items-end justify-between gap-6 p-4 sm:p-5 rounded-md-lg border border-outline-variant bg-surface-container-low w-full mb-6 print-avoid-break break-inside-avoid">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-5">
                      PACIENTE
                    </span>
                    <div className="w-full border-b border-outline" />
                  </div>
                  <div className="w-[150px] shrink-0">
                    <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block mb-5">
                      CPF
                    </span>
                    <div className="w-full border-b border-outline" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 w-full mb-6 print-avoid-break break-inside-avoid">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      PACIENTE
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {client.nome}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      CPF
                    </span>
                    <span className="text-base font-bold text-slate-900">
                      {formatCPF(client.cpf)}
                    </span>
                  </div>
                </div>
              )}

              {/* Corpo da Prescrição */}
              <div className="mt-8 space-y-6">
                <div className="space-y-4 print-avoid-break break-inside-avoid">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-base font-black text-slate-900">{prescription.medicamento}</h3>
                      <span className="text-xs font-bold text-slate-500">Uso {prescription.via}</span>
                    </div>
                    {prescription.dosagem && !rxDetails.veiculo && (
                      <p className="text-xs text-slate-500 mt-1">{prescription.dosagem}</p>
                    )}
                  </div>

                  {/* Composição / Componentes */}
                  {rxDetails.componentes && rxDetails.componentes.length > 0 && (
                    <div className="space-y-2 print-avoid-break break-inside-avoid">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fórmula Ativa</h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-2">Componente / Ativo</th>
                              <th className="px-4 py-2 text-right">Concentração</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {rxDetails.componentes.map((comp, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium text-slate-800">{comp.nome}</td>
                                <td className="px-4 py-2 text-right font-bold text-slate-700">{comp.qtd}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Veículo & Apresentação */}
                {rxDetails.veiculo && (
                  <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3 bg-white text-xs print-avoid-break break-inside-avoid">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Veículo Base</span>
                      <span className="font-semibold text-slate-800">{rxDetails.veiculo}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        {prescription.via.toLowerCase() === "oral" ? "Dose / Apresentação" : "Dosagem (Q.S.P.)"}
                      </span>
                      <span className="font-semibold text-slate-800">{rxDetails.dosagem}</span>
                    </div>
                    {rxDetails.total && (
                      <div className="col-span-2 border-t border-slate-100 pt-2 flex justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantidade Total</span>
                          <span className="font-bold text-slate-800">{rxDetails.total}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Posologia */}
                <div className="border-l-4 border-slate-800 bg-slate-50 p-4 rounded-r-xl print-avoid-break break-inside-avoid">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">
                    POSOLOGIA (Frequência & Horários)
                  </h4>
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    {prescription.posologia}
                  </p>
                </div>

                {/* Orientações ao Paciente */}
                {rxDetails.orientPaciente && (
                  <div className="space-y-1.5 print-avoid-break break-inside-avoid">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Orientações ao Paciente / Instruções Especiais
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {rxDetails.orientPaciente}
                    </p>
                  </div>
                )}

                {/* Observações à Farmácia */}
                {rxDetails.orientFarmacia && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 print-avoid-break break-inside-avoid">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Observações Técnicas à Farmácia Magistral
                    </span>
                    <p className="text-xs text-slate-500 italic leading-relaxed whitespace-pre-line">
                      {rxDetails.orientFarmacia}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé e Bloco de Assinatura */}
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-4 print-footer print-avoid-break break-inside-avoid">
              <div className="text-center text-xs text-slate-700">
                <span>{formatDateToPortuguese(prescription.data)}</span>
              </div>

              {/* Bloco de Assinatura Digital VIDaaS */}
              <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-teal-600/40 rounded-xl bg-white max-w-sm mx-auto text-center">
                <span className="text-[11px] font-bold text-slate-900">
                  Juliana Sena de Souza Vieira
                </span>
                <span className="text-[10px] text-teal-800 font-medium">
                  Enfermeira Esteta • COREN-BA 366.344
                </span>
                <span className="text-[9px] text-slate-500 mt-1 leading-tight">
                  Espaço reservado para aposição de Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)
                </span>
              </div>

              {/* Rodapé Institucional sutil */}
              <div className="text-center text-[9px] text-slate-400 border-t border-slate-200 pt-3">
                Juliana Sena de Souza Vieira • Estética Avançada e Regenerativa • Salvador - BA • Telefone: (71) 98661-2878 • COREN-BA 366.344
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
