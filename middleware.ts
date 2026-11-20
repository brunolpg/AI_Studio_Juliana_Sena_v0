import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project")) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (
      pathname.startsWith("/patients") ||
      pathname.startsWith("/clinical") ||
      pathname.startsWith("/dashboard")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  let role = String(profile?.role || "").toLowerCase().trim();
  if (!role) {
    const email = (user.email || "").toLowerCase();
    role =
      email === "brunolpg@gmail.com" || email.includes("admin")
        ? "administrador"
        : "paciente";
  }

  // Bloqueio estrito: administrador não acessa listagem/detalhes de pacientes nem prontuário/evoluções
  if (role === "administrador" || role === "admin") {
    if (
      pathname.startsWith("/patients") ||
      pathname.startsWith("/clinical") ||
      pathname === "/dashboard"
    ) {
      return NextResponse.redirect(new URL("/appointments", request.url));
    }
  }

  // Paciente autenticado é mantido no portal inicial (/)
  if (role === "paciente") {
    if (
      pathname.startsWith("/patients") ||
      pathname.startsWith("/clinical") ||
      pathname.startsWith("/appointments") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/pops")
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/patients/:path*",
    "/clinical/:path*",
    "/dashboard/:path*",
    "/appointments/:path*",
    "/pops/:path*",
  ],
};
