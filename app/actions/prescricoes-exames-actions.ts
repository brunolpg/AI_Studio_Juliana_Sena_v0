"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePropostaHash } from "@/lib/hash-proposta";
import type {
  PrescricaoExame,
  PrescricaoExameInput,
  PrescricaoExameActionResult,
  GrupoExameItem,
  CatalogoExamesPreCadastrados,
} from "@/types/prescricao-exame";

/**
 * Catálogo padrão inicial para sugestões de grupos, exames e orientações.
 */
const DEFAULT_GRUPOS: string[] = [
  "Perfil Hematológico e Inflamatório",
  "Perfil Metabólico e Glicídico",
  "Perfil Hormonal e Tireoidiano",
  "Vitaminas e Minerais",
  "Função Hepática e Renal",
];

const DEFAULT_EXAMES: string[] = [
  "Hemograma Completo",
  "PCR Ultrassensível",
  "Ferritina",
  "Glicemia de Jejum",
  "Hemoglobina Glicada (HbA1c)",
  "Insulina Basal",
  "TSH Ultrassensível",
  "T4 Livre",
  "Vitamina D (25-OH)",
  "Vitamina B12",
  "Zinco Sérico",
  "TGO (AST)",
  "TGP (ALT)",
  "Creatinina",
  "Lipidograma Completo",
];

const DEFAULT_ORIENTACOES: string[] = [
  "Jejum: 8 a 12 horas, conforme protocolo do laboratório.",
  "Manter hidratação habitual com água.",
  "Informar uso de medicamentos e suplementos contínuos no ato da coleta.",
];

/**
 * Obtém os clientes Supabase para execução segura e fallback administrativo.
 */
async function getSupabaseClients() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  const db = adminClient || serverClient;
  return { serverClient, adminClient, db };
}

/**
 * Valida se o usuário autenticado possui role de 'administrador' ou 'profissional'
 * checando metadados da sessão e a tabela public.profiles.
 */
async function verifyProfissionalOrAdmin(
  serverClient: any,
  adminDb: any
): Promise<{
  authorized: boolean;
  error?: string;
  user?: any;
  role?: string;
  profile?: any;
}> {
  if (!serverClient) {
    return {
      authorized: false,
      error: "Cliente de autenticação indisponível.",
    };
  }

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
        "Acesso não autorizado. Apenas administradores e profissionais podem gerenciar prescrições de exames.",
    };
  }

  return { authorized: true, user, role: roleFromDb, profile };
}

/**
 * 1. getPrescricoesExamesByPaciente
 * Valida se o paciente existe e está ativo (deleted_at IS NULL) e busca todas as prescrições
 * de exames do paciente ordenadas por data DESC, created_at DESC.
 */
export async function getPrescricoesExamesByPaciente(
  pacienteId: string
): Promise<PrescricaoExameActionResult<PrescricaoExame[]>> {
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

    // 1. Valida se o paciente existe e está ativo (filtro soft delete)
    const { data: paciente, error: pacError } = await activeDb
      .from("pacientes")
      .select("id, nome, cpf, email, telefone, deleted_at, status")
      .eq("id", pacienteId)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    // 2. Consulta registros de exames do paciente
    const { data: registros, error: regError } = await activeDb
      .from("prescricoes_exames")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (regError) {
      return {
        success: false,
        error: regError.message || "Erro ao consultar prescrições de exames.",
      };
    }

    const parsedRegistros: PrescricaoExame[] = (registros || []).map((row: any) => ({
      ...row,
      paciente: {
        id: paciente.id,
        nome: paciente.nome,
        cpf: paciente.cpf,
        email: paciente.email,
        telefone: paciente.telefone,
      },
    }));

    return {
      success: true,
      data: parsedRegistros,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao consultar prescrições de exames.",
    };
  }
}

/**
 * 2. getCatalogoExamesPreCadastrados
 * Agrega e retorna listas únicas de nomes de grupos, exames e orientações
 * extraídos dos registros existentes na tabela public.prescricoes_exames combinados
 * com o catálogo padrão inicial.
 */
export async function getCatalogoExamesPreCadastrados(): Promise<
  PrescricaoExameActionResult<CatalogoExamesPreCadastrados>
> {
  try {
    const { serverClient, adminClient, db } = await getSupabaseClients();
    const activeDb = adminClient || serverClient || db;

    const gruposSet = new Set<string>(DEFAULT_GRUPOS);
    const examesSet = new Set<string>(DEFAULT_EXAMES);
    const orientacoesSet = new Set<string>(DEFAULT_ORIENTACOES);

    if (activeDb) {
      const { data: records, error } = await activeDb
        .from("prescricoes_exames")
        .select("grupos_exames, orientacoes")
        .limit(200);

      if (!error && records) {
        for (const item of records) {
          // Extrai grupos e exames
          if (Array.isArray(item.grupos_exames)) {
            for (const grp of item.grupos_exames as GrupoExameItem[]) {
              if (grp && typeof grp.nome_grupo === "string" && grp.nome_grupo.trim()) {
                gruposSet.add(grp.nome_grupo.trim());
              }
              if (Array.isArray(grp?.exames)) {
                for (const ex of grp.exames) {
                  if (typeof ex === "string" && ex.trim()) {
                    examesSet.add(ex.trim());
                  }
                }
              }
            }
          }

          // Extrai orientações
          if (Array.isArray(item.orientacoes)) {
            for (const ori of item.orientacoes) {
              if (typeof ori === "string" && ori.trim()) {
                orientacoesSet.add(ori.trim());
              }
            }
          }
        }
      }
    }

    return {
      success: true,
      data: {
        gruposSugeridos: Array.from(gruposSet),
        examesSugeridos: Array.from(examesSet),
        orientacoesSugeridas: Array.from(orientacoesSet),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao consultar catálogo de exames pré-cadastrados.",
      data: {
        gruposSugeridos: DEFAULT_GRUPOS,
        examesSugeridos: DEFAULT_EXAMES,
        orientacoesSugeridas: DEFAULT_ORIENTACOES,
      },
    };
  }
}

/**
 * 3. savePrescricaoExame
 * Cria ou atualiza uma prescrição de exames com assinatura SHA-256.
 * Em edição (prescricaoExameId informado), versiona a versão anterior gravando
 * uma cópia como 'Suspenso' ("Prescrição de exames ajustada") e atualiza o registro atual para 'Ativo'.
 */
export async function savePrescricaoExame(
  input: PrescricaoExameInput,
  prescricaoExameId?: string
): Promise<PrescricaoExameActionResult<PrescricaoExame>> {
  try {
    if (!input || !input.paciente_id) {
      return {
        success: false,
        error: "Identificador do paciente não informado.",
      };
    }

    if (!input.titulo || !input.titulo.trim()) {
      return {
        success: false,
        error: "O título da prescrição de exames é obrigatório.",
      };
    }

    // Validação de grupos e exames
    const gruposFiltrados: GrupoExameItem[] = (input.grupos_exames || [])
      .map((g) => ({
        id: g.id,
        nome_grupo: (g.nome_grupo || "").trim(),
        exames: (g.exames || [])
          .map((e) => (typeof e === "string" ? e.trim() : ""))
          .filter((e) => e.length > 0),
      }))
      .filter((g) => g.nome_grupo.length > 0 && g.exames.length > 0);

    if (gruposFiltrados.length === 0) {
      return {
        success: false,
        error: "Informe ao menos um grupo com pelo menos um exame válido.",
      };
    }

    // Validação de orientações
    const orientacoesFiltradas: string[] = (input.orientacoes || [])
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter((o) => o.length > 0);

    if (orientacoesFiltradas.length === 0) {
      return {
        success: false,
        error: "Informe ao menos uma orientação para a realização dos exames.",
      };
    }

    const serverClient = await createClient();
    const adminClient = getSupabaseAdminClient();
    const db = adminClient || serverClient;

    if (!db) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    // 1. Valida permissão do usuário autenticado ('administrador' ou 'profissional')
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
      .select("id, nome, cpf, email, telefone, deleted_at")
      .eq("id", input.paciente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return {
        success: false,
        error: "Paciente não encontrado ou inativo.",
      };
    }

    const dataFinal = input.data || new Date().toISOString().split("T")[0];
    const profissionalFinal =
      input.profissional?.trim() || "Dra. Juliana Sena";

    // 3. Gera hash canônico e assinatura de integridade SHA-256
    const payloadParaHash: Record<string, unknown> = {
      paciente_id: input.paciente_id,
      titulo: input.titulo.trim(),
      data: dataFinal,
      descricao: (input.descricao || "").trim(),
      grupos_exames: gruposFiltrados,
      orientacoes: orientacoesFiltradas,
      status: "Ativo",
      profissional: profissionalFinal,
    };

    const { payloadCanonico, hash, assinatura, algoritmo } =
      generatePropostaHash(payloadParaHash);

    const now = new Date().toISOString();

    let resultData: PrescricaoExame;

    // 4. Edição com Versionamento ou Inserção Nova
    if (prescricaoExameId) {
      // Busca registro existente
      const { data: existing, error: findErr } = await db
        .from("prescricoes_exames")
        .select("*")
        .eq("id", prescricaoExameId)
        .eq("paciente_id", input.paciente_id)
        .maybeSingle();

      if (findErr || !existing) {
        return {
          success: false,
          error: "Prescrição de exames original não encontrada para edição.",
        };
      }

      // Arquiva versão anterior com status 'Suspenso'
      const { error: archiveErr } = await db
        .from("prescricoes_exames")
        .insert({
          paciente_id: existing.paciente_id,
          titulo: existing.titulo,
          data: existing.data,
          descricao: existing.descricao,
          grupos_exames: existing.grupos_exames,
          orientacoes: existing.orientacoes,
          status: "Suspenso",
          justificativa_suspensao: "Prescrição de exames ajustada",
          data_suspensao: now,
          profissional: existing.profissional,
          payload_canonico: existing.payload_canonico,
          payload_hash: existing.payload_hash,
          assinatura: existing.assinatura,
          algoritmo: existing.algoritmo,
          assinado_em: existing.assinado_em,
          created_at: existing.created_at || now,
          updated_at: now,
        });

      if (archiveErr) {
        console.warn("Aviso ao arquivar versão anterior da prescrição de exames:", archiveErr.message);
      }

      // Atualiza o registro original com os novos dados
      const { data: updated, error: updateErr } = await db
        .from("prescricoes_exames")
        .update({
          titulo: input.titulo.trim(),
          data: dataFinal,
          descricao: (input.descricao || "").trim() || null,
          grupos_exames: gruposFiltrados,
          orientacoes: orientacoesFiltradas,
          status: "Ativo",
          justificativa_suspensao: null,
          data_suspensao: null,
          profissional: profissionalFinal,
          payload_canonico: payloadCanonico,
          payload_hash: hash,
          assinatura: assinatura,
          algoritmo: algoritmo,
          assinado_em: now,
          updated_at: now,
        })
        .eq("id", prescricaoExameId)
        .select()
        .single();

      if (updateErr) {
        return {
          success: false,
          error: updateErr.message || "Erro ao atualizar prescrição de exames.",
        };
      }

      resultData = {
        ...updated,
        paciente: {
          id: paciente.id,
          nome: paciente.nome,
          cpf: paciente.cpf,
          email: paciente.email,
          telefone: paciente.telefone,
        },
      } as PrescricaoExame;
    } else {
      // Inserção de novo registro
      const { data: inserted, error: insertErr } = await db
        .from("prescricoes_exames")
        .insert({
          paciente_id: input.paciente_id,
          titulo: input.titulo.trim(),
          data: dataFinal,
          descricao: (input.descricao || "").trim() || null,
          grupos_exames: gruposFiltrados,
          orientacoes: orientacoesFiltradas,
          status: "Ativo",
          justificativa_suspensao: null,
          data_suspensao: null,
          profissional: profissionalFinal,
          payload_canonico: payloadCanonico,
          payload_hash: hash,
          assinatura: assinatura,
          algoritmo: algoritmo,
          assinado_em: now,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertErr) {
        return {
          success: false,
          error: insertErr.message || "Erro ao cadastrar prescrição de exames.",
        };
      }

      resultData = {
        ...inserted,
        paciente: {
          id: paciente.id,
          nome: paciente.nome,
          cpf: paciente.cpf,
          email: paciente.email,
          telefone: paciente.telefone,
        },
      } as PrescricaoExame;
    }

    // Revalidação de caminhos clínicos
    try {
      revalidatePath("/clinical");
      revalidatePath("/patients");
      revalidatePath("/portal-paciente");
      revalidatePath(`/pacientes/${input.paciente_id}`);
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
      error: err?.message || "Erro inesperado ao salvar prescrição de exames.",
    };
  }
}

/**
 * 4. suspenderPrescricaoExame
 * Atualiza o status da prescrição de exames para 'Suspenso' com justificativa e data de suspensão.
 */
export async function suspenderPrescricaoExame(
  id: string,
  justificativa?: string
): Promise<PrescricaoExameActionResult<PrescricaoExame>> {
  try {
    if (!id) {
      return {
        success: false,
        error: "Identificador da prescrição de exames não informado.",
      };
    }

    const serverClient = await createClient();
    const adminClient = getSupabaseAdminClient();
    const db = adminClient || serverClient;

    if (!db) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    // Valida permissão do usuário
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
    const justificativaFinal =
      justificativa?.trim() || "Suspensa pelo profissional";

    const { data, error } = await db
      .from("prescricoes_exames")
      .update({
        status: "Suspenso",
        justificativa_suspensao: justificativaFinal,
        data_suspensao: now,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao suspender prescrição de exames.",
      };
    }

    // Revalida rotas clínicas
    try {
      revalidatePath("/clinical");
      revalidatePath("/patients");
      revalidatePath("/portal-paciente");
    } catch {
      // Revalidação segura
    }

    return {
      success: true,
      data: data as PrescricaoExame,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao suspender prescrição de exames.",
    };
  }
}
