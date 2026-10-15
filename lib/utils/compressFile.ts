import { PDFDocument } from "pdf-lib";

export interface CompressOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Redimensiona e comprime imagens (JPEG, PNG, WebP) ou otimiza documentos PDF client-side
 * antes do upload para o Supabase Storage.
 *
 * @param file Arquivo original enviado pelo usuário
 * @param options Configurações de largura máxima e qualidade
 * @returns Promessa com o arquivo otimizado (ou o original em caso de fallback)
 */
export async function compressReceiptFile(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  if (!file) return file;

  const { maxWidth = 1200, quality = 0.80 } = options;
  const fileType = file.type.toLowerCase();
  const fileName = file.name;

  // 1. Processamento de Imagens (JPEG, PNG, WEBP)
  if (
    fileType.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp)$/i.test(fileName)
  ) {
    try {
      // Cria imagem bitmap para leitura rápida das dimensões originais
      const imageBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });

      let targetWidth = imageBitmap.width;
      let targetHeight = imageBitmap.height;

      // Cálculo do redimensionamento proporcional se largura for maior que maxWidth (1200px)
      if (targetWidth > maxWidth) {
        const scaleFactor = maxWidth / targetWidth;
        targetWidth = maxWidth;
        targetHeight = Math.round(targetHeight * scaleFactor);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return file;
      }

      // Preenchimento de fundo branco para transparências convertidas em JPEG
      if (fileType === "image/jpeg" || fileType === "image/jpg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);

      // Determina MIME Type de saída adequado
      let outputMime = fileType;
      if (!outputMime || outputMime === "application/octet-stream") {
        outputMime = fileName.toLowerCase().endsWith(".png")
          ? "image/png"
          : fileName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
      }

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), outputMime, quality);
      });

      if (!blob) {
        return file;
      }

      // Retorna o novo arquivo comprimido se tiver tamanho menor
      if (blob.size < file.size) {
        return new File([blob], fileName, {
          type: outputMime,
          lastModified: Date.now(),
        });
      }

      return file;
    } catch (err) {
      console.warn("Aviso na compressão de imagem. Utilizando arquivo original:", err);
      return file;
    }
  }

  // 2. Otimização de Documentos PDF via pdf-lib
  if (fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

      // Recomprime as estruturas de objetos do documento
      const pdfBytes = await pdfDoc.save({ useObjectStreams: true });

      if (pdfBytes.byteLength < file.size) {
        return new File([pdfBytes], fileName, {
          type: "application/pdf",
          lastModified: Date.now(),
        });
      }

      return file;
    } catch (err) {
      console.warn("Aviso na otimização do PDF com pdf-lib. Utilizando arquivo original:", err);
      return file;
    }
  }

  return file;
}
