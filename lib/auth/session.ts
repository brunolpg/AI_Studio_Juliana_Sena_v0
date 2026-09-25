import { cookies } from "next/headers";
import { verifyAuthToken } from "./jwt";
import type { User } from "@/types/auth";

export const SESSION_COOKIE_NAME = "auth_session_token";

/**
 * Grava o cookie HTTP-only seguro com o JWT assinado
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias em segundos
  });
}

/**
 * Remove o cookie de sessão para efetuar logout
 */
export async function removeSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Obtém o usuário atualmente autenticado a partir do token JWT no cookie
 */
export async function getSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    return await verifyAuthToken(token);
  } catch (error) {
    return null;
  }
}

/**
 * Garante que uma requisição/ação no servidor seja executada apenas por usuário autenticado
 */
export async function requireAuth(): Promise<User> {
  const user = await getSession();
  if (!user) {
    throw new Error("Não autorizado. Faça login para realizar esta ação.");
  }
  return user;
}
