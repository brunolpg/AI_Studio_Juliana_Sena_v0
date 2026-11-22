"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  ShieldCheck,
  Sparkles,
  Edit2,
  Share2,
  Loader2,
} from "lucide-react";
import type { Proposta } from "@/types/proposta";
import type { Client } from "@/types/client";
import {
  sanitizePdfFileName,
  sharePdfViaWhatsApp,
  downloadPdfFile,
  generatePropostaPdf,
} from "@/lib/utils/whatsapp-share-pdf";

interface PrintPropostaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: Proposta;
  client?: Client | null;
  userRole?: string;
  onEdit?: (proposta: Proposta) => void;
}

function getPropostaStatusBadgeClass(status?: string): string {
  const normalized = (status || "Ativo").toLowerCase();
  if (normalized === "ativo" || normalized === "aprovada" || normalized === "aprovado") {
    return "bg-success-container text-on-success-container border border-success/30";
  }
  if (
    normalized === "suspenso" ||
    normalized === "suspensa" ||
    normalized === "cancelado" ||
    normalized === "cancelada" ||
    normalized === "recusada" ||
    normalized === "recusado"
  ) {
    return "bg-error-container text-on-error-container border border-error/30";
  }
  if (normalized === "enviada" || normalized === "enviado") {
    return "bg-secondary-container text-on-secondary-container border border-secondary/30";
  }
  if (normalized === "rascunho" || normalized === "pendente") {
    return "bg-warning-container text-on-warning-container border border-warning/30";
  }
  return "bg-surface-container-high text-on-surface-variant border border-outline-variant";
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

function formatCurrency(val?: number | null): string {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calculateAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return "";
  try {
    const birthDate = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? `${age} anos` : "";
  } catch {
    return "";
  }
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

export function PrintPropostaModal({
  isOpen,
  onClose,
  proposta,
  client,
  userRole = "profissional",
  onEdit,
}: PrintPropostaModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen || !proposta) return null;

  const isProfissionalOrAdmin =
    userRole === "administrador" ||
    userRole === "admin" ||
    userRole === "profissional";

  const statusLabel = proposta.status || "Ativo";
  const normalizedStatus = statusLabel.toLowerCase();
  const canEdit =
    isProfissionalOrAdmin &&
    Boolean(onEdit) &&
    normalizedStatus !== "suspenso" &&
    normalizedStatus !== "suspensa" &&
    normalizedStatus !== "cancelado" &&
    normalizedStatus !== "cancelada" &&
    normalizedStatus !== "recusada" &&
    normalizedStatus !== "recusado";

  const pacienteNome = client?.nome || "Paciente";
  const pacienteNasc = client?.data_nascimento;
  const pacienteCpf = client?.cpf;
  const pacienteTelefone = client?.telefone || (client as any)?.whatsapp;
  const idadeStr = calculateAge(pacienteNasc);

  const buildPropostaPdfFile = async (): Promise<File> => {
    const fileName = sanitizePdfFileName("Proposta_Clinica", pacienteNome);
    return generatePropostaPdf({
      fileName,
      proposta,
      patientName: pacienteNome,
      patientCpf: pacienteCpf,
      patientBirthDate: pacienteNasc,
    });
  };

  const handleShareWhatsApp = async () => {
    try {
      setIsSharingWhatsApp(true);
      const pdfFile = await buildPropostaPdfFile();

      await sharePdfViaWhatsApp({
        file: pdfFile,
        documentTitle: `Proposta Clínica - ${proposta.titulo}`,
        patientName: pacienteNome,
        patientPhone: pacienteTelefone,
      });
    } catch (err) {
      console.error("Erro ao compartilhar proposta clínica via WhatsApp:", err);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfFile = await buildPropostaPdfFile();
      downloadPdfFile(pdfFile);
    } catch (err) {
      console.error("Erro ao gerar PDF da proposta clínica:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-on-surface/50 backdrop-blur-xs animate-in fade-in duration-200 print:p-0 print:bg-surface print:fixed print:inset-0">
      {/* Fonte Plus Jakarta Sans */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
      />

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
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">
                Relatório de Proposta Clínica
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-on-surface-variant flex-wrap">
                <span>{pacienteNome}</span>
                <span>•</span>
                <span className="truncate max-w-[180px] sm:max-w-[260px]" title={proposta.titulo}>
                  {proposta.titulo}
                </span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-md-full font-semibold ${getPropostaStatusBadgeClass(statusLabel)}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Ações Restritas a Administrador e Profissional */}
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onEdit(proposta);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-primary" />
                <span>Editar Proposta</span>
              </button>
            )}

            {/* Botão Compartilhar (WhatsApp com PDF) */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharingWhatsApp || isGeneratingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md-full border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60"
              title="Compartilhar proposta em PDF pelo WhatsApp"
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
            id="proposta-print-area"
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
                <div className="flex items-center gap-4">
                  <img
                    src="/logo-clinica.png"
                    alt="Logo Clínica"
                    className="h-16 w-auto object-contain flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex flex-col justify-center">
                    <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase whitespace-nowrap leading-tight mb-0.5">
                      PROPOSTA DE PLANEJAMENTO CLÍNICO INTEGRADO
                    </span>
                    <span className="text-base font-bold text-slate-900 whitespace-nowrap leading-tight">
                      Juliana Sena de Souza Vieira
                    </span>
                    <span className="text-xs text-slate-500 font-medium leading-tight">
                      Enfermeira Esteta
                    </span>
                  </div>
                </div>

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
                  {idadeStr && (
                    <span className="text-xs text-slate-500 font-medium ml-2">
                      ({idadeStr})
                    </span>
                  )}
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

              {/* 1. Título & Objetivo Terapêutico */}
              <div className="mb-6 p-4 rounded-2xl bg-teal-50/40 border border-teal-200/70 print-avoid-break break-inside-avoid">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white uppercase tracking-wider">
                    Plano Personalizado
                  </span>
                  <h2 className="text-sm font-bold text-teal-950">
                    {proposta.titulo}
                  </h2>
                </div>
                {proposta.objetivo && (
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line mt-2">
                    <strong className="text-teal-950">Objetivo Terapêutico:</strong> {proposta.objetivo}
                  </p>
                )}
              </div>

              {/* 2. Opções Clínicas com Numeração e Tabela de Procedimentos */}
              {proposta.opcoes && proposta.opcoes.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between section-title">
                    <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                      OPÇÕES DE PLANEJAMENTO TERAPÊUTICO
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {proposta.opcoes.length} {proposta.opcoes.length === 1 ? "opção disponível" : "opções disponíveis"}
                    </span>
                  </div>

                  <div className="space-y-4 pt-1">
                    {proposta.opcoes.map((opcao, idx) => {
                      const totalOpcao = opcao.procedimentos.reduce(
                        (acc, curr) => acc + (curr.total || 0),
                        0
                      );

                      return (
                        <div
                          key={opcao.id || idx}
                          className="rounded-2xl border border-slate-200 overflow-hidden print-avoid-break break-inside-avoid bg-white"
                        >
                          {/* Topo da Opção */}
                          <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center">
                                  #{idx + 1}
                                </span>
                                <h4 className="text-xs font-bold text-slate-900">
                                  {opcao.titulo || `Opção #${idx + 1}`}
                                </h4>
                              </div>
                              {opcao.descricao && (
                                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                  {opcao.descricao}
                                </p>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-slate-500 block">Investimento Total</span>
                              <span className="text-sm font-black text-teal-900">
                                {formatCurrency(totalOpcao)}
                              </span>
                            </div>
                          </div>

                          {/* Tabela de Procedimentos Inclusos */}
                          {opcao.procedimentos && opcao.procedimentos.length > 0 && (
                            <div className="p-3">
                              <table className="w-full text-left border-collapse text-xs print-avoid-break">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[9px]">
                                    <th className="py-2 px-2.5">Procedimento</th>
                                    <th className="py-2 px-2.5 text-center w-[15%]">Sessões</th>
                                    <th className="py-2 px-2.5 text-right w-[20%]">Valor Unit.</th>
                                    <th className="py-2 px-2.5 text-right w-[20%]">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[11px]">
                                  {opcao.procedimentos.map((proc, pIdx) => (
                                    <tr key={proc.procedimento_id || pIdx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-2.5 font-semibold text-slate-800">
                                        {proc.nome_procedimento}
                                      </td>
                                      <td className="py-2 px-2.5 text-center font-medium text-slate-600">
                                        {proc.num_sessoes}
                                      </td>
                                      <td className="py-2 px-2.5 text-right text-slate-600">
                                        {formatCurrency(proc.valor_sessao)}
                                      </td>
                                      <td className="py-2 px-2.5 text-right font-bold text-slate-900">
                                        {formatCurrency(proc.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Benefícios e Condições de Pagamento */}
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                            {opcao.beneficios && (
                              <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                <span className="font-bold text-emerald-900 block mb-0.5">Benefícios Inclusos:</span>
                                <p className="text-emerald-800 leading-relaxed whitespace-pre-line">
                                  {opcao.beneficios}
                                </p>
                              </div>
                            )}

                            {opcao.formas_pagamento && opcao.formas_pagamento.length > 0 && (
                              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                                <span className="font-bold text-slate-800 block mb-1">Condições de Pagamento:</span>
                                <div className="space-y-1">
                                  {opcao.formas_pagamento.map((fp, fIdx) => (
                                    <div key={fIdx} className="flex items-center gap-1.5 text-slate-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                                      {fp.tipo === "a_vista" ? (
                                        <span>
                                          <strong>À Vista:</strong> com {fp.desconto || 0}% de desconto (
                                          {formatCurrency(totalOpcao * (1 - (fp.desconto || 0) / 100))})
                                        </span>
                                      ) : (
                                        <span>
                                          <strong>Parcelamento:</strong> até {fp.num_parcelas || 1}x de{" "}
                                          {formatCurrency(totalOpcao / (fp.num_parcelas || 1))} sem juros
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Cronograma Clínico Sugerido */}
              {proposta.cronograma?.etapas && proposta.cronograma.etapas.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between section-title">
                    <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                      {proposta.cronograma.titulo || "CRONOGRAMA CLÍNICO SUGERIDO"}
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Sequência programada ({proposta.cronograma.etapas.length} etapas)
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 print-avoid-break break-inside-avoid">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px]">
                          <th className="py-2.5 px-3 w-[28%]">Período / Previsão</th>
                          <th className="py-2.5 px-3 w-[72%]">Etapa / Procedimentos Programados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {proposta.cronograma.etapas.map((etapa, idx) => {
                          const periodo =
                            etapa.tipo_data === "unica"
                              ? etapa.data
                                ? formatDateBR(etapa.data)
                                : "A agendar"
                              : `${formatDateBR(etapa.data_inicio)} até ${formatDateBR(etapa.data_fim)}`;

                          return (
                            <tr key={etapa.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 align-top font-bold text-teal-900 text-[11px]">
                                {periodo}
                              </td>
                              <td className="py-2.5 px-3 align-top text-slate-800 leading-relaxed text-[11px]">
                                {etapa.desc_etapa}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Tópicos e Orientações Complementares */}
              {proposta.topicos && proposta.topicos.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="border-b-2 border-slate-400 pb-1.5 flex items-center justify-between section-title">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                      ORIENTAÇÕES & CONSIDERAÇÕES COMPLEMENTARES
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {proposta.topicos.map((topico, idx) => (
                      <div key={topico.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 print-avoid-break break-inside-avoid text-xs">
                        <h4 className="font-bold text-slate-900 mb-1">
                          {topico.titulo}
                        </h4>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line text-[11px]">
                          {topico.texto}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Rodapé Institucional com Chancela Criptográfica */}
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer print-avoid-break break-inside-avoid">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-medium">
                  {formatDateToPortuguese(proposta.created_at || proposta.assinado_em)}
                </span>
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
                  Hash: {proposta.payload_hash || "AUTÊNTICO"}
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
