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
  PrescricaoExameModelo,
  PrescricaoExameModeloInput,
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

const DEFAULT_GRUPO_ITENS: Record<string, string[]> = {
  "Perfil Hematológico e Inflamatório": [
    "Hemograma Completo",
    "PCR Ultrassensível",
    "Ferritina",
  ],
  "Perfil Metabólico e Glicídico": [
    "Glicemia de Jejum",
    "Hemoglobina Glicada (HbA1c)",
    "Insulina Basal",
  ],
  "Perfil Hormonal e Tireoidiano": [
    "TSH Ultrassensível",
    "T4 Livre",
  ],
  "Vitaminas e Minerais": [
    "Vitamina D (25-OH)",
    "Vitamina B12",
    "Zinco Sérico",
  ],
  "Função Hepática e Renal": [
    "TGO (AST)",
    "TGP (ALT)",
    "Creatinina",
    "Lipidograma Completo",
  ],
};

/**
 * 2. getCatalogoExamesPreCadastrados
 * Agrega e retorna listas únicas de nomes de grupos, exames e orientações
 * extraídos das tabelas exames_grupos, exames_itens, exames_grupos_itens
 * e dos registros existentes na tabela public.prescricoes_exames,
 * combinados com o catálogo padrão inicial e ordenados alfabeticamente.
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
    const grupoItensMap: Record<string, string[]> = { ...DEFAULT_GRUPO_ITENS };

    if (activeDb) {
      // 1. Consulta grupos cadastrados
      try {
        const { data: dbGrupos } = await activeDb
          .from("exames_grupos")
          .select("id, nome")
          .order("nome", { ascending: true });

        if (dbGrupos && Array.isArray(dbGrupos)) {
          for (const g of dbGrupos) {
            if (g?.nome && typeof g.nome === "string" && g.nome.trim()) {
              gruposSet.add(g.nome.trim());
            }
          }
        }
      } catch (err) {
        console.warn("Aviso ao consultar exames_grupos:", err);
      }

      // 2. Consulta exames cadastrados
      try {
        const { data: dbItens } = await activeDb
          .from("exames_itens")
          .select("id, nome")
          .order("nome", { ascending: true });

        if (dbItens && Array.isArray(dbItens)) {
          for (const item of dbItens) {
            if (item?.nome && typeof item.nome === "string" && item.nome.trim()) {
              examesSet.add(item.nome.trim());
            }
          }
        }
      } catch (err) {
        console.warn("Aviso ao consultar exames_itens:", err);
      }

      // 3. Consulta relação grupo-exame caso exista para facilitar a sugestão automática
      try {
        const { data: dbRelacoes } = await activeDb
          .from("exames_grupos_itens")
          .select(`
            grupo_id,
            item_id,
            exames_grupos ( nome ),
            exames_itens ( nome )
          `);

        if (dbRelacoes && Array.isArray(dbRelacoes)) {
          for (const rel of dbRelacoes) {
            const grupoNome = (rel as any)?.exames_grupos?.nome;
            const itemNome = (rel as any)?.exames_itens?.nome;
            if (grupoNome && itemNome) {
              const gKey = grupoNome.trim();
              const iVal = itemNome.trim();
              if (!grupoItensMap[gKey]) {
                grupoItensMap[gKey] = [];
              }
              if (!grupoItensMap[gKey].includes(iVal)) {
                grupoItensMap[gKey].push(iVal);
              }
            }
          }
        }
      } catch {
        // Tabela de relacionamento pode ser opcional
      }

      // 4. Agrega registros de prescrições existentes
      try {
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
                  const gName = grp.nome_grupo.trim();
                  gruposSet.add(gName);
                  if (Array.isArray(grp?.exames)) {
                    if (!grupoItensMap[gName]) {
                      grupoItensMap[gName] = [];
                    }
                    for (const ex of grp.exames) {
                      if (typeof ex === "string" && ex.trim()) {
                        const exName = ex.trim();
                        examesSet.add(exName);
                        if (!grupoItensMap[gName].includes(exName)) {
                          grupoItensMap[gName].push(exName);
                        }
                      }
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
      } catch {
        // Ignora erro
      }
    }

    return {
      success: true,
      data: {
        gruposSugeridos: Array.from(gruposSet).sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" })
        ),
        examesSugeridos: Array.from(examesSet).sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" })
        ),
        orientacoesSugeridas: Array.from(orientacoesSet),
        grupoItensMap,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro ao consultar catálogo de exames pré-cadastrados.",
      data: {
        gruposSugeridos: [...DEFAULT_GRUPOS].sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" })
        ),
        examesSugeridos: [...DEFAULT_EXAMES].sort((a, b) =>
          a.localeCompare(b, "pt-BR", { sensitivity: "base" })
        ),
        orientacoesSugeridas: DEFAULT_ORIENTACOES,
        grupoItensMap: DEFAULT_GRUPO_ITENS,
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

    // 3.1. Persistência de Novos Grupos e Exames no Catálogo
    try {
      for (const grp of gruposFiltrados) {
        const nomeGrupoTrim = grp.nome_grupo.trim();
        if (!nomeGrupoTrim) continue;

        let grupoId: string | null = null;
        try {
          const { data: insertedGrupo } = await db
            .from("exames_grupos")
            .upsert(
              { nome: nomeGrupoTrim },
              { onConflict: "nome", ignoreDuplicates: true }
            )
            .select("id")
            .maybeSingle();

          if (insertedGrupo?.id) {
            grupoId = insertedGrupo.id;
          } else {
            const { data: existingGrupo } = await db
              .from("exames_grupos")
              .select("id")
              .eq("nome", nomeGrupoTrim)
              .maybeSingle();
            grupoId = existingGrupo?.id || null;
          }
        } catch (grpErr) {
          console.warn("Aviso ao persistir grupo no catálogo:", grpErr);
        }

        // Itera sobre cada exame da lista
        for (const exameNome of grp.exames) {
          const exameNomeTrim = typeof exameNome === "string" ? exameNome.trim() : "";
          if (!exameNomeTrim) continue;

          let itemId: string | null = null;
          try {
            const { data: insertedItem } = await db
              .from("exames_itens")
              .upsert(
                { nome: exameNomeTrim },
                { onConflict: "nome", ignoreDuplicates: true }
              )
              .select("id")
              .maybeSingle();

            if (insertedItem?.id) {
              itemId = insertedItem.id;
            } else {
              const { data: existingItem } = await db
                .from("exames_itens")
                .select("id")
                .eq("nome", exameNomeTrim)
                .maybeSingle();
              itemId = existingItem?.id || null;
            }

            // Amarração dos IDs na tabela associativa exames_grupos_itens
            if (grupoId && itemId) {
              await db
                .from("exames_grupos_itens")
                .upsert(
                  { grupo_id: grupoId, item_id: itemId },
                  { onConflict: "grupo_id,item_id", ignoreDuplicates: true }
                );
            }
          } catch (itemErr) {
            console.warn("Aviso ao persistir exame/vínculo no catálogo:", itemErr);
          }
        }
      }
    } catch (catErr) {
      console.warn("Aviso geral ao persistir catálogo de exames:", catErr);
    }

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

/**
 * 5. getModelosPrescricaoExames
 * Busca todos os modelos reutilizáveis ativos (ativo = true) ordenados por titulo ASC.
 */
export async function getModelosPrescricaoExames(): Promise<
  PrescricaoExameActionResult<PrescricaoExameModelo[]>
> {
  try {
    const { serverClient, adminClient, db } = await getSupabaseClients();
    const activeDb = db || adminClient || serverClient;

    if (!activeDb) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    const { data, error } = await activeDb
      .from("prescricoes_exames_modelos")
      .select("*")
      .eq("ativo", true)
      .order("titulo", { ascending: true });

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao consultar modelos de prescrição de exames.",
      };
    }

    return {
      success: true,
      data: (data || []) as PrescricaoExameModelo[],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao consultar modelos de prescrição de exames.",
    };
  }
}

/**
 * 6. saveModeloPrescricaoExame
 * Cria ou atualiza um modelo reutilizável de prescrição de exames (independente de paciente)
 * e sincroniza novos grupos e exames com o catálogo (exames_grupos / exames_itens).
 */
export async function saveModeloPrescricaoExame(
  input: PrescricaoExameModeloInput,
  modeloId?: string
): Promise<PrescricaoExameActionResult<PrescricaoExameModelo>> {
  try {
    if (!input || !input.titulo || !input.titulo.trim()) {
      return {
        success: false,
        error: "O título do modelo de prescrição de exames é obrigatório.",
      };
    }

    if (!input.descricao || !input.descricao.trim()) {
      return {
        success: false,
        error: "A descrição do modelo de prescrição de exames é obrigatória.",
      };
    }

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

    const orientacoesFiltradas: string[] = (input.orientacoes || [])
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter((o) => o.length > 0);

    if (orientacoesFiltradas.length === 0) {
      return {
        success: false,
        error: "Informe ao menos uma orientação para a realização dos exames.",
      };
    }

    const { serverClient, db } = await getSupabaseClients();

    if (!db) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

    if (serverClient) {
      const authCheck = await verifyProfissionalOrAdmin(serverClient, db);
      if (!authCheck.authorized) {
        return {
          success: false,
          error: authCheck.error || "Acesso não autorizado.",
        };
      }
    }

    // Sincroniza novos grupos e exames com exames_grupos e exames_itens (ON CONFLICT (nome) DO NOTHING)
    try {
      for (const grp of gruposFiltrados) {
        const nomeGrupoTrim = grp.nome_grupo.trim();
        if (!nomeGrupoTrim) continue;

        let grupoId: string | null = null;
        try {
          const { data: insertedGrupo } = await db
            .from("exames_grupos")
            .upsert(
              { nome: nomeGrupoTrim },
              { onConflict: "nome", ignoreDuplicates: true }
            )
            .select("id")
            .maybeSingle();

          if (insertedGrupo?.id) {
            grupoId = insertedGrupo.id;
          } else {
            const { data: existingGrupo } = await db
              .from("exames_grupos")
              .select("id")
              .eq("nome", nomeGrupoTrim)
              .maybeSingle();
            grupoId = existingGrupo?.id || null;
          }
        } catch (grpErr) {
          console.warn("Aviso ao sincronizar grupo no catálogo:", grpErr);
        }

        for (const exameNome of grp.exames) {
          const exameNomeTrim = typeof exameNome === "string" ? exameNome.trim() : "";
          if (!exameNomeTrim) continue;

          let itemId: string | null = null;
          try {
            const { data: insertedItem } = await db
              .from("exames_itens")
              .upsert(
                { nome: exameNomeTrim },
                { onConflict: "nome", ignoreDuplicates: true }
              )
              .select("id")
              .maybeSingle();

            if (insertedItem?.id) {
              itemId = insertedItem.id;
            } else {
              const { data: existingItem } = await db
                .from("exames_itens")
                .select("id")
                .eq("nome", exameNomeTrim)
                .maybeSingle();
              itemId = existingItem?.id || null;
            }

            if (grupoId && itemId) {
              await db
                .from("exames_grupos_itens")
                .upsert(
                  { grupo_id: grupoId, item_id: itemId },
                  { onConflict: "grupo_id,item_id", ignoreDuplicates: true }
                );
            }
          } catch (itemErr) {
            console.warn("Aviso ao sincronizar exame/vínculo no catálogo:", itemErr);
          }
        }
      }
    } catch (catErr) {
      console.warn("Aviso geral ao sincronizar catálogo de exames:", catErr);
    }

    const now = new Date().toISOString();
    const profissionalFinal = input.profissional?.trim() || "Dra. Juliana Sena";
    let resultData: PrescricaoExameModelo;

    if (modeloId) {
      const { data: existing, error: findErr } = await db
        .from("prescricoes_exames_modelos")
        .select("id")
        .eq("id", modeloId)
        .eq("ativo", true)
        .maybeSingle();

      if (findErr || !existing) {
        return {
          success: false,
          error: "Modelo de prescrição de exames não encontrado para atualização.",
        };
      }

      const { data: updated, error: updateErr } = await db
        .from("prescricoes_exames_modelos")
        .update({
          titulo: input.titulo.trim(),
          descricao: input.descricao.trim(),
          grupos_exames: gruposFiltrados,
          orientacoes: orientacoesFiltradas,
          profissional: profissionalFinal,
          updated_at: now,
        })
        .eq("id", modeloId)
        .select()
        .single();

      if (updateErr) {
        return {
          success: false,
          error: updateErr.message || "Erro ao atualizar modelo de prescrição de exames.",
        };
      }

      resultData = updated as PrescricaoExameModelo;
    } else {
      const { data: inserted, error: insertErr } = await db
        .from("prescricoes_exames_modelos")
        .insert({
          titulo: input.titulo.trim(),
          descricao: input.descricao.trim(),
          grupos_exames: gruposFiltrados,
          orientacoes: orientacoesFiltradas,
          profissional: profissionalFinal,
          ativo: true,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (insertErr) {
        return {
          success: false,
          error: insertErr.message || "Erro ao salvar modelo de prescrição de exames.",
        };
      }

      resultData = inserted as PrescricaoExameModelo;
    }

    try {
      revalidatePath("/clinical");
      revalidatePath("/patients");
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
      error: err?.message || "Erro inesperado ao salvar modelo de prescrição de exames.",
    };
  }
}

/**
 * 7. deleteModeloPrescricaoExame
 * Realiza soft-delete (ativo = false) de um modelo de prescrição de exames.
 */
export async function deleteModeloPrescricaoExame(
  modeloId: string
): Promise<PrescricaoExameActionResult<PrescricaoExameModelo>> {
  try {
    if (!modeloId) {
      return {
        success: false,
        error: "Identificador do modelo não informado.",
      };
    }

    const { serverClient, db } = await getSupabaseClients();

    if (!db) {
      return {
        success: false,
        error: "Banco de dados indisponível no momento.",
      };
    }

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
      .from("prescricoes_exames_modelos")
      .update({
        ativo: false,
        updated_at: now,
      })
      .eq("id", modeloId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Erro ao excluir modelo de prescrição de exames.",
      };
    }

    try {
      revalidatePath("/clinical");
      revalidatePath("/patients");
    } catch {
      // Revalidação segura
    }

    return {
      success: true,
      data: data as PrescricaoExameModelo,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Erro inesperado ao excluir modelo de prescrição de exames.",
    };
  }
}
