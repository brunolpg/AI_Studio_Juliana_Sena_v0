import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, saveTokenForUser } from "@/lib/google-calendar/oauth-sync-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = req.cookies.get("google_oauth_state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_state", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_oauth_code", req.url));
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/?error=supabase_error", req.url));
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await saveTokenForUser(user.id, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope,
      token_type: tokens.token_type,
    });

    const response = NextResponse.redirect(new URL("/?google_connected=success", req.url));
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (err) {
    console.error("Erro no callback do Google OAuth:", err);
    return NextResponse.redirect(new URL("/?error=oauth_token_exchange_failed", req.url));
  }
}
