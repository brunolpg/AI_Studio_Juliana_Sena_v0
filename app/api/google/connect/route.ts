import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/google-calendar/oauth-sync-service";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/?error=supabase_not_configured", req.url));
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userRole = profile?.role || (user.email === "brunolpg@gmail.com" ? "administrador" : user.email?.includes("juliana") ? "profissional" : "paciente");
  if (userRole !== "administrador" && userRole !== "profissional") {
    return NextResponse.redirect(new URL("/?error=unauthorized_role", req.url));
  }

  const oauth2Client = getOAuthClient();
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}
