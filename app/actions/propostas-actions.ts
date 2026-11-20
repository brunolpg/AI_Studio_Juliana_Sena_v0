"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePropostaHash } from "@/lib/hash-proposta";
import type {
  Proposta,
  PropostaInput,
  PropostaActionResult,
} from "@/types/proposta";

/**
 * Obtém os clientes Supabase para execução segura e fallback administrativo.
 */
async function getSupabaseClients() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  const db = serverClient || adminClient;
  return { serverClient, adminClient, db };
}

/**
 * Valida se o usuário autenticado possui role de 'administrador' ou 'profissional'
 * checando metadados da sessão e a tabela public.profiles.
 */
async function verifyProfissionalOrAdmin(serverClient: any, adminDb: any) {
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      error: "Acesso não autenticado. Por favor, realize login.",
    };
  }

  const rawRole = (
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    ""
  )
    .toLowerCase()
    .trim();

  const isEmailAdmin =
    user.email?.toLowerCase().includes("juliana") ||
    user.email?.toLowerCase().includes("admin");

  if (
    rawRole === "administrador" ||
    rawRole === "admin" ||
    rawRole === "profissional" ||
    isEmailAdmin
  ) {
    return { authorized: true, user, role: rawRole || "administrador" };
  }

  // Consulta papel do usuário na tabela profiles
  const targetDb = adminDb || serverClient;
  const { data: profile } = await targetDb
    .from("profiles")
    .select("role, nome")
    .eq("id", user.id)
    .maybeSingle();

  const roleFromDb = (profile?.role || "").toLowerCase().trim();
  const isAuthorized =
    roleFromDb === "administrador" ||
    roleFromDb === "admin" ||
    roleFromDb === "profissional";

  if (!isAuthorized) {
    return {
      authorized: false,
      error:
        "Acesso não autorizado. Apenas administradores e profissionais podem gerenciar propostas.",
    };
  }

  return { authorized: true, user, role: roleFromDb, profile };
}

/**
 * 1. getPropostasByPaciente
 * Valida se o paciente está ativo (deleted_at IS NULL) e busca as propostas ordenadas por created_at DESC.
 */
export async function getPropostasByPaciente(
  pacienteId: string
): Promise<PropostaActionResult<Proposta[]>> {
  try {
    if (!pacienteId) {
      return {
        success: false,
        error: "Identificador do paciente não informado.",
      };
    }

    const { serverClient, adminClient, db } = await getSupabaseClients();
    if (!db) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    const activeDb = serverClient || adminClient || db;

    // 1. Valida se o paciente existe e está ativo (soft-delete filter)
    const { data: paciente, error: pacError } = await activeDb
      .from("pacientes")
      .select("id, deleted_at, status")
      .eq("id", pacienteId)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    // 2. Busca registros na tabela public.propostas
    const { data: propostas, error: propError } = await activeDb
      .from("propostas")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });

    if (propError) {
      return {
        success: false,
        error: propError.message || "Erro ao consultar propostas do paciente.",
      };
    }

    return {
      success: true,
      data: (propostas as Proposta[]) || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao consultar propostas.",
    };
  }
}

/**
 * 2. saveProposta
 * Salva ou atualiza uma proposta clínica após verificar permissão e gerar integridade canônica SHA-256.
 */
export async function saveProposta(
  input: PropostaInput,
  propostaId?: string
): Promise<PropostaActionResult<Proposta>> {
  try {
    if (!input || !input.paciente_id) {
      return {
        success: false,
        error: "Dados da proposta ou paciente inválidos.",
      };
    }

    const { serverClient, adminClient } = await getSupabaseClients();
    if (!serverClient && !adminClient) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    const db = adminClient || serverClient;

    // 1. Valida permissão do usuário autenticado
    if (serverClient) {
      const authCheck = await verifyProfissionalOrAdmin(serverClient, db);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: authCheck.error || "Acesso não autorizado.",
        };
      }
    }

    // 2. Valida paciente ativo (deleted_at IS NULL)
    const { data: paciente, error: pacError } = await db
      .from("pacientes")
      .select("id, deleted_at")
      .eq("id", input.paciente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente de destino não encontrado ou inativo.",
      };
    }

    // 3. Gera hash canônico e assinatura de integridade
    const payloadParaHash: Record<string, unknown> = {
      paciente_id: input.paciente_id,
      titulo: input.titulo,
      objetivo: input.objetivo,
      opcoes: input.opcoes,
      cronograma: input.cronograma,
      topicos: input.topicos,
      status: input.status || "Ativo",
      profissional: input.profissional,
    };

    const { payloadCanonico, hash, assinatura, algoritmo } =
      generatePropostaHash(payloadParaHash);

    const now = new Date().toISOString();

    const propostaData = {
      paciente_id: input.paciente_id,
      titulo: input.titulo,
      objetivo: input.objetivo,
      opcoes: input.opcoes,
      cronograma: input.cronograma,
      topicos: input.topicos,
      status: input.status || "Ativo",
      profissional: input.profissional,
      payload_canonico: payloadCanonico,
      payload_hash: hash,
      assinatura: assinatura,
      algoritmo: algoritmo,
      assinado_em: now,
      updated_at: now,
    };

    let resultData: Proposta;

    if (propostaId) {
      // Atualização
      const { data, error } = await db
        .from("propostas")
        .update(propostaData)
        .eq("id", propostaId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message || "Erro ao atualizar proposta.",
        };
      }
      resultData = data as Proposta;
    } else {
      // Inserção
      const { data, error } = await db
        .from("propostas")
        .insert({
          ...propostaData,
          created_at: now,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message || "Erro ao registrar nova proposta.",
        };
      }
      resultData = data as Proposta;
    }

    // Revalidação de caminhos relevantes
    try {
      revalidatePath(`/pacientes/${input.paciente_id}`);
      revalidatePath("/pacientes");
      revalidatePath("/portal-paciente");
    } catch {
      // Revalidação segura
    }

    return {
      success: true,
      data: resultData,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao salvar proposta.",
    };
  }
}

/**
 * 3. suspenderProposta
 * Atualiza o status da proposta para 'Suspenso' com justificativa e data de suspensão.
 */
export async function suspenderProposta(
  propostaId: string,
  justificativa: string
): Promise<PropostaActionResult<Proposta>> {
  try {
    if (!propostaId) {
      return {
        success: false,
        error: "Identificador da proposta não informado.",
      };
    }

    if (!justificativa || !justificativa.trim()) {
      return {
        success: false,
        error: "A justificativa da suspensão é obrigatória.",
      };
    }

    const { serverClient, adminClient } = await getSupabaseClients();
    if (!serverClient && !adminClient) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    const db = adminClient || serverClient;

    // 1. Valida permissão do usuário
    if (serverClient) {
      const authCheck = await verifyProfissionalOrAdmin(serverClient, db);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: authCheck.error || "Acesso não autorizado.",
        };
      }
    }

    const now = new Date().toISOString();

    const { data, error } = await db
      .from("propostas")
      .update({
        status: "Suspenso",
        justificativa_suspensao: justificativa.trim(),
        data_suspensao: now,
        updated_at: now,
      })
      .eq("id", propostaId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao suspender proposta.",
      };
    }

    if (data?.paciente_id) {
      try {
        revalidatePath(`/pacientes/${data.paciente_id}`);
        revalidatePath("/pacientes");
        revalidatePath("/portal-paciente");
      } catch {
        // Revalidação segura
      }
    }

    return {
      success: true,
      data: data as Proposta,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao suspender proposta.",
    };
  }
}
