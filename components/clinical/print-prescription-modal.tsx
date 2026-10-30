"use client";

import React, { useRef, useState } from "react";
import { X, Printer, FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { PrescriptionItem } from "@/types/clinical-record";
import type { Client } from "@/types/client";

interface PrintPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: PrescriptionItem;
  client: Client;
}

function formatCPF(cpf?: string): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf;
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
}

function formatDateToPortuguese(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `Salvador - BA, ${day} de ${month} de ${year}`;
}

export function PrintPrescriptionModal({
  isOpen,
  onClose,
  prescription,
  client,
}: PrintPrescriptionModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isOpen) return null;

  // Função para parsear a dosagem formatada e obter os detalhes estruturados
  const parseRxDetails = (rx: PrescriptionItem) => {
    const dosagemStr = rx.dosagem;
    
    let componentes: { nome: string; qtd: string }[] = [];
    let veiculoInfo = "";
    let dosagemInfo = "";
    let totalInfo = "";
    
    try {
      const emIndex = dosagemStr.indexOf(" em ");
      if (emIndex !== -1) {
        const assetsPart = dosagemStr.substring(0, emIndex);
        componentes = assetsPart.split(" + ").map(a => {
          const colonIdx = a.indexOf(": ");
          if (colonIdx !== -1) {
            return {
              nome: a.substring(0, colonIdx).trim(),
              qtd: a.substring(colonIdx + 2).trim()
            };
          }
          return { nome: a.trim(), qtd: "" };
        });
        
        const remaining = dosagemStr.substring(emIndex + 4);
        const parenthesIndex = remaining.indexOf(" (");
        
        if (parenthesIndex !== -1) {
          veiculoInfo = remaining.substring(0, parenthesIndex).trim();
          const insideParentheses = remaining.substring(parenthesIndex + 2, remaining.length - 1);
          
          if (insideParentheses.includes(" | ")) {
            const parts = insideParentheses.split(" | ");
            dosagemInfo = parts[0].replace("Dose: ", "").trim();
            totalInfo = parts[1].replace("Total: ", "").trim();
          } else {
            totalInfo = insideParentheses.replace("Total: ", "").trim();
          }
        } else {
          veiculoInfo = remaining;
        }
      } else {
        componentes = [{ nome: rx.medicamento, qtd: rx.dosagem }];
      }
    } catch (e) {
      console.warn("Falha ao parsear dosagem", e);
      componentes = [{ nome: rx.medicamento, qtd: rx.dosagem }];
    }
    
    // Parse de orientações e farmácia
    let orientPaciente = "";
    let orientFarmacia = "";
    
    if (rx.instrucoes) {
      if (rx.instrucoes.includes("[Observações à Farmácia Magistral]\n")) {
        const parts = rx.instrucoes.split("[Observações à Farmácia Magistral]\n");
        orientPaciente = parts[0].replace("[Orientações ao Paciente]\n", "").trim();
        if (parts.length > 1) {
          orientFarmacia = parts[1].trim();
        }
      } else {
        orientPaciente = rx.instrucoes.replace("[Orientações ao Paciente]\n", "").trim();
      }
    }
    
    return {
      componentes: componentes.length > 0 ? componentes : [{ nome: rx.medicamento, qtd: rx.dosagem }],
      veiculo: veiculoInfo || "Veículo base adequado",
      dosagem: dosagemInfo,
      total: totalInfo || rx.duracao,
      orientPaciente,
      orientFarmacia
    };
  };

  const rxDetails = parseRxDetails(prescription);

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
            /* Remove cabeçalho (título/data) e rodapé (URL/páginas) automáticos do navegador */
            @page {
              size: A4 portrait;
              margin: 0;
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
            /* Aplica a margem limpa da folha no container interno */
            .print-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              padding: 14mm 12mm !important;
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
            .print-footer {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-top: 24px !important;
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
        {/* Painel Lateral com Ações */}
        <div
          className={`bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between shrink-0 overflow-y-auto print:hidden transition-all duration-300 ${
            isSidebarOpen ? "w-full lg:w-80" : "w-0 p-0 overflow-hidden border-0 hidden"
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span className="font-semibold text-slate-800">Receituário</span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Paciente</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">{client.nome}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Fórmula / Medicamento</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">{prescription.medicamento}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Via de Administração</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-0.5">Uso {prescription.via}</span>
              </div>
            </div>

            <div className="bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800 p-4 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-400">Padrão A4</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Este relatório foi otimizado para papel A4. Você pode imprimi-lo ou salvá-lo como PDF utilizando as opções de impressão do seu navegador.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 mt-6">
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Gerar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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

          <div
            id="receituario-print-area"
            ref={printAreaRef}
            className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[15mm] sm:p-[20mm] shadow-lg border border-slate-200 flex flex-col justify-between space-y-6 mx-auto metropolis-font"
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
              <div className="flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 w-full mb-6 print-avoid-break">
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

              {/* Corpo da Prescrição */}
              <div className="mt-8 space-y-6">
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
                  <div className="space-y-2 print-avoid-break">
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

                {/* Veículo & Apresentação */}
                {rxDetails.veiculo && (
                  <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3 bg-white text-xs print-avoid-break">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Veículo Base</span>
                      <span className="font-semibold text-slate-800">{rxDetails.veiculo}</span>
                    </div>
                    {prescription.via.toLowerCase() === "oral" ? (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Dose / Apresentação</span>
                        <span className="font-semibold text-slate-800">
                          {rxDetails.dosagem ? `${rxDetails.dosagem} dose(s)` : "Cápsula vegetal"}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Dosagem (Q.S.P.)</span>
                        <span className="font-semibold text-slate-800">{rxDetails.dosagem || "q.s.p."}</span>
                      </div>
                    )}
                    <div className="col-span-2 border-t border-slate-100 pt-2 flex justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantidade Total</span>
                        <span className="font-bold text-slate-800">{rxDetails.total}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Posologia */}
                <div className="border-l-4 border-slate-800 bg-slate-50 p-4 rounded-r-xl print-avoid-break">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">
                    POSOLOGIA (Frequência & Horários)
                  </h4>
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    {prescription.posologia}
                  </p>
                </div>

                {/* Orientações ao Paciente */}
                {rxDetails.orientPaciente && (
                  <div className="space-y-1.5 print-avoid-break">
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
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 print-avoid-break">
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
            <div className="mt-auto pt-6 border-t border-slate-200 space-y-4 print-footer">
              <div className="text-center text-xs text-slate-700">
                <span>{formatDateToPortuguese(prescription.data)}</span>
              </div>

              {/* Bloco de Assinatura Digital VIDaaS */}
              <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-teal-600/40 rounded-xl bg-teal-50/20 max-w-sm mx-auto text-center">
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
