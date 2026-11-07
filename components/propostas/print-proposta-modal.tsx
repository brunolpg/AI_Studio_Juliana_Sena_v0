"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
} from "lucide-react";
import type { Proposta } from "@/types/proposta";
import type { Client } from "@/types/client";
import {
  sanitizePdfFileName,
  sharePdfViaWhatsApp,
  generateGenericClinicalPdf,
  type SectionContent,
} from "@/lib/utils/whatsapp-share-pdf";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

interface PrintPropostaModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposta: Proposta;
  client?: Client | null;
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
  const date = clean ? new Date(clean + "T12:00:00") : new Date();
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `Salvador - BA, ${day} de ${month} de ${year}`;
}

export function PrintPropostaModal({
  isOpen,
  onClose,
  proposta,
  client,
}: PrintPropostaModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);

  if (!isOpen || !proposta) return null;

  const pacienteNome = client?.nome || "Paciente";
  const pacienteNasc = client?.data_nascimento;
  const pacienteCpf = client?.cpf;
  const pacienteTelefone = client?.telefone || (client as any)?.whatsapp;
  const idadeStr = calculateAge(pacienteNasc);

  const handleShareWhatsApp = async () => {
    try {
      setIsSharingWhatsApp(true);
      const fileName = sanitizePdfFileName("Proposta_Clinica", pacienteNome);

      const sections: SectionContent[] = [];

      // Objetivo Terapêutico
      if (proposta.objetivo) {
        sections.push({
          title: "Objetivo Terapêutico",
          paragraph: proposta.objetivo,
        });
      }

      // Opções Clínicas
      if (proposta.opcoes && proposta.opcoes.length > 0) {
        proposta.opcoes.forEach((op, idx) => {
          const items: string[] = [];
          if (op.descricao) items.push(`Descrição: ${op.descricao}`);
          if (op.beneficios) items.push(`Benefícios: ${op.beneficios}`);

          if (op.procedimentos && op.procedimentos.length > 0) {
            items.push("Procedimentos inclusos:");
            op.procedimentos.forEach((p) => {
              items.push(
                `• ${p.nome_procedimento}: ${p.num_sessoes} sessão(ões) x ${formatCurrency(
                  p.valor_sessao
                )} = ${formatCurrency(p.total)}`
              );
            });
            const totalOpcao = op.procedimentos.reduce((acc, cur) => acc + (cur.total || 0), 0);
            items.push(`Investimento Total: ${formatCurrency(totalOpcao)}`);
          }

          if (op.formas_pagamento && op.formas_pagamento.length > 0) {
            items.push("Condições de Pagamento:");
            op.formas_pagamento.forEach((fp) => {
              if (fp.tipo === "a_vista") {
                items.push(`• À vista com ${fp.desconto || 0}% de desconto`);
              } else {
                items.push(`• Parcelado em até ${fp.num_parcelas || 1}x`);
              }
            });
          }

          sections.push({
            title: op.titulo || `Opção #${idx + 1}`,
            items,
          });
        });
      }

      // Cronograma Clínico
      if (proposta.cronograma?.etapas && proposta.cronograma.etapas.length > 0) {
        sections.push({
          title: proposta.cronograma.titulo || "Cronograma Clínico Sugerido",
          items: proposta.cronograma.etapas.map((et) => {
            const periodo =
              et.tipo_data === "unica"
                ? et.data
                  ? formatDateBR(et.data)
                  : "Data única"
                : `${formatDateBR(et.data_inicio)} até ${formatDateBR(et.data_fim)}`;
            return `${periodo}: ${et.desc_etapa}`;
          }),
        });
      }

      // Tópicos Complementares
      if (proposta.topicos && proposta.topicos.length > 0) {
        proposta.topicos.forEach((t) => {
          sections.push({
            title: t.titulo,
            paragraph: t.texto,
          });
        });
      }

      const pdfFile = await generateGenericClinicalPdf({
        fileName,
        title: "Proposta de Planejamento Clínico",
        subtitle: `Título: ${proposta.titulo}`,
        patientName: pacienteNome,
        patientCpf: formatCPF(pacienteCpf),
        patientPhone: pacienteTelefone,
        dateStr: formatDateBR(proposta.created_at || proposta.assinado_em),
        professionalName: proposta.profissional || "Dra. Juliana Sena de Souza Vieira",
        sections,
      });

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

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const styles = Array.from(document.querySelectorAll("link[rel='stylesheet'], style"))
      .map((style) => style.outerHTML)
      .join("\n");

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title></title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 16mm 14mm 16mm 14mm;
            }

            *, *::before, *::after {
              box-sizing: border-box;
            }

            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }

            .print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
            }

            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            table, tr, td, th {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            thead {
              display: table-header-group !important;
            }

            h3, .section-title {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }

            .print-footer {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-top: 28px !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1200);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
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

      <div className="relative w-[95vw] max-w-[1300px] h-[90vh] bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col lg:flex-row overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Painel Lateral com Informações e Ações */}
        <div
          className={`bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 overflow-y-auto print:hidden transition-all duration-300 ${
            isSidebarOpen ? "w-full lg:w-80" : "w-0 p-0 overflow-hidden border-0 hidden"
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Relatório de Proposta Clínica
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Paciente</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {pacienteNome}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Título da Proposta</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {proposta.titulo}
                </span>
              </div>

              {proposta.objetivo && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Objetivo Clínico</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mt-0.5 leading-relaxed">
                    {proposta.objetivo}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Data de Emissão</span>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 block mt-0.5">
                  {formatDateBR(proposta.created_at || proposta.assinado_em)}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Profissional Responsável</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  Juliana Sena de Souza Vieira • COREN-BA 366.344
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Assinatura Digital</span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all block mt-0.5">
                  SHA-256: {proposta.payload_hash ? `${proposta.payload_hash.substring(0, 16)}...` : "AUTÊNTICO"}
                </span>
              </div>
            </div>

            <div className="bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/60 p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300">Padrão Institucional A4</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Relatório oficial de proposta terapêutica com detalhamento de opções, procedimentos, condições de investimento, cronograma sugerido e chancela de autenticidade.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 mt-6">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharingWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <WhatsAppIcon className="w-4 h-4 shrink-0" />
              <span>{isSharingWhatsApp ? "Preparando envio..." : "Enviar pelo WhatsApp"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Gerar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>
        </div>

        {/* Pré-visualização da Folha A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/40 flex justify-center items-start relative">
          {/* Botão de Toggle para Ocultar / Mostrar Detalhes */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="absolute top-4 left-4 p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md cursor-pointer z-30 transition-all hover:scale-105 print:hidden"
            title={isSidebarOpen ? "Ocultar Painel Lateral" : "Mostrar Painel Lateral"}
          >
            {isSidebarOpen ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <PanelLeftClose className="w-4 h-4" />
                <span className="hidden sm:inline">Ocultar Painel</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <PanelLeftOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Mostrar Painel</span>
              </div>
            )}
          </button>

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
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-6 w-full">
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
              <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 w-full mb-6 print-avoid-break">
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
              <div className="mb-6 p-4 rounded-2xl bg-teal-50/40 border border-teal-200/70 print-avoid-break">
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
                  <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between">
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
                          className="rounded-2xl border border-slate-200 overflow-hidden print-avoid-break bg-white"
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
                  <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between">
                    <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                      {proposta.cronograma.titulo || "CRONOGRAMA CLÍNICO SUGERIDO"}
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500">
                      Sequência programada ({proposta.cronograma.etapas.length} etapas)
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 print-avoid-break">
                    <table className="w-full text-left border-collapse text-xs print-avoid-break">
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
                  <div className="border-b-2 border-slate-400 pb-1.5 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                      ORIENTAÇÕES & CONSIDERAÇÕES COMPLEMENTARES
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {proposta.topicos.map((topico, idx) => (
                      <div key={topico.id || idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 print-avoid-break text-xs">
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
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer">
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
