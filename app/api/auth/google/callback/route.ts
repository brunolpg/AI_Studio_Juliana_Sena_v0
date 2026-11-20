import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getGmailRedirectUri,
  getGoogleOAuthClientConfig,
  sanitizeReturnToPath,
  verifySignedOAuthState,
} from "@/lib/google-gmail/gmail-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildRedirectUrl(requestUrl: string, returnPath: string, params: Record<string, string>) {
  const url = new URL(sanitizeReturnToPath(returnPath, "/clinical"), requestUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");
  const stateParam = reqUrl.searchParams.get("state");
  const oauthError = reqUrl.searchParams.get("error");

  const parsedState = verifySignedOAuthState(stateParam);
  const returnTo = parsedState?.returnTo || "/clinical";

  if (oauthError) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, returnTo, { gmail_error: oauthError })
    );
  }

  const user = await getSession();
  if (!user) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, "/login", { gmail_error: "unauthenticated" })
    );
  }

  const role = String(user.role || "").toLowerCase().trim();
  if (role !== "profissional" && role !== "administrador") {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, "/", { gmail_error: "forbidden" })
    );
  }

  if (!parsedState || parsedState.userId !== user.id) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, returnTo, { gmail_error: "invalid_state" })
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildRedirectUrl(request.url, returnTo, { gmail_error: "missing_code" })
    );
  }

  const { clientId, clientSecret } = getGoogleOAuthClientConfig();
  if (!clientId || !clientSecret) {
    console.error("[Google OAuth Callback] GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET ausentes.");
    return NextResponse.redirect(
      buildRedirectUrl(request.url, returnTo, { gmail_error: "missing_credentials" })
    );
  }

  try {
    const redirectUri = getGmailRedirectUri(request);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => tokenRes.statusText);
      console.error("[Google OAuth Callback] Erro na troca de código por token:", tokenRes.status, errBody);
      return NextResponse.redirect(
        buildRedirectUrl(request.url, returnTo, { gmail_error: "token_exchange_failed" })
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    const newRefreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn = Number(tokenData.expires_in || 3600);
    const returnedScope: string = String(tokenData.scope || "");
    const tokenType: string = String(tokenData.token_type || "Bearer");

    if (!accessToken) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, returnTo, { gmail_error: "missing_access_token" })
      );
    }

    if (!returnedScope.includes("gmail.send")) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, returnTo, { gmail_error: "missing_gmail_scope" })
      );
    }

    // Identifica o e-mail Google autorizado
    let authorizedEmail = "";
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        authorizedEmail = String(userInfo?.email || "").trim().toLowerCase();
      }
    } catch (infoErr) {
      console.warn("[Google OAuth Callback] Aviso ao consultar userinfo:", infoErr);
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.redirect(
        buildRedirectUrl(request.url, returnTo, { gmail_error: "supabase_admin_unavailable" })
      );
    }

    // Preserva refresh_token e escopos anteriores caso o Google não envie novo refresh_token
    const { data: existingToken } = await admin
      .from("google_tokens")
      .select("refresh_token, scope, calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const mergedScopes = Array.from(
      new Set(
        [...(existingToken?.scope || "").split(/\s+/), ...returnedScope.split(/\s+/)]
          .map((s) => s.trim())
          .filter(Boolean)
      )
    ).join(" ");

    const expiryDate = Date.now() + expiresIn * 1000;
    const finalRefreshToken = newRefreshToken || existingToken?.refresh_token || null;

    const { error: upsertErr } = await admin.from("google_tokens").upsert(
      {
        user_id: user.id,
        access_token: accessToken,
        refresh_token: finalRefreshToken,
        expiry_date: expiryDate,
        scope: mergedScopes || returnedScope,
        token_type: tokenType,
        calendar_id: existingToken?.calendar_id || "primary",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      console.error("[Google OAuth Callback] Erro ao persistir tokens em google_tokens:", upsertErr);
      return NextResponse.redirect(
        buildRedirectUrl(request.url, returnTo, { gmail_error: "db_persist_failed" })
      );
    }

    const redirectParams: Record<string, string> = { gmail_connected: "1" };
    if (authorizedEmail) {
      redirectParams.gmail_account = authorizedEmail;
    }

    return NextResponse.redirect(buildRedirectUrl(request.url, returnTo, redirectParams));
  } catch (err) {
    console.error("[Google OAuth Callback] Exceção inesperada:", err);
    return NextResponse.redirect(
      buildRedirectUrl(request.url, returnTo, { gmail_error: "unexpected_error" })
    );
  }
}
