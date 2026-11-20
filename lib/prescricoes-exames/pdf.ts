import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { PrescricaoExame } from "@/types/prescricao-exame";

export interface ExamPrescriptionPatientInfo {
  nome?: string;
  cpf?: string;
  idade?: number | string;
  status?: string;
}

const CLINIC_INFO = {
  profissional: "Dra. Juliana Sena",
  subtitulo: "Biomedicina Estética & Práticas Integrativas em Saúde • COREN-BA 366.344",
  local: "Salvador - Bahia • Atendimento Personalizado",
  rodape:
    "Dra. Juliana Sena • Biomedicina Estética & Práticas Integrativas em Saúde • COREN-BA 366.344 • Salvador - BA • (71) 98661-2878",
} as const;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_RESERVED = 44;

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
  error: rgb(0.72, 0.11, 0.11),
  errorBg: rgb(0.996, 0.945, 0.945),
  errorBorder: rgb(0.945, 0.78, 0.78),
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
  if (!isNaN(parsed.getTime())) {
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
    if (!isNaN(parsed.getTime())) {
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
  for (const ch of String(input).normalize("NFC")) {
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
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

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

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < MARGIN + FOOTER_RESERVED) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
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
        });
      }
    });
    return lines.length * leading;
  };

  // ============================================================================
  // 1. CABEÇALHO INSTITUCIONAL
  // ============================================================================
  const headerTopY = y;

  // Lado esquerdo: Identidade da Profissional
  drawText(CLINIC_INFO.profissional, MARGIN, headerTopY - 16, {
    font: bold,
    size: 18,
    color: C.primary,
  });
  drawText(CLINIC_INFO.subtitulo, MARGIN, headerTopY - 30, {
    font: bold,
    size: 8.2,
    color: C.text,
  });
  drawText(CLINIC_INFO.local, MARGIN, headerTopY - 42, {
    font: regular,
    size: 8,
    color: C.muted,
  });

  // Lado direito: Badge SOLICITAÇÃO DE EXAMES LABORATORIAIS + Emissão
  const badgeLabel = "SOLICITAÇÃO DE EXAMES LABORATORIAIS";
  const badgeFontSize = 7.2;
  const badgeTextW = bold.widthOfTextAtSize(sanitizeText(bold, badgeLabel), badgeFontSize);
  const badgeW = badgeTextW + 16;
  const badgeH = 18;
  const badgeX = PAGE_W - MARGIN - badgeW;
  const badgeY = headerTopY - 20;

  drawRoundedRectangle(page, {
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    borderRadius: 9,
    color: C.primarySoftBg,
    borderColor: C.primaryBorder,
    borderWidth: 0.8,
  });

  drawText(badgeLabel, badgeX, badgeY + 6.2, {
    font: bold,
    size: badgeFontSize,
    color: C.primary,
    align: "center",
    width: badgeW,
  });

  drawText(`Emissão: ${emissionDateBR}`, MARGIN, headerTopY - 34, {
    font: bold,
    size: 8.5,
    color: C.muted,
    align: "right",
    width: CONTENT_W,
  });

  if (
    prescricao.titulo &&
    prescricao.titulo.trim().toLowerCase() !== "solicitação de exames laboratoriais"
  ) {
    const titleRightLines = wrapText(prescricao.titulo.trim(), regular, 7.8, 195);
    drawText(titleRightLines[0], MARGIN, headerTopY - 45, {
      font: regular,
      size: 7.8,
      color: C.text,
      align: "right",
      width: CONTENT_W,
    });
  }

  y = headerTopY - 56;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1.5,
    color: C.primary,
  });
  y -= 14;

  // ============================================================================
  // 2. QUADRO IDENTIFICAÇÃO DO PACIENTE
  // ============================================================================
  const col1W = CONTENT_W * 0.48 - 14;
  const col3W = CONTENT_W * 0.28 - 14;
  const nameLines = wrapText(patientName, bold, 10, col1W);
  const ageText =
    patientAge !== undefined && patientAge !== null && String(patientAge).trim() !== ""
      ? `${patientAge} anos`
      : "Não informada";
  const ageStatusLines = wrapText(`${ageText} • ${statusLabel}`, regular, 9, col3W);
  const maxPatientLines = Math.max(nameLines.length, ageStatusLines.length, 1);
  const patientBoxH = 38 + maxPatientLines * 13;

  ensureSpace(patientBoxH + 12);
  drawRoundedRectangle(page, {
    x: MARGIN,
    y: y - patientBoxH,
    width: CONTENT_W,
    height: patientBoxH,
    borderRadius: 7,
    color: C.panel,
    borderColor: C.line,
    borderWidth: 0.8,
  });

  drawText("IDENTIFICAÇÃO DO PACIENTE", MARGIN + 12, y - 14, {
    font: bold,
    size: 7.5,
    color: C.primary,
  });

  const col1X = MARGIN + 12;
  const col2X = MARGIN + CONTENT_W * 0.48;
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

  y -= patientBoxH + 12;

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
    const alertH = 16 + alertLines.length * 12;
    ensureSpace(alertH + 10);

    drawRoundedRectangle(page, {
      x: MARGIN,
      y: y - alertH,
      width: CONTENT_W,
      height: alertH,
      borderRadius: 6,
      color: C.errorBg,
      borderColor: C.errorBorder,
      borderWidth: 0.8,
    });

    drawLines(alertLines, MARGIN + 12, y - 8, {
      font: bold,
      size: 8.5,
      color: C.error,
      leading: 12,
    });

    y -= alertH + 12;
  }

  // ============================================================================
  // 3. DESCRIÇÃO / INDICAÇÃO CLÍNICA
  // ============================================================================
  if (prescricao.descricao && prescricao.descricao.trim()) {
    const descW = CONTENT_W - 26;
    const descLines = wrapText(prescricao.descricao.trim(), regular, 9, descW);
    const descH = 26 + descLines.length * 13;
    ensureSpace(descH + 12);

    drawRoundedRectangle(page, {
      x: MARGIN,
      y: y - descH,
      width: CONTENT_W,
      height: descH,
      borderRadius: 6,
      color: C.panel,
      borderColor: C.line,
      borderWidth: 0.8,
    });

    page.drawRectangle({
      x: MARGIN,
      y: y - descH + 3,
      width: 3,
      height: descH - 6,
      color: C.primary,
    });

    drawText("DESCRIÇÃO / INDICAÇÃO CLÍNICA", MARGIN + 14, y - 14, {
      font: bold,
      size: 7.5,
      color: C.primary,
    });

    drawLines(descLines, MARGIN + 14, y - 19, {
      font: regular,
      size: 9,
      color: C.text,
      leading: 13,
    });

    y -= descH + 14;
  }

  // ============================================================================
  // 4. PAINEL DE EXAMES LABORATORIAIS SOLICITADOS
  // ============================================================================
  ensureSpace(34);
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
  y -= 20;

  const grupos = Array.isArray(prescricao.grupos_exames) ? prescricao.grupos_exames : [];
  if (grupos.length === 0) {
    ensureSpace(24);
    drawText("Nenhum grupo de exame registrado.", MARGIN, y - 10, {
      font: regular,
      size: 9,
      color: C.muted,
    });
    y -= 22;
  } else {
    const cardPaddingX = 12;
    const colGap = 16;
    const itemColW = (CONTENT_W - cardPaddingX * 2 - colGap) / 2;
    const examTextW = itemColW - 12;
    const examFontSize = 8.8;
    const examLeading = 12;

    for (let gIdx = 0; gIdx < grupos.length; gIdx++) {
      const grp = grupos[gIdx];
      const exames = Array.isArray(grp.exames) ? grp.exames.filter((e) => String(e).trim()) : [];
      const groupTitle = grp.nome_grupo?.trim() || `Grupo #${gIdx + 1}`;
      const countLabel = `${exames.length} ${exames.length === 1 ? "exame" : "exames"}`;

      // Pré-calcula linhas em pares (grade de 2 colunas)
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

      const headerH = 26;
      const bodyPaddingBottom = 8;
      const totalBodyH = rowPairs.reduce((acc, r) => acc + r.rowH, 0);
      const fullCardH = headerH + Math.max(totalBodyH, 16) + bodyPaddingBottom;
      const maxUsablePageH = PAGE_H - MARGIN * 2 - FOOTER_RESERVED;

      if (fullCardH <= maxUsablePageH) {
        ensureSpace(fullCardH + 8);
        const cardTopY = y;

        drawRoundedRectangle(page, {
          x: MARGIN,
          y: cardTopY - fullCardH,
          width: CONTENT_W,
          height: fullCardH,
          borderRadius: 7,
          color: C.white,
          borderColor: C.line,
          borderWidth: 0.8,
        });

        // Cabeçalho do grupo
        drawText(groupTitle, MARGIN + cardPaddingX, cardTopY - 16, {
          font: bold,
          size: 9.5,
          color: C.primary,
        });
        drawText(countLabel, MARGIN, cardTopY - 16, {
          font: mono,
          size: 8,
          color: C.muted,
          align: "right",
          width: CONTENT_W - cardPaddingX,
        });

        page.drawLine({
          start: { x: MARGIN + cardPaddingX, y: cardTopY - headerH + 3 },
          end: { x: PAGE_W - MARGIN - cardPaddingX, y: cardTopY - headerH + 3 },
          thickness: 0.6,
          color: C.line,
        });

        // Itens em 2 colunas
        let rowY = cardTopY - headerH - 4;
        for (const pair of rowPairs) {
          const leftX = MARGIN + cardPaddingX;
          const rightX = leftX + itemColW + colGap;

          // Bullet + texto esquerda
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

          // Bullet + texto direita
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

        y = cardTopY - fullCardH - 10;
      } else {
        // Grupo extenso: paginação controlada por linhas
        ensureSpace(headerH + 30);
        drawText(`${groupTitle} (${countLabel})`, MARGIN, y - 12, {
          font: bold,
          size: 9.5,
          color: C.primary,
        });
        y -= 18;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_W - MARGIN, y },
          thickness: 0.6,
          color: C.primaryBorder,
        });
        y -= 8;

        for (const pair of rowPairs) {
          ensureSpace(pair.rowH + 4);
          const leftX = MARGIN + 6;
          const rightX = leftX + itemColW + colGap;

          page.drawCircle({
            x: leftX + 3,
            y: y - examFontSize + 2.8,
            size: 2,
            color: C.primary,
          });
          drawLines(pair.left, leftX + 10, y, {
            font: regular,
            size: examFontSize,
            color: C.ink,
            leading: examLeading,
          });

          if (pair.right.length > 0) {
            page.drawCircle({
              x: rightX + 3,
              y: y - examFontSize + 2.8,
              size: 2,
              color: C.primary,
            });
            drawLines(pair.right, rightX + 10, y, {
              font: regular,
              size: examFontSize,
              color: C.ink,
              leading: examLeading,
            });
          }

          y -= pair.rowH;
        }

        y -= 8;
      }
    }
  }

  // ============================================================================
  // 5. INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES
  // ============================================================================
  const orientacoes = Array.isArray(prescricao.orientacoes)
    ? prescricao.orientacoes.filter((o) => String(o).trim())
    : [];

  if (orientacoes.length > 0) {
    const oriFontSize = 8.8;
    const oriLeading = 12.5;
    const oriTextW = CONTENT_W - 40;
    const wrappedOrientacoes = orientacoes.map((ori, idx) => ({
      num: `${idx + 1}.`,
      lines: wrapText(String(ori).trim(), regular, oriFontSize, oriTextW),
    }));

    const totalOriLinesH = wrappedOrientacoes.reduce(
      (acc, item) => acc + item.lines.length * oriLeading + 4,
      0
    );
    const oriBoxH = 30 + totalOriLinesH + 6;
    const maxUsablePageH = PAGE_H - MARGIN * 2 - FOOTER_RESERVED;

    if (oriBoxH <= maxUsablePageH) {
      ensureSpace(oriBoxH + 12);
      const boxTopY = y;

      drawRoundedRectangle(page, {
        x: MARGIN,
        y: boxTopY - oriBoxH,
        width: CONTENT_W,
        height: oriBoxH,
        borderRadius: 7,
        color: C.primarySoftBg,
        borderColor: C.primaryBorder,
        borderWidth: 0.8,
      });

      drawText("INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES", MARGIN + 12, boxTopY - 15, {
        font: bold,
        size: 8,
        color: C.primary,
      });

      let itemY = boxTopY - 26;
      for (const item of wrappedOrientacoes) {
        drawText(item.num, MARGIN + 14, itemY - oriFontSize, {
          font: bold,
          size: oriFontSize,
          color: C.primary,
        });
        drawLines(item.lines, MARGIN + 28, itemY, {
          font: regular,
          size: oriFontSize,
          color: C.text,
          leading: oriLeading,
        });
        itemY -= item.lines.length * oriLeading + 4;
      }

      y = boxTopY - oriBoxH - 12;
    } else {
      ensureSpace(32);
      drawText("INSTRUÇÕES E ORIENTAÇÕES PARA A REALIZAÇÃO DOS EXAMES", MARGIN, y - 12, {
        font: bold,
        size: 8.5,
        color: C.primary,
      });
      y -= 20;

      for (const item of wrappedOrientacoes) {
        const h = item.lines.length * oriLeading + 4;
        ensureSpace(h + 4);
        drawText(item.num, MARGIN + 4, y - oriFontSize, {
          font: bold,
          size: oriFontSize,
          color: C.primary,
        });
        drawLines(item.lines, MARGIN + 20, y, {
          font: regular,
          size: oriFontSize,
          color: C.text,
          leading: oriLeading,
        });
        y -= h;
      }
      y -= 10;
    }
  }

  // ============================================================================
  // 6. CHANCELA DE ASSINATURA DIGITAL SHA-256
  // ============================================================================
  const hashValue = prescricao.payload_hash?.trim() || "";
  const hashLines = hashValue
    ? wrapText(`Hash de Integridade (${prescricao.algoritmo || "SHA-256"}): ${hashValue}`, mono, 7.5, CONTENT_W - 36)
    : [];
  const hashBoxH = hashLines.length > 0 ? hashLines.length * 10.5 + 12 : 0;
  const sigBoxH = 66 + (hashBoxH > 0 ? hashBoxH + 10 : 0);

  ensureSpace(sigBoxH + 10);
  const sigTopY = y;

  drawRoundedRectangle(page, {
    x: MARGIN,
    y: sigTopY - sigBoxH,
    width: CONTENT_W,
    height: sigBoxH,
    borderRadius: 7,
    color: C.white,
    borderColor: C.primaryBorder,
    borderWidth: 0.9,
  });

  // Cabeçalho da chancela
  drawText("ASSINATURA DIGITAL & INTEGRIDADE CLÍNICA", MARGIN + 12, sigTopY - 15, {
    font: bold,
    size: 8.2,
    color: C.primary,
  });

  const algText = `Algoritmo: ${prescricao.algoritmo || "SHA-256"}`;
  const algW = mono.widthOfTextAtSize(sanitizeText(mono, algText), 7.2) + 12;
  const algX = PAGE_W - MARGIN - 12 - algW;
  drawRoundedRectangle(page, {
    x: algX,
    y: sigTopY - 20,
    width: algW,
    height: 14,
    borderRadius: 7,
    color: C.primarySoftBg,
    borderColor: C.primaryBorder,
    borderWidth: 0.6,
  });
  drawText(algText, algX, sigTopY - 15.5, {
    font: mono,
    size: 7.2,
    color: C.primary,
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
  const sigCol2X = MARGIN + CONTENT_W * 0.54;

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
      borderRadius: 5,
      color: C.panel,
      borderColor: C.line,
      borderWidth: 0.6,
    });

    drawLines(hashLines, MARGIN + 18, hashBoxTopY - 6, {
      font: mono,
      size: 7.5,
      color: C.text,
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
    });
    drawText(
      `Documento: ${prescricao.id || "—"}  •  Emissão: ${emissionDateBR}  •  Página ${idx + 1} de ${pages.length}`,
      MARGIN,
      MARGIN + 4,
      {
        font: regular,
        size: 6.6,
        color: C.faint,
      }
    );
  });

  return pdf.save({ useObjectStreams: false });
}
