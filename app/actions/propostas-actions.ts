"use server";

import { revalidatePath } from "next/cache";
import { requireProfissionalAccess, verifyProfissionalOrOwnPaciente } from "@/lib/auth/session";
import { generatePropostaHash } from "@/lib/hash-proposta";
import type {
  Proposta,
  PropostaInput,
  PropostaActionResult,
} from "@/types/proposta";

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

    const auth = await verifyProfissionalOrOwnPaciente(pacienteId);
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const activeDb = auth.supabase;

    // Valida paciente ativo (deleted_at IS NULL) e consulta propostas em paralelo com projeção enxuta
    const [
      { data: paciente, error: pacError },
      { data: propostas, error: propError },
    ] = await Promise.all([
      activeDb
        .from("pacientes")
        .select("id")
        .eq("id", pacienteId)
        .is("deleted_at", null)
        .maybeSingle(),
      activeDb
        .from("propostas")
        .select(
          "id, paciente_id, titulo, objetivo, opcoes, cronograma, topicos, status, justificativa_suspensao, data_suspensao, profissional, payload_hash, algoritmo, assinado_em, created_at, updated_at"
        )
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false }),
    ]);

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

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

    // 1. Valida permissão estrita para perfil profissional
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const db = auth.supabase;

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

    // 1. Valida permissão estrita para perfil profissional
    const auth = await requireProfissionalAccess();
    if (!auth.authorized) {
      return {
        success: false,
        error: auth.message,
        message: auth.message,
      };
    }

    const db = auth.supabase;

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
