import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Aviso ao executar signOut no Supabase (rota de API de logout):", err);
      }
    }

    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      for (const cookie of allCookies) {
        if (
          cookie.name.startsWith("sb-") ||
          cookie.name.includes("auth") ||
          cookie.name.includes("token") ||
          cookie.name.includes("session")
        ) {
          try {
            cookieStore.delete(cookie.name);
          } catch {
            // Ignora erro de exclusão individual de cookie
          }
        }
      }
    } catch (cookieErr) {
      console.warn("Aviso ao limpar cookies na rota de logout:", cookieErr);
    }
  } catch (e) {
    console.warn("Aviso na rota de API de logout:", e);
  }

  return NextResponse.json(
    { success: true, message: "Sessão encerrada com sucesso." },
    { status: 200 }
  );
}
