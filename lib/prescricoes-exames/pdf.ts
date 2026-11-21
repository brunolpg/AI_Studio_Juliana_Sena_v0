import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
// @ts-expect-error @pdf-lib/fontkit não possui declarações completas para ESM/CJS
import fontkit from "@pdf-lib/fontkit";
import type { PrescricaoExame } from "@/types/prescricao-exame";

export interface ExamPrescriptionPatientInfo {
  nome?: string;
  cpf?: string;
  idade?: number | string;
  status?: string;
}

const CLINIC_INFO = {
  profissional: "Dra. Juliana Sena",
  subtitulo: "Biomedicina Estética & Práticas Integrativas em Saúde",
  local: "Salvador - Bahia • Atendimento Personalizado",
  rodape:
    "Dra. Juliana Sena • Biomedicina Estética & Práticas Integrativas em Saúde • Salvador - BA • Telefone: (71) 98661-2878 • COREN-BA 366.344",
} as const;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 44;
const MAX_USABLE_PAGE_H = PAGE_H - MARGIN * 2 - FOOTER_RESERVED;

// Paleta 1:1 com tokens MD4 (app/globals.css) e print-exam-prescription-modal.tsx
const C = {
  primary: rgb(0.051, 0.58, 0.533), // #0d9488
  primaryContainer: rgb(0.8, 0.984, 0.945), // #ccfbf1
  onPrimaryContainer: rgb(0.067, 0.369, 0.349), // #115e59
  primaryBorderSoft: rgb(0.698, 0.875, 0.859), // primary/30 blended
  primaryHeaderLine: rgb(0.812, 0.918, 0.906), // primary/20 blended
  ink: rgb(0.059, 0.09, 0.165), // #0f172a (on-surface)
  text: rgb(0.2, 0.255, 0.333), // #334155
  muted: rgb(0.278, 0.333, 0.412), // #475569 (on-surface-variant)
  faint: rgb(0.58, 0.639, 0.722), // #94a3b8
  line: rgb(0.796, 0.835, 0.882), // #cbd5e1 (outline-variant)
  panelLow: rgb(0.973, 0.98, 0.988), // #f8fafc (surface-container-low)
  panel: rgb(0.945, 0.961, 0.976), // #f1f5f9 (surface-container)
  white: rgb(1, 1, 1), // #ffffff (surface-container-lowest)
  error: rgb(0.863, 0.149, 0.149), // #dc2626
  onErrorContainer: rgb(0.498, 0.114, 0.114), // #7f1d1d
  errorBg: rgb(0.996, 0.886, 0.886), // #fee2e2
  errorBorder: rgb(0.945, 0.722, 0.722), // error/30
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

let regularFontBytesCache: Uint8Array | null | undefined;
let boldFontBytesCache: Uint8Array | null | undefined;
let logoBytesCache: Uint8Array | null | undefined;

async function loadPublicAssetBytes(relativePath: string): Promise<Uint8Array | null> {
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

async function loadPlusJakartaFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array } | null> {
  if (regularFontBytesCache === undefined || boldFontBytesCache === undefined) {
    const [reg, bld] = await Promise.all([
      loadPublicAssetBytes("fonts/PlusJakartaSans-Regular.ttf"),
      loadPublicAssetBytes("fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    regularFontBytesCache = reg;
    boldFontBytesCache = bld;
  }
  if (regularFontBytesCache && boldFontBytesCache) {
    return { regular: regularFontBytesCache, bold: boldFontBytesCache };
  }
  return null;
}

async function loadClinicLogoBytes(): Promise<Uint8Array | null> {
  if (logoBytesCache === undefined) {
    logoBytesCache = await loadPublicAssetBytes("logo-clinica.png");
  }
  return logoBytesCache;
}

function getTodayIsoSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) {
    const today = getTodayIsoSaoPaulo();
    const [y, m, d] = today.split("-");
    return `${d}/${m}/${y}`;
  }
  const clean = String(dateStr).trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  }
  return clean;
}

function formatDateTimeBR(isoStr?: string | null, fallbackDate?: string | null): string {
  if (isoStr) {
    const parsed = new Date(isoStr);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(parsed);
    }
  }
  return formatDateBR(fallbackDate);
}

function formatCpf(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf.trim() || "Não informado";
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

function sanitizeText(font: PDFFont, input: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of String(input || "").normalize("NFC")) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (ch === "\n") {
      out += ch;
    } else if (ch === "\r") {
      continue;
    } else if (ch === "\t") {
      out += "  ";
    } else if (supported.has(cp)) {
      out += ch;
    } else if (ch in CHAR_REPLACEMENTS) {
      const replacement = CHAR_REPLACEMENTS[ch];
      for (const rCh of replacement) {
        const rCp = rCh.codePointAt(0);
        if (rCp !== undefined && supported.has(rCp)) {
          out += rCh;
        }
      }
    } else if (cp < 0x20 || (cp >= 0x1f000 && cp <= 0x1faff)) {
      continue;
    } else {
      const fallback = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (fallback && supported.has(fallback.codePointAt(0)!)) {
        out += fallback;
      }
    }
  }
  return out;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const cleanText = sanitizeText(font, text);
  const lines: string[] = [];

  for (const para of cleanText.split("\n")) {
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
            if (chunk) lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      }
    }
    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function roundedRectSvgPath(w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M ${radius} 0`,
    `L ${w - radius} 0`,
    `Q ${w} 0 ${w} ${radius}`,
    `L ${w} ${h - radius}`,
    `Q ${w} ${h} ${w - radius} ${h}`,
    `L ${radius} ${h}`,
    `Q 0 ${h} 0 ${h - radius}`,
    `L 0 ${radius}`,
    `Q 0 0 ${radius} 0`,
    `Z`,
  ].join(" ");
}

function drawRoundedRectangle(
  page: PDFPage,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
    color?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
  }
) {
  const {
    x,
    y,
    width: w,
    height: h,
    borderRadius = 6,
    color,
    borderColor,
    borderWidth = 0.8,
  } = opts;

  page.drawSvgPath(roundedRectSvgPath(w, h, borderRadius), {
    x,
    y: y + h,
    color,
    borderColor,
    borderWidth: borderColor ? borderWidth : 0,
  });
}

export function examPrescriptionPdfFileName(
  patientName?: string,
  dateStr?: string
): string {
  const base = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  const isoDate =
    dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr.trim())
      ? dateStr.trim().slice(0, 10)
      : getTodayIsoSaoPaulo();

  return `Solicitacao_Exames_${base || "Paciente"}_${isoDate}.pdf`;
}

export function buildExamNotificationMessage(
  patientName?: string,
  titulo?: string,
  data?: string
): string {
  const firstName = (patientName || "Paciente").trim().split(/\s+/)[0] || "Paciente";
  const dataFormatada = formatDateBR(data);
  return `Olá, ${firstName}! Sua solicitação de exames laboratoriais "${titulo || "Solicitação de Exames Laboratoriais"}" (emissão em ${dataFormatada}) foi emitida pela Dra. Juliana Sena. Segue em anexo o documento oficial em PDF com todos os exames solicitados e orientações de preparo. Você também pode consultá-lo a qualquer momento no seu Portal do Paciente.`;
}

export async function buildExamPrescriptionPdf(
  prescricao: PrescricaoExame,
  paciente?: ExamPrescriptionPatientInfo
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  let regular: PDFFont;
  let bold: PDFFont;
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const fontBytes = await loadPlusJakartaFonts();
  if (fontBytes) {
    try {
      regular = await pdf.embedFont(fontBytes.regular);
      bold = await pdf.embedFont(fontBytes.bold);
    } catch {
      regular = await pdf.embedFont(StandardFonts.Helvetica);
      bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }

  let embeddedLogo: PDFImage | null = null;
  const logoBytes = await loadClinicLogoBytes();
  if (logoBytes) {
    try {
      embeddedLogo = await pdf.embedPng(logoBytes);
    } catch {
      embeddedLogo = null;
    }
  }

  const patientName =
    paciente?.nome?.trim() ||
    prescricao.paciente?.nome?.trim() ||
    "Paciente";
  const patientCpf = paciente?.cpf ?? prescricao.paciente?.cpf;
  const patientAge = paciente?.idade;
  const statusLabel = prescricao.status || paciente?.status || "Ativo";
  const isAtivo = prescricao.status === "Ativo";
  const emissionDateBR = formatDateBR(prescricao.data);

  pdf.setTitle(sanitizeText(regular, `Solicitação de Exames - ${patientName}`));
  pdf.setAuthor(prescricao.profissional || CLINIC_INFO.profissional);
  pdf.setSubject("Solicitação de Exames Laboratoriais");
  pdf.setProducer("Dra. Juliana Sena - Gestão Clínica");
  pdf.setCreator("Dra. Juliana Sena - Gestão Clínica");

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const addPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensureGroup = (neededHeight: number) => {
    if (neededHeight <= MAX_USABLE_PAGE_H && y - neededHeight < MARGIN + FOOTER_RESERVED) {
      addPage();
    }
  };

  const ensureLine = (neededHeight: number) => {
    if (y - neededHeight < MARGIN + FOOTER_RESERVED) {
      addPage();
    }
  };

  const drawText = (
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
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9.5;
    const clean = sanitizeText(font, value);
    let px = x;
    if (opts.align === "right") {
      px = x + (opts.width ?? 0) - font.widthOfTextAtSize(clean, size);
    } else if (opts.align === "center") {
      px = x + ((opts.width ?? 0) - font.widthOfTextAtSize(clean, size)) / 2;
    }
    page.drawText(clean, { x: px, y: baseline, font, size, color: opts.color ?? C.ink });
  };

  const drawLines = (
    lines: string[],
    x: number,
    topY: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      leading?: number;
      align?: "left" | "right" | "center";
      width?: number;
    } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9;
    const leading = opts.leading ?? size * 1.4;
    lines.forEach((ln, idx) => {
      if (ln) {
        drawText(ln, x, topY - size - idx * leading, {
          font,
          size,
          color: opts.color ?? C.text,
          align: opts.align,
          width: opts.width,
        });
      }
    });
    return lines.length * leading;
  };

  // ============================================================================
  // 1. CABEÇALHO INSTITUCIONAL (1:1 com print-exam-prescription-modal.tsx)
  // ============================================================================
  const headerTopY = y;
  let leftTextX = MARGIN;

  if (embeddedLogo) {
    const logoH = 42;
    const scale = logoH / embeddedLogo.height;
    const logoW = embeddedLogo.width * scale;
    page.drawImage(embeddedLogo, {
      x: MARGIN,
      y: headerTopY - logoH,
      width: logoW,
      height: logoH,
    });
    leftTextX = MARGIN + logoW + 12;
  }

  // Lado direito: Badge dinâmico com prescricao.titulo + Emissão
  const badgeLabel = (prescricao.titulo?.trim() || "Prescrição de Exames").toUpperCase();
  const badgeFontSize = 7.4;
  const badgeMaxInnerW = 190;
  const badgeLines = wrapText(badgeLabel, bold, badgeFontSize, badgeMaxInnerW);
  const badgeLongestLineW = Math.max(
    ...badgeLines.map((ln) => bold.widthOfTextAtSize(sanitizeText(bold, ln), badgeFontSize)),
    70
  );
  const badgeW = Math.min(badgeMaxInnerW + 18, badgeLongestLineW + 18);
  const badgeH = Math.max(18, badgeLines.length * 10 + 8);
  const badgeX = PAGE_W - MARGIN - badgeW;
  const badgeY = headerTopY - badgeH - 2;

  const leftColMaxW = Math.max(140, badgeX - leftTextX - 12);
  const subtitleLines = wrapText(CLINIC_INFO.subtitulo, regular, 8.2, leftColMaxW);
  const localLines = wrapText(CLINIC_INFO.local, regular, 7.8, leftColMaxW);

  drawText(CLINIC_INFO.profissional, leftTextX, headerTopY - 14, {
    font: bold,
    size: 15,
    color: C.primary,
  });
  const afterSubY =
    headerTopY - 19 - drawLines(subtitleLines, leftTextX, headerTopY - 19, {
      font: regular,
      size: 8.2,
      color: C.muted,
      leading: 11,
    });
  const afterLocalY =
    afterSubY -
    drawLines(localLines, leftTextX, afterSubY - 1, {
      font: regular,
      size: 7.8,
      color: C.muted,
      leading: 10.5,
    });

  drawRoundedRectangle(page, {
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    borderRadius: Math.min(9, badgeH / 2),
    color: C.primaryContainer,
    borderColor: C.primaryBorderSoft,
    borderWidth: 0.8,
  });

  drawLines(badgeLines, badgeX + 9, badgeY + badgeH - 4, {
    font: bold,
    size: badgeFontSize,
    color: C.onPrimaryContainer,
    leading: 10,
    align: "center",
    width: badgeW - 18,
  });

  const emissionBaselineY = badgeY - 12;
  drawText(`Emissão: ${emissionDateBR}`, MARGIN, emissionBaselineY, {
    font: regular,
    size: 8.2,
    color: C.muted,
    align: "right",
    width: CONTENT_W,
  });

  const leftBottomY = Math.min(headerTopY - 44, afterLocalY - 4);
  const rightBottomY = emissionBaselineY - 6;
  y = Math.min(leftBottomY, rightBottomY) - 6;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.5,
    color: C.primaryHeaderLine,
  });
  y -= 16;

  // ============================================================================
  // 2. IDENTIFICAÇÃO DO PACIENTE (Card indivisível 1:1 com modal)
  // ============================================================================
  const col1W = CONTENT_W * 0.46 - 14;
  const col3W = CONTENT_W * 0.28 - 14;
  const nameLines = wrapText(patientName, bold, 10, col1W);
  const ageText =
    patientAge !== undefined && patientAge !== null && String(patientAge).trim() !== ""
      ? `${patientAge} anos`
      : "Não informada";
  const ageStatusLines = wrapText(`${ageText} • ${statusLabel}`, regular, 9, col3W);
  const maxPatientLines = Math.max(nameLines.length, ageStatusLines.length, 1);
  const patientBoxH = 38 + maxPatientLines * 13;

  ensureGroup(patientBoxH + 14);
  drawRoundedRectangle(page, {
    x: MARGIN,
    y: y - patientBoxH,
    width: CONTENT_W,
    height: patientBoxH,
    borderRadius: 8,
    color: C.panelLow,
    borderColor: C.line,
    borderWidth: 0.8,
  });

  drawText("IDENTIFICAÇÃO DO PACIENTE", MARGIN + 12, y - 14, {
    font: bold,
    size: 7.5,
    color: C.primary,
  });

  const col1X = MARGIN + 12;
  const col2X = MARGIN + CONTENT_W * 0.46;
  const col3X = MARGIN + CONTENT_W * 0.72;

  drawText("Nome Completo:", col1X, y - 27, { font: regular, size: 7.5, color: C.muted });
  drawLines(nameLines, col1X, y - 31, { font: bold, size: 10, color: C.ink, leading: 13 });

  drawText("CPF:", col2X, y - 27, { font: regular, size: 7.5, color: C.muted });
  drawText(formatCpf(patientCpf), col2X, y - 40, {
    font: mono,
    size: 9,
    color: C.ink,
  });

  drawText("Idade / Status:", col3X, y - 27, { font: regular, size: 7.5, color: C.muted });
  drawLines(ageStatusLines, col3X, y - 31, { font: regular, size: 9, color: C.ink, leading: 13 });

  y -= patientBoxH + 14;

  // ============================================================================
  // 2.1 ALERTA DE PRESCRIÇÃO SUSPENSA (SE APLICÁVEL)
  // ============================================================================
  if (!isAtivo) {
    const alertParts = [
      "Atenção - Documento Suspenso: Esta solicitação de exames foi descontinuada ou substituída.",
      prescricao.justificativa_suspensao
        ? `Motivo: "${prescricao.justificativa_suspensao}"`
        : "",
      prescricao.data_suspensao
        ? `Data da suspensão: ${formatDateBR(prescricao.data_suspensao)}`
        : "",
    ].filter(Boolean);
    const alertLines = wrapText(alertParts.join("\n"), regular, 8.5, CONTENT_W - 24);
    const alertH = 16 + alertLines.length * 12.5;
    ensureGroup(alertH + 12);

    drawRoundedRectangle(page, {
      x: MARGIN,
      y: y - alertH,
      width: CONTENT_W,
      height: alertH,
      borderRadius: 7,
      color: C.errorBg,
      borderColor: C.errorBorder,
      borderWidth: 0.8,
    });

    drawLines(alertLines, MARGIN + 12, y - 8, {
      font: bold,
      size: 8.5,
      color: C.onErrorContainer,
      leading: 12.5,
    });

    y -= alertH + 14;
  }

  // ============================================================================
  // 3. DESCRIÇÃO / MENSAGEM AO LABORATÓRIO (1:1 com modal)
  // ============================================================================
  if (prescricao.descricao && prescricao.descricao.trim()) {
    const descW = CONTENT_W - 24;
    const descLines = wrapText(prescricao.descricao.trim(), regular, 9, descW);
    const descLeading = 13.5;
    const descH = 16 + descLines.length * descLeading;

    if (descH <= MAX_USABLE_PAGE_H) {
      ensureGroup(descH + 14);
      drawRoundedRectangle(page, {
        x: MARGIN,
        y: y - descH,
        width: CONTENT_W,
        height: descH,
        borderRadius: 7,
        color: C.panel,
        borderColor: C.line,
        borderWidth: 0.8,
      });

      drawLines(descLines, MARGIN + 12, y - 8, {
        font: regular,
        size: 9,
        color: C.ink,
        leading: descLeading,
      });

      y -= descH + 14;
    } else {
      for (const ln of descLines) {
        ensureLine(descLeading + 4);
        if (ln) drawText(ln, MARGIN + 8, y - 9, { font: regular, size: 9, color: C.ink });
        y -= descLeading;
      }
      y -= 10;
    }
  }

  // ============================================================================
  // 4. PAINEL DE EXAMES LABORATORIAIS SOLICITADOS (título nunca órfão!)
  // ============================================================================
  const grupos = Array.isArray(prescricao.grupos_exames) ? prescricao.grupos_exames : [];

  const cardPaddingX = 12;
  const colGap = 16;
  const itemColW = (CONTENT_W - cardPaddingX * 2 - colGap) / 2;
  const examTextW = itemColW - 12;
  const examFontSize = 8.8;
  const examLeading = 12.5;
  const cardHeaderH = 26;
  const cardPadBottom = 10;

  const preparedGroups = grupos.map((grp, gIdx) => {
    const exames = Array.isArray(grp.exames) ? grp.exames.filter((e) => String(e).trim()) : [];
    const groupTitle = grp.nome_grupo?.trim() || `Grupo #${gIdx + 1}`;
    const countLabel = `${exames.length} ${exames.length === 1 ? "exame" : "exames"}`;

    const rowPairs: Array<{ left: string[]; right: string[]; rowH: number }> = [];
    for (let i = 0; i < exames.length; i += 2) {
      const leftLines = wrapText(String(exames[i]), regular, examFontSize, examTextW);
      const rightLines =
        i + 1 < exames.length
          ? wrapText(String(exames[i + 1]), regular, examFontSize, examTextW)
          : [];
      const maxLines = Math.max(leftLines.length, rightLines.length, 1);
      rowPairs.push({
        left: leftLines,
        right: rightLines,
        rowH: maxLines * examLeading + 5,
      });
    }

    const totalBodyH = rowPairs.reduce((acc, r) => acc + r.rowH, 0);
    const fullCardH = cardHeaderH + Math.max(totalBodyH, 16) + cardPadBottom;
    return { groupTitle, countLabel, rowPairs, fullCardH };
  });

  // Garante que o título da seção acompanhe o 1º card de exames (sem título órfão)
  const sectionTitleH = 22;
  const firstGroupLookahead =
    preparedGroups.length > 0
      ? Math.min(preparedGroups[0].fullCardH + 10, 120)
      : 24;
  ensureGroup(
    preparedGroups.length > 0 && sectionTitleH + preparedGroups[0].fullCardH + 10 <= MAX_USABLE_PAGE_H
      ? sectionTitleH + preparedGroups[0].fullCardH + 10
      : sectionTitleH + firstGroupLookahead
  );

  page.drawRectangle({
    x: MARGIN,
    y: y - 11,
    width: 3.5,
    height: 11,
    color: C.primary,
  });
  drawText("PAINEL DE EXAMES LABORATORIAIS SOLICITADOS", MARGIN + 9, y - 10, {
    font: bold,
    size: 10,
    color: C.ink,
  });
  y -= sectionTitleH;

  if (preparedGroups.length === 0) {
    ensureGroup(24);
    drawText("Nenhum grupo de exame registrado.", MARGIN, y - 10, {
      font: regular,
      size: 9,
      color: C.muted,
    });
    y -= 22;
  } else {
    for (const grp of preparedGroups) {
      const drawGroupCard = (
        pairs: typeof grp.rowPairs,
        titleText: string,
        rightBadge: string
      ) => {
        const bodyH = pairs.reduce((acc, r) => acc + r.rowH, 0);
        const cardH = cardHeaderH + Math.max(bodyH, 16) + cardPadBottom;
        const cardTopY = y;

        drawRoundedRectangle(page, {
          x: MARGIN,
          y: cardTopY - cardH,
          width: CONTENT_W,
          height: cardH,
          borderRadius: 8,
          color: C.white,
          borderColor: C.line,
          borderWidth: 0.8,
        });

        drawText(titleText, MARGIN + cardPaddingX, cardTopY - 16, {
          font: bold,
          size: 9.5,
          color: C.primary,
        });
        drawText(rightBadge, MARGIN, cardTopY - 16, {
          font: mono,
          size: 8,
          color: C.muted,
          align: "right",
          width: CONTENT_W - cardPaddingX,
        });

        page.drawLine({
          start: { x: MARGIN + cardPaddingX, y: cardTopY - cardHeaderH + 2 },
          end: { x: PAGE_W - MARGIN - cardPaddingX, y: cardTopY - cardHeaderH + 2 },
          thickness: 0.6,
          color: C.line,
        });

        let rowY = cardTopY - cardHeaderH - 5;
        for (const pair of pairs) {
          const leftX = MARGIN + cardPaddingX;
          const rightX = leftX + itemColW + colGap;

          page.drawCircle({
            x: leftX + 3,
            y: rowY - examFontSize + 2.8,
            size: 2,
            color: C.primary,
          });
          drawLines(pair.left, leftX + 10, rowY, {
            font: regular,
            size: examFontSize,
            color: C.ink,
            leading: examLeading,
          });

          if (pair.right.length > 0) {
            page.drawCircle({
              x: rightX + 3,
              y: rowY - examFontSize + 2.8,
              size: 2,
              color: C.primary,
            });
            drawLines(pair.right, rightX + 10, rowY, {
              font: regular,
              size: examFontSize,
              color: C.ink,
              leading: examLeading,
            });
          }

          rowY -= pair.rowH;
        }

        y = cardTopY - cardH - 11;
      };

      if (grp.fullCardH <= MAX_USABLE_PAGE_H) {
        ensureGroup(grp.fullCardH + 11);
        drawGroupCard(grp.rowPairs, grp.groupTitle, grp.countLabel);
      } else {
        // Grupo maior que 1 página inteira: divide em sub-cards com cabeçalho preservado
        let chunk: typeof grp.rowPairs = [];
        let chunkBodyH = 0;
        let isFirstChunk = true;

        for (const pair of grp.rowPairs) {
          const projectedH = cardHeaderH + chunkBodyH + pair.rowH + cardPadBottom;
          if (chunk.length > 0 && y - projectedH < MARGIN + FOOTER_RESERVED) {
            drawGroupCard(
              chunk,
              isFirstChunk ? grp.groupTitle : `${grp.groupTitle} (continuação)`,
              grp.countLabel
            );
            addPage();
            chunk = [];
            chunkBodyH = 0;
            isFirstChunk = false;
          }
          chunk.push(pair);
          chunkBodyH += pair.rowH;
        }
        if (chunk.length > 0) {
          drawGroupCard(
            chunk,
            isFirstChunk ? grp.groupTitle : `${grp.groupTitle} (continuação)`,
            grp.countLabel
          );
        }
      }
    }
  }

  // ============================================================================
  // 5. INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES (1:1 com modal)
  // ============================================================================
  const orientacoes = Array.isArray(prescricao.orientacoes)
    ? prescricao.orientacoes.filter((o) => String(o).trim())
    : [];

  if (orientacoes.length > 0) {
    const oriFontSize = 8.8;
    const oriLeading = 13;
    const oriTextW = CONTENT_W - 40;
    const wrappedOrientacoes = orientacoes.map((ori, idx) => ({
      num: `${idx + 1}.`,
      lines: wrapText(String(ori).trim(), regular, oriFontSize, oriTextW),
    }));

    const totalOriLinesH = wrappedOrientacoes.reduce(
      (acc, item) => acc + item.lines.length * oriLeading + 5,
      0
    );
    const oriBoxH = 30 + totalOriLinesH + 8;

    if (oriBoxH <= MAX_USABLE_PAGE_H) {
      ensureGroup(oriBoxH + 14);
      const boxTopY = y;

      drawRoundedRectangle(page, {
        x: MARGIN,
        y: boxTopY - oriBoxH,
        width: CONTENT_W,
        height: oriBoxH,
        borderRadius: 8,
        color: C.panelLow,
        borderColor: C.line,
        borderWidth: 0.8,
      });

      drawText("INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES", MARGIN + 12, boxTopY - 15, {
        font: bold,
        size: 8,
        color: C.primary,
      });

      let itemY = boxTopY - 27;
      for (const item of wrappedOrientacoes) {
        drawText(item.num, MARGIN + 14, itemY - oriFontSize, {
          font: bold,
          size: oriFontSize,
          color: C.primary,
        });
        drawLines(item.lines, MARGIN + 28, itemY, {
          font: regular,
          size: oriFontSize,
          color: C.ink,
          leading: oriLeading,
        });
        itemY -= item.lines.length * oriLeading + 5;
      }

      y = boxTopY - oriBoxH - 14;
    } else {
      ensureGroup(36);
      drawText("INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES", MARGIN, y - 12, {
        font: bold,
        size: 8.5,
        color: C.primary,
      });
      y -= 20;

      for (const item of wrappedOrientacoes) {
        const h = item.lines.length * oriLeading + 5;
        ensureLine(h + 4);
        drawText(item.num, MARGIN + 4, y - oriFontSize, {
          font: bold,
          size: oriFontSize,
          color: C.primary,
        });
        drawLines(item.lines, MARGIN + 20, y, {
          font: regular,
          size: oriFontSize,
          color: C.ink,
          leading: oriLeading,
        });
        y -= h;
      }
      y -= 10;
    }
  }

  // ============================================================================
  // 6. CHANCELA DE ASSINATURA DIGITAL SHA-256 (1:1 com modal, indivisível)
  // ============================================================================
  const hashValue = prescricao.payload_hash?.trim() || "";
  const hashLines = hashValue
    ? wrapText(
        `Hash de Integridade (${prescricao.algoritmo || "SHA-256"}): ${hashValue}`,
        mono,
        7.4,
        CONTENT_W - 36
      )
    : [];
  const hashBoxH = hashLines.length > 0 ? hashLines.length * 10.5 + 12 : 0;
  const sigBoxH = 66 + (hashBoxH > 0 ? hashBoxH + 10 : 0);

  ensureGroup(sigBoxH + 12);
  const sigTopY = y;

  drawRoundedRectangle(page, {
    x: MARGIN,
    y: sigTopY - sigBoxH,
    width: CONTENT_W,
    height: sigBoxH,
    borderRadius: 8,
    color: C.white,
    borderColor: C.line,
    borderWidth: 0.8,
  });

  // Cabeçalho da chancela
  drawText("Assinatura Digital & Integridade Clínica", MARGIN + 12, sigTopY - 15, {
    font: bold,
    size: 8.8,
    color: C.ink,
  });

  const algText = `Algoritmo: ${prescricao.algoritmo || "SHA-256"}`;
  const algW = mono.widthOfTextAtSize(sanitizeText(mono, algText), 7.2) + 14;
  const algX = PAGE_W - MARGIN - 12 - algW;
  drawRoundedRectangle(page, {
    x: algX,
    y: sigTopY - 20,
    width: algW,
    height: 14,
    borderRadius: 7,
    color: C.primaryContainer,
  });
  drawText(algText, algX, sigTopY - 15.5, {
    font: mono,
    size: 7.2,
    color: C.onPrimaryContainer,
    align: "center",
    width: algW,
  });

  page.drawLine({
    start: { x: MARGIN + 12, y: sigTopY - 25 },
    end: { x: PAGE_W - MARGIN - 12, y: sigTopY - 25 },
    thickness: 0.6,
    color: C.line,
  });

  const sigCol1X = MARGIN + 12;
  const sigCol2X = MARGIN + CONTENT_W * 0.52;

  drawText("Profissional Responsável:", sigCol1X, sigTopY - 38, {
    font: regular,
    size: 7.5,
    color: C.muted,
  });
  drawText(prescricao.profissional || CLINIC_INFO.profissional, sigCol1X, sigTopY - 51, {
    font: bold,
    size: 9.5,
    color: C.ink,
  });

  drawText("Assinado Digitalmente em:", sigCol2X, sigTopY - 38, {
    font: regular,
    size: 7.5,
    color: C.muted,
  });
  drawText(formatDateTimeBR(prescricao.assinado_em, prescricao.data), sigCol2X, sigTopY - 51, {
    font: mono,
    size: 8.5,
    color: C.ink,
  });

  if (hashBoxH > 0) {
    const hashBoxTopY = sigTopY - 62;
    drawRoundedRectangle(page, {
      x: MARGIN + 12,
      y: hashBoxTopY - hashBoxH,
      width: CONTENT_W - 24,
      height: hashBoxH,
      borderRadius: 6,
      color: C.panel,
    });

    drawLines(hashLines, MARGIN + 18, hashBoxTopY - 6, {
      font: mono,
      size: 7.4,
      color: C.muted,
      leading: 10.5,
    });
  }

  // ============================================================================
  // 7. RODAPÉ INSTITUCIONAL EM TODAS AS PÁGINAS
  // ============================================================================
  const pages = pdf.getPages();
  pages.forEach((p, idx) => {
    page = p;
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 26 },
      end: { x: PAGE_W - MARGIN, y: MARGIN + 26 },
      thickness: 0.6,
      color: C.line,
    });
    drawText(CLINIC_INFO.rodape, MARGIN, MARGIN + 15, {
      font: regular,
      size: 6.8,
      color: C.faint,
      align: "center",
      width: CONTENT_W,
    });
    const pageInfo = pages.length > 1 ? `  •  Página ${idx + 1} de ${pages.length}` : "";
    drawText(
      `Documento: ${prescricao.id || "—"}  •  Emissão: ${emissionDateBR}${pageInfo}`,
      MARGIN,
      MARGIN + 4,
      {
        font: regular,
        size: 6.5,
        color: C.faint,
        align: "center",
        width: CONTENT_W,
      }
    );
  });

  return pdf.save({ useObjectStreams: false });
}
