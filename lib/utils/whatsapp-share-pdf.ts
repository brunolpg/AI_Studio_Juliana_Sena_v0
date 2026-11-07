import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Sanitiza o nome do arquivo PDF seguindo o padrão exigido:
 * [TipoDocumento]_[Nome_Paciente_ou_Protocolo].pdf
 * Remove acentos, caracteres especiais e substitui espaços por underscores.
 */
export function sanitizePdfFileName(prefix: string, name: string): string {
  const combined = `${prefix} ${name || ""}`.trim();
  const normalized = combined
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentuação
    .replace(/[^a-zA-Z0-9_-]/g, "_") // caracteres especiais viram _
    .replace(/_+/g, "_") // remove repetição de _
    .replace(/^_|_$/g, ""); // apara as pontas
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
 * Quebra texto em múltiplas linhas respeitando a largura máxima disponível no PDF.
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return [];
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

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

/**
 * Cria um documento PDF estruturado em memória utilizando pdf-lib com layout A4 oficial.
 */
export async function generateGenericClinicalPdf(options: GenericClinicalPdfOptions): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = 45;
  const MARGIN_RIGHT = 45;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 45;

  const checkAddPage = (requiredSpace: number) => {
    if (y - requiredSpace < 50) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 45;
      drawMiniHeader(currentPage);
    }
  };

  const drawMiniHeader = (page: PDFPage) => {
    page.drawText("CLÍNICA DRA. JULIANA SENA • ESTÉTICA AVANÇADA", {
      x: MARGIN_LEFT,
      y: y,
      size: 8,
      font: fontBold,
      color: rgb(0.05, 0.45, 0.4),
    });
    page.drawText(`${options.title} (Continuação)`, {
      x: PAGE_WIDTH - MARGIN_RIGHT - fontRegular.widthOfTextAtSize(`${options.title} (Continuação)`, 8),
      y: y,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN_LEFT, y },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.88),
    });
    y -= 20;
  };

  // --- CABEÇALHO PRINCIPAL ---
  currentPage.drawText("DRA. JULIANA SENA", {
    x: MARGIN_LEFT,
    y: y,
    size: 15,
    font: fontBold,
    color: rgb(0.04, 0.38, 0.34), // Teal escuro institucional
  });
  y -= 14;

  currentPage.drawText("ESTÉTICA AVANÇADA E REGENERATIVA • COREN-BA 366.344", {
    x: MARGIN_LEFT,
    y: y,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55),
  });
  y -= 14;

  // Linha dourada/esmeralda divisória
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 1.5,
    color: rgb(0.79, 0.64, 0.31), // Dourado sutil
  });
  y -= 16;

  // Título do Documento
  currentPage.drawText(options.title.toUpperCase(), {
    x: MARGIN_LEFT,
    y: y,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.2),
  });
  y -= 12;

  if (options.subtitle) {
    currentPage.drawText(options.subtitle, {
      x: MARGIN_LEFT,
      y: y,
      size: 9.5,
      font: fontItalic,
      color: rgb(0.35, 0.4, 0.45),
    });
    y -= 14;
  }

  // --- QUADRO DE DADOS DO PACIENTE / DOCUMENTO ---
  const boxHeight = options.patientCpf || options.patientPhone ? 50 : 38;
  currentPage.drawRectangle({
    x: MARGIN_LEFT,
    y: y - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: rgb(0.96, 0.98, 0.98),
    borderColor: rgb(0.82, 0.9, 0.88),
    borderWidth: 1,
  });

  let boxTextY = y - 14;
  if (options.patientName) {
    currentPage.drawText("PACIENTE: ", {
      x: MARGIN_LEFT + 10,
      y: boxTextY,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.25),
    });
    currentPage.drawText(options.patientName, {
      x: MARGIN_LEFT + 70,
      y: boxTextY,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.1, 0.15, 0.2),
    });
  }

  if (options.dateStr) {
    const dateText = `DATA: ${options.dateStr}`;
    const dateWidth = fontRegular.widthOfTextAtSize(dateText, 8.5);
    currentPage.drawText(dateText, {
      x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth - 10,
      y: boxTextY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.3, 0.35, 0.4),
    });
  }

  if (options.patientCpf || options.patientPhone) {
    boxTextY -= 15;
    let extraText = "";
    if (options.patientCpf) extraText += `CPF: ${options.patientCpf}   `;
    if (options.patientPhone) extraText += `Telefone: ${options.patientPhone}`;
    currentPage.drawText(extraText, {
      x: MARGIN_LEFT + 10,
      y: boxTextY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  y -= boxHeight + 18;

  // --- SEÇÕES DO DOCUMENTO ---
  for (const section of options.sections) {
    checkAddPage(40);

    if (section.title) {
      currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: y - 16,
        width: CONTENT_WIDTH,
        height: 18,
        color: rgb(0.93, 0.96, 0.95),
      });

      currentPage.drawText(section.title.toUpperCase(), {
        x: MARGIN_LEFT + 8,
        y: y - 12,
        size: 9.5,
        font: fontBold,
        color: rgb(0.04, 0.38, 0.34),
      });

      if (section.badge) {
        const badgeWidth = fontBold.widthOfTextAtSize(section.badge, 7.5);
        currentPage.drawText(section.badge, {
          x: PAGE_WIDTH - MARGIN_RIGHT - badgeWidth - 8,
          y: y - 11,
          size: 7.5,
          font: fontBold,
          color: rgb(0.2, 0.45, 0.4),
        });
      }

      y -= 24;
    }

    if (section.paragraph) {
      const wrapped = wrapText(section.paragraph, CONTENT_WIDTH - 16, fontRegular, 9);
      for (const line of wrapped) {
        checkAddPage(14);
        currentPage.drawText(line, {
          x: MARGIN_LEFT + 8,
          y: y,
          size: 9,
          font: fontRegular,
          color: rgb(0.2, 0.25, 0.3),
        });
        y -= 13;
      }
      y -= 4;
    }

    if (section.items && section.items.length > 0) {
      for (const item of section.items) {
        const wrappedItem = wrapText(item, CONTENT_WIDTH - 24, fontRegular, 8.5);
        let firstLine = true;
        for (const line of wrappedItem) {
          checkAddPage(13);
          if (firstLine) {
            currentPage.drawText("•", {
              x: MARGIN_LEFT + 10,
              y: y,
              size: 9,
              font: fontBold,
              color: rgb(0.04, 0.38, 0.34),
            });
            firstLine = false;
          }
          currentPage.drawText(line, {
            x: MARGIN_LEFT + 22,
            y: y,
            size: 8.5,
            font: fontRegular,
            color: rgb(0.2, 0.25, 0.3),
          });
          y -= 12;
        }
        y -= 2;
      }
      y -= 6;
    }

    y -= 6;
  }

  // --- RODAPÉ / CHANCELA DE VALIDAÇÃO ---
  checkAddPage(50);
  y -= 10;
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: rgb(0.8, 0.85, 0.88),
  });
  y -= 14;

  const profName = options.professionalName || "Dra. Juliana Sena de Souza Vieira";
  const profRole = options.professionalRole || "Enfermeira Esteta • COREN-BA 366.344";

  currentPage.drawText(profName, {
    x: MARGIN_LEFT,
    y: y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.25),
  });
  currentPage.drawText(`Salvador - BA • Telefone: (71) 98661-2878`, {
    x: PAGE_WIDTH - MARGIN_RIGHT - fontRegular.widthOfTextAtSize("Salvador - BA • Telefone: (71) 98661-2878", 8),
    y: y,
    size: 8,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55),
  });
  y -= 11;

  currentPage.drawText(profRole, {
    x: MARGIN_LEFT,
    y: y,
    size: 8,
    font: fontRegular,
    color: rgb(0.45, 0.5, 0.55),
  });
  currentPage.drawText("Documento emitido eletronicamente pela plataforma clínica", {
    x: PAGE_WIDTH - MARGIN_RIGHT - fontItalic.widthOfTextAtSize("Documento emitido eletronicamente pela plataforma clínica", 7.5),
    y: y,
    size: 7.5,
    font: fontItalic,
    color: rgb(0.55, 0.6, 0.65),
  });

  const pdfBytes = await pdfDoc.save();
  return new File([pdfBytes as unknown as BlobPart], options.fileName, { type: "application/pdf" });
}

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

/**
 * Dispara o envio via WhatsApp:
 * 1. Em dispositivos móveis ou navegadores com Web Share API de arquivos, compartilha diretamente o File PDF.
 * 2. Em desktop ou quando não houver suporte a compartilhamento nativo de arquivos,
 *    tenta obter um link público via Supabase Storage e abre o WhatsApp Web com mensagem pré-formatada.
 * NUNCA executa download local automático no dispositivo do usuário.
 */
export async function sharePdfViaWhatsApp(
  context: SharePdfViaWhatsAppContext
): Promise<ShareWhatsAppResult> {
  const { file, documentTitle, patientName, patientPhone, customMessage } = context;
  const cleanPhone = cleanBrazilianPhone(patientPhone);

  const greeting = patientName ? `Olá, ${patientName}!` : "Olá!";
  const baseMessage =
    customMessage ||
    `${greeting}\n\nSegue em anexo o seu documento clínico oficial: *${documentTitle}*.\n\nQualquer dúvida sobre as instruções ou orientações, nossa equipe permanece à disposição.\n\n*Clínica Dra. Juliana Sena*\nEstética Avançada e Regenerativa\nSalvador - BA`;

  // 1. Tenta compartilhamento nativo direto pelo Web Share API (Mobile / Safari / Edge mobile)
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

  // 2. Fallback para Desktop ou navegadores sem Web Share API de arquivos:
  // Tenta upload no Supabase Storage para gerar link acessível
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

  // Monta a mensagem final do WhatsApp
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

  // Abre o WhatsApp Web em uma nova guia
  if (typeof window !== "undefined") {
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return { success: true, method: "whatsapp-web", publicUrl };
}

