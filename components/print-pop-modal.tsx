"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  ClipboardList,
  Pill,
  Sparkles,
  ListChecks,
  CheckCircle2,
  Stethoscope,
} from "lucide-react";
import type { PopProtocoloCompleto, PopBloco } from "@/types/pop";
import type { Client } from "@/types/client";

interface PrintPopModalProps {
  isOpen: boolean;
  onClose: () => void;
  pop: PopProtocoloCompleto;
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

function calculateAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return "";
  try {
    const clean = birthDateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length !== 3) return "";
    const birth = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? ` (${age} anos)` : "";
  } catch {
    return "";
  }
}

function formatDateToPortuguese(dateStr?: string | null): string {
  const clean = dateStr ? dateStr.split("T")[0] : null;
  const date = clean ? new Date(clean + "T12:00:00") : new Date();
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `Salvador - BA, ${day} de ${month} de ${year}`;
}

export function PrintPopModal({ isOpen, onClose, pop, client }: PrintPopModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isOpen) return null;

  const pacienteNome = client?.nome || pop.paciente?.nome || "Paciente";
  const pacienteNasc = client?.data_nascimento || pop.paciente?.data_nascimento;
  const pacienteCpf = client?.cpf || pop.paciente?.cpf;

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

  const blocosOrdenados = [...(pop.blocos || [])].sort((a, b) => a.ordem - b.ordem);
  const totalTopicos = blocosOrdenados.filter((b) => b.tipo === "TOPICO").length;
  const totalPrescricoes = blocosOrdenados.filter((b) => b.tipo === "PRESCRICAO").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .metropolis-font,
        .metropolis-font * {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
      `,
        }}
      />

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
                <ClipboardList className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Relatório POP Oficial
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Paciente
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {pacienteNome}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Procedimento / Protocolo
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {pop.protocolo}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Data de Emissão
                </span>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 block mt-0.5">
                  {formatDateBR(pop.data_pop)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Profissional Responsável
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {pop.profissional || "Juliana Sena de Souza Vieira"} • COREN-BA 366.344
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Tópicos</span>
                  <strong className="text-sm text-slate-800 dark:text-slate-200">{totalTopicos}</strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block">Prescrições</span>
                  <strong className="text-sm text-teal-600 dark:text-teal-400">{totalPrescricoes}</strong>
                </div>
              </div>
              {pop.payload_hash && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Assinatura Digital SHA-256
                  </span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all block mt-0.5">
                    {pop.payload_hash.substring(0, 16)}...
                  </span>
                </div>
              )}
            </div>

            <div className="bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/60 p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300">
                Padrão Institucional A4
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Relatório operacional e terapêutico completo com cabeçalho institucional, dados do
                paciente, diretrizes passo a passo, detalhamento de receitas e chancela
                criptográfica.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 mt-6">
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

        {/* Área de Visualização da Folha A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/40 flex justify-center items-start relative">
          {/* Botão de Alternância do Painel Lateral */}
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
            id="pop-print-area"
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[16mm] shadow-lg border border-slate-200 flex flex-col justify-between space-y-6 mx-auto metropolis-font"
            style={{
              boxSizing: "border-box",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <div>
              {/* 1. Cabeçalho Oficial do Relatório */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-5 w-full">
                {/* Lado Esquerdo: Logo + Título, Nome e Especialidade */}
                <div className="flex items-center gap-4">
                  <img
                    src="/logo-clinica.png"
                    alt="Logo Clínica"
                    className="h-16 w-auto object-contain flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex flex-col justify-center">
                    <span className="text-xs sm:text-sm font-bold tracking-wider text-slate-800 uppercase whitespace-nowrap leading-tight mb-0.5">
                      PROCEDIMENTO OPERACIONAL PADRÃO (POP) & PROTOCOLO CLÍNICO
                    </span>
                    <span className="text-base font-bold text-slate-900 whitespace-nowrap leading-tight">
                      Juliana Sena de Souza Vieira
                    </span>
                    <span className="text-xs text-slate-500 font-medium leading-tight">
                      Enfermeira Esteta
                    </span>
                  </div>
                </div>

                {/* Lado Direito: Registro Profissional */}
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">
                    COREN-BA 366.344
                  </span>
                </div>
              </div>

              {/* 2. Dados de Identificação do Paciente */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 mb-5 print-avoid-break">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Paciente
                    </span>
                    <span className="font-bold text-slate-900 block truncate">{pacienteNome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      CPF
                    </span>
                    <span className="text-slate-700 font-mono block">
                      {formatCPF(pacienteCpf)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Nascimento
                    </span>
                    <span className="text-slate-700 block">
                      {formatDateBR(pacienteNasc)}
                      {calculateAge(pacienteNasc)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">
                      Data do POP
                    </span>
                    <span className="font-bold text-teal-800 block">
                      {formatDateBR(pop.data_pop)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Destaque do Protocolo / Procedimento */}
              <div className="bg-teal-50/60 border border-teal-200/80 p-3.5 rounded-xl mb-4 print-avoid-break">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider">
                    Protocolo Clínico
                  </span>
                </div>
                <h2 className="text-base font-extrabold text-teal-950 leading-tight">
                  {pop.protocolo}
                </h2>
              </div>

              {/* 4. Finalidade do Procedimento */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white mb-5 print-avoid-break">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-2">
                  <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-teal-100 text-teal-900 border border-teal-200">
                    Finalidade Clínica
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Objetivo terapêutico e diretriz geral de aplicação
                  </span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {pop.finalidade}
                </p>
              </div>

              {/* 5. Sequência dos Blocos Ordenados (Tópicos e Prescrições) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Estrutura Operacional & Prescrições Integradas
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {blocosOrdenados.length} {blocosOrdenados.length === 1 ? "bloco" : "blocos"}
                  </span>
                </div>

                {blocosOrdenados.map((bloco, idx) => {
                  const numBloco = idx + 1;

                  if (bloco.tipo === "TOPICO") {
                    return (
                      <div
                        key={bloco.id || idx}
                        className="border border-slate-200 rounded-xl p-3.5 bg-white print-avoid-break space-y-2.5"
                      >
                        {/* Título do Tópico */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-teal-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {numBloco}
                            </span>
                            <h3 className="text-xs font-bold text-slate-900">
                              {bloco.topico_titulo}
                            </h3>
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                            Tópico Operacional
                          </span>
                        </div>

                        {/* Descrição do Tópico */}
                        {bloco.topico_descricao && (
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pl-7">
                            {bloco.topico_descricao}
                          </p>
                        )}

                        {/* Subtópicos Hierárquicos */}
                        {bloco.subtopicos && bloco.subtopicos.length > 0 && (
                          <div className="pl-7 pt-1 space-y-2">
                            {bloco.subtopicos
                              .sort((a, b) => a.ordem - b.ordem)
                              .map((sub, sIdx) => (
                                <div
                                  key={sub.id || sIdx}
                                  className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80 space-y-1"
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-800">
                                    <span className="text-teal-700">{numBloco}.{sIdx + 1}</span>
                                    <span>{sub.titulo}</span>
                                  </div>
                                  {sub.descricao && (
                                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap pl-4">
                                      {sub.descricao}
                                    </p>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Bloco do Tipo PRESCRIÇÃO
                  const rx = bloco.prescricao;
                  const itensRx = rx?.prescricao_itens || [];

                  return (
                    <div
                      key={bloco.id || idx}
                      className="border border-teal-200/80 rounded-xl p-3.5 bg-teal-50/30 print-avoid-break space-y-2.5"
                    >
                      {/* Cabeçalho da Prescrição */}
                      <div className="flex items-center justify-between border-b border-teal-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {numBloco}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Pill className="w-3.5 h-3.5 text-teal-700" />
                            <h3 className="text-xs font-bold text-teal-950">
                              Prescrição Vinculada ao Protocolo
                            </h3>
                          </div>
                        </div>
                        {rx?.data_prescricao && (
                          <span className="text-[10px] font-medium text-teal-800 bg-white/80 px-2 py-0.5 rounded border border-teal-200">
                            Receita de {formatDateBR(rx.data_prescricao)}
                          </span>
                        )}
                      </div>

                      {/* Itens e Fórmulas da Prescrição */}
                      {itensRx.length > 0 ? (
                        <div className="space-y-2 pl-7">
                          {itensRx.map((item: any, itIdx: number) => (
                            <div
                              key={item.id || itIdx}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 text-xs"
                            >
                              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">
                                  {itIdx + 1}. {item.nome_formula}
                                </span>
                                {item.via && (
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                    Via {item.via}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
                                {item.dosagem && (
                                  <div>
                                    <strong className="text-slate-700">Dosagem:</strong> {item.dosagem}
                                    {item.veiculo ? ` em ${item.veiculo}` : ""}
                                  </div>
                                )}
                                {item.posologia && (
                                  <div>
                                    <strong className="text-slate-700">Posologia:</strong> {item.posologia}
                                  </div>
                                )}
                              </div>

                              {item.orient_paciente && (
                                <div className="text-[11px] text-slate-700 pt-1 border-t border-slate-100 mt-1">
                                  <strong className="text-teal-900">Orientações ao Paciente:</strong>{" "}
                                  {item.orient_paciente}
                                </div>
                              )}

                              {item.orient_farmacia && (
                                <div className="text-[10px] text-slate-500 italic">
                                  <strong>Nota Farmácia:</strong> {item.orient_farmacia}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600 pl-7 italic">
                          Receita ID: {bloco.prescricao_id} vinculada ao protocolo.
                        </div>
                      )}

                      {rx?.observacoes && (
                        <p className="text-[11px] text-slate-600 pl-7">
                          <strong>Observações:</strong> {rx.observacoes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6. Rodapé Institucional com Chancela Criptográfica */}
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-medium">{formatDateToPortuguese(pop.data_pop)}</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  Juliana Sena de Souza Vieira • COREN-BA 366.344
                </span>
              </div>

              {/* Chancela de Assinatura Hash */}
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Procedimento Operacional Assinado Digitalmente (Integridade e Autenticidade via
                    SHA-256)
                  </span>
                </div>
                <div className="font-mono text-emerald-900 font-bold truncate max-w-[280px]">
                  Hash: {pop.payload_hash || "AUTÊNTICO"}
                </div>
              </div>

              {/* Rodapé de contato da clínica */}
              <div className="text-center text-[9px] text-slate-400">
                Juliana Sena de Souza Vieira • Estética Avançada e Laserterapia • Salvador - BA •
                Telefone: (71) 98661-2878
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
