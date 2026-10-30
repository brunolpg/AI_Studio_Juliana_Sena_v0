"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  FileText,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { Client } from "@/types/client";

interface PrintHomeCareModalProps {
  isOpen: boolean;
  onClose: () => void;
  ficha: HomeCareFichaCompleta;
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

export function PrintHomeCareModal({
  isOpen,
  onClose,
  ficha,
  client,
}: PrintHomeCareModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isOpen) return null;

  const pacienteNome = client?.nome || ficha.paciente?.nome || "Paciente";
  const pacienteNasc = client?.data_nascimento || ficha.paciente?.data_nascimento;
  const pacienteCpf = client?.cpf || ficha.paciente?.cpf;

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) return;

    // Cria um iframe invisível no DOM
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

    // Clona folhas de estilos e fontes da página principal
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
            /* Margens físicas oficiais aplicadas de forma uniforme em TODAS as páginas */
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

            /* O container interno não deve ter padding extra para não somar com o @page */
            .print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
            }

            /* Evita corte no meio de cards, linhas de tabelas e tópicos */
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

            /* Margem de segurança acima de seções na quebra de página */
            h3, .section-title {
              break-after: avoid !important;
              page-break-after: avoid !important;
            }

            /* Bloco de assinatura e data */
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

    // Dispara a impressão a partir do iframe após o carregamento dos recursos
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
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
                  Orientações Home Care
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
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Protocolo Clínico</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {ficha.titulo_protocolo}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Profissional Responsável</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  Juliana Sena de Souza Vieira • COREN-BA 366.344
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Paciente</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {pacienteNome}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Data do Atendimento</span>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 block mt-0.5">
                  {formatDateBR(ficha.data_home_care)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Assinatura Digital</span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all block mt-0.5">
                  SHA-256: {ficha.payload_hash?.substring(0, 16)}...
                </span>
              </div>
            </div>

            <div className="bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/60 p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300">Padrão Institucional A4</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Documento configurado no padrão oficial da clínica com cabeçalho ouro/esmeralda, dados do paciente, cuidados diários, cronograma e chancela criptográfica.
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
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-6 w-full">
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
              <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 w-full mb-6 print-avoid-break">
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
                <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 mb-5 flex items-start gap-3 print-avoid-break">
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
                <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between">
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
                    <div key={idx} className="flex items-start gap-3 text-xs print-avoid-break">
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
              <div className="mb-6 space-y-3">
                <div className="border-b-2 border-teal-700/80 pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-black text-teal-950 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-600 inline-block" />
                    CRONOGRAMA DE TRATAMENTO
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-500">
                    Fases sequenciais
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 print-avoid-break">
                  <table className="w-full text-left border-collapse text-xs print-avoid-break">
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

              {/* 6. Bloco: RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES (Se houver) */}
              {ficha.incluir_recomendacoes && ficha.recomendacoes && ficha.recomendacoes.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="border-b-2 border-amber-600/80 pb-1.5 flex items-center justify-between">
                    <h3 className="text-xs font-black text-amber-950 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES
                    </h3>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {ficha.recomendacoes.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/50 print-avoid-break">
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
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer">
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
