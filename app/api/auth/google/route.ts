import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  GMAIL_OAUTH_SCOPES,
  PROFESSIONAL_GMAIL_EMAIL,
  createSignedOAuthState,
  getGmailRedirectUri,
  getGoogleOAuthClientConfig,
  sanitizeReturnToPath,
} from "@/lib/google-gmail/gmail-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "Sessão expirada. Faça login novamente." },
      { status: 401 }
    );
  }

  const role = String(user.role || "").toLowerCase().trim();
  if (role !== "profissional" && role !== "administrador") {
    return NextResponse.json(
      {
        success: false,
        message: "Apenas profissionais ou administradores podem conectar o Gmail da clínica.",
      },
      { status: 403 }
    );
  }

  const { clientId } = getGoogleOAuthClientConfig();
  if (!clientId) {
    return NextResponse.json(
      {
        success: false,
        message: "GOOGLE_CLIENT_ID não configurado no servidor.",
      },
      { status: 500 }
    );
  }

  const reqUrl = new URL(request.url);
  let rawReturnTo = reqUrl.searchParams.get("returnTo");

  if (!rawReturnTo) {
    const referer = request.headers.get("referer");
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.origin === reqUrl.origin) {
          rawReturnTo = refUrl.pathname;
        }
      } catch {
        // ignora referer inválido
      }
    }
  }

  const returnTo = sanitizeReturnToPath(rawReturnTo, "/clinical");
  const redirectUri = getGmailRedirectUri(request);
  const state = createSignedOAuthState({ userId: user.id, returnTo });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("login_hint", PROFESSIONAL_GMAIL_EMAIL);
  authUrl.searchParams.set("scope", GMAIL_OAUTH_SCOPES.join(" "));
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
