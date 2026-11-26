import { NextRequest, NextResponse } from "next/server";
import { requireProfissionalAccess, verifyProfissionalOrOwnPaciente } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/validations/file-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_BUCKETS = ["prontuarios-documentos", "prontuarios-fotos"] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

const BUCKET_ALLOWED_MIMES: Record<AllowedBucket, string[]> = {
  "prontuarios-documentos": [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/webp",
  ],
  "prontuarios-fotos": [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/webp",
  ],
};

const BUCKET_ALLOWED_EXTENSIONS: Record<AllowedBucket, string[]> = {
  "prontuarios-documentos": [".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".webp"],
  "prontuarios-fotos": [".png", ".jpg", ".jpeg", ".bmp", ".webp"],
};

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
};

function isAllowedBucket(value: string): value is AllowedBucket {
  return (ALLOWED_BUCKETS as readonly string[]).includes(value);
}

function sanitizeFileName(rawName: string): string {
  const baseName = rawName.split(/[\\/]/).pop() || "arquivo";
  const cleaned = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "");

  const finalName = cleaned || "anexo";
  return finalName.length > 120 ? finalName.slice(-120) : finalName;
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx).toLowerCase();
}

function extractStoragePathFromUrl(rawUrl: string, bucket: AllowedBucket): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Bloqueia tentativas óbvias de path traversal ou esquemas inválidos
  if (trimmed.includes("..")) return null;

  const withoutQuery = trimmed.split("?")[0].split("#")[0];

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const authMarker = `/storage/v1/object/authenticated/${bucket}/`;

  for (const marker of [publicMarker, signedMarker, authMarker]) {
    const markerIdx = withoutQuery.indexOf(marker);
    if (markerIdx !== -1) {
      const extracted = withoutQuery.slice(markerIdx + marker.length);
      try {
        return decodeURIComponent(extracted).replace(/^\/+/, "");
      } catch {
        return extracted.replace(/^\/+/, "");
      }
    }
  }

  // Caminho relativo salvo diretamente no banco (ex.: "<clientId>/1234_exame.pdf" ou "<bucket>/<clientId>/...")
  if (!/^https?:\/\//i.test(withoutQuery)) {
    const cleaned = withoutQuery.replace(/^(\.\/|\/)+/, "");
    if (cleaned.startsWith(`${bucket}/`)) {
      return cleaned.slice(bucket.length + 1);
    }
    return cleaned;
  }

  return null;
}

/**
 * POST /api/clinical/attachments
 * Upload seguro server-side de anexos clínicos (exames/laudos e fotos) usando Admin Client,
 * garantindo autenticação/RBAC, validação de tipo/tamanho e criação resiliente do bucket.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { success: false, message: "Requisição inválida. Envie os dados em formato multipart/form-data." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawBucket = String(formData.get("bucket") || "").trim();
    const clientId = String(formData.get("clientId") || "").trim();
    const fileEntry = formData.get("file");

    if (!isAllowedBucket(rawBucket)) {
      return NextResponse.json(
        { success: false, message: "Bucket de armazenamento não permitido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (rawBucket === "prontuarios-fotos" && auth.user.role === "administrador") {
      return NextResponse.json(
        {
          success: false,
          message: "Acesso restrito ao profissional de saúde para envio de fotografias clínicas.",
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!UUID_REGEX.test(clientId)) {
      return NextResponse.json(
        { success: false, message: "Identificador de paciente inválido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!fileEntry || typeof fileEntry === "string") {
      return NextResponse.json(
        { success: false, message: "Nenhum arquivo enviado." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (fileEntry.size <= 0) {
      return NextResponse.json(
        { success: false, message: `O arquivo "${fileEntry.name}" está vazio.` },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (fileEntry.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: `O arquivo "${fileEntry.name}" excede o limite máximo permitido de 5MB.`,
        },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sanitizedName = sanitizeFileName(fileEntry.name);
    const ext = getFileExtension(sanitizedName);
    const allowedExts = BUCKET_ALLOWED_EXTENSIONS[rawBucket];
    const allowedMimes = BUCKET_ALLOWED_MIMES[rawBucket];

    const rawMime = (fileEntry.type || "").toLowerCase().trim();
    const isExtAllowed = Boolean(ext && allowedExts.includes(ext));
    const isMimeAllowed = Boolean(rawMime && allowedMimes.includes(rawMime));

    if (!isExtAllowed || (rawMime && !isMimeAllowed && rawMime !== "application/octet-stream")) {
      return NextResponse.json(
        {
          success: false,
          message: `Formato de arquivo não suportado para "${fileEntry.name}". Use ${allowedExts.join(", ").toUpperCase()}.`,
        },
        { status: 415, headers: { "Cache-Control": "no-store" } }
      );
    }

    const safeContentType = isMimeAllowed ? rawMime : EXT_TO_MIME[ext] || "application/octet-stream";

    const adminClient = getSupabaseAdminClient();
    const storageClient = adminClient || auth.supabase;

    // Confirma que o paciente existe e está ativo (soft delete)
    const { data: patientRow, error: patientErr } = await storageClient
      .from("pacientes")
      .select("id")
      .eq("id", clientId)
      .is("deleted_at", null)
      .maybeSingle();

    if (patientErr || !patientRow) {
      return NextResponse.json(
        { success: false, message: "Paciente não encontrado ou inativo." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Garante preventivamente a existência do bucket quando o Admin Client está disponível
    if (adminClient) {
      try {
        const { data: bucketInfo, error: getBucketErr } = await adminClient.storage.getBucket(rawBucket);
        if (!bucketInfo || getBucketErr) {
          await adminClient.storage.createBucket(rawBucket, {
            public: true,
            fileSizeLimit: MAX_ATTACHMENT_SIZE_BYTES,
            allowedMimeTypes: allowedMimes,
          });
        }
      } catch (bucketErr) {
        console.warn(`[clinical/attachments] Verificação preventiva do bucket '${rawBucket}':`, bucketErr);
      }
    }

    const filePath = `${clientId}/${Date.now()}_${sanitizedName}`;
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());

    let uploadRes = await storageClient.storage
      .from(rawBucket)
      .upload(filePath, fileBuffer, {
        contentType: safeContentType,
        cacheControl: "3600",
        upsert: false,
      });

    // Tenta criar o bucket automaticamente em caso de erro "Bucket not found"
    if (uploadRes.error && /bucket not found/i.test(uploadRes.error.message || "") && adminClient) {
      try {
        await adminClient.storage.createBucket(rawBucket, {
          public: true,
          fileSizeLimit: MAX_ATTACHMENT_SIZE_BYTES,
          allowedMimeTypes: allowedMimes,
        });
        uploadRes = await adminClient.storage
          .from(rawBucket)
          .upload(filePath, fileBuffer, {
            contentType: safeContentType,
            cacheControl: "3600",
            upsert: false,
          });
      } catch (retryErr) {
        console.error(`[clinical/attachments] Erro ao criar bucket '${rawBucket}':`, retryErr);
      }
    }

    if (uploadRes.error) {
      const errMsg = uploadRes.error.message || "Erro desconhecido no Supabase Storage.";
      const isBucketNotFound = /bucket not found/i.test(errMsg);
      const isRlsError = /row-level security|not authorized|permission|policy/i.test(errMsg);

      const friendlyMessage = isBucketNotFound
        ? `Bucket "${rawBucket}" não encontrado no Supabase Storage. Crie o bucket "${rawBucket}" no painel do Supabase.`
        : isRlsError
        ? `Permissão negada (RLS) ao enviar "${fileEntry.name}" para o bucket "${rawBucket}". Verifique as políticas de Storage ou a chave de serviço.`
        : `Falha ao enviar "${fileEntry.name}" para o bucket "${rawBucket}": ${errMsg}`;

      return NextResponse.json(
        { success: false, message: friendlyMessage },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: publicData } = storageClient.storage.from(rawBucket).getPublicUrl(filePath);
    const resolvedUrl = publicData?.publicUrl;

    if (!resolvedUrl) {
      return NextResponse.json(
        { success: false, message: "Arquivo enviado, mas não foi possível gerar a URL de acesso." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: resolvedUrl,
        path: filePath,
        bucket: rawBucket,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[POST /api/clinical/attachments] Erro inesperado:", err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Erro interno ao enviar anexo clínico.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * GET /api/clinical/attachments?bucket=prontuarios-documentos&clientId=<uuid>&url=<encoded>
 * Gera URL assinada de curta duração (ou pública válida) no Supabase Storage e redireciona,
 * garantindo abertura confiável tanto em buckets privados quanto públicos.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawBucket = (searchParams.get("bucket") || "prontuarios-documentos").trim();
    const clientId = (searchParams.get("clientId") || "").trim();
    const rawUrl = (searchParams.get("url") || "").trim();

    if (rawBucket !== "prontuarios-documentos") {
      return NextResponse.json(
        { success: false, message: "Bucket inválido para visualização de exames." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!UUID_REGEX.test(clientId)) {
      return NextResponse.json(
        { success: false, message: "Identificador de paciente inválido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!rawUrl || rawUrl.includes("supabase-storage-fallback.local")) {
      return NextResponse.json(
        { success: false, message: "Anexo inválido ou indisponível." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const auth = await verifyProfissionalOrOwnPaciente(clientId);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const storagePath = extractStoragePathFromUrl(rawUrl, "prontuarios-documentos");
    if (!storagePath || storagePath.includes("..")) {
      return NextResponse.json(
        { success: false, message: "Caminho do anexo inválido." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const adminClient = getSupabaseAdminClient();
    const storageClient = adminClient || auth.supabase;

    // Garante isolamento por paciente: o caminho deve estar sob a pasta do paciente
    // ou constar explicitamente na lista exames_anexos de uma evolução deste paciente.
    const belongsToPatientFolder = storagePath.startsWith(`${clientId}/`);
    if (!belongsToPatientFolder) {
      const { data: evRows } = await storageClient
        .from("evolucoes_clinicas")
        .select("exames_anexos")
        .eq("paciente_id", clientId);

      const hasMatch = (evRows || []).some(
        (row: any) =>
          Array.isArray(row.exames_anexos) &&
          row.exames_anexos.some(
            (item: unknown) =>
              typeof item === "string" &&
              (item.trim() === rawUrl ||
                extractStoragePathFromUrl(item, "prontuarios-documentos") === storagePath)
          )
      );

      if (!hasMatch) {
        return NextResponse.json(
          { success: false, message: "Acesso negado ao documento solicitado." },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // Prioriza URL assinada (funciona em buckets privados e públicos)
    const { data: signedData, error: signedErr } = await storageClient.storage
      .from("prontuarios-documentos")
      .createSignedUrl(storagePath, 300);

    if (!signedErr && signedData?.signedUrl) {
      return NextResponse.redirect(signedData.signedUrl, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Fallback seguro para URL pública do projeto Supabase configurado
    const { data: publicData } = storageClient.storage
      .from("prontuarios-documentos")
      .getPublicUrl(storagePath);

    if (publicData?.publicUrl) {
      return NextResponse.redirect(publicData.publicUrl, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: signedErr?.message || "Não foi possível abrir o exame solicitado.",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("[GET /api/clinical/attachments] Erro inesperado:", err);
    return NextResponse.json(
      { success: false, message: "Erro interno ao abrir anexo clínico." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
