import { PDFDocument } from "pdf-lib";
import { RX_MARKER_PREFIX } from "./pdf";

/**
 * Conferência ESTRUTURAL do PDF assinado que a profissional anexa.
 *
 * Objetivo: pegar os erros comuns antes de gravar no prontuário —
 * anexar o PDF sem assinar, um arquivo que não é PDF ou a receita de outro paciente.
 *
 * NÃO verifica criptograficamente a assinatura nem a cadeia ICP-Brasil.
 * A validade jurídica continua sendo conferida no Validador do ITI.
 */

export const MAX_SIGNED_PDF_BYTES = 10 * 1024 * 1024;

export type RxIdMatch = "match" | "missing" | "mismatch";

export interface SignedPdfInspection {
  /** false → bloquear o anexo (ver `errors`) */
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: {
    signatureCount: number;
    subFilters: string[];
    coversWholeFile: boolean;
    rxId: RxIdMatch;
  };
}

const ACCEPTED_SUBFILTERS = ["ETSI.CAdES.detached", "adbe.pkcs7.detached"];

export async function inspectSignedPdf(bytes: Uint8Array, expectedRxId: string): Promise<SignedPdfInspection> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: SignedPdfInspection["info"] = { signatureCount: 0, subFilters: [], coversWholeFile: false, rxId: "missing" };
  const fail = (msg: string): SignedPdfInspection => ({ ok: false, errors: [...errors, msg], warnings, info });

  if (bytes.length === 0) return fail("O arquivo está vazio.");
  if (bytes.length > MAX_SIGNED_PDF_BYTES) return fail("O arquivo é maior que 10 MB.");

  // cabeçalho %PDF- nos primeiros bytes
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  if (!head.includes("%PDF-")) return fail("O arquivo não é um PDF válido.");

  // As estruturas de assinatura ficam em texto puro (o /Contents é referenciado por
  // ByteRange em bytes brutos), então uma leitura latin1 do arquivo é suficiente.
  const raw = Buffer.from(bytes).toString("latin1");

  // 1. Assinaturas: /ByteRange [a b c d] com /Contents preenchido
  const byteRanges = [...raw.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  let filled = 0;
  for (const m of byteRanges) {
    const [start1, len1, start2, len2] = m.slice(1).map(Number);
    const gap = raw.slice(start1 + len1, start2); // "<hex>" do /Contents, fora da área assinada
    const hex = gap.replace(/[^0-9a-fA-F]/g, "");
    // placeholder de assinatura ainda não preenchida = só zeros
    if (hex.replace(/0/g, "").length >= 64) {
      filled++;
      if (start2 + len2 >= bytes.length - 4) info.coversWholeFile = true;
    }
  }
  info.signatureCount = filled;

  if (filled === 0) {
    return fail(
      byteRanges.length > 0
        ? "O PDF tem um campo de assinatura vazio. Conclua a assinatura no VIDaaS e anexe o arquivo assinado."
        : "Este PDF não contém assinatura digital. Anexe o arquivo gerado pelo VIDaaS depois de assinar, não o PDF original."
    );
  }

  info.subFilters = [...new Set([...raw.matchAll(/\/SubFilter\s*\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]))];
  if (info.subFilters.length > 0 && !info.subFilters.some((s) => ACCEPTED_SUBFILTERS.includes(s))) {
    warnings.push(`Formato de assinatura incomum (${info.subFilters.join(", ")}). Confira no Validador do ITI.`);
  }
  if (!info.coversWholeFile) {
    warnings.push("A assinatura não cobre o arquivo inteiro: ele pode ter sido alterado depois de assinado. Confira no Validador do ITI.");
  }

  // 2. A receita é a mesma? (marcador gravado nos metadados na geração do PDF)
  const expected = `${RX_MARKER_PREFIX}${expectedRxId}`;
  let keywords = "";
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    keywords = doc.getKeywords() || "";
  } catch {
    // arquivo reescrito pelo assinador: cai para a busca no texto bruto abaixo
  }
  const markerRe = new RegExp(`${RX_MARKER_PREFIX}([0-9a-fA-F-]{36})`, "g");
  const idsIn = (s: string) => [...s.matchAll(markerRe)].map((m) => m[1].toLowerCase());
  let found = idsIn(keywords);
  if (found.length === 0) found = idsIn(raw);

  if (found.length === 0) {
    info.rxId = "missing";
    warnings.push("Não foi possível confirmar que este PDF é desta receita (identificador não encontrado). Confira o conteúdo antes de seguir.");
  } else if (found.includes(expected.slice(RX_MARKER_PREFIX.length).toLowerCase())) {
    info.rxId = "match";
  } else {
    info.rxId = "mismatch";
    errors.push("Este PDF assinado pertence a OUTRA receita. Selecione o arquivo da receita que está sendo assinada.");
  }

  return { ok: errors.length === 0, errors, warnings, info };
}
