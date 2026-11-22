import fs from "node:fs";
import path from "node:path";
import {
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";
// @ts-expect-error @pdf-lib/fontkit não possui declarações completas para ESM/CJS
import fontkit from "@pdf-lib/fontkit";
import { normalizeDeclaracaoOrdem } from "@/lib/validations/termo";
import type { TermoSnapshot, TermoSnapshotCheckbox } from "@/types/termo";

export interface TermoPdfPaciente {
  nome: string;
  telefone?: string | null;
  data_nascimento?: string | null;
  cpf?: string | null;
  email?: string | null;
}

export interface TermoConsentimentoPdfInput {
  termoId?: string;
  procedimentoNome: string;
  data?: string | null;
  assinadoEm?: string | null;
  profissional?: string | null;
  paciente: TermoPdfPaciente;
  conteudoSnapshot: TermoSnapshot;
  signatureDataUrl: string;
}

const CLINIC = {
  profissional: "Juliana Sena de Souza Vieira",
  cargo: "Enfermeira Esteta",
  registro: "COREN-BA 366.344",
  rodape: "Juliana Sena de Souza Vieira • COREN-BA 366.344 • Salvador - BA",
} as const;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 44;
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2MB

const C = {
  primary: rgb(0, 0.302, 0.251), // #004d40
  primarySoftBg: rgb(0.925, 0.976, 0.965),
  primaryBorder: rgb(0.745, 0.906, 0.875),
  ink: rgb(0.06, 0.09, 0.16),
  text: rgb(0.2, 0.25, 0.33),
  muted: rgb(0.39, 0.45, 0.55),
  faint: rgb(0.55, 0.61, 0.69),
  line: rgb(0.87, 0.9, 0.93),
  panel: rgb(0.973, 0.98, 0.988),
  white: rgb(1, 1, 1),
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

let regularFontBytesCache: Uint8Array | null = null;
let boldFontBytesCache: Uint8Array | null = null;
let logoBytesCache: Uint8Array | null | undefined;

function loadLocalPlusJakartaSansFonts(): { regular: Uint8Array; bold: Uint8Array } | null {
  try {
    if (!regularFontBytesCache || !boldFontBytesCache) {
      const regularPath = path.join(
        process.cwd(),
        "public",
        "fonts",
        "PlusJakartaSans-Regular.ttf"
      );
      const boldPath = path.join(
        process.cwd(),
        "public",
        "fonts",
        "PlusJakartaSans-Bold.ttf"
      );

      if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
        return null;
      }

      regularFontBytesCache = new Uint8Array(fs.readFileSync(regularPath));
      boldFontBytesCache = new Uint8Array(fs.readFileSync(boldPath));
    }
    return { regular: regularFontBytesCache, bold: boldFontBytesCache };
  } catch (err) {
    console.warn("[termos/pdf] Falha ao carregar Plus Jakarta Sans local:", err);
    return null;
  }
}

function loadClinicLogo(): Uint8Array | null {
  if (logoBytesCache !== undefined) return logoBytesCache;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-clinica.png");
    if (fs.existsSync(logoPath)) {
      logoBytesCache = new Uint8Array(fs.readFileSync(logoPath));
      return logoBytesCache;
    }
  } catch (err) {
    console.warn("[termos/pdf] Falha ao carregar logo da clínica:", err);
  }
  logoBytesCache = null;
  return null;
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

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
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

function topRoundedRectSvgPath(w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${radius} 0`,
    `L ${w - radius} 0`,
    `Q ${w} 0 ${w} ${radius}`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
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

function drawTopRoundedRect(
  page: PDFPage,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
    color?: ReturnType<typeof rgb>;
  }
) {
  const { x, y, width: w, height: h, borderRadius = 6, color } = opts;
  page.drawSvgPath(topRoundedRectSvgPath(w, h, borderRadius), {
    x,
    y: y + h,
    color,
    borderWidth: 0,
  });
}

function drawCheckedVectorBox(page: PDFPage, x: number, bottomY: number, size = 10) {
  drawRoundedRectangle(page, {
    x,
    y: bottomY,
    width: size,
    height: size,
    borderRadius: 2,
    color: C.primary,
    borderColor: C.primary,
    borderWidth: 0.7,
  });

  // Check vetorial interno via drawLine (coordenadas proporcionais ao tamanho da caixa)
  const p1 = { x: x + size * 0.24, y: bottomY + size * 0.5 };
  const p2 = { x: x + size * 0.43, y: bottomY + size * 0.28 };
  const p3 = { x: x + size * 0.78, y: bottomY + size * 0.72 };

  page.drawLine({
    start: p1,
    end: p2,
    thickness: 1.45,
    color: C.white,
    lineCap: LineCapStyle.Round,
  });
  page.drawLine({
    start: p2,
    end: p3,
    thickness: 1.45,
    color: C.white,
    lineCap: LineCapStyle.Round,
  });
}

function formatCpf(cpf?: string | null): string {
  if (!cpf) return "Não informado";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return cpf.trim() || "Não informado";
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return "Não informado";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone.trim() || "Não informado";
}

function formatBirthDateBR(dateStr?: string | null): string {
  if (!dateStr) return "Não informada";
  const trimmed = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const clean = trimmed.split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(parsed);
  }
  return trimmed;
}

function formatSignedDateTimeSaoPaulo(isoStr?: string | null): string {
  const date = isoStr ? new Date(isoStr) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const datePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(validDate);

  const timePart = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(validDate);

  return `${datePart} às ${timePart} (Horário de Brasília)`;
}

function decodePngDataUrl(dataUrl: string): Uint8Array {
  const trimmed = (dataUrl || "").trim();
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (!match) {
    throw new Error(
      "Assinatura inválida. É necessário fornecer uma imagem PNG em base64."
    );
  }

  const base64Payload = match[1].replace(/\s+/g, "");
  const bytes = Buffer.from(base64Payload, "base64");

  if (bytes.byteLength < 8) {
    throw new Error("Assinatura PNG vazia ou corrompida.");
  }
  if (bytes.byteLength > MAX_SIGNATURE_BYTES) {
    throw new Error("Imagem da assinatura excede o limite permitido de 2MB.");
  }

  // Verifica magic bytes de PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (!isPng) {
    throw new Error("Arquivo de assinatura não corresponde a um PNG válido.");
  }

  return new Uint8Array(bytes);
}

function normalizeCheckboxText(item: TermoSnapshotCheckbox | string): string {
  if (typeof item === "string") return item.trim();
  return String(item?.texto || "").trim();
}

function normalizeComparableTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function generateTermoConsentimentoPdf(
  input: TermoConsentimentoPdfInput
): Promise<Uint8Array> {
  const signatureBytes = decodePngDataUrl(input.signatureDataUrl);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let regular: PDFFont;
  let bold: PDFFont;

  const fontBytes = loadLocalPlusJakartaSansFonts();
  if (fontBytes) {
    try {
      regular = await pdfDoc.embedFont(fontBytes.regular);
      bold = await pdfDoc.embedFont(fontBytes.bold);
    } catch {
      regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let embeddedLogo: PDFImage | null = null;
  const logoBytes = loadClinicLogo();
  if (logoBytes) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn("[termos/pdf] Falha ao embutir logo PNG:", err);
    }
  }

  const embeddedSignature = await pdfDoc.embedPng(signatureBytes);

  const pacienteNome = input.paciente.nome?.trim() || "Paciente";
  const procedimentoNome =
    input.procedimentoNome?.trim() ||
    input.conteudoSnapshot?.procedimento?.trim() ||
    "Procedimento Estético";

  pdfDoc.setTitle(
    sanitizeText(regular, `Termo de Consentimento - ${procedimentoNome} - ${pacienteNome}`)
  );
  pdfDoc.setAuthor(CLINIC.profissional);
  pdfDoc.setSubject(`Termo de Consentimento Livre e Esclarecido - ${procedimentoNome}`);
  pdfDoc.setProducer("Dra. Juliana Sena - Gestão Clínica");
  pdfDoc.setCreator("Dra. Juliana Sena - Gestão Clínica");

  let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const drawText = (
    targetPage: PDFPage,
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
    targetPage.drawText(clean, {
      x: px,
      y: baseline,
      font,
      size,
      color: opts.color ?? C.ink,
    });
  };

  const drawLines = (
    targetPage: PDFPage,
    lines: string[],
    x: number,
    topY: number,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      leading?: number;
    } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9.2;
    const leading = opts.leading ?? size * 1.45;
    lines.forEach((ln, idx) => {
      if (ln) {
        drawText(targetPage, ln, x, topY - size - idx * leading, {
          font,
          size,
          color: opts.color ?? C.text,
        });
      }
    });
    return lines.length * leading;
  };

  const drawMiniContinuationHeader = (targetPage: PDFPage): number => {
    const topY = PAGE_H - MARGIN;
    let leftX = MARGIN;

    if (embeddedLogo) {
      const miniLogoH = 20;
      const miniScale = miniLogoH / embeddedLogo.height;
      const miniLogoW = embeddedLogo.width * miniScale;
      targetPage.drawImage(embeddedLogo, {
        x: MARGIN,
        y: topY - miniLogoH,
        width: miniLogoW,
        height: miniLogoH,
      });
      leftX = MARGIN + miniLogoW + 10;
    }

    drawText(
      targetPage,
      "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO",
      leftX,
      topY - 9,
      {
        font: bold,
        size: 7.5,
        color: C.primary,
      }
    );
    drawText(
      targetPage,
      `${procedimentoNome}  •  Paciente: ${pacienteNome}`,
      leftX,
      topY - 19,
      {
        font: regular,
        size: 7.5,
        color: C.muted,
      }
    );

    drawText(targetPage, CLINIC.registro, MARGIN, topY - 14, {
      font: bold,
      size: 7.5,
      color: C.muted,
      align: "right",
      width: CONTENT_W,
    });

    const lineY = topY - 26;
    targetPage.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_W - MARGIN, y: lineY },
      thickness: 0.7,
      color: C.primaryBorder,
    });

    return lineY - 16;
  };

  const addNewPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = drawMiniContinuationHeader(page);
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < MARGIN + FOOTER_RESERVED) {
      addNewPage();
    }
  };

  const usableContinuationPageH = PAGE_H - MARGIN - 42 - (MARGIN + FOOTER_RESERVED);

  // ============================================================================
  // 1. CABEÇALHO INSTITUCIONAL (Padrão Home Care — Cuidados & Orientações)
  // ============================================================================
  const headerTopY = y;
  let textStartX = MARGIN;

  if (embeddedLogo) {
    const targetHeight = 46;
    const scale = targetHeight / embeddedLogo.height;
    const targetWidth = embeddedLogo.width * scale;

    page.drawImage(embeddedLogo, {
      x: MARGIN,
      y: headerTopY - targetHeight,
      width: targetWidth,
      height: targetHeight,
    });
    textStartX = MARGIN + targetWidth + 14;
  }

  drawText(
    page,
    "DOCUMENTO CLÍNICO • CONSENTIMENTO INFORMADO",
    textStartX,
    headerTopY - 12,
    {
      font: bold,
      size: 8.2,
      color: C.primary,
    }
  );
  drawText(page, CLINIC.profissional, textStartX, headerTopY - 27, {
    font: bold,
    size: 13.5,
    color: C.ink,
  });
  drawText(page, CLINIC.cargo, textStartX, headerTopY - 40, {
    font: regular,
    size: 9.2,
    color: C.muted,
  });

  drawText(page, CLINIC.registro, MARGIN, headerTopY - 26, {
    font: bold,
    size: 8.8,
    color: C.muted,
    align: "right",
    width: CONTENT_W,
  });

  y = headerTopY - 56;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.2,
    color: C.primary,
  });
  y -= 18;

  // ============================================================================
  // 2. TÍTULO PRINCIPAL + 3. SUBTÍTULO (PROCEDIMENTO)
  // ============================================================================
  const mainTitle = "Termo de Consentimento Livre e Esclarecido";
  const mainTitleLines = wrapText(mainTitle, bold, 14.5, CONTENT_W);
  for (const ln of mainTitleLines) {
    drawText(page, ln, MARGIN, y - 14.5, {
      font: bold,
      size: 14.5,
      color: C.ink,
      align: "center",
      width: CONTENT_W,
    });
    y -= 18.5;
  }

  y -= 2;
  const subTitleLines = wrapText(procedimentoNome, bold, 10.5, CONTENT_W - 24);
  for (const ln of subTitleLines) {
    drawText(page, ln, MARGIN, y - 10.5, {
      font: bold,
      size: 10.5,
      color: C.primary,
      align: "center",
      width: CONTENT_W,
    });
    y -= 14.5;
  }

  // Linha decorativa central sutil sob o subtítulo
  const accentLineW = 72;
  page.drawLine({
    start: { x: MARGIN + (CONTENT_W - accentLineW) / 2, y: y - 2 },
    end: { x: MARGIN + (CONTENT_W + accentLineW) / 2, y: y - 2 },
    thickness: 1.6,
    color: C.primary,
  });
  y -= 16;

  // ============================================================================
  // 4. BLOCO DADOS DO PACIENTE (PAINEL ESTRUTURADO)
  // ============================================================================
  const padX = 14;
  const innerW = CONTENT_W - padX * 2;
  const r1Col1W = innerW * 0.64 - 8;
  const r1Col2W = innerW * 0.36;

  const r2Col1W = innerW * 0.31 - 8;
  const r2Col2W = innerW * 0.27 - 8;
  const r2Col3W = innerW * 0.42;

  const nomeLines = wrapText(pacienteNome, bold, 9.8, r1Col1W);
  const cpfText = formatCpf(input.paciente.cpf);
  const cpfLines = wrapText(cpfText, bold, 9.5, r1Col2W);

  const phoneLines = wrapText(formatPhone(input.paciente.telefone), regular, 9, r2Col1W);
  const birthLines = wrapText(
    formatBirthDateBR(input.paciente.data_nascimento),
    regular,
    9,
    r2Col2W
  );
  const emailLines = wrapText(
    input.paciente.email?.trim() || "Não informado",
    regular,
    9,
    r2Col3W
  );

  const row1LinesCount = Math.max(nomeLines.length, cpfLines.length, 1);
  const row2LinesCount = Math.max(phoneLines.length, birthLines.length, emailLines.length, 1);

  const row1H = 12 + row1LinesCount * 13;
  const row2H = 12 + row2LinesCount * 12.5;
  const panelHeaderH = 22;
  const patientPanelH = panelHeaderH + 8 + row1H + 10 + row2H + 10;

  ensureSpace(patientPanelH + 12);
  const panelTopY = y;

  drawRoundedRectangle(page, {
    x: MARGIN,
    y: panelTopY - patientPanelH,
    width: CONTENT_W,
    height: patientPanelH,
    borderRadius: 7,
    color: C.panel,
    borderColor: C.line,
    borderWidth: 0.9,
  });

  // Faixa de cabeçalho discreta do painel do paciente
  drawTopRoundedRect(page, {
    x: MARGIN,
    y: panelTopY - panelHeaderH,
    width: CONTENT_W,
    height: panelHeaderH,
    borderRadius: 7,
    color: C.primarySoftBg,
  });

  page.drawLine({
    start: { x: MARGIN, y: panelTopY - panelHeaderH },
    end: { x: PAGE_W - MARGIN, y: panelTopY - panelHeaderH },
    thickness: 0.6,
    color: C.primaryBorder,
  });

  drawText(page, "DADOS DO PACIENTE", MARGIN + padX, panelTopY - 14.5, {
    font: bold,
    size: 7.8,
    color: C.primary,
  });

  // Linha 1: Nome Completo | CPF
  const row1TopY = panelTopY - panelHeaderH - 8;
  const col1X = MARGIN + padX;
  const col2Row1X = MARGIN + padX + innerW * 0.64;

  drawText(page, "NOME COMPLETO", col1X, row1TopY - 7, {
    font: bold,
    size: 6.8,
    color: C.muted,
  });
  drawLines(page, nomeLines, col1X, row1TopY - 11, {
    font: bold,
    size: 9.8,
    color: C.ink,
    leading: 13,
  });

  drawText(page, "CPF", col2Row1X, row1TopY - 7, {
    font: bold,
    size: 6.8,
    color: C.muted,
  });
  drawLines(page, cpfLines, col2Row1X, row1TopY - 11, {
    font: bold,
    size: 9.5,
    color: C.ink,
    leading: 13,
  });

  // Divisória interna sutil entre linha 1 e linha 2
  const dividerY = row1TopY - row1H - 5;
  page.drawLine({
    start: { x: MARGIN + padX, y: dividerY },
    end: { x: PAGE_W - MARGIN - padX, y: dividerY },
    thickness: 0.5,
    color: C.line,
  });

  // Linha 2: Telefone | Data de Nascimento | E-mail
  const row2TopY = dividerY - 5;
  const col2Row2X = MARGIN + padX + innerW * 0.31;
  const col3Row2X = MARGIN + padX + innerW * 0.58;

  drawText(page, "TELEFONE", col1X, row2TopY - 7, {
    font: bold,
    size: 6.8,
    color: C.muted,
  });
  drawLines(page, phoneLines, col1X, row2TopY - 11, {
    font: regular,
    size: 9,
    color: C.ink,
    leading: 12.5,
  });

  drawText(page, "DATA DE NASCIMENTO", col2Row2X, row2TopY - 7, {
    font: bold,
    size: 6.8,
    color: C.muted,
  });
  drawLines(page, birthLines, col2Row2X, row2TopY - 11, {
    font: regular,
    size: 9,
    color: C.ink,
    leading: 12.5,
  });

  drawText(page, "E-MAIL", col3Row2X, row2TopY - 7, {
    font: bold,
    size: 6.8,
    color: C.muted,
  });
  drawLines(page, emailLines, col3Row2X, row2TopY - 11, {
    font: regular,
    size: 9,
    color: C.ink,
    leading: 12.5,
  });

  y = panelTopY - patientPanelH - 18;

  // ============================================================================
  // 5. TÓPICOS ENUMERADOS (1. Título, 2. Título, ...)
  // ============================================================================
  const topicos = [...(input.conteudoSnapshot?.topicos || [])].sort(
    (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
  );

  const bodyFontSize = 9.2;
  const bodyLeading = 13.8;
  const checkboxFontSize = 8.9;
  const checkboxLeading = 13.2;
  const checkboxBoxSize = 10;
  const checkboxTextIndent = 18;

  for (let idx = 0; idx < topicos.length; idx++) {
    const topico = topicos[idx];
    const numero = idx + 1;
    const tituloFormatado = `${numero}. ${(topico.titulo || "").trim()}`;
    const titleLines = wrapText(tituloFormatado, bold, 10.2, CONTENT_W - 10);
    const bodyLines = topico.texto_topico?.trim()
      ? wrapText(topico.texto_topico.trim(), regular, bodyFontSize, CONTENT_W - 6)
      : [];
    const checkboxes = (topico.linhas_checkbox || [])
      .map(normalizeCheckboxText)
      .filter((txt) => txt.length > 0);

    // Garante que o título do tópico não fique órfão no fim da página
    const titleBlockH = titleLines.length * 14 + 6;
    const minFirstContentH =
      bodyLines.length > 0
        ? Math.min(bodyLines.length, 2) * bodyLeading + 4
        : checkboxes.length > 0
          ? 20
          : 0;

    ensureSpace(titleBlockH + minFirstContentH + 8);

    // Barra vertical discreta + Título enumerado
    const titleStartY = y;
    const barH = titleLines.length * 14 - 2;
    page.drawRectangle({
      x: MARGIN,
      y: titleStartY - barH - 1,
      width: 3,
      height: barH,
      color: C.primary,
    });

    drawLines(page, titleLines, MARGIN + 9, titleStartY + 1, {
      font: bold,
      size: 10.2,
      color: C.primary,
      leading: 14,
    });
    y -= titleLines.length * 14 + 5;

    // Texto do tópico com quebra limpa entre páginas linha a linha
    for (const line of bodyLines) {
      if (line === "") {
        y -= bodyLeading * 0.55;
        continue;
      }
      ensureSpace(bodyLeading + 2);
      drawText(page, line, MARGIN + 4, y - bodyFontSize, {
        font: regular,
        size: bodyFontSize,
        color: C.text,
      });
      y -= bodyLeading;
    }

    // Linhas de checkbox com ícone vetorial marcado (#004d40 + check branco via drawLine)
    if (checkboxes.length > 0) {
      y -= 4;
      const checkTextW = CONTENT_W - checkboxTextIndent - 8;

      for (const itemText of checkboxes) {
        const itemLines = wrapText(itemText, regular, checkboxFontSize, checkTextW);
        const itemH = Math.max(checkboxBoxSize + 2, itemLines.length * checkboxLeading) + 4;
        ensureSpace(itemH + 2);

        const boxX = MARGIN + 6;
        const boxBottomY = y - checkboxBoxSize - 0.5;
        drawCheckedVectorBox(page, boxX, boxBottomY, checkboxBoxSize);

        drawLines(page, itemLines, boxX + checkboxTextIndent, y + 0.5, {
          font: regular,
          size: checkboxFontSize,
          color: C.ink,
          leading: checkboxLeading,
        });

        y -= itemH;
      }
    }

    y -= 10;
  }

  // ============================================================================
  // 6. DECLARAÇÃO DE CONSENTIMENTO (CARD VISUALMENTE DESTACADO)
  // ============================================================================
  const declaracao = input.conteudoSnapshot?.declaracao;
  if (declaracao) {
    const declPadX = 14;
    const declInnerW = CONTENT_W - declPadX * 2;
    const declHeaderH = 26;
    const declFontSize = 9.3;
    const declLeading = 14;
    const declCheckFontSize = 9;
    const declCheckLeading = 13.4;

    const rawDeclTitle = (declaracao.titulo || "").trim();
    const hasDistinctSubtitle =
      rawDeclTitle.length > 0 &&
      normalizeComparableTitle(rawDeclTitle) !==
        normalizeComparableTitle("Declaração de Consentimento");

    const declSubtitleLines = hasDistinctSubtitle
      ? wrapText(rawDeclTitle, bold, 9.6, declInnerW)
      : [];
    const declBodyLines = declaracao.texto_topico?.trim()
      ? wrapText(declaracao.texto_topico.trim(), regular, declFontSize, declInnerW)
      : [];
    const declCheckboxes = (declaracao.linhas_checkbox || [])
      .map(normalizeCheckboxText)
      .filter((txt) => txt.length > 0);

    const wrappedDeclCheckboxes = declCheckboxes.map((txt) =>
      wrapText(txt, bold, declCheckFontSize, declInnerW - checkboxTextIndent - 2)
    );

    const subtitleH = declSubtitleLines.length > 0 ? declSubtitleLines.length * 13.5 + 6 : 0;
    const bodyH = declBodyLines.reduce(
      (acc, ln) => acc + (ln === "" ? declLeading * 0.55 : declLeading),
      0
    );
    const checksH = wrappedDeclCheckboxes.reduce(
      (acc, lines) =>
        acc + Math.max(checkboxBoxSize + 2, lines.length * declCheckLeading) + 5,
      0
    );

    const declOrdem = normalizeDeclaracaoOrdem(declaracao.ordem_blocos);
    const hasDeclBody = declBodyLines.length > 0;
    const hasDeclChecks = wrappedDeclCheckboxes.length > 0;
    const betweenBlocksGap = hasDeclBody && hasDeclChecks ? 8 : 0;

    const totalDeclCardH =
      declHeaderH +
      12 +
      subtitleH +
      bodyH +
      checksH +
      betweenBlocksGap +
      10;

    if (totalDeclCardH <= usableContinuationPageH) {
      ensureSpace(totalDeclCardH + 10);
      const cardTopY = y;

      // Fundo suave primarySoftBg + borda destacada #004d40
      drawRoundedRectangle(page, {
        x: MARGIN,
        y: cardTopY - totalDeclCardH,
        width: CONTENT_W,
        height: totalDeclCardH,
        borderRadius: 8,
        color: C.primarySoftBg,
        borderColor: C.primary,
        borderWidth: 1.5,
      });

      // Cabeçalho de destaque em #004d40
      drawTopRoundedRect(page, {
        x: MARGIN,
        y: cardTopY - declHeaderH,
        width: CONTENT_W,
        height: declHeaderH,
        borderRadius: 8,
        color: C.primary,
      });

      drawText(page, "Declaração de Consentimento", MARGIN + declPadX, cardTopY - 17, {
        font: bold,
        size: 10.5,
        color: C.white,
      });

      let cursorY = cardTopY - declHeaderH - 12;

      if (declSubtitleLines.length > 0) {
        drawLines(page, declSubtitleLines, MARGIN + declPadX, cursorY, {
          font: bold,
          size: 9.6,
          color: C.primary,
          leading: 13.5,
        });
        cursorY -= subtitleH;
      }

      let renderedBlocks = 0;
      for (const bloco of declOrdem) {
        if (bloco === "texto" && hasDeclBody) {
          if (renderedBlocks > 0) {
            cursorY -= betweenBlocksGap;
          }
          for (const line of declBodyLines) {
            if (line === "") {
              cursorY -= declLeading * 0.55;
              continue;
            }
            drawText(page, line, MARGIN + declPadX, cursorY - declFontSize, {
              font: regular,
              size: declFontSize,
              color: C.ink,
            });
            cursorY -= declLeading;
          }
          renderedBlocks += 1;
        } else if (bloco === "confirmacoes" && hasDeclChecks) {
          if (renderedBlocks > 0) {
            cursorY -= betweenBlocksGap;
          }
          for (const itemLines of wrappedDeclCheckboxes) {
            const itemH =
              Math.max(checkboxBoxSize + 2, itemLines.length * declCheckLeading) + 5;
            const boxX = MARGIN + declPadX;
            const boxBottomY = cursorY - checkboxBoxSize - 0.5;
            drawCheckedVectorBox(page, boxX, boxBottomY, checkboxBoxSize);

            drawLines(page, itemLines, boxX + checkboxTextIndent, cursorY + 0.5, {
              font: bold,
              size: declCheckFontSize,
              color: C.ink,
              leading: declCheckLeading,
            });
            cursorY -= itemH;
          }
          renderedBlocks += 1;
        }
      }

      y = cardTopY - totalDeclCardH - 18;
    } else {
      // Contingência para declarações extensas com paginação limpa mantendo destaque visual
      ensureSpace(declHeaderH + 40);
      drawRoundedRectangle(page, {
        x: MARGIN,
        y: y - declHeaderH,
        width: CONTENT_W,
        height: declHeaderH,
        borderRadius: 6,
        color: C.primary,
      });
      drawText(page, "Declaração de Consentimento", MARGIN + declPadX, y - 17, {
        font: bold,
        size: 10.5,
        color: C.white,
      });
      y -= declHeaderH + 10;

      if (declSubtitleLines.length > 0) {
        ensureSpace(subtitleH + 6);
        drawLines(page, declSubtitleLines, MARGIN + 8, y, {
          font: bold,
          size: 9.6,
          color: C.primary,
          leading: 13.5,
        });
        y -= subtitleH;
      }

      let renderedBlocks = 0;
      for (const bloco of declOrdem) {
        if (bloco === "texto" && hasDeclBody) {
          if (renderedBlocks > 0) {
            y -= 6;
          }
          for (const line of declBodyLines) {
            if (line === "") {
              y -= declLeading * 0.55;
              continue;
            }
            ensureSpace(declLeading + 4);
            page.drawRectangle({
              x: MARGIN,
              y: y - declLeading,
              width: CONTENT_W,
              height: declLeading,
              color: C.primarySoftBg,
            });
            page.drawRectangle({
              x: MARGIN,
              y: y - declLeading,
              width: 3,
              height: declLeading,
              color: C.primary,
            });
            drawText(page, line, MARGIN + 10, y - declFontSize, {
              font: regular,
              size: declFontSize,
              color: C.ink,
            });
            y -= declLeading;
          }
          renderedBlocks += 1;
        } else if (bloco === "confirmacoes" && hasDeclChecks) {
          if (renderedBlocks > 0) {
            y -= 6;
          }
          for (const itemLines of wrappedDeclCheckboxes) {
            const itemH =
              Math.max(checkboxBoxSize + 2, itemLines.length * declCheckLeading) + 6;
            ensureSpace(itemH + 4);

            page.drawRectangle({
              x: MARGIN,
              y: y - itemH,
              width: CONTENT_W,
              height: itemH,
              color: C.primarySoftBg,
            });
            page.drawRectangle({
              x: MARGIN,
              y: y - itemH,
              width: 3,
              height: itemH,
              color: C.primary,
            });

            const boxX = MARGIN + 10;
            const boxBottomY = y - checkboxBoxSize - 2;
            drawCheckedVectorBox(page, boxX, boxBottomY, checkboxBoxSize);
            drawLines(page, itemLines, boxX + checkboxTextIndent, y - 1, {
              font: bold,
              size: declCheckFontSize,
              color: C.ink,
              leading: declCheckLeading,
            });
            y -= itemH;
          }
          renderedBlocks += 1;
        }
      }

      y -= 16;
    }
  }

  // ============================================================================
  // 7. ASSINATURA DO PACIENTE (IMAGEM PNG CENTRALIZADA + DADOS E TIMESTAMP)
  // ============================================================================
  const sigMaxW = 220;
  const sigMaxH = 66;
  const imgDims = embeddedSignature.scaleToFit(sigMaxW, sigMaxH);
  const sigLineW = 280;
  const sigBlockH = Math.max(imgDims.height, 44) + 56;

  ensureSpace(sigBlockH + 12);

  y -= 6;
  const imgAreaTopY = y;
  const imgAreaH = Math.max(imgDims.height, 44);
  const imgX = MARGIN + (CONTENT_W - imgDims.width) / 2;
  const imgY = imgAreaTopY - imgAreaH + (imgAreaH - imgDims.height) / 2;

  page.drawImage(embeddedSignature, {
    x: imgX,
    y: imgY,
    width: imgDims.width,
    height: imgDims.height,
  });

  const sigLineY = imgAreaTopY - imgAreaH - 4;
  const sigLineStartX = MARGIN + (CONTENT_W - sigLineW) / 2;
  page.drawLine({
    start: { x: sigLineStartX, y: sigLineY },
    end: { x: sigLineStartX + sigLineW, y: sigLineY },
    thickness: 0.9,
    color: C.primary,
  });

  drawText(page, pacienteNome, MARGIN, sigLineY - 14, {
    font: bold,
    size: 10,
    color: C.ink,
    align: "center",
    width: CONTENT_W,
  });

  drawText(page, `CPF: ${cpfText}`, MARGIN, sigLineY - 26, {
    font: regular,
    size: 8.6,
    color: C.text,
    align: "center",
    width: CONTENT_W,
  });

  drawText(
    page,
    `Assinado em ${formatSignedDateTimeSaoPaulo(input.assinadoEm)}`,
    MARGIN,
    sigLineY - 38,
    {
      font: regular,
      size: 8,
      color: C.muted,
      align: "center",
      width: CONTENT_W,
    }
  );

  // ============================================================================
  // 8. RODAPÉ INSTITUCIONAL + PAGINAÇÃO (PÁGINA X DE Y) EM TODAS AS PÁGINAS
  // ============================================================================
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  pages.forEach((p, idx) => {
    const lineY = MARGIN + 22;
    p.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_W - MARGIN, y: lineY },
      thickness: 0.6,
      color: C.line,
    });

    drawText(p, CLINIC.rodape, MARGIN, MARGIN + 9, {
      font: regular,
      size: 7.2,
      color: C.muted,
    });

    drawText(p, `Página ${idx + 1} de ${totalPages}`, MARGIN, MARGIN + 9, {
      font: bold,
      size: 7.2,
      color: C.primary,
      align: "right",
      width: CONTENT_W,
    });
  });

  return pdfDoc.save({ useObjectStreams: false });
}
