"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, clientFilterSchema } from "@/lib/validations/client-schema";
import { calculateAge } from "@/lib/brazil-data";
import { getSession } from "@/lib/auth/session";
import type {
  Client,
  ClientInput,
  ClientFilter,
  PaginatedResult,
  ActionResponse,
} from "@/types/client";

/**
 * Normaliza erros do Zod em um mapa chave/valor amigável
 */
function formatZodErrors(errors: unknown): Record<string, string[]> {
  if (typeof errors === "object" && errors !== null && "issues" in errors) {
    const issues = (errors as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const formatted: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "geral";
      if (!formatted[key]) {
        formatted[key] = [];
      }
      formatted[key].push(issue.message);
    }
    return formatted;
  }
  return { geral: ["Erro de validação nos dados fornecidos."] };
}

const PATIENT_LIST_COLUMNS = `
  id,
  nome,
  data_nascimento,
  idade,
  email,
  sexo,
  telefone,
  cpf,
  cep,
  logradouro,
  numero,
  complemento,
  estado,
  cidade,
  profissao,
  status,
  observacoes,
  created_at,
  updated_at,
  deleted_at
`;

const PATIENT_SELECTOR_COLUMNS = `
  id,
  nome,
  data_nascimento,
  idade,
  email,
  sexo,
  telefone,
  cpf,
  cep,
  logradouro,
  numero,
  complemento,
  estado,
  cidade,
  profissao,
  status,
  observacoes,
  created_at,
  updated_at,
  deleted_at
`;

function isStaffRole(role?: string | null): boolean {
  const normalized = String(role || "").toLowerCase().trim();
  return normalized === "profissional" || normalized === "administrador" || normalized === "admin";
}

function sanitizePostgrestSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[%_(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSupabasePatientError(error: { code?: string; message?: string; hint?: string }, context: string): string {
  const code = error.code || "";
  const msg = error.message || "Erro desconhecido";
  const isRlsOrPermission =
    code === "42501" ||
    code === "PGRST301" ||
    /row-level security|permission denied|insufficient_privilege|not allowed|jwt/i.test(msg);

  if (isRlsOrPermission) {
    return `Permissão/RLS negada ao ${context} (${code || "RLS"}): ${msg}. Verifique as políticas SELECT de public.pacientes para o perfil profissional/administrador.`;
  }

  return `Erro ao ${context}: ${msg}${code ? ` (${code})` : ""}`;
}

async function resolveStaffClientContext(): Promise<
  | {
      authorized: true;
      sessionUser: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      db: NonNullable<Awaited<ReturnType<typeof createClient>>>;
      isAdminRole: boolean;
    }
  | { authorized: false; message: string }
> {
  const serverClient = await createClient();
  if (!serverClient) {
    return { authorized: false, message: "Banco de dados não disponível." };
  }

  const sessionUser = await getSession(serverClient);
  if (!sessionUser) {
    return {
      authorized: false,
      message: "Sessão expirada ou não autenticada. Faça login novamente para acessar a lista de pacientes.",
    };
  }

  if (!isStaffRole(sessionUser.role)) {
    return {
      authorized: false,
      message: "Acesso restrito aos perfis Profissional e Administrador.",
    };
  }

  const adminClient = getSupabaseAdminClient();
  const db = adminClient || serverClient;

  return {
    authorized: true,
    sessionUser,
    db,
    isAdminRole: sessionUser.role === "administrador",
  };
}

async function enrichPatientsWithProfileAvatars(
  db: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  rows: Client[],
  isAdminRole: boolean
): Promise<Client[]> {
  if (isAdminRole || rows.length === 0) {
    return rows.map((c) => ({
      ...c,
      avatar_url: null,
      foto_perfil: null,
    }));
  }

  const emails = Array.from(
    new Set(rows.map((c) => c.email?.toLowerCase().trim()).filter((e): e is string => Boolean(e)))
  );

  const profilesMap = new Map<string, string>();
  if (emails.length > 0) {
    try {
      const { data: profiles } = await db
        .from("profiles")
        .select("email, avatar_url")
        .in("email", emails);

      if (profiles) {
        for (const pr of profiles) {
          if (pr.email && pr.avatar_url) {
            profilesMap.set(pr.email.toLowerCase().trim(), pr.avatar_url);
          }
        }
      }
    } catch (profErr) {
      console.warn("Falha ao buscar avatar_url em profiles:", profErr);
    }
  }

  return rows.map((c) => {
    const email = (c.email || "").toLowerCase().trim();
    const avatar = c.avatar_url || profilesMap.get(email) || null;
    return {
      ...c,
      avatar_url: avatar,
      foto_perfil: undefined,
    };
  });
}

/**
 * 1. LISTAGEM COM BUSCA EM TEMPO REAL, FILTROS POR STATUS E PAGINAÇÃO
 */
export async function getClientsAction(
  rawFilters: Partial<ClientFilter>
): Promise<ActionResponse<PaginatedResult<Client>>> {
  try {
    const filterParsed = clientFilterSchema.safeParse(rawFilters);
    if (!filterParsed.success) {
      return {
        success: false,
        message: "Filtros inválidos",
        errors: formatZodErrors(filterParsed.error),
      };
    }

    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const { db, isAdminRole } = auth;
    const { search, status, page, pageSize, sortBy, sortOrder } = filterParsed.data;

    let query = db.from("pacientes").select(PATIENT_LIST_COLUMNS, { count: "exact" });

    // Filtro de Soft Delete e Status (sempre deleted_at IS NULL exceto na Lixeira)
    if (status === "excluidos") {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
      if (status === "Ativo" || status === "Inativo") {
        query = query.eq("status", status);
      }
    }

    // Busca textual em tempo real (Nome, CPF, E-mail ou Cidade)
    const sanitizedTerm = sanitizePostgrestSearch(search || "");
    if (sanitizedTerm.length > 0) {
      query = query.or(
        `nome.ilike.%${sanitizedTerm}%,cpf.ilike.%${sanitizedTerm}%,email.ilike.%${sanitizedTerm}%,cidade.ilike.%${sanitizedTerm}%`
      );
    }

    // Ordenação e paginação
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order(sortBy, { ascending: sortOrder === "asc" }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Erro Supabase getClientsAction:", error);
      return {
        success: false,
        message: formatSupabasePatientError(error, "listar pacientes"),
      };
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clientRows = (data as unknown as Client[]) || [];
    const enrichedClients = await enrichPatientsWithProfileAvatars(db, clientRows, isAdminRole);

    return {
      success: true,
      data: {
        data: enrichedClients,
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    console.error("Erro inesperado em getClientsAction:", error);
    return {
      success: false,
      message: `Ocorreu um erro interno ao listar pacientes: ${(error as Error).message}`,
    };
  }
}

/**
 * 1B. LISTAGEM ENXUTA DE PACIENTES ATIVOS PARA SELETOR DE PRONTUÁRIOS
 * Sem select("*") e sem carregar blobs base64 de foto_perfil.
 */
export async function getActivePatientsForSelectorAction(): Promise<ActionResponse<Client[]>> {
  try {
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const { db, isAdminRole } = auth;

    const { data, error } = await db
      .from("pacientes")
      .select(PATIENT_SELECTOR_COLUMNS)
      .is("deleted_at", null)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase getActivePatientsForSelectorAction:", error);
      return {
        success: false,
        message: formatSupabasePatientError(error, "carregar lista de pacientes para prontuários"),
      };
    }

    const rows = (data as unknown as Client[]) || [];
    const enriched = await enrichPatientsWithProfileAvatars(db, rows, isAdminRole);

    return {
      success: true,
      data: enriched,
    };
  } catch (error) {
    console.error("Erro inesperado em getActivePatientsForSelectorAction:", error);
    return {
      success: false,
      message: `Falha ao carregar lista de pacientes: ${(error as Error).message}`,
    };
  }
}

/**
 * 2. BUSCA POR ID (inclui foto_perfil sob demanda para edição no perfil profissional)
 */
export async function getClientByIdAction(id: string): Promise<ActionResponse<Client>> {
  try {
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const { db, isAdminRole } = auth;
    const columns = isAdminRole
      ? PATIENT_LIST_COLUMNS
      : `${PATIENT_LIST_COLUMNS}, foto_perfil`;

    const { data, error } = await db
      .from("pacientes")
      .select(columns)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Erro Supabase getClientByIdAction:", error);
      return {
        success: false,
        message: formatSupabasePatientError(error, "buscar dados do paciente"),
      };
    }

    if (!data) {
      return {
        success: false,
        message: "Cliente/Paciente não encontrado no banco de dados.",
      };
    }

    const clientData = data as unknown as Client;

    return {
      success: true,
      data: isAdminRole
        ? { ...clientData, avatar_url: null, foto_perfil: null }
        : clientData,
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao buscar paciente: ${(error as Error).message}`,
    };
  }
}

/**
 * 3. CRIAÇÃO DE PACIENTE COM VALIDAÇÃO ZOD E CÁLCULO SEGURO DE IDADE
 */
export async function createClientAction(
  rawInput: unknown
): Promise<ActionResponse<Client>> {
  try {
    // 0. Verificação de autorização baseada em sessão JWT (profissional ou administrador)
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    // 1. Validação estrita dos dados recebidos via Zod
    const validationResult = clientSchema.safeParse(rawInput);
    if (!validationResult.success) {
      return {
        success: false,
        message: "Por favor, corrija os erros no formulário antes de salvar.",
        errors: formatZodErrors(validationResult.error),
      };
    }

    const validData: ClientInput = validationResult.data;

    // 2. Garantia de integridade no servidor: recalcula a idade a partir da data de nascimento
    const calculatedAge = calculateAge(validData.data_nascimento);
    if (calculatedAge === null) {
      return {
        success: false,
        message: "Data de nascimento inválida.",
        errors: { data_nascimento: ["Não foi possível calcular a idade do paciente."] },
      };
    }
    validData.idade = calculatedAge;

    const { db, isAdminRole } = auth;

    // Verifica duplicidade de CPF ativo
    const { data: existingCpf } = await db
      .from("pacientes")
      .select("id")
      .eq("cpf", validData.cpf)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCpf) {
      return {
        success: false,
        message: "Já existe um paciente ativo cadastrado com este CPF.",
        errors: { cpf: ["Este CPF já está registrado para outro paciente ativo."] },
      };
    }

    const insertPayload = isAdminRole
      ? { ...validData, foto_perfil: null, deleted_at: null }
      : { ...validData, foto_perfil: validData.foto_perfil ?? null, deleted_at: null };

    const { data, error } = await db
      .from("pacientes")
      .insert([insertPayload])
      .select(PATIENT_LIST_COLUMNS)
      .single();

    if (error) {
      console.error("Erro Supabase createClient:", error);
      return {
        success: false,
        message: formatSupabasePatientError(error, "salvar paciente"),
      };
    }

    revalidatePath("/");
    const createdClient = data as unknown as Client;
    return {
      success: true,
      message: "Paciente cadastrado com sucesso!",
      data: isAdminRole
        ? { ...createdClient, avatar_url: null, foto_perfil: null }
        : createdClient,
    };
  } catch (error) {
    console.error("Erro em createClientAction:", error);
    return {
      success: false,
      message: `Erro interno do servidor: ${(error as Error).message}`,
    };
  }
}

/**
 * 4. ATUALIZAÇÃO DE PACIENTE (EDIÇÃO COMPLETA)
 */
export async function updateClientAction(
  id: string,
  rawInput: unknown
): Promise<ActionResponse<Client>> {
  try {
    if (!id) {
      return { success: false, message: "ID do paciente é obrigatório." };
    }

    // 0. Verificação de autorização baseada em sessão JWT (profissional ou administrador)
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    // Validação Zod
    const validationResult = clientSchema.safeParse(rawInput);
    if (!validationResult.success) {
      return {
        success: false,
        message: "Verifique os erros nos campos informados.",
        errors: formatZodErrors(validationResult.error),
      };
    }

    const validData: ClientInput = validationResult.data;

    // Recalcula idade no servidor
    const calculatedAge = calculateAge(validData.data_nascimento);
    if (calculatedAge === null) {
      return {
        success: false,
        message: "Data de nascimento inválida.",
        errors: { data_nascimento: ["Não foi possível calcular a idade."] },
      };
    }
    validData.idade = calculatedAge;

    const { db, isAdminRole } = auth;

    // Verifica duplicidade de CPF com outro paciente ativo
    const { data: existingCpf } = await db
      .from("pacientes")
      .select("id")
      .eq("cpf", validData.cpf)
      .neq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingCpf) {
      return {
        success: false,
        message: "Este CPF já está cadastrado para outro paciente.",
        errors: { cpf: ["CPF já em uso por outro cadastro."] },
      };
    }

    const { foto_perfil, ...validDataWithoutPhoto } = validData;
    const shouldUpdatePhoto = !isAdminRole && foto_perfil !== undefined;
    const updatePayload = shouldUpdatePhoto
      ? { ...validDataWithoutPhoto, foto_perfil, updated_at: new Date().toISOString() }
      : { ...validDataWithoutPhoto, updated_at: new Date().toISOString() };

    const { data, error } = await db
      .from("pacientes")
      .update(updatePayload)
      .eq("id", id)
      .select(PATIENT_LIST_COLUMNS)
      .single();

    if (error) {
      return {
        success: false,
        message: formatSupabasePatientError(error, "atualizar paciente"),
      };
    }

    revalidatePath("/");
    const updatedClient = data as unknown as Client;
    return {
      success: true,
      message: "Dados do paciente atualizados com sucesso!",
      data: isAdminRole
        ? { ...updatedClient, avatar_url: null, foto_perfil: null }
        : updatedClient,
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao atualizar paciente: ${(error as Error).message}`,
    };
  }
}

/**
 * 5. EXCLUSÃO LÓGICA (SOFT DELETE)
 * Atualiza o campo deleted_at com a data/hora atual e inativa o status,
 * preservando o histórico de dados e auditoria no PostgreSQL.
 */
export async function softDeleteClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    if (!id) {
      return { success: false, message: "ID do paciente é obrigatório." };
    }

    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const now = new Date().toISOString();
    const { error } = await auth.db
      .from("pacientes")
      .update({
        deleted_at: now,
        status: "Inativo",
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        message: formatSupabasePatientError(error, "inativar paciente"),
      };
    }

    revalidatePath("/");
    return {
      success: true,
      message: "Paciente movido para a lixeira com sucesso!",
    };
  } catch (error) {
    return {
      success: false,
      message: `Falha na exclusão lógica: ${(error as Error).message}`,
    };
  }
}

/**
 * 6. RESTAURAÇÃO DE PACIENTE EXCLUÍDO
 */
export async function restoreClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const now = new Date().toISOString();
    const { error } = await auth.db
      .from("pacientes")
      .update({
        deleted_at: null,
        status: "Ativo",
        updated_at: now,
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        message: formatSupabasePatientError(error, "restaurar paciente"),
      };
    }

    revalidatePath("/");
    return {
      success: true,
      message: "Paciente restaurado com sucesso!",
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao restaurar: ${(error as Error).message}`,
    };
  }
}

/**
 * 7. EXCLUSÃO DEFINITIVA (HARD DELETE)
 */
export async function permanentDeleteClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    const auth = await resolveStaffClientContext();
    if (!auth.authorized) {
      return {
        success: false,
        message: auth.message,
      };
    }

    const { error } = await auth.db.from("pacientes").delete().eq("id", id);
    if (error) {
      return {
        success: false,
        message: formatSupabasePatientError(error, "excluir paciente permanentemente"),
      };
    }

    revalidatePath("/");
    return {
      success: true,
      message: "Registro excluído permanentemente do banco de dados.",
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao excluir permanentemente: ${(error as Error).message}`,
    };
  }
}
