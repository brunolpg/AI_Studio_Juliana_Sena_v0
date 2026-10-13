import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
// @ts-ignore
import fontkit from '@pdf-lib/fontkit';

let regularFontBytesCache: Uint8Array | null = null;
let boldFontBytesCache: Uint8Array | null = null;

function loadLocalPlusJakartaSansFonts(): { regular: Uint8Array; bold: Uint8Array } | null {
  try {
    if (!regularFontBytesCache || !boldFontBytesCache) {
      const regularPath = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Regular.ttf");
      const boldPath = path.join(process.cwd(), "public", "fonts", "PlusJakartaSans-Bold.ttf");

      if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
        console.warn("Fontes Plus Jakarta Sans não encontradas em public/fonts");
        return null;
      }

      regularFontBytesCache = new Uint8Array(fs.readFileSync(regularPath));
      boldFontBytesCache = new Uint8Array(fs.readFileSync(boldPath));
    }
    return { regular: regularFontBytesCache, bold: boldFontBytesCache };
  } catch (err) {
    console.error("Erro ao carregar fontes locais:", err);
    return null;
  }
}

function loadClinicLogo(): Uint8Array | null {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-clinica.png");
    if (fs.existsSync(logoPath)) {
      return new Uint8Array(fs.readFileSync(logoPath));
    }
  } catch (e) {
    console.warn("Logo não encontrada em public/logo-clinica.png");
  }
  return null;
}

export const PROFISSIONAL = {
  nome: "Juliana Sena de Souza Vieira",
  cargo: "Enfermeira Esteta",
  registro: "COREN-BA 366.344",
  rodape:
    "Juliana Sena de Souza Vieira • Estética Avançada e Regenerativa • Salvador - BA • Telefone: (71) 98661-2878 • COREN-BA 366.344",
} as const;

export const RX_MARKER_PREFIX = "rx:";

export interface PrescriptionPdfComponent {
  nome?: string | null;
  quantidade?: number | string | null;
  unidade?: string | null;
}

export interface PrescriptionPdfInput {
  id: string;
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

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 46;

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

const REPLACEMENTS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "×": "x",
  "−": "-",
  "": "",
  "": "",
};

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
    else if (cp < 0x20 || (cp >= 0x1f000 && cp <= 0x1faff)) continue;
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

export function prescriptionPdfFileName(patientName?: string | null, date?: string | null): string {
  const base = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `Receita_${base || "Paciente"}_${(date || new Date().toISOString()).slice(0, 10)}.pdf`;
}

export async function buildPrescriptionPdf(input: PrescriptionPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  let regular: PDFFont;
  let bold: PDFFont;
  let italic: PDFFont;

  const fontBytes = loadLocalPlusJakartaSansFonts();
  if (fontBytes) {
    try {
      regular = await pdf.embedFont(fontBytes.regular);
      bold = await pdf.embedFont(fontBytes.bold);
      italic = regular;
    } catch {
      regular = await pdf.embedFont(StandardFonts.Helvetica);
      bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    }
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  }

  const paciente = input.paciente.nome?.trim() || "Paciente";
  const item = input.item || {};
  const isOral = (item.via || "").toLowerCase() === "oral";

  pdf.setTitle(sanitize(regular, `Receituário - ${paciente}`));
  pdf.setAuthor(PROFISSIONAL.nome);
  pdf.setSubject("Receituário / Prescrição magistral");
  pdf.setKeywords([`${RX_MARKER_PREFIX}${input.id}`]);
  pdf.setProducer("Juliana Sena - Gestão de Pacientes");
  pdf.setCreator("Juliana Sena - Gestão de Pacientes");

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (height: number) => {
    if (height > PAGE_H - MARGIN * 2 - FOOTER_RESERVED) {
      throw new Error("Conteúdo da receita extenso demais para caber em uma página do PDF.");
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

  // 1. Cabeçalho com Logo
  const logoBytes = loadClinicLogo();
  let embeddedLogo = null;
  if (logoBytes) {
    try {
      embeddedLogo = await pdf.embedPng(logoBytes);
    } catch (err) {
      console.warn("Falha ao embutir logo PNG no PDF:", err);
    }
  }

  const headerTopY = y;
  let textStartX = MARGIN;

  if (embeddedLogo) {
    const logoSize = 44;
    page.drawImage(embeddedLogo, {
      x: MARGIN,
      y: headerTopY - logoSize,
      width: logoSize,
      height: logoSize,
    });
    textStartX = MARGIN + logoSize + 12;
  }

  text("RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL", textStartX, headerTopY - 12, { font: bold, size: 8.5, color: C.text });
  text(PROFISSIONAL.nome, textStartX, headerTopY - 27, { font: bold, size: 14, color: C.ink });
  text(PROFISSIONAL.cargo, textStartX, headerTopY - 40, { font: bold, size: 9.5, color: C.teal });
  text(PROFISSIONAL.registro, MARGIN, headerTopY - 14, { font: bold, size: 9, color: C.muted, align: "right", width: CONTENT_W });

  y = headerTopY - 54;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: C.line });
  y -= 16;

  // 2. Card do Paciente
  const patientBoxH = 42;
  page.drawRectangle({
    x: MARGIN,
    y: y - patientBoxH,
    width: CONTENT_W,
    height: patientBoxH,
    color: C.panel,
    borderColor: C.line,
    borderWidth: 0.8,
  });

  text("PACIENTE", MARGIN + 12, y - 14, { font: bold, size: 7, color: C.faint });
  text(paciente, MARGIN + 12, y - 29, { font: bold, size: 10.5, color: C.ink });
  text("CPF", MARGIN, y - 14, { font: bold, size: 7, color: C.faint, align: "right", width: CONTENT_W - 12 });
  text(formatCpf(input.paciente.cpf), MARGIN, y - 29, { font: bold, size: 10.5, color: C.ink, align: "right", width: CONTENT_W - 12 });
  y -= patientBoxH + 20;

  // 3. Fórmula e Título
  ensure(36);
  text(item.nome_formula?.trim() || "Fórmula magistral", MARGIN, y - 12, { font: bold, size: 13, color: C.ink });
  text(`Uso ${isOral ? "Oral" : "Tópico"}`, MARGIN, y - 12, { font: bold, size: 9.5, color: C.muted, align: "right", width: CONTENT_W });
  y -= 26;

  // 4. Subtítulo "FÓRMULA ATIVA" e Tabela de Componentes
  text("FÓRMULA ATIVA", MARGIN, y - 8, { font: bold, size: 7.5, color: C.faint });
  y -= 14;

  const componentes = (item.componentes_snapshot || []).filter((c) => present(c?.nome));
  if (componentes.length > 0) {
    const rowH = 20;
    ensure(rowH * (componentes.length + 1) + 8);
    const tableTop = y;

    page.drawRectangle({
      x: MARGIN,
      y: tableTop - rowH,
      width: CONTENT_W,
      height: rowH,
      color: rgb(0.95, 0.96, 0.98),
    });
    text("Componente / Ativo", MARGIN + 10, tableTop - 13, { font: bold, size: 8, color: C.text });
    text("Concentração", MARGIN, tableTop - 13, { font: bold, size: 8, color: C.text, align: "right", width: CONTENT_W - 10 });

    componentes.forEach((c, i) => {
      const top = tableTop - rowH * (i + 1);
      page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.5, color: C.line });
      text(String(c.nome), MARGIN + 10, top - 13, { font: bold, size: 9.5 });
      const qty = present(c.quantidade) ? `${c.quantidade}${c.unidade ? c.unidade : ""}` : "";
      text(qty, MARGIN, top - 13, { font: bold, size: 9.5, align: "right", width: CONTENT_W - 10 });
    });

    const tableH = rowH * (componentes.length + 1);
    page.drawRectangle({
      x: MARGIN,
      y: tableTop - tableH,
      width: CONTENT_W,
      height: tableH,
      borderColor: C.line,
      borderWidth: 0.8,
    });
    y = tableTop - tableH - 14;
  }

  // 5. Veículo / dose / total
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
    ensure(46);
    const h = 36;
    page.drawRectangle({
      x: MARGIN,
      y: y - h,
      width: CONTENT_W,
      height: h,
      color: C.panel,
      borderColor: C.line,
      borderWidth: 0.8,
    });
    const colW = CONTENT_W / cells.length;
    cells.forEach(([label, value], i) => {
      const cx = MARGIN + colW * i + 12;
      text(label, cx, y - 13, { font: bold, size: 7, color: C.faint });
      text(value, cx, y - 26, { font: bold, size: 9.5 });
    });
    y -= h + 14;
  }

  // 6. Posologia
  if (present(item.posologia)) {
    const w = CONTENT_W - 28;
    const bodyH = measure(String(item.posologia), w, regular, 9.5, 14);
    const h = bodyH + 32;
    ensure(h + 6);

    page.drawRectangle({
      x: MARGIN,
      y: y - h,
      width: CONTENT_W,
      height: h,
      color: C.tealBg,
      borderColor: C.tealLine,
      borderWidth: 0.8,
    });

    page.drawLine({
      start: { x: MARGIN + 1, y: y },
      end: { x: MARGIN + 1, y: y - h },
      thickness: 3,
      color: C.teal,
    });

    text("POSOLOGIA (FREQUÊNCIA & HORÁRIOS)", MARGIN + 14, y - 15, { font: bold, size: 7.5, color: rgb(0.07, 0.3, 0.29) });
    paragraph(String(item.posologia), MARGIN + 14, y - 20, w, { size: 9.5, leading: 14, color: rgb(0.07, 0.3, 0.29) });
    y -= h + 14;
  }

  // 7. Orientações ao paciente
  const orientPaciente = present(item.orient_paciente) ? String(item.orient_paciente) : present(input.observacoes) ? String(input.observacoes) : "";
  if (orientPaciente) {
    const h = measure(orientPaciente, CONTENT_W, regular, 9, 13) + 16;
    ensure(h);
    text("ORIENTAÇÕES AO PACIENTE / INSTRUÇÕES ESPECIAIS", MARGIN, y - 8, { font: bold, size: 7, color: C.faint });
    paragraph(orientPaciente, MARGIN, y - 13, CONTENT_W, { size: 9, leading: 13, color: C.text });
    y -= h + 6;
  }

  // 8. Observações à farmácia
  if (present(item.orient_farmacia)) {
    const w = CONTENT_W - 24;
    const h = measure(String(item.orient_farmacia), w, italic, 8.5, 12.5) + 26;
    ensure(h + 6);
    page.drawRectangle({
      x: MARGIN,
      y: y - h,
      width: CONTENT_W,
      height: h,
      color: C.panel,
      borderColor: C.line,
      borderWidth: 0.8,
    });
    text("OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL", MARGIN + 12, y - 13, { font: bold, size: 7, color: C.muted });
    paragraph(String(item.orient_farmacia), MARGIN + 12, y - 18, w, { font: italic, size: 8.5, leading: 12.5, color: C.muted });
    y -= h + 14;
  }

  // 9. Data e Bloco de Assinatura Qualificada ICP-Brasil
  ensure(120);
  y -= 10;
  text(`Salvador - BA, ${formatDatePt(input.dataPrescricao)}`, MARGIN, y - 10, { size: 10, color: C.text, align: "center", width: CONTENT_W });
  y -= 36;

  const sigW = 290;
  const sigH = 60;
  const sigX = MARGIN + (CONTENT_W - sigW) / 2;
  page.drawRectangle({
    x: sigX,
    y: y - sigH,
    width: sigW,
    height: sigH,
    color: C.tealBg,
    borderColor: C.teal,
    borderWidth: 1,
    borderDashArray: [4, 3],
  });
  text(PROFISSIONAL.nome, sigX, y - 18, { font: bold, size: 10.5, align: "center", width: sigW });
  text(`${PROFISSIONAL.cargo} • ${PROFISSIONAL.registro}`, sigX, y - 31, { font: bold, size: 9, color: C.teal, align: "center", width: sigW });
  text("Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)", sigX, y - 46, {
    size: 6.8,
    color: C.muted,
    align: "center",
    width: sigW,
  });

  // 10. Rodapé institucional
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 28 }, end: { x: PAGE_W - MARGIN, y: MARGIN + 28 }, thickness: 0.5, color: C.line });
    paragraph(PROFISSIONAL.rodape, MARGIN, MARGIN + 24, CONTENT_W, { size: 6.8, leading: 9, color: C.faint });
    text(`Código da receita: ${input.id}${pages.length > 1 ? `  •  página ${i + 1}/${pages.length}` : ""}`, MARGIN, MARGIN + 4, {
      size: 6.5,
      color: C.faint,
    });
  });

  return pdf.save({ useObjectStreams: false });
}
