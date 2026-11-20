import "server-only";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const PROFESSIONAL_GMAIL_EMAIL = "julianasevieira@gmail.com";
export const PROFESSIONAL_DISPLAY_NAME = "Dra. Juliana Sena";

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export interface GmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendEmailViaGmailParams {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
  fromName?: string;
  fromEmail?: string;
}

export type SendEmailViaGmailResult =
  | {
      success: true;
      messageId: string;
      threadId?: string;
      sender: string;
    }
  | {
      success: false;
      status: number;
      code: "GMAIL_AUTH_REQUIRED" | "GMAIL_CONFIG_ERROR" | "GMAIL_SEND_ERROR";
      authUrl?: string;
      error: string;
    };

let ephemeralStateSecret: string | null = null;

function getOAuthStateSecret(): string {
  const configured =
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET;
  if (configured) return configured;
  if (!ephemeralStateSecret) {
    ephemeralStateSecret = crypto.randomBytes(32).toString("hex");
  }
  return ephemeralStateSecret;
}

export function sanitizeReturnToPath(rawPath?: string | null, fallback = "/clinical"): string {
  if (!rawPath) return fallback;
  const trimmed = rawPath.trim();
  if (/^\/(?!\/)/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function createSignedOAuthState(payload: {
  userId: string;
  returnTo: string;
}): string {
  const body = {
    userId: payload.userId,
    returnTo: sanitizeReturnToPath(payload.returnTo),
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutos
  };
  const encoded = Buffer.from(JSON.stringify(body), "utf-8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getOAuthStateSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySignedOAuthState(
  stateParam?: string | null
): { userId: string; returnTo: string } | null {
  if (!stateParam) return null;
  const parts = stateParam.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getOAuthStateSecret())
    .update(encoded)
    .digest("base64url");

  const sigA = Buffer.from(providedSig);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (!parsed || typeof parsed.userId !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return {
      userId: parsed.userId,
      returnTo: sanitizeReturnToPath(parsed.returnTo),
    };
  } catch {
    return null;
  }
}

/**
 * Constrói o redirect_uri exclusivo da Gmail API sem usar GOOGLE_REDIRECT_URI (reservado ao Supabase Auth).
 */
export function getGmailRedirectUri(request: Request): string {
  const dedicatedUri = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (dedicatedUri) {
    return dedicatedUri;
  }
  return new URL("/api/auth/google/callback", request.url).toString();
}

export function getGoogleOAuthClientConfig() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  return { clientId, clientSecret };
}

function hasGmailSendScope(scopeStr?: string | null): boolean {
  if (!scopeStr) return false;
  const scopes = scopeStr
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return scopes.some(
    (s) =>
      s === "https://www.googleapis.com/auth/gmail.send" ||
      s === "https://mail.google.com/" ||
      s.endsWith("/gmail.send")
  );
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeRfc2047Header(value: string): string {
  const clean = sanitizeHeaderValue(value);
  if (/^[\x20-\x7E]*$/.test(clean)) {
    return clean;
  }
  return `=?UTF-8?B?${Buffer.from(clean, "utf-8").toString("base64")}?=`;
}

function sanitizeAttachmentFilename(filename: string): string {
  const clean = sanitizeHeaderValue(filename)
    .replace(/["\\/;]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_");
  return clean || "documento.pdf";
}

function wrapBase64Lines(base64: string): string {
  const clean = base64.replace(/\s+/g, "");
  return clean.replace(/(.{1,76})/g, "$1\r\n").trimEnd();
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildMultipartMixedMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: GmailAttachment[];
}): string {
  const boundary = `----=_NextPart_${crypto.randomBytes(16).toString("hex")}`;

  const headers = [
    `From: ${sanitizeHeaderValue(params.from)}`,
    `To: ${sanitizeHeaderValue(params.to)}`,
    `Subject: ${encodeRfc2047Header(params.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const htmlBase64 = wrapBase64Lines(Buffer.from(params.html, "utf-8").toString("base64"));

  const parts: string[] = [
    [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      htmlBase64,
    ].join("\r\n"),
  ];

  for (const att of params.attachments || []) {
    const rawBase64 = Buffer.isBuffer(att.content)
      ? att.content.toString("base64")
      : String(att.content || "").replace(/\s+/g, "");
    if (!rawBase64) continue;

    const safeName = sanitizeAttachmentFilename(att.filename);
    const contentType = sanitizeHeaderValue(att.contentType || "application/pdf");

    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${contentType}; name="${safeName}"`,
        `Content-Disposition: attachment; filename="${safeName}"`,
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64Lines(rawBase64),
      ].join("\r\n")
    );
  }

  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n--${boundary}--\r\n`;
}

interface GoogleTokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | string | null;
  scope: string | null;
  token_type: string | null;
  updated_at: string;
}

async function findAuthorizedProfessionalToken(): Promise<{
  tokenRow: GoogleTokenRow | null;
  configError?: string;
}> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      tokenRow: null,
      configError: "Cliente administrativo do Supabase não configurado.",
    };
  }

  const { data: tokenRows, error: tokenErr } = await supabase
    .from("google_tokens")
    .select("user_id, access_token, refresh_token, expiry_date, scope, token_type, updated_at")
    .ilike("scope", "%gmail.send%")
    .order("updated_at", { ascending: false });

  if (tokenErr) {
    console.error("[Gmail Service] Erro ao consultar google_tokens:", tokenErr);
    return { tokenRow: null };
  }

  const gmailRows = (tokenRows || []).filter((r) => hasGmailSendScope(r.scope));
  if (gmailRows.length === 0) {
    return { tokenRow: null };
  }

  const userIds = Array.from(new Set(gmailRows.map((r) => r.user_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, role")
    .in("id", userIds);

  const profileById = new Map<string, { id: string; email?: string | null; role?: string | null }>();
  for (const p of profiles || []) {
    profileById.set(p.id, p);
  }

  // Prioridade 1: conta da profissional julianasevieira@gmail.com
  const julianaRow = gmailRows.find((r) => {
    const prof = profileById.get(r.user_id);
    return prof?.email?.toLowerCase().trim() === PROFESSIONAL_GMAIL_EMAIL;
  });
  if (julianaRow) return { tokenRow: julianaRow };

  // Prioridade 2: perfil com role 'profissional'
  const profissionalRow = gmailRows.find((r) => {
    const prof = profileById.get(r.user_id);
    return String(prof?.role || "").toLowerCase().trim() === "profissional";
  });
  if (profissionalRow) return { tokenRow: profissionalRow };

  // Prioridade 3: perfil com role 'administrador'
  const adminRow = gmailRows.find((r) => {
    const prof = profileById.get(r.user_id);
    const role = String(prof?.role || "").toLowerCase().trim();
    return role === "administrador" || role === "admin";
  });
  if (adminRow) return { tokenRow: adminRow };

  // Contingência caso o registro em profiles não exista ainda: verifica auth.users
  for (const row of gmailRows) {
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(row.user_id);
      const email = authData?.user?.email?.toLowerCase().trim() || "";
      if (
        email === PROFESSIONAL_GMAIL_EMAIL ||
        email === "brunolpg@gmail.com" ||
        email.includes("juliana")
      ) {
        return { tokenRow: row };
      }
    } catch {
      // ignora erro de lookup individual
    }
  }

  return { tokenRow: null };
}

async function refreshGmailAccessToken(
  userId: string,
  refreshToken: string
): Promise<{ accessToken: string | null; requiresReauth: boolean; error?: string }> {
  const { clientId, clientSecret } = getGoogleOAuthClientConfig();
  if (!clientId || !clientSecret) {
    return {
      accessToken: null,
      requiresReauth: false,
      error: "Credenciais OAuth do Google (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) ausentes.",
    };
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.warn(`[Gmail Service] Falha ao renovar access_token (${res.status}): ${errText}`);
      const isRevokedOrInvalid = res.status === 400 || res.status === 401;
      return {
        accessToken: null,
        requiresReauth: isRevokedOrInvalid,
        error: "Autorização do Gmail expirada ou revogada. Reconecte a conta Google.",
      };
    }

    const data = await res.json();
    const newAccessToken: string | undefined = data.access_token;
    if (!newAccessToken) {
      return {
        accessToken: null,
        requiresReauth: true,
        error: "Google não retornou um novo access_token.",
      };
    }

    const expiresInSec = Number(data.expires_in || 3600);
    const newExpiryDate = Date.now() + expiresInSec * 1000;

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const updatePayload: Record<string, any> = {
        access_token: newAccessToken,
        expiry_date: newExpiryDate,
        updated_at: new Date().toISOString(),
      };
      if (data.token_type) {
        updatePayload.token_type = data.token_type;
      }
      if (data.refresh_token) {
        updatePayload.refresh_token = data.refresh_token;
      }

      const { error: updateErr } = await supabase
        .from("google_tokens")
        .update(updatePayload)
        .eq("user_id", userId);

      if (updateErr) {
        console.warn("[Gmail Service] Aviso ao atualizar token renovado no Supabase:", updateErr);
      }
    }

    return { accessToken: newAccessToken, requiresReauth: false };
  } catch (err: any) {
    console.error("[Gmail Service] Exceção ao renovar access_token:", err);
    return {
      accessToken: null,
      requiresReauth: false,
      error: err?.message || "Erro de rede ao renovar token do Gmail.",
    };
  }
}

export async function sendEmailViaGmail(
  params: SendEmailViaGmailParams
): Promise<SendEmailViaGmailResult> {
  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((addr) => sanitizeHeaderValue(String(addr || "")))
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      success: false,
      status: 400,
      code: "GMAIL_SEND_ERROR",
      error: "Destinatário de e-mail não informado.",
    };
  }

  const { tokenRow, configError } = await findAuthorizedProfessionalToken();
  if (configError) {
    return {
      success: false,
      status: 500,
      code: "GMAIL_CONFIG_ERROR",
      error: configError,
    };
  }

  if (!tokenRow) {
    return {
      success: false,
      status: 401,
      code: "GMAIL_AUTH_REQUIRED",
      authUrl: "/api/auth/google",
      error: `Conta Gmail (${PROFESSIONAL_GMAIL_EMAIL}) ainda não conectada para envio de e-mails.`,
    };
  }

  let accessToken = tokenRow.access_token;
  const rawExpiry = tokenRow.expiry_date ? Number(tokenRow.expiry_date) : 0;
  const expiryMs = rawExpiry > 0 && rawExpiry < 1e12 ? rawExpiry * 1000 : rawExpiry;
  const isExpired = !accessToken || !expiryMs || expiryMs <= Date.now() + 60_000;

  if (isExpired) {
    if (!tokenRow.refresh_token) {
      return {
        success: false,
        status: 401,
        code: "GMAIL_AUTH_REQUIRED",
        authUrl: "/api/auth/google",
        error: `Token do Gmail expirado. Conecte novamente a conta ${PROFESSIONAL_GMAIL_EMAIL}.`,
      };
    }

    const refreshed = await refreshGmailAccessToken(tokenRow.user_id, tokenRow.refresh_token);
    if (!refreshed.accessToken) {
      if (refreshed.requiresReauth) {
        return {
          success: false,
          status: 401,
          code: "GMAIL_AUTH_REQUIRED",
          authUrl: "/api/auth/google",
          error: refreshed.error || "Autorização do Gmail expirada. Reconecte a conta.",
        };
      }
      return {
        success: false,
        status: 500,
        code: "GMAIL_CONFIG_ERROR",
        error: refreshed.error || "Falha ao renovar credenciais do Gmail.",
      };
    }
    accessToken = refreshed.accessToken;
  }

  const fromEmail = params.fromEmail || PROFESSIONAL_GMAIL_EMAIL;
  const fromName = params.fromName || PROFESSIONAL_DISPLAY_NAME;
  const fromHeader = `${fromName} <${fromEmail}>`;

  const mimeMessage = buildMultipartMixedMimeMessage({
    from: fromHeader,
    to: recipients.join(", "),
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });

  const raw = toBase64Url(mimeMessage);

  const attemptSend = async (token: string) =>
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

  let gmailRes = await attemptSend(accessToken);

  // Se o token foi rejeitado com 401, tenta uma única renovação via refresh_token
  if (gmailRes.status === 401 && tokenRow.refresh_token) {
    const retryRefresh = await refreshGmailAccessToken(tokenRow.user_id, tokenRow.refresh_token);
    if (retryRefresh.accessToken) {
      accessToken = retryRefresh.accessToken;
      gmailRes = await attemptSend(accessToken);
    } else if (retryRefresh.requiresReauth) {
      return {
        success: false,
        status: 401,
        code: "GMAIL_AUTH_REQUIRED",
        authUrl: "/api/auth/google",
        error: "Autorização do Gmail expirada ou revogada. Reconecte a conta.",
      };
    }
  }

  if (gmailRes.status === 401 || gmailRes.status === 403) {
    const errText = await gmailRes.text().catch(() => gmailRes.statusText);
    console.warn(`[Gmail API] Acesso negado (${gmailRes.status}): ${errText}`);
    return {
      success: false,
      status: 401,
      code: "GMAIL_AUTH_REQUIRED",
      authUrl: "/api/auth/google",
      error: `Permissão do Gmail necessária para ${PROFESSIONAL_GMAIL_EMAIL}. Conecte a conta novamente.`,
    };
  }

  if (!gmailRes.ok) {
    const errText = await gmailRes.text().catch(() => gmailRes.statusText);
    console.error(`[Gmail API] Erro ao enviar mensagem (${gmailRes.status}): ${errText}`);
    return {
      success: false,
      status: 502,
      code: "GMAIL_SEND_ERROR",
      error: errText || "Falha ao enviar e-mail pela Gmail API.",
    };
  }

  const data = await gmailRes.json().catch(() => ({}));
  return {
    success: true,
    messageId: data.id || "",
    threadId: data.threadId,
    sender: fromEmail,
  };
}
