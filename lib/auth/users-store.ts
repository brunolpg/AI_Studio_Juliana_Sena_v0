import bcrypt from "bcryptjs";
import type { User } from "@/types/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/client";

export interface StoredUser extends User {
  passwordHash: string;
}

// Senha padrão hasheada com salt (rounds = 10)
// Senhas originais:
// juliana.sena@clinica.com -> Clinica@2025
// admin@clinica.com        -> Admin@1234
// recepcao@clinica.com     -> Recepcao@2025
const INITIAL_USERS: StoredUser[] = [
  {
    id: "usr-juliana-001",
    name: "Dra. Juliana Sena",
    email: "juliana.sena@clinica.com",
    role: "medico",
    roleLabel: "Médica / Especialista",
    created_at: "2025-01-10T08:00:00.000Z",
    // bcrypt hash para "Clinica@2025"
    passwordHash: "$2b$10$vB5JvMYAMN33XXyufpLznuHEjwOh5k9amDYBMcewluDloijyJS0N6",
  },
  {
    id: "usr-admin-002",
    name: "Bruno Gonçalves",
    email: "admin@clinica.com",
    role: "admin",
    roleLabel: "Administrador do Sistema",
    created_at: "2025-01-10T08:00:00.000Z",
    // bcrypt hash para "Admin@1234"
    passwordHash: "$2b$10$0O/Q/jIPobngnp/RNiAHZ.kOWJwb0AUGZwqBWEjIPKlTQr083vQuC",
  },
  {
    id: "usr-recepcao-003",
    name: "Mariana Costa",
    email: "recepcao@clinica.com",
    role: "recepcionista",
    roleLabel: "Recepção & Triagem",
    created_at: "2025-02-15T09:30:00.000Z",
    // bcrypt hash para "Recepcao@2025"
    passwordHash: "$2b$10$KYOyVyxmZFrBuJIAKhwJZ.hwrEUaPtFMXdAedbH9v9Ed7K7Gwe0qG",
  },
];

// Armazenamento em memória com persistência durante a vida da aplicação
let memoryUsers: StoredUser[] = [...INITIAL_USERS];

export async function hashPassword(plainText: string): Promise<string> {
  return await bcrypt.hash(plainText, 10);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainText, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Busca usuário por e-mail (no Supabase ou fallback em memória)
 */
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("email", normalized)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role || "usuario",
          roleLabel: data.role_label || "Usuário",
          created_at: data.created_at,
          passwordHash: data.password_hash,
        };
      }
    } catch {
      // Ignora erro se a tabela 'usuarios' ainda não foi criada no Supabase e usa memória
    }
  }

  const found = memoryUsers.find((u) => u.email.toLowerCase() === normalized);
  return found || null;
}

/**
 * Cria um novo usuário cadastrado com senha criptografada via bcrypt
 */
export async function createUserRecord(params: {
  name: string;
  email: string;
  password: string;
  role?: User["role"];
}): Promise<User> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const passwordHash = await hashPassword(params.password);

  const role = params.role || "medico";
  const roleLabelMap: Record<User["role"], string> = {
    admin: "Administrador do Sistema",
    medico: "Médico(a) / Especialista",
    recepcionista: "Recepção & Triagem",
    usuario: "Usuário Autorizado",
  };
  const roleLabel = roleLabelMap[role] || "Usuário Autorizado";
  const now = new Date().toISOString();

  const newUser: StoredUser = {
    id: `usr-${crypto.randomUUID()}`,
    name: params.name.trim(),
    email: normalizedEmail,
    role,
    roleLabel,
    created_at: now,
    passwordHash,
  };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .insert([
          {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            role_label: newUser.roleLabel,
            password_hash: newUser.passwordHash,
            created_at: now,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
          roleLabel: data.role_label,
          created_at: data.created_at,
        };
      }
    } catch {
      // Falha gracefully para memória
    }
  }

  memoryUsers.unshift(newUser);

  // Retorna sem o hash da senha por segurança
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    roleLabel: newUser.roleLabel,
    created_at: newUser.created_at,
  };
}
