import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function jsonError(status: number, message: string) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Receitas (baixar PDF / anexar assinada) são restritas à equipe da clínica.
 * Devolve uma resposta de erro pronta, ou null se o acesso está liberado.
 */
export async function denyUnlessStaff(): Promise<NextResponse | null> {
  const user = await getSession();
  if (!user) return jsonError(401, "Sessão expirada. Faça login novamente.");
  if (user.role === "paciente") return jsonError(403, "Sem permissão para esta ação.");
  return null;
}
