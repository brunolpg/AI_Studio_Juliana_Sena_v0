import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

/**
 * Geração server-side do PDF da receita (A4, texto pesquisável, fontes padrão).
 *
 * O PDF é pensado para ser assinado depois (PAdES / ICP-Brasil via VIDaaS):
 *  - salvo SEM object streams (xref clássico), o formato mais compatível com
 *    assinadores que acrescentam a assinatura por atualização incremental;
 *  - leva o ID da prescrição nos metadados (Keywords "rx:<id>") e no rodapé,
 *    para conferir, no upload, se o arquivo assinado é desta receita.
 */

export const PROFISSIONAL = {
  nome: "Juliana Sena de Souza Vieira",
  cargo: "Enfermeira Esteta",
  registro: "COREN-BA 366.344",
  rodape:
    "Juliana Sena de Souza Vieira • Estética Avançada e Regenerativa • Salvador - BA • Telefone: (71) 98661-2878 • COREN-BA 366.344",
} as const;

/** Prefixo do marcador gravado nos metadados do PDF. */
export const RX_MARKER_PREFIX = "rx:";

export interface PrescriptionPdfComponent {
  nome?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
}

export interface PrescriptionPdfInput {
  id: string;
  /** YYYY-MM-DD */
  dataPrescricao?: string | null;
  observacoes?: string | null;
  paciente: { nome?: string | null; cpf?: string | null };
  item: {
    nome_formula?: string | null;
    via?: string | null;
    veiculo?: string | null;
    dosagem?: number | string | null;
    tipo_veiculo?: string | null;
    posologia?: string | null;
    duracao?: number | string | null;
    orient_paciente?: string | null;
    orient_farmacia?: string | null;
    componentes_snapshot?: PrescriptionPdfComponent[] | null;
  };
}

// ---- layout ---------------------------------------------------------------
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 46; // espaço do rodapé institucional

const C = {
  ink: rgb(0.06, 0.09, 0.16),
  text: rgb(0.2, 0.25, 0.33),
  muted: rgb(0.39, 0.45, 0.55),
  faint: rgb(0.58, 0.64, 0.72),
  line: rgb(0.89, 0.91, 0.94),
  panel: rgb(0.97, 0.98, 0.99),
  teal: rgb(0.05, 0.58, 0.53),
  tealBg: rgb(0.94, 0.99, 0.98),
  tealLine: rgb(0.8, 0.98, 0.95),
};

// ---- utilidades -----------------------------------------------------------
const REPLACEMENTS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "×": "x",
  "−": "-",
  "​": "",
  "﻿": "",
};

/** Mantém só caracteres que a fonte WinAnsi consegue desenhar (evita exceção do pdf-lib). */
function sanitize(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n") out += ch;
    else if (ch === "\r") continue;
    else if (ch === "\t") out += "  ";
    else if (supported.has(cp)) out += ch;
    else if (ch in REPLACEMENTS) out += REPLACEMENTS[ch];
    else if (cp < 0x20 || (cp >= 0x1f000 && cp <= 0x1faff)) continue; // controle / emoji
    else out += "?";
  }
  return out;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.trim().split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
      } else {
        // palavra maior que a linha: quebra por caractere
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      }
    }
    lines.push(line);
  }
  return lines;
}

function formatCpf(cpf?: string | null): string {
  const clean = (cpf || "").replace(/\D/g, "");
  if (clean.length !== 11) return cpf?.trim() || "Não informado";
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

function formatDatePt(date?: string | null): string {
  const d = date && /^\d{4}-\d{2}-\d{2}/.test(date) ? new Date(`${date.slice(0, 10)}T12:00:00-03:00`) : new Date();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

const present = (v: unknown): v is string | number => v !== null && v !== undefined && String(v).trim() !== "";

/** Nome de arquivo seguro (ASCII) para download. */
export function prescriptionPdfFileName(patientName?: string | null, date?: string | null): string {
  const base = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `Receita_${base || "Paciente"}_${(date || new Date().toISOString()).slice(0, 10)}.pdf`;
}

// ---- gerador --------------------------------------------------------------
export async function buildPrescriptionPdf(input: PrescriptionPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const paciente = input.paciente.nome?.trim() || "Paciente";
  const item = input.item || {};
  const isOral = (item.via || "").toLowerCase() === "oral";

  // Metadados (o marcador permite conferir o arquivo assinado no upload)
  pdf.setTitle(sanitize(regular, `Receituário - ${paciente}`));
  pdf.setAuthor(PROFISSIONAL.nome);
  pdf.setSubject("Receituário / Prescrição magistral");
  pdf.setKeywords([`${RX_MARKER_PREFIX}${input.id}`]);
  pdf.setProducer("Juliana Sena - Gestão de Pacientes");
  pdf.setCreator("Juliana Sena - Gestão de Pacientes");

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (height: number) => {
    // Nunca truncar texto em silêncio: um bloco maior que uma página inteira é erro.
    if (height > PAGE_H - MARGIN * 2 - FOOTER_RESERVED) {
      throw new Error("Conteúdo da receita extenso demais para caber em uma página do PDF. Reduza o texto do campo mais longo.");
    }
    if (y - height < MARGIN + FOOTER_RESERVED) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const text = (
    value: string,
    x: number,
    baseline: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" | "center"; width?: number } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const clean = sanitize(font, value);
    let px = x;
    if (opts.align === "right") px = x + (opts.width ?? 0) - font.widthOfTextAtSize(clean, size);
    if (opts.align === "center") px = x + ((opts.width ?? 0) - font.widthOfTextAtSize(clean, size)) / 2;
    page.drawText(clean, { x: px, y: baseline, font, size, color: opts.color ?? C.ink });
  };

  /** Bloco de texto com quebra de linha; devolve a altura usada. */
  const paragraph = (
    value: string,
    x: number,
    top: number,
    width: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; leading?: number } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const leading = opts.leading ?? size * 1.4;
    const lines = wrapText(sanitize(font, value), font, size, width);
    lines.forEach((ln, i) => {
      if (ln) text(ln, x, top - size - i * leading, { font, size, color: opts.color });
    });
    return lines.length * leading;
  };

  const measure = (value: string, width: number, font: PDFFont, size: number, leading: number) =>
    wrapText(sanitize(font, value), font, size, width).length * leading;

  // 1. Cabeçalho -------------------------------------------------------------
  text("RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL", MARGIN, y - 10, { font: bold, size: 9.5 });
  text(PROFISSIONAL.nome, MARGIN, y - 28, { font: bold, size: 15 });
  text(PROFISSIONAL.cargo, MARGIN, y - 42, { font: bold, size: 10, color: C.teal });
  text(PROFISSIONAL.registro, MARGIN, y - 12, { font: bold, size: 10, color: C.muted, align: "right", width: CONTENT_W });
  y -= 52;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.6, color: C.ink });
  y -= 18;

  // 2. Paciente --------------------------------------------------------------
  const patientBoxH = 44;
  page.drawRectangle({ x: MARGIN, y: y - patientBoxH, width: CONTENT_W, height: patientBoxH, color: C.panel, borderColor: C.line, borderWidth: 1 });
  text("PACIENTE", MARGIN + 12, y - 15, { font: bold, size: 7.5, color: C.faint });
  text(paciente, MARGIN + 12, y - 31, { font: bold, size: 11.5 });
  text("CPF", MARGIN, y - 15, { font: bold, size: 7.5, color: C.faint, align: "right", width: CONTENT_W - 12 });
  text(formatCpf(input.paciente.cpf), MARGIN, y - 31, { font: bold, size: 11.5, align: "right", width: CONTENT_W - 12 });
  y -= patientBoxH + 22;

  // 3. Fórmula ---------------------------------------------------------------
  ensure(40);
  text(item.nome_formula?.trim() || "Fórmula magistral", MARGIN, y - 13, { font: bold, size: 13.5 });
  text(`Uso ${isOral ? "Oral" : "Tópico"}`, MARGIN, y - 12, { font: bold, size: 10, color: C.muted, align: "right", width: CONTENT_W });
  y -= 28;

  // 4. Componentes (do snapshot gravado na prescrição) -------------------------
  const componentes = (item.componentes_snapshot || []).filter((c) => present(c?.nome));
  if (componentes.length > 0) {
    const rowH = 21;
    ensure(rowH * (componentes.length + 1) + 8);
    const tableTop = y;
    page.drawRectangle({ x: MARGIN, y: tableTop - rowH, width: CONTENT_W, height: rowH, color: rgb(0.95, 0.96, 0.98) });
    text("COMPONENTE / ATIVO", MARGIN + 10, tableTop - 14, { font: bold, size: 8, color: C.text });
    text("CONCENTRAÇÃO", MARGIN, tableTop - 14, { font: bold, size: 8, color: C.text, align: "right", width: CONTENT_W - 10 });
    componentes.forEach((c, i) => {
      const top = tableTop - rowH * (i + 1);
      page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.6, color: C.line });
      text(String(c.nome), MARGIN + 10, top - 14, { font: bold, size: 10 });
      const qty = present(c.quantidade) ? `${c.quantidade}${c.unidade ? c.unidade : ""}` : "";
      text(qty, MARGIN, top - 14, { font: bold, size: 10, align: "right", width: CONTENT_W - 10 });
    });
    const tableH = rowH * (componentes.length + 1);
    page.drawRectangle({ x: MARGIN, y: tableTop - tableH, width: CONTENT_W, height: tableH, borderColor: C.line, borderWidth: 1 });
    y = tableTop - tableH - 14;
  }

  // 5. Veículo / dose / total -------------------------------------------------
  const cells: Array<[string, string]> = [];
  if (present(item.veiculo)) cells.push(["VEÍCULO BASE", String(item.veiculo)]);
  if (present(item.dosagem)) {
    cells.push(isOral ? ["DOSE / APRESENTAÇÃO", `${item.dosagem} dose(s)`] : ["DOSAGEM (Q.S.P.)", `${item.dosagem} g`]);
  }
  if (present(item.duracao)) {
    const total = isOral ? `${item.duracao} ${item.tipo_veiculo || ""}`.trim() : `${item.duracao}${item.tipo_veiculo || "un"}`;
    cells.push(["QUANTIDADE TOTAL", total]);
  }
  if (cells.length > 0) {
    ensure(48);
    const h = 38;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.panel, borderColor: C.line, borderWidth: 1 });
    const colW = CONTENT_W / cells.length;
    cells.forEach(([label, value], i) => {
      const cx = MARGIN + colW * i + 12;
      text(label, cx, y - 14, { font: bold, size: 7.5, color: C.faint });
      text(value, cx, y - 28, { font: bold, size: 10.5 });
    });
    y -= h + 14;
  }

  // 6. Posologia --------------------------------------------------------------
  if (present(item.posologia)) {
    const w = CONTENT_W - 28;
    const bodyH = measure(String(item.posologia), w, regular, 10.5, 15);
    const h = bodyH + 36;
    ensure(h + 6);
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.tealBg, borderColor: C.tealLine, borderWidth: 1 });
    text("POSOLOGIA (FREQUÊNCIA E HORÁRIOS)", MARGIN + 14, y - 17, { font: bold, size: 8, color: rgb(0.07, 0.3, 0.29) });
    paragraph(String(item.posologia), MARGIN + 14, y - 22, w, { size: 10.5, leading: 15, color: rgb(0.07, 0.3, 0.29) });
    y -= h + 14;
  }

  // 7. Orientações ao paciente ------------------------------------------------
  const orientPaciente = present(item.orient_paciente) ? String(item.orient_paciente) : present(input.observacoes) ? String(input.observacoes) : "";
  if (orientPaciente) {
    const h = measure(orientPaciente, CONTENT_W, regular, 9.5, 13.5) + 18;
    ensure(h);
    text("ORIENTAÇÕES AO PACIENTE / INSTRUÇÕES ESPECIAIS", MARGIN, y - 9, { font: bold, size: 7.5, color: C.faint });
    paragraph(orientPaciente, MARGIN, y - 14, CONTENT_W, { size: 9.5, leading: 13.5, color: C.text });
    y -= h + 6;
  }

  // 8. Observações à farmácia -------------------------------------------------
  if (present(item.orient_farmacia)) {
    const w = CONTENT_W - 24;
    const h = measure(String(item.orient_farmacia), w, italic, 9, 13) + 30;
    ensure(h + 6);
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: C.panel, borderColor: C.line, borderWidth: 1 });
    text("OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL", MARGIN + 12, y - 15, { font: bold, size: 7.5, color: C.muted });
    paragraph(String(item.orient_farmacia), MARGIN + 12, y - 20, w, { font: italic, size: 9, leading: 13, color: C.muted });
    y -= h + 14;
  }

  // 9. Data e bloco de assinatura ---------------------------------------------
  ensure(130);
  y -= 14;
  text(`Salvador - BA, ${formatDatePt(input.dataPrescricao)}`, MARGIN, y - 10, { size: 10.5, color: C.text, align: "center", width: CONTENT_W });
  y -= 40;

  const sigW = 300;
  const sigH = 64;
  const sigX = MARGIN + (CONTENT_W - sigW) / 2;
  page.drawRectangle({ x: sigX, y: y - sigH, width: sigW, height: sigH, color: C.tealBg, borderColor: C.teal, borderWidth: 1.2, borderDashArray: [5, 3] });
  text(PROFISSIONAL.nome, sigX, y - 20, { font: bold, size: 11, align: "center", width: sigW });
  text(`${PROFISSIONAL.cargo} • ${PROFISSIONAL.registro}`, sigX, y - 34, { font: bold, size: 9.5, color: C.teal, align: "center", width: sigW });
  text("Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)", sigX, y - 50, {
    size: 7,
    color: C.muted,
    align: "center",
    width: sigW,
  });

  // 10. Rodapé em todas as páginas ---------------------------------------------
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 30 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 30 }, thickness: 0.6, color: C.line });
    paragraph(PROFISSIONAL.rodape, MARGIN, MARGIN + 26, CONTENT_W, { size: 7, leading: 9.5, color: C.faint });
    text(`Código da receita: ${input.id}${pages.length > 1 ? `  •  página ${i + 1}/${pages.length}` : ""}`, MARGIN, MARGIN + 4, {
      size: 6.5,
      color: C.faint,
    });
  });

  return pdf.save({ useObjectStreams: false });
}
