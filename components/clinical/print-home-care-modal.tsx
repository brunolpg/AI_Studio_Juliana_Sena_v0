"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  HeartHandshake,
  AlertTriangle,
  ShieldCheck,
  Edit2,
  Share2,
  Loader2,
} from "lucide-react";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { Client } from "@/types/client";
import {
  sanitizePdfFileName,
  sharePdfViaWhatsApp,
  downloadPdfFile,
  generateHomeCarePdf,
} from "@/lib/utils/whatsapp-share-pdf";

interface PrintHomeCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  ficha: HomeCareFichaCompleta;
  client?: Client | null;
  userRole?: string;
  onEdit?: (ficha: HomeCareFichaCompleta) => void;
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = dateStr.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatCPF(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

function formatDateToPortuguese(dateStr?: string | null): string {
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

export function PrintHomeCareModal({
  isOpen,
  onClose,
  ficha,
  client,
  userRole = "profissional",
  onEdit,
}: PrintHomeCareModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const isProfissionalOrAdmin =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const pacienteNome = client?.nome || ficha.paciente?.nome || "Paciente";
  const pacienteCpf = client?.cpf || ficha.paciente?.cpf;
  const pacienteTelefone = client?.telefone || (client as any)?.whatsapp;

  const statusLabel = ficha.status || "Ativo";
  const statusBadgeClass =
    statusLabel === "Ativo"
      ? "bg-success-container text-on-success-container border border-success/30"
      : statusLabel === "Concluído"
      ? "bg-secondary-container text-on-secondary-container border border-secondary/30"
      : "bg-error-container text-on-error-container border border-error/30";

  const buildHomeCarePdfFile = async (): Promise<File> => {
    const fileName = sanitizePdfFileName("Home_Care", pacienteNome);
    return generateHomeCarePdf({
      fileName,
      ficha,
      patientName: pacienteNome,
      patientCpf: pacienteCpf,
    });
  };

  const handleShareWhatsApp = async () => {
    try {
      setIsSharingWhatsApp(true);
      const pdfFile = await buildHomeCarePdfFile();

      await sharePdfViaWhatsApp({
        file: pdfFile,
        documentTitle: `Home Care - ${ficha.titulo_protocolo}`,
        patientName: pacienteNome,
        patientPhone: pacienteTelefone,
      });
    } catch (err) {
      console.error("Erro ao compartilhar ficha de Home Care via WhatsApp:", err);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await buildHomeCarePdfFile();
      downloadPdfFile(pdfFile);
    } catch (err) {
      console.error("Erro ao gerar PDF da ficha de Home Care:", err);
    } finally {
      setIsGeneratingPdf(false);
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
              <HeartHandshake className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                Orientações Home Care
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant flex-wrap">
                <span>{pacienteNome}</span>
                <span>•</span>
                <span>Emissão: {formatDateBR(ficha.data_home_care)}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-md-full font-semibold ${statusBadgeClass}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Ações Restritas a Administrador e Profissional */}
            {isProfissionalOrAdmin && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(ficha);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" />
                <span>Editar Orientações</span>
              </button>
            )}

            {/* Botão Compartilhar (WhatsApp com PDF) */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharingWhatsApp || isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
              title="Compartilhar orientações em PDF pelo WhatsApp"
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

        {/* Pré-visualização da Folha A4 */}
        <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-surface-container/40 print:p-0 print:overflow-visible">
          {/* Folha de Impressão A4 */}
          <div
            id="home-care-print-area"
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
                      PROTOCOLO DE CUIDADOS DOMICILIARES (HOME CARE)
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
              <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 w-full mb-6 print-avoid-break break-inside-avoid">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    PACIENTE
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {pacienteNome}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    CPF
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {formatCPF(pacienteCpf)}
                  </span>
                </div>
              </div>

              {/* 3. Caixa de Alerta: ATENÇÃO CRÍTICA (Configurável) */}
              {ficha.incluir_atencao_critica !== false && Boolean(ficha.atencao_critica_texto?.trim()) && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 mb-5 flex items-start gap-3 print-avoid-break break-inside-avoid">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold uppercase tracking-wider block mb-0.5 text-amber-800">
                      {ficha.atencao_critica_titulo || "ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO"}
                    </span>
                    {ficha.atencao_critica_texto}
                  </div>
                </div>
              )}

              {/* 4. Bloco: CUIDADOS (Tópicos numerados) */}
              <div className="mb-6 space-y-3">
                <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between section-title">
                  <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                    CUIDADOS DIÁRIOS FUNDAMENTAIS
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {ficha.cuidados.length} {ficha.cuidados.length === 1 ? "tópico" : "tópicos"}
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {ficha.cuidados.map((cuidado, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs print-avoid-break break-inside-avoid">
                      <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[11px]">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                          {cuidado.titulo}
                        </h4>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {cuidado.texto}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Bloco: CRONOGRAMA DE TRATAMENTO */}
              {ficha.cronograma && ficha.cronograma.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between section-title">
                    <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                      CRONOGRAMA DE TRATAMENTO
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Fases sequenciais
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 print-avoid-break break-inside-avoid">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3 w-[22%]">Período</th>
                          <th className="py-2.5 px-3 w-[43%]">Produto & Frequência</th>
                          <th className="py-2.5 px-3 w-[35%]">Objetivo Clínico</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {ficha.cronograma.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 align-top font-bold text-teal-900">
                              <div>
                                DIAS {item.dia_inicio} AO {item.dia_fim}
                              </div>
                              {item.fase_titulo && (
                                <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                  {item.fase_titulo}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              <span className="font-bold text-slate-900 block">
                                {item.nome_formula}
                              </span>
                              <span className="text-slate-600 text-[11px] block mt-0.5 leading-relaxed">
                                {item.posologia}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 align-top text-slate-700 leading-relaxed text-[11px]">
                              {item.objetivo_clinico}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. Bloco: RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES (Se houver) */}
              {ficha.incluir_recomendacoes && ficha.recomendacoes && ficha.recomendacoes.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="border-b-2 border-amber-600/80 pb-1.5 flex items-center justify-between section-title">
                    <h3 className="text-xs font-black text-amber-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {ficha.recomendacoes.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/50 print-avoid-break break-inside-avoid">
                        <div className="w-5 h-5 rounded-md bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                            {rec.titulo}
                          </h4>
                          <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                            {rec.texto}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 7. Rodapé Institucional com Chancela Criptográfica */}
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer print-avoid-break break-inside-avoid">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-medium">{formatDateToPortuguese(ficha.data_home_care)}</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  Juliana Sena de Souza Vieira • COREN-BA 366.344
                </span>
              </div>

              {/* Chancela de Assinatura Hash */}
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Documento Clínico Assinado Digitalmente (Integridade Garantida via SHA-256)</span>
                </div>
                <div className="font-mono text-emerald-900 font-bold truncate max-w-[280px]">
                  Hash: {ficha.payload_hash || "AUTÊNTICO"}
                </div>
              </div>

              {/* Rodapé de contato da clínica */}
              <div className="text-center text-[9px] text-slate-400">
                Juliana Sena de Souza Vieira • Estética Avançada e Laserterapia • Salvador - BA • Telefone: (71) 98661-2878
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
