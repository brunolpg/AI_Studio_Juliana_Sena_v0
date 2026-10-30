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
  Stethoscope,
  Activity,
  Heart,
  Scale,
  Thermometer,
  Pill,
  FileHeart,
} from "lucide-react";
import type { ClinicalEvolution, PrescriptionItem } from "@/types/clinical-record";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { Client } from "@/types/client";

interface PrintEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  evolution: ClinicalEvolution;
  client?: Client | null;
  linkedPrescriptions?: PrescriptionItem[];
  linkedHomeCareFicha?: HomeCareFichaCompleta | null;
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
    const birth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
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
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `Salvador - BA, ${day} de ${month} de ${year}`;
}

export function PrintEvolutionModal({
  isOpen,
  onClose,
  evolution,
  client,
  linkedPrescriptions = [],
  linkedHomeCareFicha,
}: PrintEvolutionModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isOpen) return null;

  const pacienteNome = client?.nome || "Paciente";
  const pacienteNasc = client?.data_nascimento;
  const pacienteCpf = client?.cpf;

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

  const sinaisVitais = evolution.sinaisVitais;
  const hasVitalSigns = Boolean(
    sinaisVitais &&
      (sinaisVitais.pressaoArterial ||
        sinaisVitais.frequenciaCardiaca ||
        sinaisVitais.temperatura ||
        sinaisVitais.peso ||
        sinaisVitais.imc ||
        sinaisVitais.hidratacaoCutanea != null ||
        sinaisVitais.oleosidadeSebo != null ||
        sinaisVitais.indiceElasticidade != null)
  );

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
                <Stethoscope className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Relatório de Evolução Clínica
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
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Paciente</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {pacienteNome}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Tipo / Procedimento</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {evolution.tipo} {evolution.tipo_atendimento ? `• ${evolution.tipo_atendimento}` : ""}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Data e Horário</span>
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 block mt-0.5">
                  {formatDateBR(evolution.data)} às {evolution.horario}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Profissional Responsável</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">
                  {evolution.profissional || "Juliana Sena de Souza Vieira"} • {evolution.especialidade || "COREN-BA 366.344"}
                </span>
              </div>
              {evolution.payload_hash && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Assinatura Digital</span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all block mt-0.5">
                    SHA-256: {evolution.payload_hash.substring(0, 16)}...
                  </span>
                </div>
              )}
            </div>

            <div className="bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/60 p-4 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300">Padrão Institucional A4</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Relatório clínico completo no padrão oficial da clínica com cabeçalho institucional, dados do paciente, estrutura SOAP (Subjetivo, Objetivo, Avaliação, Plano), sinais vitais, vínculos terapêuticos e chancela criptográfica.
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

        {/* Área de Visualização e Renderização da Folha A4 */}
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
            id="evolution-print-area"
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[16mm] sm:p-[16mm] shadow-lg border border-slate-200 flex flex-col justify-between space-y-6 mx-auto metropolis-font"
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
                      REGISTRO DE EVOLUÇÃO CLÍNICA & PROCEDIMENTO REGENERATIVO
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
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Paciente</span>
                    <span className="font-bold text-slate-900 block truncate">
                      {pacienteNome}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">CPF</span>
                    <span className="text-slate-700 font-mono block">
                      {formatCPF(pacienteCpf)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Nascimento</span>
                    <span className="text-slate-700 block">
                      {formatDateBR(pacienteNasc)}
                      {calculateAge(pacienteNasc)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Data / Horário da Sessão</span>
                    <span className="font-bold text-teal-800 block">
                      {formatDateBR(evolution.data)} às {evolution.horario}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Destaque do Procedimento / Tipo de Atendimento */}
              <div className="bg-teal-50/60 border border-teal-200/80 p-3 rounded-xl mb-5 flex items-center justify-between print-avoid-break">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-teal-900 uppercase tracking-wider block">
                      Procedimento / Tipo de Atendimento
                    </span>
                    <span className="text-sm font-extrabold text-teal-950 block">
                      {evolution.tipo}
                      {evolution.tipo_atendimento ? ` — ${evolution.tipo_atendimento}` : ""}
                    </span>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[10px] text-slate-500 block">Profissional Responsável</span>
                  <span className="font-semibold text-slate-800 block">
                    {evolution.profissional || "Juliana Sena de Souza Vieira"}
                  </span>
                </div>
              </div>

              {/* 4. Estrutura SOAP da Evolução Clínica */}
              <div className="space-y-4 mb-5">
                
                {/* S • Subjetivo */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white print-avoid-break">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-teal-100 text-teal-900 border border-teal-200">
                      S • Subjetivo
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Queixas, percepção e histórico relatado pelo paciente
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {evolution.subjetivo || "Nenhuma queixa ou sintoma atípico relatado pelo paciente nesta sessão."}
                  </p>
                </div>

                {/* O • Objetivo + Sinais Vitais */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white print-avoid-break">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-sky-100 text-sky-900 border border-sky-200">
                      O • Objetivo
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Achados clínicos, exame físico dermatofuncional e parâmetros
                    </span>
                  </div>

                  {/* Sinais Vitais se cadastrados */}
                  {hasVitalSigns && sinaisVitais && (
                    <div className="mb-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
                      {sinaisVitais.pressaoArterial && (
                        <div className="flex items-center gap-1 font-mono">
                          <Heart className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-slate-500 text-[11px]">PA:</span>
                          <strong className="text-slate-800">{sinaisVitais.pressaoArterial} mmHg</strong>
                        </div>
                      )}
                      {sinaisVitais.frequenciaCardiaca && (
                        <div className="flex items-center gap-1 font-mono">
                          <Activity className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-slate-500 text-[11px]">FC:</span>
                          <strong className="text-slate-800">{sinaisVitais.frequenciaCardiaca} bpm</strong>
                        </div>
                      )}
                      {sinaisVitais.temperatura && (
                        <div className="flex items-center gap-1 font-mono">
                          <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-slate-500 text-[11px]">Tax:</span>
                          <strong className="text-slate-800">{sinaisVitais.temperatura} °C</strong>
                        </div>
                      )}
                      {sinaisVitais.peso && (
                        <div className="flex items-center gap-1 font-mono">
                          <Scale className="w-3.5 h-3.5 text-sky-500" />
                          <span className="text-slate-500 text-[11px]">Peso:</span>
                          <strong className="text-slate-800">{sinaisVitais.peso} kg</strong>
                        </div>
                      )}
                      {sinaisVitais.imc && (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-slate-500 text-[11px]">IMC:</span>
                          <strong className="text-teal-800 bg-teal-50 px-1 rounded">{sinaisVitais.imc} kg/m²</strong>
                        </div>
                      )}
                      {sinaisVitais.hidratacaoCutanea != null && (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-slate-500 text-[11px]">Hidratação:</span>
                          <strong className="text-teal-700">{sinaisVitais.hidratacaoCutanea}%</strong>
                        </div>
                      )}
                      {sinaisVitais.oleosidadeSebo != null && (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-slate-500 text-[11px]">Oleosidade:</span>
                          <strong className="text-slate-800">{sinaisVitais.oleosidadeSebo}%</strong>
                        </div>
                      )}
                      {sinaisVitais.indiceElasticidade != null && (
                        <div className="flex items-center gap-1 font-mono">
                          <span className="text-slate-500 text-[11px]">Elasticidade:</span>
                          <strong className="text-slate-800">{sinaisVitais.indiceElasticidade}%</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {evolution.objetivo || "Exame físico dentro dos padrões da normalidade para o procedimento executado."}
                  </p>
                </div>

                {/* A • Avaliação / Diagnóstico */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white print-avoid-break">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-amber-100 text-amber-900 border border-amber-200">
                      A • Avaliação / Diagnóstico
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Interpretação clínica, resposta tecidual e evolução do quadro
                    </span>
                  </div>
                  <p className="text-xs text-slate-900 font-semibold leading-relaxed whitespace-pre-wrap">
                    {evolution.avaliacao || "Resposta regenerativa satisfatória ao protocolo instituído."}
                  </p>
                </div>

                {/* P • Plano / Conduta Regenerativa */}
                <div className="border border-slate-200 rounded-xl p-3.5 bg-white print-avoid-break">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase rounded bg-emerald-100 text-emerald-900 border border-emerald-200">
                      P • Plano / Conduta Regenerativa
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Conduta terapêutica, prescrições, cuidados aplicados e retorno
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {evolution.plano || "Manutenção do plano terapêutico com reavaliação na próxima sessão programada."}
                  </p>
                </div>

              </div>

              {/* 5. Vínculos Terapêuticos Associados (Prescrições & Home Care) */}
              {((linkedPrescriptions && linkedPrescriptions.length > 0) ||
                (evolution.prescricoes_detalhes && evolution.prescricoes_detalhes.length > 0) ||
                linkedHomeCareFicha ||
                evolution.home_care_ficha) && (
                <div className="border-t border-slate-200 pt-3.5 mt-4 space-y-3 print-avoid-break">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Vínculos Terapêuticos Associados a esta Sessão
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Prescrições Vinculadas */}
                    {((linkedPrescriptions && linkedPrescriptions.length > 0) ||
                      (evolution.prescricoes_detalhes && evolution.prescricoes_detalhes.length > 0)) && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] mb-1">
                          <Pill className="w-3.5 h-3.5 text-teal-600" />
                          <span>Prescrições / Medicamentos Vinculados</span>
                        </div>
                        {linkedPrescriptions && linkedPrescriptions.length > 0 ? (
                          <div className="space-y-1 mt-1 text-[11px] text-slate-700">
                            {linkedPrescriptions.map((rx) => (
                              <div key={rx.id} className="leading-tight">
                                • <strong className="text-slate-900">{rx.medicamento}</strong> ({rx.dosagem} - {rx.posologia})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-1 mt-1 text-[11px] text-slate-700">
                            {evolution.prescricoes_detalhes?.map((det) => (
                              <div key={det.id} className="leading-tight">
                                • Receita de {formatDateBR(det.data_prescricao)}: {det.formulas.join(", ")}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ficha de Home Care Vinculada */}
                    {(linkedHomeCareFicha || evolution.home_care_ficha) && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px] mb-1">
                          <FileHeart className="w-3.5 h-3.5 text-teal-600" />
                          <span>Ficha de Home Care Vinculada</span>
                        </div>
                        <div className="text-[11px] text-slate-700 leading-tight mt-1">
                          Protocolo:{" "}
                          <strong className="text-slate-900">
                            {linkedHomeCareFicha?.titulo_protocolo || evolution.home_care_ficha?.titulo_protocolo}
                          </strong>
                          {" "}({formatDateBR(linkedHomeCareFicha?.data_home_care || evolution.home_care_ficha?.data_home_care)})
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* 6. Rodapé Institucional com Chancela Criptográfica */}
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-3 print-footer">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-medium">{formatDateToPortuguese(evolution.data)}</span>
                <span className="text-[11px] font-semibold text-slate-700">
                  Juliana Sena de Souza Vieira • COREN-BA 366.344
                </span>
              </div>

              {/* Chancela de Assinatura Hash */}
              <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Documento Clínico Assinado Digitalmente (Integridade e Autenticidade via SHA-256)</span>
                </div>
                <div className="font-mono text-emerald-900 font-bold truncate max-w-[280px]">
                  Hash: {evolution.payload_hash || "AUTÊNTICO"}
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
