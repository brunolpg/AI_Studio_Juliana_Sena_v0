import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectSignedPdf } from "./signed-pdf";

/** Bucket e pasta já usados pelo fluxo atual de receitas assinadas. */
export const SIGNED_BUCKET = "receitas";

export type AttachSignedResult =
  | { success: true; url: string; warnings: string[] }
  | { success: false; status: number; message: string; errors?: string[] };

/**
 * Confere o PDF assinado e o vincula à prescrição (Storage + colunas
 * `pdf_assinado_url` / `data_assinatura`).
 *
 * É o ponto único de gravação: hoje recebe o arquivo que a profissional anexa;
 * quando houver integração direta com a API do VIDaaS, o PDF devolvido pela
 * API entra aqui da mesma forma.
 */
export async function attachSignedPrescription(
  supabase: SupabaseClient,
  prescriptionId: string,
  pdfBytes: Uint8Array
): Promise<AttachSignedResult> {
  const { data: rx, error: rxErr } = await supabase
    .from("prescricoes")
    .select("id, pdf_assinado_url")
    .eq("id", prescriptionId)
    .maybeSingle();

  if (rxErr || !rx) {
    return { success: false, status: 404, message: "Prescrição não encontrada." };
  }
  if (rx.pdf_assinado_url) {
    return { success: false, status: 409, message: "Esta receita já possui um PDF assinado anexado." };
  }

  const inspection = await inspectSignedPdf(pdfBytes, prescriptionId);
  if (!inspection.ok) {
    return { success: false, status: 422, message: inspection.errors[0], errors: inspection.errors };
  }

  const filePath = `receitas/${prescriptionId}_assinado_${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(SIGNED_BUCKET)
    .upload(filePath, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false });
  if (uploadErr) {
    return { success: false, status: 502, message: `Falha ao salvar o arquivo: ${uploadErr.message}` };
  }

  const { data: publicData } = supabase.storage.from(SIGNED_BUCKET).getPublicUrl(filePath);

  // `.is(..., null)` evita que dois envios simultâneos sobrescrevam um ao outro
  const now = new Date().toISOString();
  const { data: updated, error: dbErr } = await supabase
    .from("prescricoes")
    .update({ pdf_assinado_url: publicData.publicUrl, data_assinatura: now, updated_at: now })
    .eq("id", prescriptionId)
    .is("pdf_assinado_url", null)
    .select("id");

  if (dbErr || !updated || updated.length === 0) {
    await supabase.storage.from(SIGNED_BUCKET).remove([filePath]); // não deixa arquivo órfão
    return dbErr
      ? { success: false, status: 502, message: `Falha ao vincular à prescrição: ${dbErr.message}` }
      : { success: false, status: 409, message: "Esta receita já possui um PDF assinado anexado." };
  }

  return { success: true, url: publicData.publicUrl, warnings: inspection.warnings };
}
