import { SignJWT, jwtVerify } from "jose";
import type { User } from "@/types/auth";

const JWT_SECRET_STRING =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  "juliana-sena-jwt-super-secret-key-production-ready-2025-token-auth";

const SECRET_KEY = new TextEncoder().encode(JWT_SECRET_STRING);
const ISSUER = "juliana-sena-gestao";
const AUDIENCE = "juliana-sena-app";

export interface JWTPayloadUser {
  sub: string;
  name: string;
  email: string;
  role: User["role"];
  roleLabel: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Gera um token JWT assinado criptograficamente com validade de 7 dias
 */
export async function createAuthToken(user: User): Promise<string> {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    created_at: user.created_at,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  return token;
}

/**
 * Valida o token JWT e extrai o perfil do usuário autenticado
 */
export async function verifyAuthToken(token: string): Promise<User | null> {
  try {
    if (!token || typeof token !== "string") return null;

    const { payload } = await jwtVerify(token, SECRET_KEY, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    if (!payload || !payload.sub) return null;

    const user: User = {
      id: String(payload.sub),
      name: String(payload.name || "Usuário"),
      email: String(payload.email || ""),
      role: (payload.role as User["role"]) || "usuario",
      roleLabel: String(payload.roleLabel || "Usuário"),
      created_at: String(payload.created_at || new Date().toISOString()),
    };

    return user;
  } catch (error) {
    // Token inválido, adulterado ou expirado
    return null;
  }
}
