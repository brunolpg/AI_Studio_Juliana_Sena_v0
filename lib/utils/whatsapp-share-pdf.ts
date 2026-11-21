import { PDFDocument, StandardFonts, rgb, PDFFont, PDFImage, PDFPage } from "pdf-lib";
// @ts-expect-error @pdf-lib/fontkit não possui declarações completas para ESM/CJS
import fontkit from "@pdf-lib/fontkit";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ClinicalEvolution, PrescriptionItem } from "@/types/clinical-record";
import type { HomeCareFichaCompleta } from "@/types/home-care";
import type { Proposta } from "@/types/proposta";
import type { PopProtocoloCompleto } from "@/types/pop";

/**
 * Sanitiza o nome do arquivo PDF seguindo o padrão exigido:
 * [TipoDocumento]_[Nome_Paciente_ou_Protocolo].pdf
 */
export function sanitizePdfFileName(prefix: string, name: string): string {
  const combined = `${prefix} ${name || ""}`.trim();
  const normalized = combined
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${normalized || "Documento_Clinico"}.pdf`;
}

/**
 * Limpa o número de telefone e adiciona DDI 55 (Brasil) caso não possua.
 */
export function cleanBrazilianPhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Dispara o download direto de um File PDF no navegador (unificado com o botão Imprimir / Gerar PDF).
 */
export function downloadPdfFile(file: File): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ============================================================================
// MOTOR COMPARTILHADO DE LAYOUT A4 (1:1 COM OS MODAIS HTML + PAGINAÇÃO INTELIGENTE)
// ============================================================================

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 44;
const MAX_USABLE_H = PAGE_H - MARGIN * 2 - FOOTER_RESERVED;

const PROF = {
  nome: "Juliana Sena de Souza Vieira",
  cargo: "Enfermeira Esteta",
  registro: "COREN-BA 366.344",
  rodapeReceita:
    "Juliana Sena de Souza Vieira • Estética Avançada e Regenerativa • Salvador - BA • Telefone: (71) 98661-2878 • COREN-BA 366.344",
  rodapeClinica:
    "Juliana Sena de Souza Vieira • Estética Avançada e Laserterapia • Salvador - BA • Telefone: (71) 98661-2878",
} as const;

const PALETTE = {
  slate900: rgb(0.059, 0.09, 0.165), // #0f172a
  slate800: rgb(0.118, 0.161, 0.231), // #1e293b
  slate700: rgb(0.2, 0.255, 0.333), // #334155
  slate600: rgb(0.278, 0.333, 0.412), // #475569
  slate500: rgb(0.392, 0.455, 0.545), // #64748b
  slate400: rgb(0.58, 0.639, 0.722), // #94a3b8
  slate200: rgb(0.886, 0.91, 0.941), // #e2e8f0
  slate100: rgb(0.945, 0.961, 0.976), // #f1f5f9
  slate50: rgb(0.973, 0.98, 0.988), // #f8fafc
  white: rgb(1, 1, 1),

  teal950: rgb(0.016, 0.184, 0.18), // #042f2e
  teal900: rgb(0.075, 0.306, 0.29), // #134e4a
  teal800: rgb(0.067, 0.369, 0.349), // #115e59
  teal700: rgb(0.059, 0.463, 0.431), // #0f766e
  teal600: rgb(0.051, 0.58, 0.533), // #0d9488
  teal200: rgb(0.6, 0.965, 0.894), // #99f6e4
  teal100: rgb(0.8, 0.984, 0.945), // #ccfbf1
  teal50: rgb(0.941, 0.992, 0.98), // #f0fdfa

  emerald900: rgb(0.024, 0.306, 0.231), // #064e3b
  emerald800: rgb(0.024, 0.373, 0.275), // #065f46
  emerald600: rgb(0.02, 0.588, 0.412), // #059669
  emerald200: rgb(0.655, 0.953, 0.816), // #a7f3d0
  emerald100: rgb(0.82, 0.98, 0.898), // #d1fae5
  emerald50: rgb(0.925, 0.992, 0.961), // #ecfdf5
  popDeep: rgb(0, 0.302, 0.251), // #004d40

  sky900: rgb(0.047, 0.29, 0.431), // #0c4a6e
  sky200: rgb(0.729, 0.902, 0.992), // #bae6fd
  sky100: rgb(0.878, 0.949, 0.996), // #e0f2fe

  amber950: rgb(0.271, 0.102, 0.012), // #451a03
  amber900: rgb(0.471, 0.208, 0.059), // #78350f
  amber800: rgb(0.573, 0.251, 0.055), // #92400e
  amber600: rgb(0.851, 0.467, 0.024), // #d97706
  amber200: rgb(0.992, 0.902, 0.541), // #fde68a
  amber100: rgb(0.996, 0.953, 0.78), // #fef3c7
  amber50: rgb(1, 0.984, 0.922), // #fffbeb
};

const CHAR_REPLACEMENTS: Record<string, string> = {
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  "×": "x",
  "−": "-",
  "–": "-",
  "—": "-",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "…": "...",
  "•": "•",
};

let cachedRegularFont: Uint8Array | null | undefined;
let cachedBoldFont: Uint8Array | null | undefined;
let cachedClinicLogo: Uint8Array | null | undefined;

async function fetchPublicAsset(relativePath: string): Promise<Uint8Array | null> {
  try {
    if (typeof window !== "undefined") {
      const res = await fetch(`/${relativePath}`);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    const fs = await import(/* webpackIgnore: true */ "node:fs");
    const path = await import(/* webpackIgnore: true */ "node:path");
    const fullPath = path.join(process.cwd(), "public", ...relativePath.split("/"));
    if (!fs.existsSync(fullPath)) return null;
    return new Uint8Array(fs.readFileSync(fullPath));
  } catch {
    return null;
  }
}

async function loadFontsAndLogo(pdfDoc: PDFDocument): Promise<{
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
  logo: PDFImage | null;
}> {
  pdfDoc.registerFontkit(fontkit);

  if (cachedRegularFont === undefined || cachedBoldFont === undefined) {
    const [reg, bld] = await Promise.all([
      fetchPublicAsset("fonts/PlusJakartaSans-Regular.ttf"),
      fetchPublicAsset("fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    cachedRegularFont = reg;
    cachedBoldFont = bld;
  }
  if (cachedClinicLogo === undefined) {
    cachedClinicLogo = await fetchPublicAsset("logo-clinica.png");
  }

  let regular: PDFFont;
  let bold: PDFFont;
  let italic: PDFFont;

  if (cachedRegularFont && cachedBoldFont) {
    try {
      regular = await pdfDoc.embedFont(cachedRegularFont);
      bold = await pdfDoc.embedFont(cachedBoldFont);
      italic = regular;
    } catch {
      regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    }
  } else {
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  }

  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  let logo: PDFImage | null = null;
  if (cachedClinicLogo) {
    try {
      logo = await pdfDoc.embedPng(cachedClinicLogo);
    } catch {
      logo = null;
    }
  }

  return { regular, bold, italic, mono, logo };
}

function sanitizeText(font: PDFFont, input: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of String(input || "").normalize("NFC")) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (ch === "\n") out += ch;
    else if (ch === "\r") continue;
    else if (ch === "\t") out += "  ";
    else if (supported.has(cp)) out += ch;
    else if (ch in CHAR_REPLACEMENTS) {
      for (const rCh of CHAR_REPLACEMENTS[ch]) {
        const rCp = rCh.codePointAt(0);
        if (rCp !== undefined && supported.has(rCp)) out += rCh;
      }
    } else if (cp < 0x20 || (cp >= 0x1f000 && cp <= 0x1faff)) continue;
    else {
      const fallback = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (fallback && supported.has(fallback.codePointAt(0)!)) {
        out += fallback;
      }
    }
  }
  return out;
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const cleanText = sanitizeText(font, text);
  if (!cleanText) return [""];
  const lines: string[] = [];

  for (const para of cleanText.split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let currentLine = "";
    for (const word of para.trim().split(/\s+/)) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }
      if (currentLine) lines.push(currentLine);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        currentLine = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) > maxWidth) {
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        currentLine = chunk;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines.length > 0 ? lines : [""];
}

function roundedRectPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  return [
    `M ${rad} 0`,
    `L ${w - rad} 0`,
    `Q ${w} 0 ${w} ${rad}`,
    `L ${w} ${h - rad}`,
    `Q ${w} ${h} ${w - rad} ${h}`,
    `L ${rad} ${h}`,
    `Q 0 ${h} 0 ${h - rad}`,
    `L 0 ${rad}`,
    `Q 0 0 ${rad} 0`,
    `Z`,
  ].join(" ");
}

function topRoundedRectPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h);
  return [
    `M ${rad} 0`,
    `L ${w - rad} 0`,
    `Q ${w} 0 ${w} ${rad}`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    `L 0 ${rad}`,
    `Q 0 0 ${rad} 0`,
    `Z`,
  ].join(" ");
}

function rightRoundedRectPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  return [
    `M 0 0`,
    `L ${w - rad} 0`,
    `Q ${w} 0 ${w} ${rad}`,
    `L ${w} ${h - rad}`,
    `Q ${w} ${h} ${w - rad} ${h}`,
    `L 0 ${h}`,
    `Z`,
  ].join(" ");
}

function formatDateBRSaoPaulo(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }
  return clean;
}

const MONTHS_CAP = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTHS_LOWER = [
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

function formatDateLongSaoPaulo(dateStr?: string | null, capitalizeMonth = true): string {
  const clean = dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr.trim()) ? dateStr.trim().slice(0, 10) : null;
  const d = clean ? new Date(`${clean}T12:00:00-03:00`) : new Date();
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const [year, monthStr, dayStr] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(valid)
    .split("-");
  const monthIdx = Math.max(0, Math.min(11, parseInt(monthStr, 10) - 1));
  const day = parseInt(dayStr, 10);
  const month = (capitalizeMonth ? MONTHS_CAP : MONTHS_LOWER)[monthIdx];
  return `Salvador - BA, ${day} de ${month} de ${year}`;
}

function formatCpfValue(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf.trim() || "Não informado";
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

function formatCurrencyBR(val?: number | null): string {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calculateAgeText(birthDateStr?: string | null, withParens = false): string {
  if (!birthDateStr) return "";
  try {
    const clean = birthDateStr.split("T")[0];
    const parts = clean.split("-");
    if (parts.length !== 3) return "";
    const birth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("-");
    const today = new Date(parseInt(nowParts[0], 10), parseInt(nowParts[1], 10) - 1, parseInt(nowParts[2], 10));
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 0) return "";
    return withParens ? ` (${age} anos)` : `${age} anos`;
  } catch {
    return "";
  }
}

class PdfDocBuilder {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  mono: PDFFont;
  logo: PDFImage | null;

  constructor(
    pdf: PDFDocument,
    assets: { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont; logo: PDFImage | null }
  ) {
    this.pdf = pdf;
    this.regular = assets.regular;
    this.bold = assets.bold;
    this.italic = assets.italic;
    this.mono = assets.mono;
    this.logo = assets.logo;
    this.page = pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  static async create(meta: { title: string; subject: string; author?: string }) {
    const pdf = await PDFDocument.create();
    const assets = await loadFontsAndLogo(pdf);
    pdf.setTitle(sanitizeText(assets.regular, meta.title));
    pdf.setAuthor(meta.author || PROF.nome);
    pdf.setSubject(meta.subject);
    pdf.setProducer("Juliana Sena - Gestão Clínica");
    pdf.setCreator("Juliana Sena - Gestão Clínica");
    return new PdfDocBuilder(pdf, assets);
  }

  addPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensureGroup(height: number) {
    if (height <= MAX_USABLE_H && this.y - height < MARGIN + FOOTER_RESERVED) {
      this.addPage();
    }
  }

  ensureLine(height: number) {
    if (this.y - height < MARGIN + FOOTER_RESERVED) {
      this.addPage();
    }
  }

  drawRect(opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    r?: number;
    color?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
    borderDashArray?: number[];
  }) {
    const { x, y, w, h, r = 6, color, borderColor, borderWidth = 0.8, borderDashArray } = opts;
    if (r <= 0) {
      this.page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color,
        borderColor,
        borderWidth: borderColor ? borderWidth : 0,
      });
      return;
    }
    this.page.drawSvgPath(roundedRectPath(w, h, r), {
      x,
      y: y + h,
      color,
      borderColor,
      borderWidth: borderColor ? borderWidth : 0,
      borderDashArray,
    });
  }

  drawTopRect(opts: { x: number; y: number; w: number; h: number; r?: number; color: ReturnType<typeof rgb> }) {
    this.page.drawSvgPath(topRoundedRectPath(opts.w, opts.h, opts.r ?? 6), {
      x: opts.x,
      y: opts.y + opts.h,
      color: opts.color,
      borderWidth: 0,
    });
  }

  drawRightRect(opts: { x: number; y: number; w: number; h: number; r?: number; color: ReturnType<typeof rgb> }) {
    this.page.drawSvgPath(rightRoundedRectPath(opts.w, opts.h, opts.r ?? 8), {
      x: opts.x,
      y: opts.y + opts.h,
      color: opts.color,
      borderWidth: 0,
    });
  }

  text(
    value: string,
    x: number,
    baseline: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      align?: "left" | "right" | "center";
      width?: number;
    } = {}
  ) {
    const font = opts.font ?? this.regular;
    const size = opts.size ?? 9.5;
    const clean = sanitizeText(font, value);
    let px = x;
    if (opts.align === "right") px = x + (opts.width ?? 0) - font.widthOfTextAtSize(clean, size);
    if (opts.align === "center") px = x + ((opts.width ?? 0) - font.widthOfTextAtSize(clean, size)) / 2;
    this.page.drawText(clean, { x: px, y: baseline, font, size, color: opts.color ?? PALETTE.slate900 });
  }

  lines(
    lineList: string[],
    x: number,
    top: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      leading?: number;
      align?: "left" | "right" | "center";
      width?: number;
    } = {}
  ) {
    const font = opts.font ?? this.regular;
    const size = opts.size ?? 9;
    const leading = opts.leading ?? size * 1.42;
    lineList.forEach((ln, idx) => {
      if (ln) {
        this.text(ln, x, top - size - idx * leading, {
          font,
          size,
          color: opts.color,
          align: opts.align,
          width: opts.width,
        });
      }
    });
    return lineList.length * leading;
  }

  /** Cabeçalho institucional 1:1 com todos os modais A4 da clínica */
  drawInstitutionalHeader(documentTitle: string) {
    const headerTopY = this.y;
    let textStartX = MARGIN;

    if (this.logo) {
      const targetHeight = 46;
      const scale = targetHeight / this.logo.height;
      const targetWidth = this.logo.width * scale;
      this.page.drawImage(this.logo, {
        x: MARGIN,
        y: headerTopY - targetHeight,
        width: targetWidth,
        height: targetHeight,
      });
      textStartX = MARGIN + targetWidth + 14;
    }

    const corenW = this.regular.widthOfTextAtSize(PROF.registro, 8.8) + 12;
    const titleMaxW = Math.max(160, PAGE_W - MARGIN - corenW - textStartX);
    const titleLines = wrapText(documentTitle.toUpperCase(), titleMaxW, this.bold, 8.3);

    let cursor = headerTopY - 2;
    cursor -= this.lines(titleLines, textStartX, cursor, {
      font: this.bold,
      size: 8.3,
      color: PALETTE.slate800,
      leading: 10.5,
    });
    this.text(PROF.nome, textStartX, cursor - 13, {
      font: this.bold,
      size: 12.2,
      color: PALETTE.slate900,
    });
    this.text(PROF.cargo, textStartX, cursor - 25.5, {
      font: this.regular,
      size: 8.8,
      color: PALETTE.slate500,
    });

    const headerBottom = Math.min(headerTopY - 46, cursor - 30);
    const midY = (headerTopY + headerBottom) / 2;

    this.text(PROF.registro, MARGIN, midY - 3, {
      font: this.regular,
      size: 8.8,
      color: PALETTE.slate500,
      align: "right",
      width: CONTENT_W,
    });

    this.y = headerBottom - 9;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 1,
      color: PALETTE.slate900,
    });
    this.y -= 16;
  }

  /** Bloco padrão de identificação do paciente (2 colunas: PACIENTE | CPF) */
  drawSimplePatientCard(patientName: string, cpf?: string | null, ageSuffix?: string) {
    const cpfText = formatCpfValue(cpf);
    const cpfColW = 130;
    const nameMaxW = CONTENT_W - 28 - cpfColW - 14;
    const fullLabel = ageSuffix ? `${patientName} (${ageSuffix})` : patientName;
    const nameLines = wrapText(fullLabel, nameMaxW, this.bold, 11);
    const boxH = 26 + nameLines.length * 14 + 8;

    this.ensureGroup(boxH + 16);
    this.drawRect({
      x: MARGIN,
      y: this.y - boxH,
      w: CONTENT_W,
      h: boxH,
      r: 10,
      color: PALETTE.slate50,
      borderColor: PALETTE.slate200,
    });

    this.text("PACIENTE", MARGIN + 14, this.y - 15, {
      font: this.bold,
      size: 7.5,
      color: PALETTE.slate500,
    });
    this.lines(nameLines, MARGIN + 14, this.y - 21, {
      font: this.bold,
      size: 11,
      color: PALETTE.slate900,
      leading: 14,
    });

    this.text("CPF", MARGIN, this.y - 15, {
      font: this.bold,
      size: 7.5,
      color: PALETTE.slate500,
      align: "right",
      width: CONTENT_W - 14,
    });
    this.text(cpfText, MARGIN, this.y - 32, {
      font: this.bold,
      size: 11,
      color: PALETTE.slate900,
      align: "right",
      width: CONTENT_W - 14,
    });

    this.y -= boxH + 16;
  }

  /** Bloco final indivisível: Data + Profissional + Chancela SHA-256 */
  drawHashSealBlock(opts: { dateText: string; sealLabel: string; hash?: string | null }) {
    const hashStr = `Hash: ${opts.hash || "AUTÊNTICO"}`;
    const leftW = CONTENT_W * 0.58 - 16;
    const rightW = CONTENT_W * 0.42 - 16;
    const leftLines = wrapText(opts.sealLabel, leftW, this.bold, 7.6);
    const rightLines = wrapText(hashStr, rightW, this.mono, 7.2);
    const sealH = Math.max(leftLines.length * 10.5, rightLines.length * 10) + 14;
    const totalH = 14 + 18 + sealH + 10;

    this.ensureGroup(totalH);

    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.6,
      color: PALETTE.slate200,
    });
    this.y -= 16;

    this.text(opts.dateText, MARGIN, this.y - 8, {
      font: this.regular,
      size: 8.8,
      color: PALETTE.slate600,
    });
    this.text(`${PROF.nome} • ${PROF.registro}`, MARGIN, this.y - 8, {
      font: this.bold,
      size: 8.4,
      color: PALETTE.slate700,
      align: "right",
      width: CONTENT_W,
    });
    this.y -= 18;

    this.drawRect({
      x: MARGIN,
      y: this.y - sealH,
      w: CONTENT_W,
      h: sealH,
      r: 8,
      color: PALETTE.emerald50,
      borderColor: PALETTE.emerald200,
      borderWidth: 0.8,
    });

    this.lines(leftLines, MARGIN + 10, this.y - 7, {
      font: this.bold,
      size: 7.6,
      color: PALETTE.emerald800,
      leading: 10.5,
    });
    this.lines(rightLines, MARGIN + CONTENT_W - 10 - rightW, this.y - 7, {
      font: this.mono,
      size: 7.2,
      color: PALETTE.emerald900,
      leading: 10,
      align: "right",
      width: rightW,
    });

    this.y -= sealH + 10;
  }

  /** Rodapé institucional + numeração de páginas em todas as páginas */
  applyFooters(contactText: string, extraLine?: string) {
    const pages = this.pdf.getPages();
    const total = pages.length;
    pages.forEach((p, idx) => {
      this.page = p;
      this.page.drawLine({
        start: { x: MARGIN, y: MARGIN + 26 },
        end: { x: PAGE_W - MARGIN, y: MARGIN + 26 },
        thickness: 0.5,
        color: PALETTE.slate200,
      });

      const pageSuffix = total > 1 ? `  •  Página ${idx + 1} de ${total}` : "";
      if (extraLine) {
        this.text(contactText, MARGIN, MARGIN + 15, {
          font: this.regular,
          size: 6.8,
          color: PALETTE.slate400,
          align: "center",
          width: CONTENT_W,
        });
        this.text(`${extraLine}${pageSuffix}`, MARGIN, MARGIN + 4, {
          font: this.regular,
          size: 6.5,
          color: PALETTE.slate400,
          align: "center",
          width: CONTENT_W,
        });
      } else {
        this.text(`${contactText}${pageSuffix}`, MARGIN, MARGIN + 11, {
          font: this.regular,
          size: 7,
          color: PALETTE.slate400,
          align: "center",
          width: CONTENT_W,
        });
      }
    });
  }

  async toFile(fileName: string): Promise<File> {
    const bytes = await this.pdf.save({ useObjectStreams: false });
    return new File([bytes as unknown as BlobPart], fileName, { type: "application/pdf" });
  }
}

// ============================================================================
// 1. RECEITUÁRIO CLIENT-SIDE (FALLBACK 1:1 COM lib/prescricoes/pdf.ts E MODAL)
// ============================================================================

export interface PrescriptionClientPdfInput {
  fileName: string;
  id?: string;
  patientName: string;
  patientCpf?: string | null;
  dataPrescricao?: string | null;
  medicamento: string;
  via: string;
  componentes: Array<{ nome: string; qtd: string }>;
  veiculo?: string;
  dosagem?: string;
  total?: string;
  posologia?: string;
  orientPaciente?: string;
  orientFarmacia?: string;
}

export async function generatePrescriptionPdfClient(
  input: PrescriptionClientPdfInput
): Promise<File> {
  const doc = await PdfDocBuilder.create({
    title: `Receituário - ${input.patientName}`,
    subject: "Receituário / Prescrição Magistral",
  });

  const isOral = (input.via || "").toLowerCase() === "oral";
  doc.drawInstitutionalHeader("RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL");
  doc.drawSimplePatientCard(input.patientName, input.patientCpf);

  // Fórmula + Tabela de ativos (grupo indivisível)
  const viaText = `Uso ${isOral ? "Oral" : "Tópico"}`;
  const viaW = doc.bold.widthOfTextAtSize(sanitizeText(doc.bold, viaText), 9) + 14;
  const titleLines = wrapText(input.medicamento || "Fórmula magistral", CONTENT_W - viaW, doc.bold, 12);
  const titleH = titleLines.length * 15 + 12;

  const compNameW = CONTENT_W * 0.68 - 16;
  const compQtyW = CONTENT_W * 0.32 - 16;
  const rows = (input.componentes || [])
    .filter((c) => c.nome?.trim())
    .map((c) => {
      const nameLines = wrapText(c.nome.trim(), compNameW, doc.regular, 9);
      const qtyLines = wrapText((c.qtd || "").trim(), compQtyW, doc.bold, 9);
      const rowH = Math.max(22, Math.max(nameLines.length, qtyLines.length, 1) * 12.5 + 10);
      return { nameLines, qtyLines, rowH };
    });

  const tableHeaderH = 24;
  const totalTableH = rows.length > 0 ? 15 + tableHeaderH + rows.reduce((a, r) => a + r.rowH, 0) + 14 : 0;
  doc.ensureGroup(
    titleH + totalTableH <= MAX_USABLE_H
      ? titleH + totalTableH
      : titleH + (rows.length > 0 ? 15 + tableHeaderH + rows[0].rowH + 6 : 0)
  );

  doc.lines(titleLines, MARGIN, doc.y, { font: doc.bold, size: 12, color: PALETTE.slate900, leading: 15 });
  doc.text(viaText, MARGIN, doc.y - 12, {
    font: doc.bold,
    size: 9,
    color: PALETTE.slate500,
    align: "right",
    width: CONTENT_W,
  });
  doc.y -= titleH;

  if (rows.length > 0) {
    doc.text("FÓRMULA ATIVA", MARGIN, doc.y - 8, { font: doc.bold, size: 7.5, color: PALETTE.slate400 });
    doc.y -= 15;

    const drawChunk = (chunk: typeof rows) => {
      const top = doc.y;
      const chunkH = tableHeaderH + chunk.reduce((a, r) => a + r.rowH, 0);

      doc.drawTopRect({
        x: MARGIN,
        y: top - tableHeaderH,
        w: CONTENT_W,
        h: tableHeaderH,
        r: 6,
        color: PALETTE.slate100,
      });
      doc.text("Componente / Ativo", MARGIN + 12, top - 15, { font: doc.bold, size: 8.5, color: PALETTE.slate600 });
      doc.text("Concentração", MARGIN, top - 15, {
        font: doc.bold,
        size: 8.5,
        color: PALETTE.slate600,
        align: "right",
        width: CONTENT_W - 12,
      });

      let rowTop = top - tableHeaderH;
      chunk.forEach((r, idx) => {
        doc.page.drawLine({
          start: { x: MARGIN, y: rowTop },
          end: { x: PAGE_W - MARGIN, y: rowTop },
          thickness: idx === 0 ? 0.8 : 0.5,
          color: idx === 0 ? PALETTE.slate200 : PALETTE.slate100,
        });
        doc.lines(r.nameLines, MARGIN + 12, rowTop - 5, {
          font: doc.regular,
          size: 9,
          color: PALETTE.slate800,
          leading: 12.5,
        });
        doc.lines(r.qtyLines, MARGIN + CONTENT_W - 12 - compQtyW, rowTop - 5, {
          font: doc.bold,
          size: 9,
          color: PALETTE.slate700,
          leading: 12.5,
          align: "right",
          width: compQtyW,
        });
        rowTop -= r.rowH;
      });

      doc.drawRect({
        x: MARGIN,
        y: top - chunkH,
        w: CONTENT_W,
        h: chunkH,
        r: 6,
        borderColor: PALETTE.slate200,
      });
      doc.y = top - chunkH - 14;
    };

    let current: typeof rows = [];
    let currentH = tableHeaderH;
    for (const r of rows) {
      if (current.length > 0 && doc.y - (currentH + r.rowH) < MARGIN + FOOTER_RESERVED) {
        drawChunk(current);
        doc.addPage();
        current = [];
        currentH = tableHeaderH;
      }
      current.push(r);
      currentH += r.rowH;
    }
    if (current.length > 0) drawChunk(current);
  }

  // Card 2 linhas: Veículo Base | Dosagem (Q.S.P.) + Quantidade Total
  if (input.veiculo || input.dosagem || input.total) {
    const padX = 12;
    const padY = 10;
    const colGap = 16;
    const halfW = (CONTENT_W - padX * 2 - colGap) / 2;
    const fullW = CONTENT_W - padX * 2;

    const veiculoStr = input.veiculo?.trim() || "Veículo base adequado";
    const dosagemLabel = isOral ? "DOSE / APRESENTAÇÃO" : "DOSAGEM (Q.S.P.)";
    const dosagemRaw = input.dosagem?.trim() || "";
    const dosagemStr = dosagemRaw
      ? isOral
        ? /dose/i.test(dosagemRaw)
          ? dosagemRaw
          : `${dosagemRaw} dose(s)`
        : dosagemRaw
      : isOral
        ? "Cápsula vegetal"
        : "q.s.p.";
    const totalStr = input.total?.trim() || "";

    const vLines = wrapText(veiculoStr, halfW, doc.bold, 9.5);
    const dLines = wrapText(dosagemStr, halfW, doc.bold, 9.5);
    const tLines = totalStr ? wrapText(totalStr, fullW, doc.bold, 9.5) : [];

    const r1H = 12 + Math.max(vLines.length, dLines.length, 1) * 13;
    const r2H = totalStr ? 12 + Math.max(tLines.length, 1) * 13 : 0;
    const cardH = padY + r1H + (totalStr ? 14 + r2H : 0) + padY;

    doc.ensureGroup(cardH + 16);
    const top = doc.y;
    doc.drawRect({
      x: MARGIN,
      y: top - cardH,
      w: CONTENT_W,
      h: cardH,
      r: 6,
      color: PALETTE.white,
      borderColor: PALETTE.slate200,
    });

    const lx = MARGIN + padX;
    const rx = MARGIN + padX + halfW + colGap;
    const r1Top = top - padY;

    doc.text("VEÍCULO BASE", lx, r1Top - 7, { font: doc.bold, size: 7, color: PALETTE.slate400 });
    doc.lines(vLines, lx, r1Top - 11, { font: doc.bold, size: 9.5, color: PALETTE.slate800, leading: 13 });

    doc.text(dosagemLabel, rx, r1Top - 7, {
      font: doc.bold,
      size: 7,
      color: PALETTE.slate400,
      align: "right",
      width: halfW,
    });
    doc.lines(dLines, rx, r1Top - 11, {
      font: doc.bold,
      size: 9.5,
      color: PALETTE.slate800,
      leading: 13,
      align: "right",
      width: halfW,
    });

    if (totalStr) {
      const divY = r1Top - r1H - 6;
      doc.page.drawLine({
        start: { x: MARGIN + padX, y: divY },
        end: { x: PAGE_W - MARGIN - padX, y: divY },
        thickness: 0.6,
        color: PALETTE.slate100,
      });
      const r2Top = divY - 8;
      doc.text("QUANTIDADE TOTAL", lx, r2Top - 7, { font: doc.bold, size: 7, color: PALETTE.slate400 });
      doc.lines(tLines, lx, r2Top - 11, { font: doc.bold, size: 9.5, color: PALETTE.slate800, leading: 13 });
    }
    doc.y = top - cardH - 16;
  }

  // Posologia (fundo neutro slate-50 + borda esquerda slate-800)
  if (input.posologia?.trim()) {
    const posLines = wrapText(input.posologia.trim(), CONTENT_W - 28, doc.regular, 9.5);
    const posH = 28 + posLines.length * 14 + 10;
    doc.ensureGroup(posH + 14);
    const top = doc.y;
    doc.drawRightRect({ x: MARGIN, y: top - posH, w: CONTENT_W, h: posH, r: 8, color: PALETTE.slate50 });
    doc.page.drawRectangle({ x: MARGIN, y: top - posH, width: 3.5, height: posH, color: PALETTE.slate800 });
    doc.text("POSOLOGIA (FREQUÊNCIA & HORÁRIOS)", MARGIN + 15, top - 16, {
      font: doc.bold,
      size: 7.5,
      color: PALETTE.slate900,
    });
    doc.lines(posLines, MARGIN + 15, top - 24, {
      font: doc.regular,
      size: 9.5,
      color: PALETTE.slate800,
      leading: 14,
    });
    doc.y = top - posH - 16;
  }

  // Orientações ao Paciente
  if (input.orientPaciente?.trim()) {
    const oLines = wrapText(input.orientPaciente.trim(), CONTENT_W, doc.regular, 9);
    const oH = 16 + oLines.length * 13.5 + 8;
    doc.ensureGroup(oH);
    doc.text("ORIENTAÇÕES AO PACIENTE / INSTRUÇÕES ESPECIAIS", MARGIN, doc.y - 8, {
      font: doc.bold,
      size: 7.5,
      color: PALETTE.slate400,
    });
    doc.lines(oLines, MARGIN, doc.y - 15, { font: doc.regular, size: 9, color: PALETTE.slate600, leading: 13.5 });
    doc.y -= oH + 6;
  }

  // Observações à Farmácia
  if (input.orientFarmacia?.trim()) {
    const fLines = wrapText(input.orientFarmacia.trim(), CONTENT_W - 24, doc.italic, 8.5);
    const fH = 24 + fLines.length * 13 + 10;
    doc.ensureGroup(fH + 14);
    const top = doc.y;
    doc.drawRect({
      x: MARGIN,
      y: top - fH,
      w: CONTENT_W,
      h: fH,
      r: 6,
      color: PALETTE.slate50,
      borderColor: PALETTE.slate200,
    });
    doc.text("OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL", MARGIN + 12, top - 14, {
      font: doc.bold,
      size: 7.5,
      color: PALETTE.slate500,
    });
    doc.lines(fLines, MARGIN + 12, top - 21, { font: doc.italic, size: 8.5, color: PALETTE.slate500, leading: 13 });
    doc.y = top - fH - 14;
  }

  // Data + Caixa branca tracejada de assinatura VIDaaS
  const sigW = 310;
  const sigNotice =
    "Espaço reservado para aposição de Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)";
  const sigNoticeLines = wrapText(sigNotice, sigW - 28, doc.regular, 7.2);
  const sigH = 42 + sigNoticeLines.length * 10 + 10;
  doc.ensureGroup(14 + 18 + 14 + sigH + 8);

  doc.y -= 6;
  doc.page.drawLine({
    start: { x: MARGIN, y: doc.y },
    end: { x: PAGE_W - MARGIN, y: doc.y },
    thickness: 0.6,
    color: PALETTE.slate200,
  });
  doc.y -= 18;

  doc.text(formatDateLongSaoPaulo(input.dataPrescricao, true), MARGIN, doc.y - 10, {
    font: doc.regular,
    size: 9.5,
    color: PALETTE.slate700,
    align: "center",
    width: CONTENT_W,
  });
  doc.y -= 24;

  const sigX = MARGIN + (CONTENT_W - sigW) / 2;
  doc.drawRect({
    x: sigX,
    y: doc.y - sigH,
    w: sigW,
    h: sigH,
    r: 8,
    color: PALETTE.white,
    borderColor: PALETTE.teal600,
    borderWidth: 1,
    borderDashArray: [4, 3],
  });
  doc.text(PROF.nome, sigX, doc.y - 18, { font: doc.bold, size: 10, color: PALETTE.slate900, align: "center", width: sigW });
  doc.text(`${PROF.cargo} • ${PROF.registro}`, sigX, doc.y - 31, {
    font: doc.bold,
    size: 8.5,
    color: PALETTE.teal800,
    align: "center",
    width: sigW,
  });
  doc.lines(sigNoticeLines, sigX + 14, doc.y - 38, {
    font: doc.regular,
    size: 7.2,
    color: PALETTE.slate500,
    leading: 10,
    align: "center",
    width: sigW - 28,
  });

  doc.applyFooters(PROF.rodapeReceita, input.id ? `Código da receita: ${input.id}` : undefined);
  return doc.toFile(input.fileName);
}

// ============================================================================
// 2. EVOLUÇÃO CLÍNICA (1:1 COM print-evolution-modal.tsx)
// ============================================================================

export interface EvolutionPdfInput {
  fileName: string;
  evolution: ClinicalEvolution;
  patientName: string;
  patientCpf?: string | null;
  patientBirthDate?: string | null;
  linkedPrescriptions?: PrescriptionItem[];
  linkedHomeCareFicha?: HomeCareFichaCompleta | null;
}

export async function generateEvolutionPdf(input: EvolutionPdfInput): Promise<File> {
  const { evolution, patientName, patientCpf, patientBirthDate, linkedPrescriptions = [], linkedHomeCareFicha } = input;
  const doc = await PdfDocBuilder.create({
    title: `Evolução Clínica - ${patientName}`,
    subject: "Registro de Evolução Clínica & Procedimento Regenerativo",
    author: evolution.profissional || PROF.nome,
  });

  doc.drawInstitutionalHeader("REGISTRO DE EVOLUÇÃO CLÍNICA & PROCEDIMENTO REGENERATIVO");

  // Card 4 colunas de Identificação do Paciente
  const colW = (CONTENT_W - 24 - 24) / 4;
  const nameLines = wrapText(patientName, colW, doc.bold, 9);
  const cpfLines = wrapText(formatCpfValue(patientCpf), colW, doc.mono, 8.2);
  const nascText = `${formatDateBRSaoPaulo(patientBirthDate)}${calculateAgeText(patientBirthDate, true)}`;
  const nascLines = wrapText(nascText, colW, doc.regular, 8.5);
  const sessionText = `${formatDateBRSaoPaulo(evolution.data)}${evolution.horario ? ` às ${evolution.horario}` : ""}`;
  const sessionLines = wrapText(sessionText, colW, doc.bold, 8.5);

  const maxPatientRows = Math.max(nameLines.length, cpfLines.length, nascLines.length, sessionLines.length, 1);
  const pCardH = 26 + maxPatientRows * 12 + 8;
  doc.ensureGroup(pCardH + 14);

  const pTop = doc.y;
  doc.drawRect({
    x: MARGIN,
    y: pTop - pCardH,
    w: CONTENT_W,
    h: pCardH,
    r: 8,
    color: PALETTE.slate50,
    borderColor: PALETTE.slate200,
  });

  const colsX = [0, 1, 2, 3].map((i) => MARGIN + 12 + i * (colW + 8));
  doc.text("PACIENTE", colsX[0], pTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(nameLines, colsX[0], pTop - 19, { font: doc.bold, size: 9, color: PALETTE.slate900, leading: 12 });

  doc.text("CPF", colsX[1], pTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(cpfLines, colsX[1], pTop - 19, { font: doc.mono, size: 8.2, color: PALETTE.slate700, leading: 12 });

  doc.text("NASCIMENTO", colsX[2], pTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(nascLines, colsX[2], pTop - 19, { font: doc.regular, size: 8.5, color: PALETTE.slate700, leading: 12 });

  doc.text("DATA / HORÁRIO DA SESSÃO", colsX[3], pTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(sessionLines, colsX[3], pTop - 19, { font: doc.bold, size: 8.5, color: PALETTE.teal800, leading: 12 });

  doc.y = pTop - pCardH - 12;

  // Destaque do Procedimento / Tipo de Atendimento
  const procTitle = `${evolution.tipo || "Atendimento"}${evolution.tipo_atendimento ? ` — ${evolution.tipo_atendimento}` : ""}`;
  const profName = evolution.profissional || PROF.nome;
  const procLeftW = CONTENT_W * 0.62 - 20;
  const procRightW = CONTENT_W * 0.38 - 16;
  const procLines = wrapText(procTitle, procLeftW, doc.bold, 10.5);
  const profLines = wrapText(profName, procRightW, doc.bold, 8.8);
  const bannerH = 22 + Math.max(procLines.length * 13.5, profLines.length * 12) + 8;

  doc.ensureGroup(bannerH + 14);
  const bTop = doc.y;
  doc.drawRect({
    x: MARGIN,
    y: bTop - bannerH,
    w: CONTENT_W,
    h: bannerH,
    r: 8,
    color: PALETTE.teal50,
    borderColor: PALETTE.teal200,
  });

  doc.text("PROCEDIMENTO / TIPO DE ATENDIMENTO", MARGIN + 12, bTop - 13, {
    font: doc.bold,
    size: 7,
    color: PALETTE.teal900,
  });
  doc.lines(procLines, MARGIN + 12, bTop - 18, {
    font: doc.bold,
    size: 10.5,
    color: PALETTE.teal950,
    leading: 13.5,
  });

  doc.text("Profissional Responsável", MARGIN + CONTENT_W - 12 - procRightW, bTop - 13, {
    font: doc.regular,
    size: 7.5,
    color: PALETTE.slate500,
    align: "right",
    width: procRightW,
  });
  doc.lines(profLines, MARGIN + CONTENT_W - 12 - procRightW, bTop - 19, {
    font: doc.bold,
    size: 8.8,
    color: PALETTE.slate800,
    leading: 12,
    align: "right",
    width: procRightW,
  });

  doc.y = bTop - bannerH - 14;

  // Sinais Vitais preparados (se existirem)
  const sv = evolution.sinaisVitais;
  const svChips: string[] = [];
  if (sv) {
    if (sv.pressaoArterial) svChips.push(`PA: ${sv.pressaoArterial} mmHg`);
    if (sv.frequenciaCardiaca) svChips.push(`FC: ${sv.frequenciaCardiaca} bpm`);
    if (sv.temperatura) svChips.push(`Tax: ${sv.temperatura} °C`);
    if (sv.peso) svChips.push(`Peso: ${sv.peso} kg`);
    if (sv.imc) svChips.push(`IMC: ${sv.imc} kg/m²`);
    if (sv.hidratacaoCutanea != null) svChips.push(`Hidratação: ${sv.hidratacaoCutanea}%`);
    if (sv.oleosidadeSebo != null) svChips.push(`Oleosidade: ${sv.oleosidadeSebo}%`);
    const elastRaw = (sv as any).elasticidade ?? sv.indiceElasticidade;
    if (elastRaw != null) {
      const num = Number(elastRaw);
      const norm = num > 5 ? Math.min(5, Math.max(1, Math.round(num / 20))) : num;
      svChips.push(`Elasticidade: ${norm}/5`);
    }
  }

  // Helper para renderizar cada card SOAP sem quebrar ao meio
  const drawSoapCard = (cfg: {
    badge: string;
    subtitle: string;
    body: string;
    bodyBold?: boolean;
    badgeBg: ReturnType<typeof rgb>;
    badgeBorder: ReturnType<typeof rgb>;
    badgeText: ReturnType<typeof rgb>;
    vitalChips?: string[];
  }) => {
    const innerW = CONTENT_W - 24;
    const bodyFont = cfg.bodyBold ? doc.bold : doc.regular;
    const bodyLines = wrapText(cfg.body, innerW, bodyFont, 9);
    const bodyLeading = 13.5;

    const vitalsStr = cfg.vitalChips && cfg.vitalChips.length > 0 ? cfg.vitalChips.join("   •   ") : "";
    const vitalsLines = vitalsStr ? wrapText(vitalsStr, innerW - 14, doc.mono, 8) : [];
    const vitalsBoxH = vitalsLines.length > 0 ? vitalsLines.length * 11.5 + 12 : 0;

    const headerH = 26;
    const fullH = headerH + (vitalsBoxH > 0 ? vitalsBoxH + 8 : 0) + bodyLines.length * bodyLeading + 14;

    if (fullH <= MAX_USABLE_H) {
      doc.ensureGroup(fullH + 10);
      const top = doc.y;
      doc.drawRect({
        x: MARGIN,
        y: top - fullH,
        w: CONTENT_W,
        h: fullH,
        r: 8,
        color: PALETTE.white,
        borderColor: PALETTE.slate200,
      });

      const badgeW = doc.bold.widthOfTextAtSize(sanitizeText(doc.bold, cfg.badge.toUpperCase()), 7.5) + 14;
      doc.drawRect({
        x: MARGIN + 12,
        y: top - 20,
        w: badgeW,
        h: 14,
        r: 4,
        color: cfg.badgeBg,
        borderColor: cfg.badgeBorder,
        borderWidth: 0.6,
      });
      doc.text(cfg.badge.toUpperCase(), MARGIN + 12, top - 15.5, {
        font: doc.bold,
        size: 7.5,
        color: cfg.badgeText,
        align: "center",
        width: badgeW,
      });

      const subX = MARGIN + 12 + badgeW + 8;
      const subMaxW = PAGE_W - MARGIN - 12 - subX;
      const subClean = wrapText(cfg.subtitle, Math.max(80, subMaxW), doc.regular, 8)[0];
      doc.text(subClean, subX, top - 15.5, {
        font: doc.regular,
        size: 8,
        color: PALETTE.slate500,
      });

      doc.page.drawLine({
        start: { x: MARGIN + 12, y: top - headerH },
        end: { x: PAGE_W - MARGIN - 12, y: top - headerH },
        thickness: 0.5,
        color: PALETTE.slate100,
      });

      let cursorY = top - headerH - 7;
      if (vitalsBoxH > 0) {
        doc.drawRect({
          x: MARGIN + 12,
          y: cursorY - vitalsBoxH,
          w: innerW,
          h: vitalsBoxH,
          r: 6,
          color: PALETTE.slate50,
          borderColor: PALETTE.slate200,
          borderWidth: 0.6,
        });
        doc.lines(vitalsLines, MARGIN + 19, cursorY - 6, {
          font: doc.mono,
          size: 8,
          color: PALETTE.slate800,
          leading: 11.5,
        });
        cursorY -= vitalsBoxH + 8;
      }

      doc.lines(bodyLines, MARGIN + 12, cursorY, {
        font: bodyFont,
        size: 9,
        color: cfg.bodyBold ? PALETTE.slate900 : PALETTE.slate800,
        leading: bodyLeading,
      });

      doc.y = top - fullH - 10;
    } else {
      // SOAP muito longo: mantém cabeçalho + primeiras linhas juntos e pagina linha a linha
      doc.ensureGroup(headerH + 36);
      const badgeW = doc.bold.widthOfTextAtSize(sanitizeText(doc.bold, cfg.badge.toUpperCase()), 7.5) + 14;
      doc.drawRect({
        x: MARGIN,
        y: doc.y - 16,
        w: badgeW,
        h: 14,
        r: 4,
        color: cfg.badgeBg,
        borderColor: cfg.badgeBorder,
        borderWidth: 0.6,
      });
      doc.text(cfg.badge.toUpperCase(), MARGIN, doc.y - 11.5, {
        font: doc.bold,
        size: 7.5,
        color: cfg.badgeText,
        align: "center",
        width: badgeW,
      });
      doc.y -= 22;

      if (vitalsBoxH > 0) {
        doc.ensureGroup(vitalsBoxH + 8);
        doc.drawRect({
          x: MARGIN,
          y: doc.y - vitalsBoxH,
          w: CONTENT_W,
          h: vitalsBoxH,
          r: 6,
          color: PALETTE.slate50,
          borderColor: PALETTE.slate200,
        });
        doc.lines(vitalsLines, MARGIN + 8, doc.y - 6, {
          font: doc.mono,
          size: 8,
          color: PALETTE.slate800,
          leading: 11.5,
        });
        doc.y -= vitalsBoxH + 8;
      }

      for (const ln of bodyLines) {
        doc.ensureLine(bodyLeading + 2);
        if (ln) {
          doc.text(ln, MARGIN + 4, doc.y - 9, {
            font: bodyFont,
            size: 9,
            color: cfg.bodyBold ? PALETTE.slate900 : PALETTE.slate800,
          });
        }
        doc.y -= bodyLeading;
      }
      doc.y -= 10;
    }
  };

  drawSoapCard({
    badge: "S • Subjetivo",
    subtitle: "Queixas, percepção e histórico relatado pelo paciente",
    body: evolution.subjetivo || "Nenhuma queixa ou sintoma atípico relatado pelo paciente nesta sessão.",
    badgeBg: PALETTE.teal100,
    badgeBorder: PALETTE.teal200,
    badgeText: PALETTE.teal900,
  });

  drawSoapCard({
    badge: "O • Objetivo",
    subtitle: "Achados clínicos, exame físico dermatofuncional e parâmetros",
    body: evolution.objetivo || "Exame físico dentro dos padrões da normalidade para o procedimento executado.",
    badgeBg: PALETTE.sky100,
    badgeBorder: PALETTE.sky200,
    badgeText: PALETTE.sky900,
    vitalChips: svChips,
  });

  drawSoapCard({
    badge: "A • Avaliação / Diagnóstico",
    subtitle: "Interpretação clínica, resposta tecidual e evolução do quadro",
    body: evolution.avaliacao || "Resposta regenerativa satisfatória ao protocolo instituído.",
    bodyBold: true,
    badgeBg: PALETTE.amber100,
    badgeBorder: PALETTE.amber200,
    badgeText: PALETTE.amber900,
  });

  drawSoapCard({
    badge: "P • Plano / Conduta Regenerativa",
    subtitle: "Conduta terapêutica, prescrições, cuidados aplicados e retorno",
    body: evolution.plano || "Manutenção do plano terapêutico com reavaliação na próxima sessão programada.",
    badgeBg: PALETTE.emerald100,
    badgeBorder: PALETTE.emerald200,
    badgeText: PALETTE.emerald900,
  });

  // Vínculos Terapêuticos Associados
  const hasRx = linkedPrescriptions.length > 0 || (evolution.prescricoes_detalhes?.length ?? 0) > 0;
  const hcInfo = linkedHomeCareFicha || evolution.home_care_ficha;
  if (hasRx || hcInfo) {
    const rxLines: string[] = [];
    if (linkedPrescriptions.length > 0) {
      linkedPrescriptions.forEach((rx) => {
        rxLines.push(`• ${rx.medicamento} (${rx.dosagem} - ${rx.posologia})`);
      });
    } else if (evolution.prescricoes_detalhes) {
      evolution.prescricoes_detalhes.forEach((det) => {
        rxLines.push(`• Receita de ${formatDateBRSaoPaulo(det.data_prescricao)}: ${det.formulas.join(", ")}`);
      });
    }

    const hcText = hcInfo
      ? `Protocolo: ${hcInfo.titulo_protocolo} (${formatDateBRSaoPaulo(hcInfo.data_home_care)})`
      : "";

    const twoCols = hasRx && Boolean(hcInfo);
    const boxW = twoCols ? (CONTENT_W - 10) / 2 : CONTENT_W;
    const rxWrapped = rxLines.flatMap((l) => wrapText(l, boxW - 20, doc.regular, 8.2));
    const hcWrapped = hcText ? wrapText(hcText, boxW - 20, doc.regular, 8.2) : [];

    const rxBoxH = hasRx ? 24 + rxWrapped.length * 11.5 + 8 : 0;
    const hcBoxH = hcInfo ? 24 + hcWrapped.length * 11.5 + 8 : 0;
    const rowBoxH = Math.max(rxBoxH, hcBoxH);
    const totalLinksH = 22 + rowBoxH + 10;

    doc.ensureGroup(totalLinksH);
    doc.page.drawLine({
      start: { x: MARGIN, y: doc.y },
      end: { x: PAGE_W - MARGIN, y: doc.y },
      thickness: 0.6,
      color: PALETTE.slate200,
    });
    doc.y -= 13;
    doc.text("VÍNCULOS TERAPÊUTICOS ASSOCIADOS A ESTA SESSÃO", MARGIN, doc.y - 7, {
      font: doc.bold,
      size: 7.5,
      color: PALETTE.slate400,
    });
    doc.y -= 14;

    const top = doc.y;
    if (hasRx) {
      doc.drawRect({
        x: MARGIN,
        y: top - rowBoxH,
        w: boxW,
        h: rowBoxH,
        r: 7,
        color: PALETTE.slate50,
        borderColor: PALETTE.slate200,
      });
      doc.text("Prescrições / Medicamentos Vinculados", MARGIN + 10, top - 14, {
        font: doc.bold,
        size: 8.2,
        color: PALETTE.slate800,
      });
      doc.lines(rxWrapped, MARGIN + 10, top - 22, {
        font: doc.regular,
        size: 8.2,
        color: PALETTE.slate700,
        leading: 11.5,
      });
    }

    if (hcInfo) {
      const hcX = twoCols ? MARGIN + boxW + 10 : MARGIN;
      doc.drawRect({
        x: hcX,
        y: top - rowBoxH,
        w: boxW,
        h: rowBoxH,
        r: 7,
        color: PALETTE.slate50,
        borderColor: PALETTE.slate200,
      });
      doc.text("Ficha de Home Care Vinculada", hcX + 10, top - 14, {
        font: doc.bold,
        size: 8.2,
        color: PALETTE.slate800,
      });
      doc.lines(hcWrapped, hcX + 10, top - 22, {
        font: doc.regular,
        size: 8.2,
        color: PALETTE.slate700,
        leading: 11.5,
      });
    }

    doc.y = top - rowBoxH - 12;
  }

  doc.drawHashSealBlock({
    dateText: formatDateLongSaoPaulo(evolution.data, false),
    sealLabel: "Documento Clínico Assinado Digitalmente (Integridade e Autenticidade via SHA-256)",
    hash: evolution.payload_hash,
  });

  doc.applyFooters(PROF.rodapeClinica);
  return doc.toFile(input.fileName);
}

// ============================================================================
// 3. PROTOCOLO HOME CARE (1:1 COM print-home-care-modal.tsx)
// ============================================================================

export interface HomeCarePdfInput {
  fileName: string;
  ficha: HomeCareFichaCompleta;
  patientName: string;
  patientCpf?: string | null;
}

export async function generateHomeCarePdf(input: HomeCarePdfInput): Promise<File> {
  const { ficha, patientName, patientCpf } = input;
  const doc = await PdfDocBuilder.create({
    title: `Home Care - ${patientName}`,
    subject: `Protocolo de Cuidados Domiciliares - ${ficha.titulo_protocolo}`,
    author: ficha.profissional || PROF.nome,
  });

  doc.drawInstitutionalHeader("PROTOCOLO DE CUIDADOS DOMICILIARES (HOME CARE)");
  doc.drawSimplePatientCard(patientName, patientCpf);

  // Atenção Crítica (Card Âmbar)
  if (ficha.incluir_atencao_critica !== false && ficha.atencao_critica_texto?.trim()) {
    const alertTitle = (ficha.atencao_critica_titulo || "ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO").toUpperCase();
    const textLines = wrapText(ficha.atencao_critica_texto.trim(), CONTENT_W - 28, doc.regular, 8.8);
    const titleLines = wrapText(alertTitle, CONTENT_W - 28, doc.bold, 8.2);
    const alertH = 14 + titleLines.length * 11.5 + 3 + textLines.length * 13 + 10;

    doc.ensureGroup(alertH + 14);
    const top = doc.y;
    doc.drawRect({
      x: MARGIN,
      y: top - alertH,
      w: CONTENT_W,
      h: alertH,
      r: 10,
      color: PALETTE.amber50,
      borderColor: PALETTE.amber200,
    });

    const afterTitle = top - 10 - doc.lines(titleLines, MARGIN + 14, top - 10, {
      font: doc.bold,
      size: 8.2,
      color: PALETTE.amber800,
      leading: 11.5,
    });
    doc.lines(textLines, MARGIN + 14, afterTitle - 2, {
      font: doc.regular,
      size: 8.8,
      color: PALETTE.amber900,
      leading: 13,
    });
    doc.y = top - alertH - 14;
  }

  const drawSectionBar = (
    title: string,
    rightText: string,
    accent: ReturnType<typeof rgb>,
    titleColor: ReturnType<typeof rgb>
  ) => {
    doc.page.drawCircle({ x: MARGIN + 4, y: doc.y - 7, size: 3, color: accent });
    doc.text(title.toUpperCase(), MARGIN + 12, doc.y - 10, {
      font: doc.bold,
      size: 9,
      color: titleColor,
    });
    if (rightText) {
      doc.text(rightText, MARGIN, doc.y - 10, {
        font: doc.bold,
        size: 7.5,
        color: PALETTE.slate500,
        align: "right",
        width: CONTENT_W,
      });
    }
    doc.y -= 16;
    doc.page.drawLine({
      start: { x: MARGIN, y: doc.y },
      end: { x: PAGE_W - MARGIN, y: doc.y },
      thickness: 1.4,
      color: accent,
    });
    doc.y -= 12;
  };

  // Bloco 1: CUIDADOS DIÁRIOS FUNDAMENTAIS
  const cuidados = ficha.cuidados || [];
  if (cuidados.length > 0) {
    const preparedCuidados = cuidados.map((c, idx) => {
      const titleLines = wrapText(c.titulo || `Cuidado ${idx + 1}`, CONTENT_W - 30, doc.bold, 9);
      const bodyLines = wrapText(c.texto || "", CONTENT_W - 30, doc.regular, 8.8);
      const h = Math.max(20, titleLines.length * 12 + bodyLines.length * 13 + 8);
      return { num: String(idx + 1), titleLines, bodyLines, h };
    });

    // Mantém título da seção junto com o 1º cuidado
    doc.ensureGroup(28 + preparedCuidados[0].h + 6);
    drawSectionBar(
      "CUIDADOS DIÁRIOS FUNDAMENTAIS",
      `${cuidados.length} ${cuidados.length === 1 ? "tópico" : "tópicos"}`,
      PALETTE.teal700,
      PALETTE.teal950
    );

    for (const item of preparedCuidados) {
      doc.ensureGroup(item.h + 6);
      const top = doc.y;
      doc.drawRect({
        x: MARGIN,
        y: top - 19,
        w: 19,
        h: 19,
        r: 5,
        color: PALETTE.teal100,
      });
      doc.text(item.num, MARGIN, top - 13, {
        font: doc.bold,
        size: 8.8,
        color: PALETTE.teal800,
        align: "center",
        width: 19,
      });

      const afterT = top - doc.lines(item.titleLines, MARGIN + 27, top, {
        font: doc.bold,
        size: 9,
        color: PALETTE.slate900,
        leading: 12,
      });
      doc.lines(item.bodyLines, MARGIN + 27, afterT - 2, {
        font: doc.regular,
        size: 8.8,
        color: PALETTE.slate700,
        leading: 13,
      });

      doc.y = top - item.h - 4;
    }
    doc.y -= 8;
  }

  // Bloco 2: CRONOGRAMA DE TRATAMENTO (Tabela 3 colunas com paginação limpa)
  const cronograma = ficha.cronograma || [];
  if (cronograma.length > 0) {
    const col1W = CONTENT_W * 0.22;
    const col2W = CONTENT_W * 0.43;
    const col3W = CONTENT_W * 0.35;
    const headerH = 24;

    const preparedRows = cronograma.map((cr) => {
      const p1 = wrapText(`DIAS ${cr.dia_inicio} AO ${cr.dia_fim}`, col1W - 14, doc.bold, 8.2);
      const p1Sub = cr.fase_titulo ? wrapText(cr.fase_titulo, col1W - 14, doc.regular, 7.6) : [];
      const p2 = wrapText(cr.nome_formula || "", col2W - 14, doc.bold, 8.8);
      const p2Sub = cr.posologia ? wrapText(cr.posologia, col2W - 14, doc.regular, 8.2) : [];
      const p3 = wrapText(cr.objetivo_clinico || "", col3W - 14, doc.regular, 8.2);

      const h1 = p1.length * 11 + (p1Sub.length > 0 ? p1Sub.length * 10 + 3 : 0);
      const h2 = p2.length * 11.5 + (p2Sub.length > 0 ? p2Sub.length * 11 + 3 : 0);
      const h3 = p3.length * 11.5;
      const rowH = Math.max(h1, h2, h3, 16) + 14;
      return { p1, p1Sub, p2, p2Sub, p3, rowH };
    });

    const fullTableH = headerH + preparedRows.reduce((a, r) => a + r.rowH, 0);
    doc.ensureGroup(
      28 + fullTableH <= MAX_USABLE_H
        ? 28 + fullTableH + 8
        : 28 + headerH + preparedRows[0].rowH + 8
    );

    drawSectionBar("CRONOGRAMA DE TRATAMENTO", "Fases sequenciais", PALETTE.teal700, PALETTE.teal950);

    const drawCronoChunk = (rows: typeof preparedRows) => {
      const top = doc.y;
      const chunkH = headerH + rows.reduce((a, r) => a + r.rowH, 0);

      doc.drawTopRect({
        x: MARGIN,
        y: top - headerH,
        w: CONTENT_W,
        h: headerH,
        r: 7,
        color: PALETTE.slate100,
      });
      doc.text("PERÍODO", MARGIN + 8, top - 15, { font: doc.bold, size: 7.5, color: PALETTE.slate700 });
      doc.text("PRODUTO & FREQUÊNCIA", MARGIN + col1W + 8, top - 15, { font: doc.bold, size: 7.5, color: PALETTE.slate700 });
      doc.text("OBJETIVO CLÍNICO", MARGIN + col1W + col2W + 8, top - 15, { font: doc.bold, size: 7.5, color: PALETTE.slate700 });

      let rowTop = top - headerH;
      rows.forEach((r) => {
        doc.page.drawLine({
          start: { x: MARGIN, y: rowTop },
          end: { x: PAGE_W - MARGIN, y: rowTop },
          thickness: 0.6,
          color: PALETTE.slate200,
        });

        const yStart = rowTop - 7;
        const afterP1 = yStart - doc.lines(r.p1, MARGIN + 8, yStart, { font: doc.bold, size: 8.2, color: PALETTE.teal900, leading: 11 });
        if (r.p1Sub.length > 0) {
          doc.lines(r.p1Sub, MARGIN + 8, afterP1 - 2, { font: doc.regular, size: 7.6, color: PALETTE.slate500, leading: 10 });
        }

        const afterP2 = yStart - doc.lines(r.p2, MARGIN + col1W + 8, yStart, { font: doc.bold, size: 8.8, color: PALETTE.slate900, leading: 11.5 });
        if (r.p2Sub.length > 0) {
          doc.lines(r.p2Sub, MARGIN + col1W + 8, afterP2 - 2, { font: doc.regular, size: 8.2, color: PALETTE.slate600, leading: 11 });
        }

        doc.lines(r.p3, MARGIN + col1W + col2W + 8, yStart, { font: doc.regular, size: 8.2, color: PALETTE.slate700, leading: 11.5 });
        rowTop -= r.rowH;
      });

      doc.drawRect({ x: MARGIN, y: top - chunkH, w: CONTENT_W, h: chunkH, r: 7, borderColor: PALETTE.slate200 });
      doc.y = top - chunkH - 14;
    };

    let chunk: typeof preparedRows = [];
    let chunkH = headerH;
    for (const r of preparedRows) {
      if (chunk.length > 0 && doc.y - (chunkH + r.rowH) < MARGIN + FOOTER_RESERVED) {
        drawCronoChunk(chunk);
        doc.addPage();
        chunk = [];
        chunkH = headerH;
      }
      chunk.push(r);
      chunkH += r.rowH;
    }
    if (chunk.length > 0) drawCronoChunk(chunk);
  }

  // Bloco 3: RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES
  if (ficha.incluir_recomendacoes && ficha.recomendacoes && ficha.recomendacoes.length > 0) {
    const preparedRecs = ficha.recomendacoes.map((rec, idx) => {
      const titleLines = wrapText(rec.titulo || `Recomendação ${idx + 1}`, CONTENT_W - 44, doc.bold, 8.8);
      const bodyLines = wrapText(rec.texto || "", CONTENT_W - 44, doc.regular, 8.4);
      const h = Math.max(24, titleLines.length * 11.5 + bodyLines.length * 12 + 16);
      return { num: String(idx + 1), titleLines, bodyLines, h };
    });

    doc.ensureGroup(28 + preparedRecs[0].h + 8);
    drawSectionBar(
      "RECOMENDAÇÕES COMPLEMENTARES IMPORTANTES",
      "",
      PALETTE.amber600,
      PALETTE.amber950
    );

    for (const rec of preparedRecs) {
      doc.ensureGroup(rec.h + 8);
      const top = doc.y;
      doc.drawRect({
        x: MARGIN,
        y: top - rec.h,
        w: CONTENT_W,
        h: rec.h,
        r: 8,
        color: PALETTE.amber50,
        borderColor: PALETTE.amber200,
        borderWidth: 0.7,
      });

      doc.drawRect({ x: MARGIN + 9, y: top - 24, w: 16, h: 16, r: 4, color: PALETTE.amber200 });
      doc.text(rec.num, MARGIN + 9, top - 19, {
        font: doc.bold,
        size: 8,
        color: PALETTE.amber900,
        align: "center",
        width: 16,
      });

      const afterT = top - 8 - doc.lines(rec.titleLines, MARGIN + 33, top - 8, {
        font: doc.bold,
        size: 8.8,
        color: PALETTE.slate900,
        leading: 11.5,
      });
      doc.lines(rec.bodyLines, MARGIN + 33, afterT - 2, {
        font: doc.regular,
        size: 8.4,
        color: PALETTE.slate700,
        leading: 12,
      });

      doc.y = top - rec.h - 8;
    }
  }

  doc.drawHashSealBlock({
    dateText: formatDateLongSaoPaulo(ficha.data_home_care, true),
    sealLabel: "Documento Clínico Assinado Digitalmente (Integridade Garantida via SHA-256)",
    hash: ficha.payload_hash,
  });

  doc.applyFooters(PROF.rodapeClinica);
  return doc.toFile(input.fileName);
}

// ============================================================================
// 4. PROPOSTA CLÍNICA (1:1 COM print-proposta-modal.tsx)
// ============================================================================

export interface PropostaPdfInput {
  fileName: string;
  proposta: Proposta;
  patientName: string;
  patientCpf?: string | null;
  patientBirthDate?: string | null;
}

export async function generatePropostaPdf(input: PropostaPdfInput): Promise<File> {
  const { proposta, patientName, patientCpf, patientBirthDate } = input;
  const doc = await PdfDocBuilder.create({
    title: `Proposta Clínica - ${patientName}`,
    subject: `Proposta de Planejamento Clínico - ${proposta.titulo}`,
    author: proposta.profissional || PROF.nome,
  });

  doc.drawInstitutionalHeader("PROPOSTA DE PLANEJAMENTO CLÍNICO INTEGRADO");
  doc.drawSimplePatientCard(patientName, patientCpf, calculateAgeText(patientBirthDate, false) || undefined);

  // Banner Título & Objetivo Terapêutico
  const pillLabel = "PLANO PERSONALIZADO";
  const pillW = doc.bold.widthOfTextAtSize(pillLabel, 7) + 14;
  const titleMaxW = CONTENT_W - 28 - pillW - 8;
  const propTitleLines = wrapText(proposta.titulo || "Proposta Clínica", titleMaxW, doc.bold, 10.5);
  const objLines = proposta.objetivo?.trim()
    ? wrapText(`Objetivo Terapêutico: ${proposta.objetivo.trim()}`, CONTENT_W - 28, doc.regular, 8.8)
    : [];
  const planH = 14 + Math.max(16, propTitleLines.length * 13.5) + (objLines.length > 0 ? 8 + objLines.length * 13 : 0) + 10;

  doc.ensureGroup(planH + 14);
  const planTop = doc.y;
  doc.drawRect({
    x: MARGIN,
    y: planTop - planH,
    w: CONTENT_W,
    h: planH,
    r: 10,
    color: PALETTE.teal50,
    borderColor: PALETTE.teal200,
  });

  doc.drawRect({ x: MARGIN + 12, y: planTop - 24, w: pillW, h: 14, r: 7, color: PALETTE.teal600 });
  doc.text(pillLabel, MARGIN + 12, planTop - 19.5, {
    font: doc.bold,
    size: 7,
    color: PALETTE.white,
    align: "center",
    width: pillW,
  });
  const afterTitle =
    planTop - 11 - doc.lines(propTitleLines, MARGIN + 12 + pillW + 8, planTop - 11, {
      font: doc.bold,
      size: 10.5,
      color: PALETTE.teal950,
      leading: 13.5,
    });

  if (objLines.length > 0) {
    doc.lines(objLines, MARGIN + 12, Math.min(afterTitle, planTop - 28) - 4, {
      font: doc.regular,
      size: 8.8,
      color: PALETTE.slate700,
      leading: 13,
    });
  }
  doc.y = planTop - planH - 16;

  const drawSectionBar = (
    title: string,
    rightText: string,
    accent: ReturnType<typeof rgb>,
    titleColor: ReturnType<typeof rgb>
  ) => {
    doc.page.drawCircle({ x: MARGIN + 4, y: doc.y - 7, size: 3, color: accent });
    doc.text(title.toUpperCase(), MARGIN + 12, doc.y - 10, { font: doc.bold, size: 9, color: titleColor });
    if (rightText) {
      doc.text(rightText, MARGIN, doc.y - 10, {
        font: doc.bold,
        size: 7.5,
        color: PALETTE.slate500,
        align: "right",
        width: CONTENT_W,
      });
    }
    doc.y -= 16;
    doc.page.drawLine({
      start: { x: MARGIN, y: doc.y },
      end: { x: PAGE_W - MARGIN, y: doc.y },
      thickness: 1.4,
      color: accent,
    });
    doc.y -= 12;
  };

  // Opções de Planejamento Terapêutico
  const opcoes = proposta.opcoes || [];
  if (opcoes.length > 0) {
    // Pré-calcula cada opção inteira para manter o card da opção indivisível
    const preparedOpcoes = opcoes.map((opcao, idx) => {
      const totalOpcao = (opcao.procedimentos || []).reduce((acc, p) => acc + (p.total || 0), 0);
      const totalStr = formatCurrencyBR(totalOpcao);
      const headerRightW = Math.max(105, doc.bold.widthOfTextAtSize(totalStr, 11) + 12);
      const headerLeftW = CONTENT_W - 24 - headerRightW - 12;

      const opTitleLines = wrapText(opcao.titulo || `Opção #${idx + 1}`, headerLeftW - 24, doc.bold, 9.5);
      const opDescLines = opcao.descricao?.trim()
        ? wrapText(opcao.descricao.trim(), headerLeftW, doc.regular, 8.2)
        : [];
      const topH = Math.max(
        38,
        12 + opTitleLines.length * 12.5 + (opDescLines.length > 0 ? 4 + opDescLines.length * 11 : 0) + 10
      );

      // Tabela de procedimentos
      const tInnerW = CONTENT_W - 20;
      const c1W = tInnerW * 0.45;
      const c2W = tInnerW * 0.15;
      const c3W = tInnerW * 0.2;
      const c4W = tInnerW * 0.2;
      const procs = (opcao.procedimentos || []).map((p) => {
        const nameLines = wrapText(p.nome_procedimento || "", c1W - 10, doc.bold, 8.4);
        const rowH = Math.max(20, nameLines.length * 11.5 + 8);
        return {
          nameLines,
          sessoes: String(p.num_sessoes ?? 1),
          unit: formatCurrencyBR(p.valor_sessao),
          sub: formatCurrencyBR(p.total),
          rowH,
        };
      });
      const procTableH = procs.length > 0 ? 20 + procs.reduce((a, p) => a + p.rowH, 0) + 14 : 0;

      // Benefícios e Pagamento
      const hasBen = Boolean(opcao.beneficios?.trim());
      const hasPay = Boolean(opcao.formas_pagamento && opcao.formas_pagamento.length > 0);
      const twoFootCols = hasBen && hasPay;
      const footColW = twoFootCols ? (CONTENT_W - 28) / 2 : CONTENT_W - 20;

      const benLines = hasBen ? wrapText(opcao.beneficios!.trim(), footColW - 16, doc.regular, 8.2) : [];
      const payItems = (opcao.formas_pagamento || []).map((fp) =>
        fp.tipo === "a_vista"
          ? `• À Vista: com ${fp.desconto || 0}% de desconto (${formatCurrencyBR(totalOpcao * (1 - (fp.desconto || 0) / 100))})`
          : `• Parcelamento: até ${fp.num_parcelas || 1}x de ${formatCurrencyBR(totalOpcao / (fp.num_parcelas || 1))} sem juros`
      );
      const payLines = payItems.flatMap((line) => wrapText(line, footColW - 16, doc.regular, 8.2));

      const benH = hasBen ? 22 + benLines.length * 11.5 + 8 : 0;
      const payH = hasPay ? 22 + payLines.length * 11.5 + 8 : 0;
      const footRowH = hasBen || hasPay ? Math.max(benH, payH) + 12 : 0;

      const fullCardH = topH + procTableH + footRowH + 4;
      return {
        idx,
        totalStr,
        headerRightW,
        opTitleLines,
        opDescLines,
        topH,
        c1W,
        c2W,
        c3W,
        c4W,
        procs,
        procTableH,
        hasBen,
        hasPay,
        twoFootCols,
        footColW,
        benLines,
        payLines,
        footRowH,
        fullCardH,
      };
    });

    doc.ensureGroup(
      28 + preparedOpcoes[0].fullCardH <= MAX_USABLE_H
        ? 28 + preparedOpcoes[0].fullCardH + 10
        : 28 + preparedOpcoes[0].topH + 40
    );

    drawSectionBar(
      "OPÇÕES DE PLANEJAMENTO TERAPÊUTICO",
      `${opcoes.length} ${opcoes.length === 1 ? "opção disponível" : "opções disponíveis"}`,
      PALETTE.teal700,
      PALETTE.teal950
    );

    for (const op of preparedOpcoes) {
      if (op.fullCardH <= MAX_USABLE_H) {
        doc.ensureGroup(op.fullCardH + 12);
        const top = doc.y;

        doc.drawRect({
          x: MARGIN,
          y: top - op.fullCardH,
          w: CONTENT_W,
          h: op.fullCardH,
          r: 10,
          color: PALETTE.white,
          borderColor: PALETTE.slate200,
        });

        // Topo da opção
        doc.drawTopRect({
          x: MARGIN,
          y: top - op.topH,
          w: CONTENT_W,
          h: op.topH,
          r: 10,
          color: PALETTE.slate50,
        });
        doc.page.drawLine({
          start: { x: MARGIN, y: top - op.topH },
          end: { x: PAGE_W - MARGIN, y: top - op.topH },
          thickness: 0.7,
          color: PALETTE.slate200,
        });

        doc.drawRect({ x: MARGIN + 12, y: top - 24, w: 18, h: 15, r: 4, color: PALETTE.teal600 });
        doc.text(`#${op.idx + 1}`, MARGIN + 12, top - 19, {
          font: doc.bold,
          size: 7.5,
          color: PALETTE.white,
          align: "center",
          width: 18,
        });

        const afterTitleY = top - 10 - doc.lines(op.opTitleLines, MARGIN + 36, top - 10, {
          font: doc.bold,
          size: 9.5,
          color: PALETTE.slate900,
          leading: 12.5,
        });
        if (op.opDescLines.length > 0) {
          doc.lines(op.opDescLines, MARGIN + 12, Math.min(afterTitleY, top - 26) - 3, {
            font: doc.regular,
            size: 8.2,
            color: PALETTE.slate600,
            leading: 11,
          });
        }

        doc.text("Investimento Total", MARGIN + CONTENT_W - 12 - op.headerRightW, top - 14, {
          font: doc.bold,
          size: 7.5,
          color: PALETTE.slate500,
          align: "right",
          width: op.headerRightW,
        });
        doc.text(op.totalStr, MARGIN + CONTENT_W - 12 - op.headerRightW, top - 28, {
          font: doc.bold,
          size: 11,
          color: PALETTE.teal900,
          align: "right",
          width: op.headerRightW,
        });

        let cursorY = top - op.topH - 8;

        // Tabela de procedimentos
        if (op.procs.length > 0) {
          const tx = MARGIN + 10;
          doc.page.drawRectangle({
            x: tx,
            y: cursorY - 18,
            width: CONTENT_W - 20,
            height: 18,
            color: PALETTE.slate50,
          });
          doc.text("PROCEDIMENTO", tx + 6, cursorY - 12, { font: doc.bold, size: 7.2, color: PALETTE.slate600 });
          doc.text("SESSÕES", tx + op.c1W, cursorY - 12, {
            font: doc.bold,
            size: 7.2,
            color: PALETTE.slate600,
            align: "center",
            width: op.c2W,
          });
          doc.text("VALOR UNIT.", tx + op.c1W + op.c2W, cursorY - 12, {
            font: doc.bold,
            size: 7.2,
            color: PALETTE.slate600,
            align: "right",
            width: op.c3W - 6,
          });
          doc.text("SUBTOTAL", tx + op.c1W + op.c2W + op.c3W, cursorY - 12, {
            font: doc.bold,
            size: 7.2,
            color: PALETTE.slate600,
            align: "right",
            width: op.c4W - 6,
          });

          cursorY -= 18;
          op.procs.forEach((p, pIdx) => {
            doc.page.drawLine({
              start: { x: tx, y: cursorY },
              end: { x: tx + CONTENT_W - 20, y: cursorY },
              thickness: pIdx === 0 ? 0.7 : 0.4,
              color: pIdx === 0 ? PALETTE.slate200 : PALETTE.slate100,
            });
            doc.lines(p.nameLines, tx + 6, cursorY - 5, {
              font: doc.bold,
              size: 8.4,
              color: PALETTE.slate800,
              leading: 11.5,
            });
            doc.text(p.sessoes, tx + op.c1W, cursorY - 13, {
              font: doc.regular,
              size: 8.4,
              color: PALETTE.slate600,
              align: "center",
              width: op.c2W,
            });
            doc.text(p.unit, tx + op.c1W + op.c2W, cursorY - 13, {
              font: doc.regular,
              size: 8.4,
              color: PALETTE.slate600,
              align: "right",
              width: op.c3W - 6,
            });
            doc.text(p.sub, tx + op.c1W + op.c2W + op.c3W, cursorY - 13, {
              font: doc.bold,
              size: 8.4,
              color: PALETTE.slate900,
              align: "right",
              width: op.c4W - 6,
            });
            cursorY -= p.rowH;
          });
          cursorY -= 6;
        }

        // Benefícios e Formas de Pagamento
        if (op.hasBen || op.hasPay) {
          const boxH = op.footRowH - 12;
          if (op.hasBen) {
            doc.drawRect({
              x: MARGIN + 10,
              y: cursorY - boxH,
              w: op.footColW,
              h: boxH,
              r: 7,
              color: PALETTE.emerald50,
              borderColor: PALETTE.emerald100,
            });
            doc.text("Benefícios Inclusos:", MARGIN + 18, cursorY - 13, {
              font: doc.bold,
              size: 8,
              color: PALETTE.emerald900,
            });
            doc.lines(op.benLines, MARGIN + 18, cursorY - 20, {
              font: doc.regular,
              size: 8.2,
              color: PALETTE.emerald800,
              leading: 11.5,
            });
          }
          if (op.hasPay) {
            const px = op.twoFootCols ? MARGIN + 10 + op.footColW + 8 : MARGIN + 10;
            doc.drawRect({
              x: px,
              y: cursorY - boxH,
              w: op.footColW,
              h: boxH,
              r: 7,
              color: PALETTE.slate50,
              borderColor: PALETTE.slate200,
            });
            doc.text("Condições de Pagamento:", px + 8, cursorY - 13, {
              font: doc.bold,
              size: 8,
              color: PALETTE.slate800,
            });
            doc.lines(op.payLines, px + 8, cursorY - 20, {
              font: doc.regular,
              size: 8.2,
              color: PALETTE.slate700,
              leading: 11.5,
            });
          }
        }

        doc.y = top - op.fullCardH - 12;
      } else {
        // Opção muito extensa: pagina por procedimento mantendo cabeçalho e itens intactos
        doc.ensureGroup(op.topH + 40);
        doc.drawRect({
          x: MARGIN,
          y: doc.y - op.topH,
          w: CONTENT_W,
          h: op.topH,
          r: 8,
          color: PALETTE.slate50,
          borderColor: PALETTE.slate200,
        });
        doc.lines(op.opTitleLines, MARGIN + 12, doc.y - 10, { font: doc.bold, size: 9.5, color: PALETTE.slate900, leading: 12.5 });
        doc.text(`Total: ${op.totalStr}`, MARGIN, doc.y - 22, {
          font: doc.bold,
          size: 10,
          color: PALETTE.teal900,
          align: "right",
          width: CONTENT_W - 12,
        });
        doc.y -= op.topH + 6;
        for (const p of op.procs) {
          doc.ensureLine(p.rowH + 4);
          doc.lines(p.nameLines, MARGIN + 8, doc.y - 4, { font: doc.bold, size: 8.4, color: PALETTE.slate800, leading: 11.5 });
          doc.text(`${p.sessoes}x ${p.unit} = ${p.sub}`, MARGIN, doc.y - 12, {
            font: doc.bold,
            size: 8.4,
            color: PALETTE.slate900,
            align: "right",
            width: CONTENT_W - 8,
          });
          doc.y -= p.rowH;
        }
        doc.y -= 10;
      }
    }
  }

  // Cronograma Clínico Sugerido
  const etapas = proposta.cronograma?.etapas || [];
  if (etapas.length > 0) {
    const col1W = CONTENT_W * 0.28;
    const col2W = CONTENT_W * 0.72;
    const headerH = 24;

    const preparedEtapas = etapas.map((et) => {
      const periodo =
        et.tipo_data === "unica"
          ? et.data
            ? formatDateBRSaoPaulo(et.data)
            : "A agendar"
          : `${formatDateBRSaoPaulo(et.data_inicio)} até ${formatDateBRSaoPaulo(et.data_fim)}`;
      const pLines = wrapText(periodo, col1W - 16, doc.bold, 8.4);
      const dLines = wrapText(et.desc_etapa || "", col2W - 16, doc.regular, 8.5);
      const rowH = Math.max(pLines.length * 11.5, dLines.length * 12, 16) + 12;
      return { pLines, dLines, rowH };
    });

    const fullH = headerH + preparedEtapas.reduce((a, r) => a + r.rowH, 0);
    doc.ensureGroup(28 + fullH <= MAX_USABLE_H ? 28 + fullH + 10 : 28 + headerH + preparedEtapas[0].rowH + 10);

    drawSectionBar(
      proposta.cronograma.titulo || "CRONOGRAMA CLÍNICO SUGERIDO",
      `Sequência programada (${etapas.length} etapas)`,
      PALETTE.teal700,
      PALETTE.teal950
    );

    const drawCronoChunk = (rows: typeof preparedEtapas) => {
      const top = doc.y;
      const chunkH = headerH + rows.reduce((a, r) => a + r.rowH, 0);
      doc.drawTopRect({ x: MARGIN, y: top - headerH, w: CONTENT_W, h: headerH, r: 7, color: PALETTE.slate100 });
      doc.text("PERÍODO / PREVISÃO", MARGIN + 8, top - 15, { font: doc.bold, size: 7.5, color: PALETTE.slate700 });
      doc.text("ETAPA / PROCEDIMENTOS PROGRAMADOS", MARGIN + col1W + 8, top - 15, {
        font: doc.bold,
        size: 7.5,
        color: PALETTE.slate700,
      });

      let rowTop = top - headerH;
      rows.forEach((r) => {
        doc.page.drawLine({
          start: { x: MARGIN, y: rowTop },
          end: { x: PAGE_W - MARGIN, y: rowTop },
          thickness: 0.6,
          color: PALETTE.slate200,
        });
        doc.lines(r.pLines, MARGIN + 8, rowTop - 6, { font: doc.bold, size: 8.4, color: PALETTE.teal900, leading: 11.5 });
        doc.lines(r.dLines, MARGIN + col1W + 8, rowTop - 6, {
          font: doc.regular,
          size: 8.5,
          color: PALETTE.slate800,
          leading: 12,
        });
        rowTop -= r.rowH;
      });
      doc.drawRect({ x: MARGIN, y: top - chunkH, w: CONTENT_W, h: chunkH, r: 7, borderColor: PALETTE.slate200 });
      doc.y = top - chunkH - 14;
    };

    let chunk: typeof preparedEtapas = [];
    let chunkH = headerH;
    for (const r of preparedEtapas) {
      if (chunk.length > 0 && doc.y - (chunkH + r.rowH) < MARGIN + FOOTER_RESERVED) {
        drawCronoChunk(chunk);
        doc.addPage();
        chunk = [];
        chunkH = headerH;
      }
      chunk.push(r);
      chunkH += r.rowH;
    }
    if (chunk.length > 0) drawCronoChunk(chunk);
  }

  // Orientações & Considerações Complementares
  const topicos = proposta.topicos || [];
  if (topicos.length > 0) {
    const preparedTopicos = topicos.map((t) => {
      const tLines = wrapText(t.titulo || "", CONTENT_W - 24, doc.bold, 9);
      const bLines = wrapText(t.texto || "", CONTENT_W - 24, doc.regular, 8.5);
      const h = 10 + tLines.length * 12 + 4 + bLines.length * 12.5 + 8;
      return { tLines, bLines, h };
    });

    doc.ensureGroup(28 + preparedTopicos[0].h + 8);
    drawSectionBar("ORIENTAÇÕES & CONSIDERAÇÕES COMPLEMENTARES", "", PALETTE.slate400, PALETTE.slate800);

    for (const t of preparedTopicos) {
      doc.ensureGroup(t.h + 8);
      const top = doc.y;
      doc.drawRect({
        x: MARGIN,
        y: top - t.h,
        w: CONTENT_W,
        h: t.h,
        r: 8,
        color: PALETTE.slate50,
        borderColor: PALETTE.slate200,
      });
      const afterT = top - 9 - doc.lines(t.tLines, MARGIN + 12, top - 9, { font: doc.bold, size: 9, color: PALETTE.slate900, leading: 12 });
      doc.lines(t.bLines, MARGIN + 12, afterT - 2, { font: doc.regular, size: 8.5, color: PALETTE.slate700, leading: 12.5 });
      doc.y = top - t.h - 8;
    }
  }

  doc.drawHashSealBlock({
    dateText: formatDateLongSaoPaulo(proposta.created_at || proposta.assinado_em, true),
    sealLabel: "Documento Clínico Assinado Digitalmente (Integridade Garantida via SHA-256)",
    hash: proposta.payload_hash,
  });

  doc.applyFooters(PROF.rodapeClinica);
  return doc.toFile(input.fileName);
}

// ============================================================================
// 5. PROCEDIMENTO OPERACIONAL PADRÃO - POP (1:1 COM components/print-pop-modal.tsx)
// ============================================================================

export interface PopPdfInput {
  fileName: string;
  pop: PopProtocoloCompleto;
}

export async function generatePopPdf(input: PopPdfInput): Promise<File> {
  const { pop } = input;
  const doc = await PdfDocBuilder.create({
    title: `POP - ${pop.protocolo}`,
    subject: "Procedimento Operacional Padrão (POP) & Protocolo Clínico",
    author: pop.profissional || PROF.nome,
  });

  doc.drawInstitutionalHeader("PROCEDIMENTO OPERACIONAL PADRÃO (POP) & PROTOCOLO CLÍNICO");

  // 1. Destaque do Protocolo
  const protLines = wrapText(pop.protocolo || "Protocolo Clínico", CONTENT_W - 24, doc.bold, 11.5);
  const protH = 24 + protLines.length * 14.5 + 8;
  doc.ensureGroup(protH + 10);
  const protTop = doc.y;
  doc.drawRect({
    x: MARGIN,
    y: protTop - protH,
    w: CONTENT_W,
    h: protH,
    r: 8,
    color: PALETTE.emerald50,
    borderColor: PALETTE.emerald200,
  });
  doc.text("PROTOCOLO CLÍNICO INSTITUCIONAL", MARGIN + 12, protTop - 15, {
    font: doc.bold,
    size: 7.5,
    color: PALETTE.popDeep,
  });
  doc.lines(protLines, MARGIN + 12, protTop - 22, {
    font: doc.bold,
    size: 11.5,
    color: PALETTE.popDeep,
    leading: 14.5,
  });
  doc.y = protTop - protH - 10;

  // 2. Metadados do Protocolo (3 colunas: STATUS | DATA DO POP | PROFISSIONAL)
  const metaColW = (CONTENT_W - 24 - 16) / 3;
  const statusLines = wrapText(pop.status || "Ativo", metaColW, doc.bold, 9);
  const dataLines = wrapText(formatDateBRSaoPaulo(pop.data_pop), metaColW, doc.bold, 9);
  const profLines = wrapText(pop.profissional || PROF.nome, metaColW, doc.bold, 9);
  const metaH = 24 + Math.max(statusLines.length, dataLines.length, profLines.length, 1) * 12 + 8;

  doc.ensureGroup(metaH + 12);
  const metaTop = doc.y;
  doc.drawRect({
    x: MARGIN,
    y: metaTop - metaH,
    w: CONTENT_W,
    h: metaH,
    r: 8,
    color: PALETTE.slate50,
    borderColor: PALETTE.slate200,
  });

  const mCols = [0, 1, 2].map((i) => MARGIN + 12 + i * (metaColW + 8));
  doc.text("STATUS", mCols[0], metaTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(statusLines, mCols[0], metaTop - 19, { font: doc.bold, size: 9, color: PALETTE.slate700, leading: 12 });

  doc.text("DATA DO POP", mCols[1], metaTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(dataLines, mCols[1], metaTop - 19, { font: doc.bold, size: 9, color: PALETTE.popDeep, leading: 12 });

  doc.text("PROFISSIONAL", mCols[2], metaTop - 13, { font: doc.bold, size: 7, color: PALETTE.slate400 });
  doc.lines(profLines, mCols[2], metaTop - 19, { font: doc.bold, size: 9, color: PALETTE.slate800, leading: 12 });
  doc.y = metaTop - metaH - 12;

  // 3. Finalidade Clínica
  if (pop.finalidade?.trim()) {
    const finLines = wrapText(pop.finalidade.trim(), CONTENT_W - 24, doc.regular, 9);
    const finH = 34 + finLines.length * 13.5 + 8;
    doc.ensureGroup(finH + 12);
    const top = doc.y;
    doc.drawRect({
      x: MARGIN,
      y: top - finH,
      w: CONTENT_W,
      h: finH,
      r: 8,
      color: PALETTE.white,
      borderColor: PALETTE.slate200,
    });

    const badgeW = doc.bold.widthOfTextAtSize("FINALIDADE CLÍNICA", 7.4) + 14;
    doc.drawRect({
      x: MARGIN + 12,
      y: top - 20,
      w: badgeW,
      h: 14,
      r: 4,
      color: PALETTE.emerald100,
      borderColor: PALETTE.emerald200,
      borderWidth: 0.6,
    });
    doc.text("FINALIDADE CLÍNICA", MARGIN + 12, top - 15.5, {
      font: doc.bold,
      size: 7.4,
      color: PALETTE.emerald900,
      align: "center",
      width: badgeW,
    });
    doc.text("Objetivo terapêutico e diretriz geral de aplicação", MARGIN + 12 + badgeW + 8, top - 15.5, {
      font: doc.regular,
      size: 8,
      color: PALETTE.slate500,
    });
    doc.page.drawLine({
      start: { x: MARGIN + 12, y: top - 26 },
      end: { x: PAGE_W - MARGIN - 12, y: top - 26 },
      thickness: 0.5,
      color: PALETTE.slate100,
    });
    doc.lines(finLines, MARGIN + 12, top - 33, { font: doc.regular, size: 9, color: PALETTE.slate800, leading: 13.5 });
    doc.y = top - finH - 14;
  }

  // 4. Sequência dos Blocos Ordenados
  const blocosOrdenados = [...(pop.blocos || [])].sort((a, b) => a.ordem - b.ordem);
  if (blocosOrdenados.length > 0) {
    doc.ensureGroup(46);
    doc.text("ESTRUTURA OPERACIONAL & PRESCRIÇÕES INTEGRADAS", MARGIN, doc.y - 8, {
      font: doc.bold,
      size: 7.8,
      color: PALETTE.slate500,
    });
    doc.text(
      `${blocosOrdenados.length} ${blocosOrdenados.length === 1 ? "bloco" : "blocos"}`,
      MARGIN,
      doc.y - 8,
      { font: doc.bold, size: 7.5, color: PALETTE.slate400, align: "right", width: CONTENT_W }
    );
    doc.y -= 13;
    doc.page.drawLine({
      start: { x: MARGIN, y: doc.y },
      end: { x: PAGE_W - MARGIN, y: doc.y },
      thickness: 0.6,
      color: PALETTE.slate200,
    });
    doc.y -= 12;

    for (let idx = 0; idx < blocosOrdenados.length; idx++) {
      const bloco = blocosOrdenados[idx];
      const numBloco = idx + 1;

      if (bloco.tipo === "TOPICO") {
        const badgeLabel = "TÓPICO OPERACIONAL";
        const rightBadgeW = doc.bold.widthOfTextAtSize(badgeLabel, 6.8) + 12;
        const titleMaxW = CONTENT_W - 24 - 24 - rightBadgeW - 10;
        const tLines = wrapText(bloco.topico_titulo || `Tópico ${numBloco}`, titleMaxW, doc.bold, 9.2);
        const descLines = bloco.topico_descricao?.trim()
          ? wrapText(bloco.topico_descricao.trim(), CONTENT_W - 44, doc.regular, 8.8)
          : [];
        const sortedSubs = [...(bloco.subtopicos || [])].sort((a, b) => a.ordem - b.ordem);
        const preparedSubs = sortedSubs.map((sub, sIdx) => {
          const sTitle = wrapText(`${numBloco}.${sIdx + 1} ${sub.titulo || ""}`, CONTENT_W - 60, doc.bold, 8.4);
          const sDesc = sub.descricao?.trim()
            ? wrapText(sub.descricao.trim(), CONTENT_W - 68, doc.regular, 8.2)
            : [];
          const h = 10 + sTitle.length * 11.5 + (sDesc.length > 0 ? 3 + sDesc.length * 11.5 : 0) + 8;
          return { sTitle, sDesc, h };
        });

        const headerH = Math.max(26, tLines.length * 12 + 12);
        const descH = descLines.length > 0 ? descLines.length * 13 + 8 : 0;
        const subsH = preparedSubs.reduce((a, s) => a + s.h + 6, 0);
        const fullH = headerH + descH + subsH + 14;

        if (fullH <= MAX_USABLE_H) {
          doc.ensureGroup(fullH + 10);
          const top = doc.y;
          doc.drawRect({
            x: MARGIN,
            y: top - fullH,
            w: CONTENT_W,
            h: fullH,
            r: 8,
            color: PALETTE.white,
            borderColor: PALETTE.slate200,
          });

          doc.drawRect({ x: MARGIN + 12, y: top - 23, w: 16, h: 16, r: 4, color: PALETTE.popDeep });
          doc.text(String(numBloco), MARGIN + 12, top - 18, {
            font: doc.bold,
            size: 8,
            color: PALETTE.white,
            align: "center",
            width: 16,
          });
          doc.lines(tLines, MARGIN + 34, top - 10, { font: doc.bold, size: 9.2, color: PALETTE.slate900, leading: 12 });

          const bx = PAGE_W - MARGIN - 12 - rightBadgeW;
          doc.drawRect({
            x: bx,
            y: top - 22,
            w: rightBadgeW,
            h: 13,
            r: 4,
            color: PALETTE.emerald50,
            borderColor: PALETTE.emerald200,
            borderWidth: 0.6,
          });
          doc.text(badgeLabel, bx, top - 17.8, {
            font: doc.bold,
            size: 6.8,
            color: PALETTE.popDeep,
            align: "center",
            width: rightBadgeW,
          });

          doc.page.drawLine({
            start: { x: MARGIN + 12, y: top - headerH },
            end: { x: PAGE_W - MARGIN - 12, y: top - headerH },
            thickness: 0.5,
            color: PALETTE.slate100,
          });

          let cursorY = top - headerH - 8;
          if (descLines.length > 0) {
            cursorY -= doc.lines(descLines, MARGIN + 34, cursorY, {
              font: doc.regular,
              size: 8.8,
              color: PALETTE.slate700,
              leading: 13,
            });
            cursorY -= 6;
          }

          for (const sub of preparedSubs) {
            doc.drawRect({
              x: MARGIN + 34,
              y: cursorY - sub.h,
              w: CONTENT_W - 46,
              h: sub.h,
              r: 6,
              color: PALETTE.slate50,
              borderColor: PALETTE.slate200,
              borderWidth: 0.6,
            });
            const afterST = cursorY - 7 - doc.lines(sub.sTitle, MARGIN + 42, cursorY - 7, {
              font: doc.bold,
              size: 8.4,
              color: PALETTE.slate800,
              leading: 11.5,
            });
            if (sub.sDesc.length > 0) {
              doc.lines(sub.sDesc, MARGIN + 48, afterST - 2, {
                font: doc.regular,
                size: 8.2,
                color: PALETTE.slate600,
                leading: 11.5,
              });
            }
            cursorY -= sub.h + 6;
          }

          doc.y = top - fullH - 10;
        } else {
          // Tópico muito extenso: pagina mantendo cada subtópico indivisível
          doc.ensureGroup(headerH + 34);
          doc.drawRect({ x: MARGIN, y: doc.y - 16, w: 16, h: 16, r: 4, color: PALETTE.popDeep });
          doc.text(String(numBloco), MARGIN, doc.y - 11, {
            font: doc.bold,
            size: 8,
            color: PALETTE.white,
            align: "center",
            width: 16,
          });
          doc.lines(tLines, MARGIN + 22, doc.y - 3, { font: doc.bold, size: 9.2, color: PALETTE.slate900, leading: 12 });
          doc.y -= headerH;

          for (const ln of descLines) {
            doc.ensureLine(14);
            if (ln) doc.text(ln, MARGIN + 22, doc.y - 8.8, { font: doc.regular, size: 8.8, color: PALETTE.slate700 });
            doc.y -= 13;
          }
          doc.y -= 4;

          for (const sub of preparedSubs) {
            doc.ensureGroup(sub.h + 6);
            const sTop = doc.y;
            doc.drawRect({
              x: MARGIN + 22,
              y: sTop - sub.h,
              w: CONTENT_W - 22,
              h: sub.h,
              r: 6,
              color: PALETTE.slate50,
              borderColor: PALETTE.slate200,
            });
            const afterST = sTop - 7 - doc.lines(sub.sTitle, MARGIN + 30, sTop - 7, {
              font: doc.bold,
              size: 8.4,
              color: PALETTE.slate800,
              leading: 11.5,
            });
            if (sub.sDesc.length > 0) {
              doc.lines(sub.sDesc, MARGIN + 36, afterST - 2, {
                font: doc.regular,
                size: 8.2,
                color: PALETTE.slate600,
                leading: 11.5,
              });
            }
            doc.y = sTop - sub.h - 6;
          }
          doc.y -= 6;
        }
      } else if (bloco.tipo === "TABELA") {
        const colunas = bloco.tabela_dados?.colunas || [];
        const linhas = bloco.tabela_dados?.linhas || [];
        const tableW = CONTENT_W - 46;
        const colW = colunas.length > 0 ? tableW / colunas.length : tableW;

        const headerLinesList = colunas.map((c) => wrapText(c || "", Math.max(24, colW - 10), doc.bold, 8));
        const tHeaderH = Math.max(20, Math.max(...headerLinesList.map((l) => l.length), 1) * 11 + 8);

        const preparedRows = linhas.map((row) => {
          const cells = colunas.map((_, cIdx) => {
            const val = row[cIdx] !== undefined && row[cIdx] !== "" ? String(row[cIdx]) : "—";
            return wrapText(val, Math.max(24, colW - 10), cIdx === 0 ? doc.bold : doc.regular, 8);
          });
          const rowH = Math.max(18, Math.max(...cells.map((c) => c.length), 1) * 11 + 8);
          return { cells, rowH };
        });

        const titleLines = wrapText(bloco.topico_titulo || "Tabela Paramétrica / Conduta", CONTENT_W - 140, doc.bold, 9.2);
        const descLines = bloco.topico_descricao?.trim()
          ? wrapText(bloco.topico_descricao.trim(), tableW, doc.regular, 8.6)
          : [];
        const cardHeadH = Math.max(26, titleLines.length * 12 + 12);
        const descH = descLines.length > 0 ? descLines.length * 12.5 + 8 : 0;
        const matrixH = colunas.length > 0 && linhas.length > 0 ? tHeaderH + preparedRows.reduce((a, r) => a + r.rowH, 0) : 0;
        const fullH = cardHeadH + descH + matrixH + 18;

        const drawMatrixTable = (x: number, startY: number, rows: typeof preparedRows) => {
          let cy = startY;
          doc.page.drawRectangle({ x, y: cy - tHeaderH, width: tableW, height: tHeaderH, color: PALETTE.slate100 });
          headerLinesList.forEach((hLines, cIdx) => {
            doc.lines(hLines, x + cIdx * colW + 5, cy - 5, {
              font: doc.bold,
              size: 8,
              color: PALETTE.slate800,
              leading: 11,
            });
          });
          cy -= tHeaderH;

          rows.forEach((r, rIdx) => {
            if (rIdx % 2 === 1) {
              doc.page.drawRectangle({ x, y: cy - r.rowH, width: tableW, height: r.rowH, color: PALETTE.slate50 });
            }
            doc.page.drawLine({
              start: { x, y: cy },
              end: { x: x + tableW, y: cy },
              thickness: 0.5,
              color: PALETTE.slate200,
            });
            r.cells.forEach((cellLines, cIdx) => {
              doc.lines(cellLines, x + cIdx * colW + 5, cy - 5, {
                font: cIdx === 0 ? doc.bold : doc.regular,
                size: 8,
                color: cIdx === 0 ? PALETTE.slate800 : PALETTE.slate700,
                leading: 11,
              });
            });
            cy -= r.rowH;
          });

          const totalH = startY - cy;
          doc.page.drawRectangle({
            x,
            y: cy,
            width: tableW,
            height: totalH,
            borderColor: PALETTE.slate200,
            borderWidth: 0.6,
          });
          for (let c = 1; c < colunas.length; c++) {
            doc.page.drawLine({
              start: { x: x + c * colW, y: startY },
              end: { x: x + c * colW, y: cy },
              thickness: 0.4,
              color: PALETTE.slate200,
            });
          }
          return cy;
        };

        if (fullH <= MAX_USABLE_H) {
          doc.ensureGroup(fullH + 10);
          const top = doc.y;
          doc.drawRect({
            x: MARGIN,
            y: top - fullH,
            w: CONTENT_W,
            h: fullH,
            r: 8,
            color: PALETTE.white,
            borderColor: PALETTE.slate200,
          });
          doc.drawRect({ x: MARGIN + 12, y: top - 23, w: 16, h: 16, r: 4, color: PALETTE.popDeep });
          doc.text(String(numBloco), MARGIN + 12, top - 18, {
            font: doc.bold,
            size: 8,
            color: PALETTE.white,
            align: "center",
            width: 16,
          });
          doc.lines(titleLines, MARGIN + 34, top - 10, { font: doc.bold, size: 9.2, color: PALETTE.slate900, leading: 12 });

          const badgeLabel = "TABELA PARAMÉTRICA";
          const bw = doc.bold.widthOfTextAtSize(badgeLabel, 6.8) + 12;
          const bx = PAGE_W - MARGIN - 12 - bw;
          doc.drawRect({
            x: bx,
            y: top - 22,
            w: bw,
            h: 13,
            r: 4,
            color: PALETTE.emerald50,
            borderColor: PALETTE.emerald200,
            borderWidth: 0.6,
          });
          doc.text(badgeLabel, bx, top - 17.8, {
            font: doc.bold,
            size: 6.8,
            color: PALETTE.popDeep,
            align: "center",
            width: bw,
          });

          doc.page.drawLine({
            start: { x: MARGIN + 12, y: top - cardHeadH },
            end: { x: PAGE_W - MARGIN - 12, y: top - cardHeadH },
            thickness: 0.5,
            color: PALETTE.slate100,
          });

          let cy = top - cardHeadH - 8;
          if (descLines.length > 0) {
            cy -= doc.lines(descLines, MARGIN + 34, cy, { font: doc.regular, size: 8.6, color: PALETTE.slate700, leading: 12.5 });
            cy -= 6;
          }
          if (matrixH > 0) {
            drawMatrixTable(MARGIN + 34, cy, preparedRows);
          }
          doc.y = top - fullH - 10;
        } else {
          // Tabela longa: repete cabeçalho em cada nova página
          doc.ensureGroup(cardHeadH + tHeaderH + (preparedRows[0]?.rowH ?? 20) + 16);
          doc.text(`${numBloco}. ${bloco.topico_titulo || "Tabela Paramétrica / Conduta"}`, MARGIN, doc.y - 11, {
            font: doc.bold,
            size: 9.2,
            color: PALETTE.slate900,
          });
          doc.y -= 18;
          let chunk: typeof preparedRows = [];
          let chunkH = tHeaderH;
          for (const r of preparedRows) {
            if (chunk.length > 0 && doc.y - (chunkH + r.rowH) < MARGIN + FOOTER_RESERVED) {
              doc.y = drawMatrixTable(MARGIN + 18, doc.y, chunk) - 10;
              doc.addPage();
              chunk = [];
              chunkH = tHeaderH;
            }
            chunk.push(r);
            chunkH += r.rowH;
          }
          if (chunk.length > 0) {
            doc.y = drawMatrixTable(MARGIN + 18, doc.y, chunk) - 12;
          }
        }
      } else if (bloco.tipo === "FORMULA") {
        const formula = bloco.formula || {};
        const innerW = CONTENT_W - 44;
        const details: Array<{ label: string; text: string; color?: ReturnType<typeof rgb> }> = [];
        if (formula.dosagem) {
          details.push({
            label: "Dosagem: ",
            text: `${formula.dosagem}${formula.veiculo ? ` em ${formula.veiculo}` : ""}`,
          });
        }
        if (formula.posologia) details.push({ label: "Posologia: ", text: String(formula.posologia) });
        if (formula.orient_paciente) {
          details.push({ label: "Orientações ao Paciente: ", text: String(formula.orient_paciente), color: PALETTE.popDeep });
        }
        if (formula.orient_farmacia) {
          details.push({ label: "Nota à Farmácia: ", text: String(formula.orient_farmacia), color: PALETTE.slate500 });
        }
        if (formula.descricao) {
          details.push({ label: "Diretrizes Clínicas: ", text: String(formula.descricao), color: PALETTE.slate500 });
        }

        const fNameLines = wrapText(formula.nome || "Fórmula Magistral", innerW, doc.bold, 9.2);
        const detailBlocks = details.map((d) => ({
          lines: wrapText(`${d.label}${d.text}`, innerW, doc.regular, 8.4),
          color: d.color || PALETTE.slate700,
        }));
        const innerBoxH =
          10 + fNameLines.length * 12 + detailBlocks.reduce((a, b) => a + b.lines.length * 11.8 + 4, 0) + 10;
        const fullH = 34 + innerBoxH + 10;

        doc.ensureGroup(fullH + 10);
        const top = doc.y;
        doc.drawRect({
          x: MARGIN,
          y: top - fullH,
          w: CONTENT_W,
          h: fullH,
          r: 8,
          color: PALETTE.emerald50,
          borderColor: PALETTE.emerald200,
        });

        doc.drawRect({ x: MARGIN + 12, y: top - 23, w: 16, h: 16, r: 4, color: PALETTE.popDeep });
        doc.text(String(numBloco), MARGIN + 12, top - 18, {
          font: doc.bold,
          size: 8,
          color: PALETTE.white,
          align: "center",
          width: 16,
        });
        doc.text("Fórmula Magistral Vinculada ao Protocolo", MARGIN + 34, top - 18, {
          font: doc.bold,
          size: 9,
          color: PALETTE.popDeep,
        });

        if (formula.via) {
          const viaBadge = `VIA ${String(formula.via).toUpperCase()}`;
          const vw = doc.bold.widthOfTextAtSize(viaBadge, 7.2) + 12;
          const vx = PAGE_W - MARGIN - 12 - vw;
          doc.drawRect({
            x: vx,
            y: top - 22,
            w: vw,
            h: 13,
            r: 4,
            color: PALETTE.white,
            borderColor: PALETTE.emerald200,
            borderWidth: 0.6,
          });
          doc.text(viaBadge, vx, top - 17.8, {
            font: doc.bold,
            size: 7.2,
            color: PALETTE.emerald800,
            align: "center",
            width: vw,
          });
        }

        const innerTop = top - 32;
        doc.drawRect({
          x: MARGIN + 12,
          y: innerTop - innerBoxH,
          w: CONTENT_W - 24,
          h: innerBoxH,
          r: 6,
          color: PALETTE.white,
          borderColor: PALETTE.slate200,
        });

        let cy = innerTop - 8;
        cy -= doc.lines(fNameLines, MARGIN + 22, cy, { font: doc.bold, size: 9.2, color: PALETTE.slate900, leading: 12 });
        cy -= 4;
        for (const blk of detailBlocks) {
          cy -= doc.lines(blk.lines, MARGIN + 22, cy, { font: doc.regular, size: 8.4, color: blk.color, leading: 11.8 });
          cy -= 4;
        }

        doc.y = top - fullH - 10;
      } else {
        // Bloco do tipo PRESCRICAO
        const rx = bloco.prescricao;
        const itensRx: any[] = rx?.prescricao_itens || [];
        const innerW = CONTENT_W - 58;

        const preparedItems = itensRx.map((it, itIdx) => {
          const headerStr = `${itIdx + 1}. ${it.nome_formula || "Fórmula"}${it.via ? `  [VIA ${String(it.via).toUpperCase()}]` : ""}`;
          const hLines = wrapText(headerStr, innerW, doc.bold, 8.8);
          const extra: string[] = [];
          if (it.dosagem) extra.push(`Dosagem: ${it.dosagem}${it.veiculo ? ` em ${it.veiculo}` : ""}`);
          if (it.posologia) extra.push(`Posologia: ${it.posologia}`);
          if (it.orient_paciente) extra.push(`Orientações: ${it.orient_paciente}`);
          if (it.orient_farmacia) extra.push(`Nota Farmácia: ${it.orient_farmacia}`);
          const eLines = extra.flatMap((line) => wrapText(line, innerW, doc.regular, 8.2));
          const h = 8 + hLines.length * 11.5 + (eLines.length > 0 ? 4 + eLines.length * 11.5 : 0) + 8;
          return { hLines, eLines, h };
        });

        const obsLines = rx?.observacoes?.trim()
          ? wrapText(`Observações: ${rx.observacoes.trim()}`, CONTENT_W - 46, doc.regular, 8.2)
          : [];
        const itemsTotalH =
          preparedItems.length > 0 ? preparedItems.reduce((a, it) => a + it.h + 6, 0) : 20;
        const obsH = obsLines.length > 0 ? obsLines.length * 11.5 + 6 : 0;
        const fullH = 34 + itemsTotalH + obsH + 8;

        doc.ensureGroup(fullH <= MAX_USABLE_H ? fullH + 10 : 64);
        const top = doc.y;
        doc.drawRect({
          x: MARGIN,
          y: top - fullH,
          w: CONTENT_W,
          h: fullH,
          r: 8,
          color: PALETTE.emerald50,
          borderColor: PALETTE.emerald200,
        });
        doc.drawRect({ x: MARGIN + 12, y: top - 23, w: 16, h: 16, r: 4, color: PALETTE.popDeep });
        doc.text(String(numBloco), MARGIN + 12, top - 18, {
          font: doc.bold,
          size: 8,
          color: PALETTE.white,
          align: "center",
          width: 16,
        });
        doc.text("Prescrição Vinculada ao Protocolo", MARGIN + 34, top - 18, {
          font: doc.bold,
          size: 9,
          color: PALETTE.popDeep,
        });

        if (rx?.data_prescricao) {
          const dtBadge = `Receita de ${formatDateBRSaoPaulo(rx.data_prescricao)}`;
          const dw = doc.regular.widthOfTextAtSize(dtBadge, 7.2) + 12;
          const dx = PAGE_W - MARGIN - 12 - dw;
          doc.drawRect({
            x: dx,
            y: top - 22,
            w: dw,
            h: 13,
            r: 4,
            color: PALETTE.white,
            borderColor: PALETTE.emerald200,
            borderWidth: 0.6,
          });
          doc.text(dtBadge, dx, top - 17.8, {
            font: doc.regular,
            size: 7.2,
            color: PALETTE.emerald800,
            align: "center",
            width: dw,
          });
        }

        let cy = top - 32;
        if (preparedItems.length > 0) {
          for (const it of preparedItems) {
            doc.drawRect({
              x: MARGIN + 34,
              y: cy - it.h,
              w: CONTENT_W - 46,
              h: it.h,
              r: 6,
              color: PALETTE.white,
              borderColor: PALETTE.slate200,
            });
            const afterH = cy - 7 - doc.lines(it.hLines, MARGIN + 42, cy - 7, {
              font: doc.bold,
              size: 8.8,
              color: PALETTE.slate900,
              leading: 11.5,
            });
            if (it.eLines.length > 0) {
              doc.lines(it.eLines, MARGIN + 42, afterH - 2, {
                font: doc.regular,
                size: 8.2,
                color: PALETTE.slate600,
                leading: 11.5,
              });
            }
            cy -= it.h + 6;
          }
        } else {
          doc.text(`Receita ID: ${bloco.prescricao_id || "—"} vinculada ao protocolo.`, MARGIN + 34, cy - 11, {
            font: doc.italic,
            size: 8.4,
            color: PALETTE.slate600,
          });
          cy -= 18;
        }

        if (obsLines.length > 0) {
          doc.lines(obsLines, MARGIN + 34, cy - 2, { font: doc.regular, size: 8.2, color: PALETTE.slate600, leading: 11.5 });
        }

        doc.y = top - fullH - 10;
      }
    }
  }

  doc.drawHashSealBlock({
    dateText: formatDateLongSaoPaulo(pop.data_pop, false),
    sealLabel: "Procedimento Operacional Assinado Digitalmente (Integridade e Autenticidade via SHA-256)",
    hash: pop.payload_hash,
  });

  doc.applyFooters(PROF.rodapeClinica);
  return doc.toFile(input.fileName);
}

// ============================================================================
// 6. GERADOR GENÉRICO APRIMORADO (Plus Jakarta Sans + Logo + Paginação Inteligente)
// ============================================================================

export interface SectionContent {
  title?: string;
  items?: string[];
  paragraph?: string;
  badge?: string;
}

export interface GenericClinicalPdfOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  patientName?: string;
  patientCpf?: string;
  patientPhone?: string;
  dateStr?: string;
  professionalName?: string;
  professionalRole?: string;
  sections: SectionContent[];
}

export async function generateGenericClinicalPdf(
  options: GenericClinicalPdfOptions
): Promise<File> {
  const doc = await PdfDocBuilder.create({
    title: options.title,
    subject: options.subtitle || options.title,
    author: options.professionalName || PROF.nome,
  });

  doc.drawInstitutionalHeader(options.title);

  if (options.subtitle) {
    const subLines = wrapText(options.subtitle, CONTENT_W, doc.italic, 9.2);
    doc.ensureGroup(subLines.length * 13 + 8);
    doc.lines(subLines, MARGIN, doc.y, { font: doc.italic, size: 9.2, color: PALETTE.slate600, leading: 13 });
    doc.y -= subLines.length * 13 + 8;
  }

  if (options.patientName || options.patientCpf || options.dateStr) {
    doc.drawSimplePatientCard(
      options.patientName || "Paciente",
      options.patientCpf,
      options.dateStr ? `Data: ${options.dateStr}` : undefined
    );
  }

  for (const section of options.sections) {
    const pLines = section.paragraph ? wrapText(section.paragraph, CONTENT_W - 24, doc.regular, 9) : [];
    const wrappedItems = (section.items || []).map((item) => wrapText(item, CONTENT_W - 34, doc.regular, 8.6));

    const headerH = section.title ? 24 : 0;
    const pH = pLines.length > 0 ? pLines.length * 13 + 6 : 0;
    const itemsH = wrappedItems.reduce((a, l) => a + l.length * 12.2 + 4, 0);
    const fullH = headerH + pH + itemsH + 14;

    if (fullH <= MAX_USABLE_H) {
      doc.ensureGroup(fullH + 10);
      const top = doc.y;
      doc.drawRect({
        x: MARGIN,
        y: top - fullH,
        w: CONTENT_W,
        h: fullH,
        r: 8,
        color: PALETTE.white,
        borderColor: PALETTE.slate200,
      });

      let cy = top;
      if (section.title) {
        doc.drawTopRect({ x: MARGIN, y: top - headerH, w: CONTENT_W, h: headerH, r: 8, color: PALETTE.slate50 });
        doc.text(section.title.toUpperCase(), MARGIN + 12, top - 15, {
          font: doc.bold,
          size: 8.4,
          color: PALETTE.slate800,
        });
        if (section.badge) {
          doc.text(section.badge, MARGIN, top - 15, {
            font: doc.bold,
            size: 7.5,
            color: PALETTE.teal700,
            align: "right",
            width: CONTENT_W - 12,
          });
        }
        doc.page.drawLine({
          start: { x: MARGIN, y: top - headerH },
          end: { x: PAGE_W - MARGIN, y: top - headerH },
          thickness: 0.6,
          color: PALETTE.slate200,
        });
        cy -= headerH + 8;
      } else {
        cy -= 8;
      }

      if (pLines.length > 0) {
        cy -= doc.lines(pLines, MARGIN + 12, cy, { font: doc.regular, size: 9, color: PALETTE.slate800, leading: 13 });
        cy -= 6;
      }

      for (const itemLines of wrappedItems) {
        doc.text("•", MARGIN + 12, cy - 8.6, { font: doc.bold, size: 9, color: PALETTE.teal700 });
        cy -= doc.lines(itemLines, MARGIN + 22, cy, { font: doc.regular, size: 8.6, color: PALETTE.slate700, leading: 12.2 });
        cy -= 4;
      }

      doc.y = top - fullH - 10;
    } else {
      doc.ensureGroup(headerH + 34);
      if (section.title) {
        doc.drawRect({ x: MARGIN, y: doc.y - headerH, w: CONTENT_W, h: headerH, r: 6, color: PALETTE.slate50 });
        doc.text(section.title.toUpperCase(), MARGIN + 10, doc.y - 15, {
          font: doc.bold,
          size: 8.4,
          color: PALETTE.slate800,
        });
        doc.y -= headerH + 6;
      }
      for (const ln of pLines) {
        doc.ensureLine(14);
        if (ln) doc.text(ln, MARGIN + 8, doc.y - 9, { font: doc.regular, size: 9, color: PALETTE.slate800 });
        doc.y -= 13;
      }
      for (const itemLines of wrappedItems) {
        const ih = itemLines.length * 12.2 + 4;
        doc.ensureLine(ih);
        doc.text("•", MARGIN + 10, doc.y - 8.6, { font: doc.bold, size: 9, color: PALETTE.teal700 });
        doc.lines(itemLines, MARGIN + 20, doc.y, { font: doc.regular, size: 8.6, color: PALETTE.slate700, leading: 12.2 });
        doc.y -= ih;
      }
      doc.y -= 10;
    }
  }

  doc.applyFooters(PROF.rodapeReceita);
  return doc.toFile(options.fileName);
}

// ============================================================================
// COMPARTILHAMENTO VIA WHATSAPP
// ============================================================================

export interface ShareWhatsAppResult {
  success: boolean;
  method: "web-share" | "whatsapp-web" | "cancelled" | "fallback";
  publicUrl?: string;
  error?: string;
}

export interface SharePdfViaWhatsAppContext {
  file: File;
  documentTitle: string;
  patientName?: string;
  patientPhone?: string | null;
  customMessage?: string;
}

export async function sharePdfViaWhatsApp(
  context: SharePdfViaWhatsAppContext
): Promise<ShareWhatsAppResult> {
  const { file, documentTitle, patientName, patientPhone, customMessage } = context;
  const cleanPhone = cleanBrazilianPhone(patientPhone);

  const greeting = patientName ? `Olá, ${patientName}!` : "Olá!";
  const baseMessage =
    customMessage ||
    `${greeting}\n\nSegue em anexo o seu documento clínico oficial: *${documentTitle}*.\n\nQualquer dúvida sobre as instruções ou orientações, nossa equipe permanece à disposição.\n\n*Clínica Dra. Juliana Sena*\nEstética Avançada e Regenerativa\nSalvador - BA`;

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  ) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: documentTitle,
          text: baseMessage,
        });
        return { success: true, method: "web-share" };
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return { success: false, method: "cancelled" };
      }
      console.warn("[WhatsApp Share] Web Share API falhou ou foi recusado, aplicando fallback:", err);
    }
  }

  let publicUrl: string | undefined = undefined;

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const bucket = "documentos";
      const filePath = `whatsapp_temp/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          publicUrl = urlData.publicUrl;
        }
      }
    }
  } catch (err) {
    console.warn("[WhatsApp Share] Não foi possível fazer upload para o storage:", err);
  }

  let finalMessage = baseMessage;
  if (publicUrl) {
    finalMessage += `\n\n📄 *Acesse ou baixe o PDF aqui:*\n${publicUrl}`;
  } else {
    finalMessage += `\n\n📄 *Arquivo gerado:* ${file.name}`;
  }

  const encodedText = encodeURIComponent(finalMessage);
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;

  if (typeof window !== "undefined") {
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return { success: true, method: "whatsapp-web", publicUrl };
}
