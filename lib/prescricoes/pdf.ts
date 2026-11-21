import fs from "fs";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
// @ts-expect-error @pdf-lib/fontkit não possui declarações completas para ESM/CJS
import fontkit from "@pdf-lib/fontkit";

let regularFontBytesCache: Uint8Array | null = null;
let boldFontBytesCache: Uint8Array | null = null;
let logoBytesCache: Uint8Array | null | undefined;

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
  if (logoBytesCache !== undefined) return logoBytesCache;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-clinica.png");
    if (fs.existsSync(logoPath)) {
      logoBytesCache = new Uint8Array(fs.readFileSync(logoPath));
      return logoBytesCache;
    }
  } catch {
    console.warn("Logótipo não encontrado em public/logo-clinica.png");
  }
  logoBytesCache = null;
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
const FOOTER_RESERVED = 48;
const MAX_USABLE_PAGE_H = PAGE_H - MARGIN * 2 - FOOTER_RESERVED;

const C = {
  ink: rgb(0.059, 0.09, 0.165), // slate-900 (#0f172a)
  slate800: rgb(0.118, 0.161, 0.231), // slate-800 (#1e293b)
  slate700: rgb(0.2, 0.255, 0.333), // slate-700 (#334155)
  text: rgb(0.278, 0.333, 0.412), // slate-600 (#475569)
  muted: rgb(0.392, 0.455, 0.545), // slate-500 (#64748b)
  faint: rgb(0.58, 0.639, 0.722), // slate-400 (#94a3b8)
  line: rgb(0.886, 0.91, 0.941), // slate-200 (#e2e8f0)
  lineSoft: rgb(0.945, 0.961, 0.976), // slate-100 (#f1f5f9)
  panel: rgb(0.973, 0.98, 0.988), // slate-50 (#f8fafc)
  white: rgb(1, 1, 1),
  teal: rgb(0.067, 0.369, 0.349), // teal-800 (#115e59)
  tealBorder: rgb(0.051, 0.58, 0.533), // teal-600 (#0d9488)
};

const REPLACEMENTS: Record<string, string> = {
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

function sanitize(font: PDFFont, text: string): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of String(text || "").normalize("NFC")) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (ch === "\n") out += ch;
    else if (ch === "\r") continue;
    else if (ch === "\t") out += "  ";
    else if (supported.has(cp)) out += ch;
    else if (ch in REPLACEMENTS) {
      for (const rCh of REPLACEMENTS[ch]) {
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

function rightRoundedRectSvgPath(w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M 0 0`,
    `L ${w - radius} 0`,
    `Q ${w} 0 ${w} ${radius}`,
    `L ${w} ${h - radius}`,
    `Q ${w} ${h} ${w - radius} ${h}`,
    `L 0 ${h}`,
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
    borderDashArray?: number[];
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
    borderDashArray,
  } = opts;

  page.drawSvgPath(roundedRectSvgPath(w, h, borderRadius), {
    x,
    y: y + h,
    color,
    borderColor,
    borderWidth: borderColor ? borderWidth : 0,
    borderDashArray,
  });
}

function drawRightRoundedRect(
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
    borderRadius = 8,
    color,
    borderColor,
    borderWidth = 0.6,
  } = opts;

  page.drawSvgPath(rightRoundedRectSvgPath(w, h, borderRadius), {
    x,
    y: y + h,
    color,
    borderColor,
    borderWidth: borderColor ? borderWidth : 0,
  });
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const cleanText = sanitize(font, text);
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

function formatCpf(cpf?: string | null): string {
  const clean = (cpf || "").replace(/\D/g, "");
  if (clean.length !== 11) return cpf?.trim() || "Não informado";
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

const MONTHS_PT_CAPITALIZED = [
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

function formatDatePtCapitalized(date?: string | null): string {
  const d =
    date && /^\d{4}-\d{2}-\d{2}/.test(date.trim())
      ? new Date(`${date.trim().slice(0, 10)}T12:00:00-03:00`)
      : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(validDate)
    .split("-");
  const year = parts[0];
  const monthIdx = Math.max(0, Math.min(11, parseInt(parts[1], 10) - 1));
  const day = parseInt(parts[2], 10);
  return `Salvador - BA, ${day} de ${MONTHS_PT_CAPITALIZED[monthIdx]} de ${year}`;
}

const present = (v: unknown): v is string | number =>
  v !== null && v !== undefined && String(v).trim() !== "";

export function prescriptionPdfFileName(patientName?: string | null, date?: string | null): string {
  const base = (patientName || "Paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  const isoDate =
    date && /^\d{4}-\d{2}-\d{2}/.test(date.trim())
      ? date.trim().slice(0, 10)
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
  return `Receita_${base || "Paciente"}_${isoDate}.pdf`;
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

  // Metadados e marcador crítico para validação ICP-Brasil / VIDaaS (lib/prescricoes/signed-pdf.ts)
  pdf.setTitle(sanitize(regular, `Receituário - ${paciente}`));
  pdf.setAuthor(PROFISSIONAL.nome);
  pdf.setSubject("Receituário / Prescrição magistral");
  pdf.setKeywords([`${RX_MARKER_PREFIX}${input.id}`]);
  pdf.setProducer("Juliana Sena - Gestão de Pacientes");
  pdf.setCreator("Juliana Sena - Gestão de Pacientes");

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const addPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensureGroup = (groupHeight: number) => {
    if (groupHeight <= MAX_USABLE_PAGE_H && y - groupHeight < MARGIN + FOOTER_RESERVED) {
      addPage();
    }
  };

  const ensureLine = (lineHeight: number) => {
    if (y - lineHeight < MARGIN + FOOTER_RESERVED) {
      addPage();
    }
  };

  const text = (
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
    const size = opts.size ?? 10;
    const clean = sanitize(font, value);
    let px = x;
    if (opts.align === "right") px = x + (opts.width ?? 0) - font.widthOfTextAtSize(clean, size);
    if (opts.align === "center") px = x + ((opts.width ?? 0) - font.widthOfTextAtSize(clean, size)) / 2;
    page.drawText(clean, { x: px, y: baseline, font, size, color: opts.color ?? C.ink });
  };

  const drawLines = (
    lines: string[],
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
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9.5;
    const leading = opts.leading ?? size * 1.42;
    lines.forEach((ln, i) => {
      if (ln) {
        text(ln, x, top - size - i * leading, {
          font,
          size,
          color: opts.color,
          align: opts.align,
          width: opts.width,
        });
      }
    });
    return lines.length * leading;
  };

  // ==========================================================================
  // 1. CABEÇALHO INSTITUCIONAL (1:1 com print-prescription-modal.tsx)
  // ==========================================================================
  const logoBytes = loadClinicLogo();
  let embeddedLogo = null;
  if (logoBytes) {
    try {
      embeddedLogo = await pdf.embedPng(logoBytes);
    } catch (err) {
      console.warn("Falha ao embutir logótipo PNG no PDF:", err);
    }
  }

  const headerTopY = y;
  const headerBlockH = 46;
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

  // Coluna esquerda: Título (slate-800), Nome (slate-900), Especialidade (slate-500 / C.muted)
  text("RECEITUÁRIO / PRESCRIÇÃO MAGISTRAL", textStartX, headerTopY - 12, {
    font: bold,
    size: 8.5,
    color: C.slate800,
  });
  text(PROFISSIONAL.nome, textStartX, headerTopY - 27, {
    font: bold,
    size: 12.5,
    color: C.ink,
  });
  text(PROFISSIONAL.cargo, textStartX, headerTopY - 40, {
    font: regular,
    size: 9,
    color: C.muted,
  });

  // Lado direito: COREN-BA 366.344 centralizado verticalmente no cabeçalho
  text(PROFISSIONAL.registro, MARGIN, headerTopY - 26, {
    font: regular,
    size: 8.8,
    color: C.muted,
    align: "right",
    width: CONTENT_W,
  });

  y = headerTopY - headerBlockH - 9;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: C.ink,
  });
  y -= 18;

  // ==========================================================================
  // 2. IDENTIFICAÇÃO DO PACIENTE (Card arredondado dinâmico, sem colisão)
  // ==========================================================================
  const cpfFormatted = formatCpf(input.paciente.cpf);
  const cpfColW = 130;
  const patientNameMaxW = CONTENT_W - 28 - cpfColW - 14;
  const patientNameLines = wrapText(paciente, bold, 11, patientNameMaxW);
  const patientBoxH = 26 + patientNameLines.length * 14 + 8;

  ensureGroup(patientBoxH + 16);
  drawRoundedRectangle(page, {
    x: MARGIN,
    y: y - patientBoxH,
    width: CONTENT_W,
    height: patientBoxH,
    borderRadius: 10,
    color: C.panel,
    borderColor: C.line,
    borderWidth: 0.8,
  });

  text("PACIENTE", MARGIN + 14, y - 15, { font: bold, size: 7.5, color: C.muted });
  drawLines(patientNameLines, MARGIN + 14, y - 21, {
    font: bold,
    size: 11,
    color: C.ink,
    leading: 14,
  });

  text("CPF", MARGIN, y - 15, {
    font: bold,
    size: 7.5,
    color: C.muted,
    align: "right",
    width: CONTENT_W - 14,
  });
  text(cpfFormatted, MARGIN, y - 32, {
    font: bold,
    size: 11,
    color: C.ink,
    align: "right",
    width: CONTENT_W - 14,
  });

  y -= patientBoxH + 22;

  // ==========================================================================
  // 3 & 4. TÍTULO DA FÓRMULA + TABELA DE COMPONENTES (GRUPO INDIVISÍVEL)
  // ==========================================================================
  const formulaTitle = item.nome_formula?.trim() || "Fórmula magistral";
  const viaText = `Uso ${isOral ? "Oral" : "Tópico"}`;
  const viaW = bold.widthOfTextAtSize(sanitize(bold, viaText), 9) + 14;
  const titleLines = wrapText(formulaTitle, bold, 12, CONTENT_W - viaW);
  const titleBlockH = titleLines.length * 15 + 14;

  const componentes = (item.componentes_snapshot || []).filter((c) => present(c?.nome));
  const compNameColW = CONTENT_W * 0.68 - 16;
  const compQtyColW = CONTENT_W * 0.32 - 16;
  const tableHeaderH = 24;

  const preparedRows = componentes.map((c) => {
    const nomeStr = String(c.nome || "").trim();
    const qtyStr = present(c.quantidade)
      ? `${c.quantidade}${c.unidade ? c.unidade : ""}`.trim()
      : "";
    const nameLines = wrapText(nomeStr, regular, 9, compNameColW);
    const qtyLines = wrapText(qtyStr, bold, 9, compQtyColW);
    const maxL = Math.max(nameLines.length, qtyLines.length, 1);
    const rowH = Math.max(22, maxL * 12.5 + 10);
    return { nameLines, qtyLines, rowH };
  });

  const tableRowsTotalH = preparedRows.reduce((acc, r) => acc + r.rowH, 0);
  const activeSectionH =
    componentes.length > 0 ? 15 + tableHeaderH + tableRowsTotalH + 14 : 0;
  const formulaGroupTotalH = titleBlockH + activeSectionH;

  if (formulaGroupTotalH <= MAX_USABLE_PAGE_H) {
    ensureGroup(formulaGroupTotalH);
  } else {
    const minFirstChunkH =
      titleBlockH +
      (preparedRows.length > 0 ? 15 + tableHeaderH + preparedRows[0].rowH + 6 : 0);
    ensureGroup(minFirstChunkH);
  }

  // Título da fórmula + Via
  drawLines(titleLines, MARGIN, y, { font: bold, size: 12, color: C.ink, leading: 15 });
  text(viaText, MARGIN, y - 12, {
    font: bold,
    size: 9,
    color: C.muted,
    align: "right",
    width: CONTENT_W,
  });
  y -= titleBlockH;

  // Tabela "FÓRMULA ATIVA"
  if (preparedRows.length > 0) {
    text("FÓRMULA ATIVA", MARGIN, y - 8, { font: bold, size: 7.5, color: C.faint });
    y -= 15;

    const drawTableChunk = (rows: typeof preparedRows) => {
      const tableTop = y;
      const chunkH = tableHeaderH + rows.reduce((acc, r) => acc + r.rowH, 0);

      drawTopRoundedRect(page, {
        x: MARGIN,
        y: tableTop - tableHeaderH,
        width: CONTENT_W,
        height: tableHeaderH,
        borderRadius: 6,
        color: C.lineSoft,
      });

      text("Componente / Ativo", MARGIN + 12, tableTop - 15, {
        font: bold,
        size: 8.5,
        color: C.text,
      });
      text("Concentração", MARGIN, tableTop - 15, {
        font: bold,
        size: 8.5,
        color: C.text,
        align: "right",
        width: CONTENT_W - 12,
      });

      let rowTop = tableTop - tableHeaderH;
      rows.forEach((row, idx) => {
        page.drawLine({
          start: { x: MARGIN, y: rowTop },
          end: { x: PAGE_W - MARGIN, y: rowTop },
          thickness: idx === 0 ? 0.8 : 0.5,
          color: idx === 0 ? C.line : C.lineSoft,
        });

        drawLines(row.nameLines, MARGIN + 12, rowTop - 5, {
          font: regular,
          size: 9,
          color: C.slate800,
          leading: 12.5,
        });

        drawLines(row.qtyLines, MARGIN + CONTENT_W - 12 - compQtyColW, rowTop - 5, {
          font: bold,
          size: 9,
          color: C.slate700,
          leading: 12.5,
          align: "right",
          width: compQtyColW,
        });

        rowTop -= row.rowH;
      });

      drawRoundedRectangle(page, {
        x: MARGIN,
        y: tableTop - chunkH,
        width: CONTENT_W,
        height: chunkH,
        borderRadius: 6,
        borderColor: C.line,
        borderWidth: 0.8,
      });

      y = tableTop - chunkH - 14;
    };

    const fullTableH = tableHeaderH + tableRowsTotalH;
    if (fullTableH <= MAX_USABLE_PAGE_H) {
      ensureGroup(fullTableH + 14);
      drawTableChunk(preparedRows);
    } else {
      let currentChunk: typeof preparedRows = [];
      let currentChunkH = tableHeaderH;
      for (const row of preparedRows) {
        if (currentChunk.length > 0 && y - (currentChunkH + row.rowH) < MARGIN + FOOTER_RESERVED) {
          drawTableChunk(currentChunk);
          addPage();
          currentChunk = [];
          currentChunkH = tableHeaderH;
        }
        currentChunk.push(row);
        currentChunkH += row.rowH;
      }
      if (currentChunk.length > 0) {
        drawTableChunk(currentChunk);
      }
    }
  }

  // ==========================================================================
  // 5. CARD VEÍCULO BASE / DOSAGEM (Q.S.P.) / QUANTIDADE TOTAL (2 LINHAS)
  //    Linha 1: 2 colunas (VEÍCULO BASE | DOSAGEM (Q.S.P.) ou DOSE / APRESENTAÇÃO)
  //    Linha 2: largura total (QUANTIDADE TOTAL) — altura dinâmica via wrapText
  // ==========================================================================
  const hasVehicleCard = present(item.veiculo) || present(item.dosagem) || present(item.duracao);
  if (hasVehicleCard) {
    const padX = 12;
    const padY = 10;
    const colGap = 16;
    const halfColW = (CONTENT_W - padX * 2 - colGap) / 2;
    const fullInnerW = CONTENT_W - padX * 2;

    const veiculoText = present(item.veiculo) ? String(item.veiculo).trim() : "Veículo base adequado";
    const dosagemLabel = isOral ? "DOSE / APRESENTAÇÃO" : "DOSAGEM (Q.S.P.)";
    const dosagemRaw = present(item.dosagem) ? String(item.dosagem).trim() : "";
    const dosagemText = dosagemRaw
      ? isOral
        ? /dose/i.test(dosagemRaw)
          ? dosagemRaw
          : `${dosagemRaw} dose(s)`
        : /^\d+([.,]\d+)?$/.test(dosagemRaw)
          ? `${dosagemRaw} g`
          : dosagemRaw
      : isOral
        ? "Cápsula vegetal"
        : "q.s.p.";

    const hasTotalRow = present(item.duracao);
    const totalText = hasTotalRow
      ? isOral
        ? `${item.duracao} ${item.tipo_veiculo || ""}`.trim()
        : `${item.duracao}${item.tipo_veiculo || "un"}`.trim()
      : "";

    const veiculoLines = wrapText(veiculoText, bold, 9.5, halfColW);
    const dosagemLines = wrapText(dosagemText, bold, 9.5, halfColW);
    const totalLines = hasTotalRow ? wrapText(totalText, bold, 9.5, fullInnerW) : [];

    const row1LinesCount = Math.max(veiculoLines.length, dosagemLines.length, 1);
    const row1H = 12 + row1LinesCount * 13;
    const row2H = hasTotalRow ? 12 + Math.max(totalLines.length, 1) * 13 : 0;
    const dividerSpace = hasTotalRow ? 14 : 0;
    const cardH = padY + row1H + dividerSpace + row2H + padY;

    ensureGroup(cardH + 16);

    const cardTop = y;
    drawRoundedRectangle(page, {
      x: MARGIN,
      y: cardTop - cardH,
      width: CONTENT_W,
      height: cardH,
      borderRadius: 6,
      color: C.white,
      borderColor: C.line,
      borderWidth: 0.8,
    });

    const leftColX = MARGIN + padX;
    const rightColX = MARGIN + padX + halfColW + colGap;
    const row1Top = cardTop - padY;

    // Linha 1 - Coluna 1: VEÍCULO BASE
    text("VEÍCULO BASE", leftColX, row1Top - 7, { font: bold, size: 7, color: C.faint });
    drawLines(veiculoLines, leftColX, row1Top - 11, {
      font: bold,
      size: 9.5,
      color: C.slate800,
      leading: 13,
    });

    // Linha 1 - Coluna 2: DOSAGEM (Q.S.P.) / DOSE / APRESENTAÇÃO
    text(dosagemLabel, rightColX, row1Top - 7, { font: bold, size: 7, color: C.faint });
    drawLines(dosagemLines, rightColX, row1Top - 11, {
      font: bold,
      size: 9.5,
      color: C.slate800,
      leading: 13,
    });

    // Linha 2 - Largura total: QUANTIDADE TOTAL
    if (hasTotalRow) {
      const dividerY = row1Top - row1H - 6;
      page.drawLine({
        start: { x: MARGIN + padX, y: dividerY },
        end: { x: PAGE_W - MARGIN - padX, y: dividerY },
        thickness: 0.6,
        color: C.lineSoft,
      });

      const row2Top = dividerY - 8;
      text("QUANTIDADE TOTAL", leftColX, row2Top - 7, { font: bold, size: 7, color: C.faint });
      drawLines(totalLines, leftColX, row2Top - 11, {
        font: bold,
        size: 9.5,
        color: C.slate800,
        leading: 13,
      });
    }

    y = cardTop - cardH - 16;
  }

  // ==========================================================================
  // 6. POSOLOGIA (Fundo neutro C.panel + barra lateral esquerda escura C.slate800)
  // ==========================================================================
  if (present(item.posologia)) {
    const posText = String(item.posologia).trim();
    const posW = CONTENT_W - 28;
    const posLines = wrapText(posText, regular, 9.5, posW);
    const posLeading = 14;
    const fullPosH = 28 + posLines.length * posLeading + 10;

    if (fullPosH <= MAX_USABLE_PAGE_H) {
      ensureGroup(fullPosH + 14);
      const boxTop = y;

      drawRightRoundedRect(page, {
        x: MARGIN,
        y: boxTop - fullPosH,
        width: CONTENT_W,
        height: fullPosH,
        borderRadius: 8,
        color: C.panel,
      });

      page.drawRectangle({
        x: MARGIN,
        y: boxTop - fullPosH,
        width: 3.5,
        height: fullPosH,
        color: C.slate800,
      });

      text("POSOLOGIA (FREQUÊNCIA & HORÁRIOS)", MARGIN + 15, boxTop - 16, {
        font: bold,
        size: 7.5,
        color: C.ink,
      });
      drawLines(posLines, MARGIN + 15, boxTop - 24, {
        font: regular,
        size: 9.5,
        color: C.slate800,
        leading: posLeading,
      });

      y = boxTop - fullPosH - 16;
    } else {
      // Paginação controlada para posologias extensas
      ensureGroup(48);
      page.drawRectangle({ x: MARGIN, y: y - 22, width: CONTENT_W, height: 22, color: C.panel });
      page.drawRectangle({ x: MARGIN, y: y - 22, width: 3.5, height: 22, color: C.slate800 });
      text("POSOLOGIA (FREQUÊNCIA & HORÁRIOS)", MARGIN + 15, y - 14, {
        font: bold,
        size: 7.5,
        color: C.ink,
      });
      y -= 22;

      for (const ln of posLines) {
        ensureLine(posLeading + 4);
        page.drawRectangle({
          x: MARGIN,
          y: y - posLeading,
          width: CONTENT_W,
          height: posLeading,
          color: C.panel,
        });
        page.drawRectangle({
          x: MARGIN,
          y: y - posLeading,
          width: 3.5,
          height: posLeading,
          color: C.slate800,
        });
        if (ln) {
          text(ln, MARGIN + 15, y - 10, { font: regular, size: 9.5, color: C.slate800 });
        }
        y -= posLeading;
      }
      y -= 14;
    }
  }

  // ==========================================================================
  // 7. ORIENTAÇÕES AO PACIENTE
  // ==========================================================================
  const orientPaciente = present(item.orient_paciente)
    ? String(item.orient_paciente).trim()
    : present(input.observacoes)
      ? String(input.observacoes).trim()
      : "";

  if (orientPaciente) {
    const orientLeading = 13.5;
    const orientLines = wrapText(orientPaciente, regular, 9, CONTENT_W);
    const fullOrientH = 16 + orientLines.length * orientLeading + 8;

    if (fullOrientH <= MAX_USABLE_PAGE_H) {
      ensureGroup(fullOrientH);
      text("ORIENTAÇÕES AO PACIENTE / INSTRUÇÕES ESPECIAIS", MARGIN, y - 8, {
        font: bold,
        size: 7.5,
        color: C.faint,
      });
      drawLines(orientLines, MARGIN, y - 15, {
        font: regular,
        size: 9,
        color: C.text,
        leading: orientLeading,
      });
      y -= fullOrientH + 6;
    } else {
      ensureGroup(34);
      text("ORIENTAÇÕES AO PACIENTE / INSTRUÇÕES ESPECIAIS", MARGIN, y - 8, {
        font: bold,
        size: 7.5,
        color: C.faint,
      });
      y -= 16;
      for (const ln of orientLines) {
        ensureLine(orientLeading + 2);
        if (ln) text(ln, MARGIN, y - 9, { font: regular, size: 9, color: C.text });
        y -= orientLeading;
      }
      y -= 10;
    }
  }

  // ==========================================================================
  // 8. OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL
  // ==========================================================================
  if (present(item.orient_farmacia)) {
    const farmText = String(item.orient_farmacia).trim();
    const farmW = CONTENT_W - 24;
    const farmLeading = 13;
    const farmLines = wrapText(farmText, italic, 8.5, farmW);
    const fullFarmH = 24 + farmLines.length * farmLeading + 10;

    if (fullFarmH <= MAX_USABLE_PAGE_H) {
      ensureGroup(fullFarmH + 14);
      const boxTop = y;
      drawRoundedRectangle(page, {
        x: MARGIN,
        y: boxTop - fullFarmH,
        width: CONTENT_W,
        height: fullFarmH,
        borderRadius: 6,
        color: C.panel,
        borderColor: C.line,
        borderWidth: 0.8,
      });

      text("OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL", MARGIN + 12, boxTop - 14, {
        font: bold,
        size: 7.5,
        color: C.muted,
      });
      drawLines(farmLines, MARGIN + 12, boxTop - 21, {
        font: italic,
        size: 8.5,
        color: C.muted,
        leading: farmLeading,
      });

      y = boxTop - fullFarmH - 14;
    } else {
      ensureGroup(34);
      text("OBSERVAÇÕES TÉCNICAS À FARMÁCIA MAGISTRAL", MARGIN, y - 8, {
        font: bold,
        size: 7.5,
        color: C.muted,
      });
      y -= 16;
      for (const ln of farmLines) {
        ensureLine(farmLeading + 2);
        if (ln) text(ln, MARGIN + 6, y - 8.5, { font: italic, size: 8.5, color: C.muted });
        y -= farmLeading;
      }
      y -= 12;
    }
  }

  // ==========================================================================
  // 9. DATA + BLOCO DE ASSINATURA DIGITAL QUALIFICADA ICP-BRASIL (INDIVISÍVEL)
  // ==========================================================================
  const sigW = 310;
  const sigNoticeText =
    "Espaço reservado para aposição de Assinatura Digital Qualificada ICP-Brasil (VIDaaS / Validador ITI)";
  const sigNoticeLines = wrapText(sigNoticeText, regular, 7.2, sigW - 28);
  const sigH = 42 + sigNoticeLines.length * 10 + 10;
  const dateAndSigTotalH = 14 + 18 + 14 + sigH + 8;

  ensureGroup(dateAndSigTotalH);

  // Linha divisória sutil acima do bloco de data/assinatura (espelhando border-t border-slate-200)
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.6,
    color: C.line,
  });
  y -= 18;

  text(formatDatePtCapitalized(input.dataPrescricao), MARGIN, y - 10, {
    font: regular,
    size: 9.5,
    color: C.slate700,
    align: "center",
    width: CONTENT_W,
  });
  y -= 24;

  const sigX = MARGIN + (CONTENT_W - sigW) / 2;
  drawRoundedRectangle(page, {
    x: sigX,
    y: y - sigH,
    width: sigW,
    height: sigH,
    borderRadius: 8,
    color: C.white,
    borderColor: C.tealBorder,
    borderWidth: 1,
    borderDashArray: [4, 3],
  });

  text(PROFISSIONAL.nome, sigX, y - 18, {
    font: bold,
    size: 10,
    color: C.ink,
    align: "center",
    width: sigW,
  });
  text(`${PROFISSIONAL.cargo} • ${PROFISSIONAL.registro}`, sigX, y - 31, {
    font: bold,
    size: 8.5,
    color: C.teal,
    align: "center",
    width: sigW,
  });
  drawLines(sigNoticeLines, sigX + 14, y - 38, {
    font: regular,
    size: 7.2,
    color: C.muted,
    leading: 10,
    align: "center",
    width: sigW - 28,
  });

  // ==========================================================================
  // 10. RODAPÉ INSTITUCIONAL EM TODAS AS PÁGINAS
  // ==========================================================================
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({
      start: { x: MARGIN, y: MARGIN + 28 },
      end: { x: PAGE_W - MARGIN, y: MARGIN + 28 },
      thickness: 0.6,
      color: C.line,
    });

    const footerLines = wrapText(PROFISSIONAL.rodape, regular, 6.8, CONTENT_W);
    drawLines(footerLines, MARGIN, MARGIN + 24, {
      font: regular,
      size: 6.8,
      color: C.faint,
      leading: 9,
      align: "center",
      width: CONTENT_W,
    });

    const pageInfo = pages.length > 1 ? `  •  Página ${i + 1} de ${pages.length}` : "";
    text(`Código da receita: ${input.id}${pageInfo}`, MARGIN, MARGIN + 4, {
      font: regular,
      size: 6.5,
      color: C.faint,
      align: "center",
      width: CONTENT_W,
    });
  });

  return pdf.save({ useObjectStreams: false });
}
