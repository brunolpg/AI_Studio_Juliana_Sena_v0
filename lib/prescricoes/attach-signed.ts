import type { SupabaseClient } from "@supabase/supabase-js";
import { inspectSignedPdf } from "./signed-pdf";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** Bucket padronizado para armazenamento de prescrições e receitas assinadas */
export const SIGNED_BUCKET = "prescricoes";

export type AttachSignedResult =
  | { success: true; url: string; warnings: string[] }
  | { success: false; status: number; message: string; errors?: string[] };

/**
 * Tenta assegurar de forma resiliente que o bucket de armazenamento exista no Supabase.
 * Se o bucket não for encontrado, tenta criá-lo automaticamente via Admin Client (service_role)
 * ou cliente autenticado com configuração pública e limite de 5MB.
 */
async function ensureBucketExists(supabase: SupabaseClient): Promise<SupabaseClient> {
  const adminClient = getSupabaseAdminClient();
  const operatorClient = adminClient || supabase;

  try {
    const { data: bucket, error: getErr } = await operatorClient.storage.getBucket(SIGNED_BUCKET);
    if (!bucket || getErr) {
      await operatorClient.storage.createBucket(SIGNED_BUCKET, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ["application/pdf"],
      });
    }
  } catch (err) {
    console.warn(`[storage] Verificação preventiva do bucket '${SIGNED_BUCKET}':`, err);
  }

  return operatorClient;
}

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

  // Caminho padronizado e organizado: prescricoes/<id>/<timestamp>-assinada.pdf
  const filePath = `prescricoes/${prescriptionId}/${Date.now()}-assinada.pdf`;

  // Assegura preventivamente a existência do bucket
  const privilegedClient = await ensureBucketExists(supabase);

  // Tenta upload com cliente autenticado ou cliente com privilégios
  let storageClient = privilegedClient || supabase;
  let uploadResult = await storageClient.storage
    .from(SIGNED_BUCKET)
    .upload(filePath, Buffer.from(pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
    });

  // Fallback de emergência caso o erro inicial seja "Bucket not found"
  if (uploadResult.error && /bucket not found/i.test(uploadResult.error.message || "")) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      try {
        await admin.storage.createBucket(SIGNED_BUCKET, {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ["application/pdf"],
        });
        storageClient = admin;
        uploadResult = await storageClient.storage
          .from(SIGNED_BUCKET)
          .upload(filePath, Buffer.from(pdfBytes), {
            contentType: "application/pdf",
            upsert: true,
          });
      } catch (createErr) {
        console.error(`[storage] Erro na criação de emergência do bucket '${SIGNED_BUCKET}':`, createErr);
      }
    }
  }

  if (uploadResult.error) {
    const isBucketNotFound = /bucket not found/i.test(uploadResult.error.message || "");
    const friendlyMessage = isBucketNotFound
      ? `Falha ao salvar o arquivo: O bucket de armazenamento '${SIGNED_BUCKET}' não foi encontrado no Supabase. Execute o script 'sql/supabase-prescricoes-storage.sql' para provisioná-lo.`
      : `Falha ao salvar o arquivo: ${uploadResult.error.message}`;

    return { success: false, status: 502, message: friendlyMessage };
  }

  const { data: publicData } = storageClient.storage.from(SIGNED_BUCKET).getPublicUrl(filePath);

  if (!publicData?.publicUrl) {
    await storageClient.storage.from(SIGNED_BUCKET).remove([filePath]);
    return { success: false, status: 502, message: "Não foi possível obter a URL pública do PDF gravado." };
  }

  // Atualiza banco de dados (public.prescricoes):
  // `.is("pdf_assinado_url", null)` evita concorrência entre envios simultâneos
  const now = new Date().toISOString();
  const dbClient = getSupabaseAdminClient() || supabase;
  const { data: updated, error: dbErr } = await dbClient
    .from("prescricoes")
    .update({
      pdf_assinado_url: publicData.publicUrl,
      data_assinatura: now,
      updated_at: now,
    })
    .eq("id", prescriptionId)
    .is("pdf_assinado_url", null)
    .select("id");

  if (dbErr || !updated || updated.length === 0) {
    await storageClient.storage.from(SIGNED_BUCKET).remove([filePath]); // não deixa arquivo órfão
    return dbErr
      ? { success: false, status: 502, message: `Falha ao vincular à prescrição: ${dbErr.message}` }
      : { success: false, status: 409, message: "Esta receita já possui um PDF assinado anexado." };
  }

  return { success: true, url: publicData.publicUrl, warnings: inspection.warnings };
}
