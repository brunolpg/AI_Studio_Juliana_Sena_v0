"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalizeJson, gerarHashSha256, assinarHash } from "@/lib/crypto-payload";
import { homeCareFichaSchema } from "@/lib/validations/home-care";
import type {
  HomeCareTopico,
  HomeCareFichaCompleta,
  SaveHomeCareFichaInput,
} from "@/types/home-care";

/**
 * Obtém o cliente Supabase administrativo com service_role para operações administrativas
 * nas tabelas de Home Care (evitando erros de 'permission denied' por RLS)
 * e o cliente com sessão de cookies para validação de autenticação do usuário.
 */
async function getSupabaseClients() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  const adminDb = adminClient || serverClient;
  return { serverClient, adminClient, adminDb };
}

/**
 * Cadastra ou atualiza um tópico de Home Care no catálogo central:
 * - Se possui id: atualiza título e texto.
 * - Se NÃO possui id: verifica se já existe um tópico no mesmo grupo com o mesmo título (case-insensitive).
 *   - Se existir: atualiza o texto e reutiliza o id existente em vez de duplicar.
 *   - Se não existir: insere o novo tópico no grupo e retorna o id gerado.
 */
async function upsertCatalogTopic(
  adminDb: SupabaseClient,
  grupo: "CUIDADOS" | "RECOMENDACOES" | "ATENCAO_CRITICA",
  item: { topico_id?: string; titulo: string; texto: string }
): Promise<string> {
  const trimmedTitulo = item.titulo.trim();
  const trimmedTexto = item.texto.trim();

  // 1. Se já veio com ID, atualiza o tópico existente
  if (item.topico_id) {
    const { error: updateError } = await adminDb
      .from("home_care_topicos")
      .update({
        titulo: trimmedTitulo,
        texto: trimmedTexto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.topico_id);

    if (updateError) {
      console.warn("Aviso ao atualizar tópico existente no catálogo:", updateError.message);
    }
    return item.topico_id;
  }

  // 2. Tópico sem ID: verificar se já existe no mesmo grupo com o mesmo título (case-insensitive)
  const { data: existingTopics, error: findError } = await adminDb
    .from("home_care_topicos")
    .select("id, titulo, texto")
    .eq("grupo", grupo)
    .ilike("titulo", trimmedTitulo)
    .limit(1);

  if (findError) {
    console.warn("Aviso ao buscar duplicata de tópico:", findError.message);
  }

  const existingTopic = existingTopics && existingTopics.length > 0 ? existingTopics[0] : null;

  if (existingTopic?.id) {
    // Reutiliza o id existente e atualiza o texto com a versão mais recente
    const { error: updateExistingError } = await adminDb
      .from("home_care_topicos")
      .update({
        texto: trimmedTexto,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTopic.id);

    if (updateExistingError) {
      console.warn("Aviso ao atualizar texto do tópico reutilizado:", updateExistingError.message);
    }

    return existingTopic.id;
  }

  // 3. Se não existir, faz o insert e retorna o novo id
  const { data: novoTopico, error: insertError } = await adminDb
    .from("home_care_topicos")
    .insert({
      grupo,
      titulo: trimmedTitulo,
      texto: trimmedTexto,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertError || !novoTopico) {
    throw new Error(`Falha ao cadastrar tópico '${trimmedTitulo}' no catálogo: ${insertError?.message}`);
  }

  return novoTopico.id;
}

/**
 * 1. Busca os tópicos de catálogo pré-cadastrados e as fórmulas magistrais
 */
export async function getHomeCareCatalogAndFormulas(): Promise<{
  topicos: HomeCareTopico[];
  formulas: Array<{ id: string; nome: string; posologia?: string | null; via?: string }>;
}> {
  try {
    const { adminDb } = await getSupabaseClients();
    if (!adminDb) {
      return { topicos: [], formulas: [] };
    }

    // Busca tópicos de catálogo com o cliente administrativo
    const { data: topicosData, error: topicosError } = await adminDb
      .from("home_care_topicos")
      .select("*")
      .order("grupo", { ascending: true })
      .order("titulo", { ascending: true });

    if (topicosError) {
      console.warn("Aviso ao carregar home_care_topicos:", topicosError.message);
    }

    // Busca fórmulas magistrais
    const { data: formulasData, error: formulasError } = await adminDb
      .from("formulas")
      .select("id, nome, posologia, via")
      .order("nome", { ascending: true });

    if (formulasError) {
      console.warn("Aviso ao carregar formulas:", formulasError.message);
    }

    return {
      topicos: (topicosData as HomeCareTopico[]) || [],
      formulas: formulasData || [],
    };
  } catch (err: any) {
    console.error("Erro em getHomeCareCatalogAndFormulas:", err);
    return { topicos: [], formulas: [] };
  }
}

/**
 * 2. Busca agendamentos do paciente para vínculo opcional e autopreenchimento de data
 */
export async function getPatientAppointments(pacienteId: string) {
  try {
    const { adminDb } = await getSupabaseClients();
    if (!adminDb || !pacienteId) return [];

    const { data, error } = await adminDb
      .from("appointments")
      .select("id, data, horario_inicio, horario_fim, procedimento")
      .eq("client_id", pacienteId)
      .order("data", { ascending: false });

    if (error) {
      console.warn("Aviso ao carregar agendamentos do paciente:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Erro em getPatientAppointments:", err);
    return [];
  }
}

/**
 * 2.1 Busca todos os pacientes ativos ordenados por nome para seleção no modal
 */
export async function getActivePatients(): Promise<
  Array<{ id: string; nome: string; cpf?: string | null }>
> {
  try {
    const { adminDb } = await getSupabaseClients();
    if (!adminDb) return [];

    const { data, error } = await adminDb
      .from("pacientes")
      .select("id, nome, cpf")
      .is("deleted_at", null)
      .eq("status", "Ativo")
      .order("nome", { ascending: true });

    if (error) {
      console.warn("Aviso ao carregar pacientes ativos:", error.message);
      return [];
    }
    return (data as Array<{ id: string; nome: string; cpf?: string | null }>) || [];
  } catch (err) {
    console.error("Erro em getActivePatients:", err);
    return [];
  }
}

/**
 * 3. Atualiza diretamente um tópico no catálogo central
 */
export async function updateCatalogTopic(id: string, titulo: string, texto: string) {
  try {
    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) throw new Error("Banco de dados indisponível");

    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return { error: "Usuário não autenticado." };
    }

    const { error } = await adminDb
      .from("home_care_topicos")
      .update({
        titulo: titulo.trim(),
        texto: texto.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error("Erro em updateCatalogTopic:", err);
    return { error: err?.message || "Erro ao atualizar tópico do catálogo." };
  }
}

/**
 * 4. Salva (Cria ou Edita) uma Ficha de Home Care com Hash SHA-256 e sincronização
 */
export async function saveHomeCareFicha(input: SaveHomeCareFichaInput): Promise<{
  success?: boolean;
  fichaId?: string;
  error?: string;
}> {
  try {
    const parsed = homeCareFichaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.errors[0]?.message || "Dados inválidos para a Ficha de Home Care.",
      };
    }

    const validData = parsed.data;
    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) {
      return { error: "Serviço de banco de dados não configurado." };
    }

    // 1. Validação obrigatória da autenticação do usuário
    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return { error: "Acesso não autorizado. Por favor, realize login novamente." };
    }

    // Identificar profissional responsável oficial
    let profissionalNome = validData.profissional;
    if (
      !profissionalNome ||
      profissionalNome.toLowerCase().includes("bruno") ||
      profissionalNome.includes("@") ||
      profissionalNome === "Dra. Juliana Sena"
    ) {
      profissionalNome = "Juliana Sena de Souza Vieira";
    }

    // 2. Processar e sincronizar Tópicos de CUIDADOS usando cliente administrativo
    const processadosCuidados: Array<{ topico_id: string; titulo: string; texto: string; ordem: number }> = [];
    for (let i = 0; i < validData.cuidados.length; i++) {
      const item = validData.cuidados[i];
      const topicoId = await upsertCatalogTopic(adminDb, "CUIDADOS", {
        topico_id: item.topico_id,
        titulo: item.titulo,
        texto: item.texto,
      });

      processadosCuidados.push({
        topico_id: topicoId,
        titulo: item.titulo.trim(),
        texto: item.texto.trim(),
        ordem: i + 1,
      });
    }

    // 3. Processar e sincronizar Tópicos de RECOMENDAÇÕES (se habilitado) usando cliente administrativo
    const processadasRecomendacoes: Array<{ topico_id: string; titulo: string; texto: string; ordem: number }> = [];
    if (validData.incluir_recomendacoes && validData.recomendacoes?.length) {
      for (let i = 0; i < validData.recomendacoes.length; i++) {
        const item = validData.recomendacoes[i];
        const topicoId = await upsertCatalogTopic(adminDb, "RECOMENDACOES", {
          topico_id: item.topico_id,
          titulo: item.titulo,
          texto: item.texto,
        });

        processadasRecomendacoes.push({
          topico_id: topicoId,
          titulo: item.titulo.trim(),
          texto: item.texto.trim(),
          ordem: i + 1,
        });
      }
    }

    // 3.1 Processar e sincronizar Atenção Crítica (se habilitada e com texto informado)
    const incluirAtencaoCritica = validData.incluir_atencao_critica !== false;
    const atencaoCriticaTitulo = validData.atencao_critica_titulo?.trim() || null;
    const atencaoCriticaTexto = validData.atencao_critica_texto?.trim() || null;

    if (incluirAtencaoCritica && atencaoCriticaTexto) {
      try {
        await upsertCatalogTopic(adminDb, "ATENCAO_CRITICA", {
          titulo: atencaoCriticaTitulo || "ATENÇÃO CRÍTICA — CUIDADOS PÓS-PROCEDIMENTO",
          texto: atencaoCriticaTexto,
        });
      } catch (catErr: any) {
        console.warn("Aviso ao sincronizar tópico de Atenção Crítica no catálogo:", catErr?.message);
      }
    }

    // 4. Montar payload canônico determinístico
    const canonicalPayload = {
      paciente_id: validData.paciente_id,
      appointment_id: validData.appointment_id || null,
      titulo_protocolo: validData.titulo_protocolo.trim(),
      data_home_care: validData.data_home_care,
      profissional: profissionalNome,
      incluir_atencao_critica: incluirAtencaoCritica,
      atencao_critica_titulo: atencaoCriticaTitulo,
      atencao_critica_texto: atencaoCriticaTexto,
      cuidados: processadosCuidados.map((c) => ({
        ordem: c.ordem,
        titulo: c.titulo,
        texto: c.texto,
      })),
      cronograma: validData.cronograma.map((cr, idx) => ({
        ordem: idx + 1,
        dia_inicio: cr.dia_inicio,
        dia_fim: cr.dia_fim,
        fase_titulo: cr.fase_titulo?.trim() || null,
        formula_id: cr.formula_id || null,
        nome_formula: cr.nome_formula.trim(),
        posologia: cr.posologia.trim(),
        objetivo_clinico: cr.objetivo_clinico.trim(),
      })),
      recomendacoes: validData.incluir_recomendacoes
        ? processadasRecomendacoes.map((r) => ({
            ordem: r.ordem,
            titulo: r.titulo,
            texto: r.texto,
          }))
        : [],
    };

    const canonicalStr = canonicalizeJson(canonicalPayload);
    const payloadHash = gerarHashSha256(canonicalStr);
    const assinatura = assinarHash(payloadHash);
    const assinadoEm = new Date().toISOString();

    const fichaRecord = {
      paciente_id: validData.paciente_id,
      appointment_id: validData.appointment_id || null,
      titulo_protocolo: validData.titulo_protocolo.trim(),
      data_home_care: validData.data_home_care,
      incluir_atencao_critica: incluirAtencaoCritica,
      atencao_critica_titulo: atencaoCriticaTitulo,
      atencao_critica_texto: atencaoCriticaTexto,
      incluir_recomendacoes: validData.incluir_recomendacoes,
      status: validData.status || "Ativo",
      profissional: profissionalNome,
      payload_canonico: canonicalPayload,
      payload_hash: payloadHash,
      assinatura: assinatura,
      algoritmo: "RS256",
      assinado_em: assinadoEm,
      updated_at: new Date().toISOString(),
    };

    let fichaId = validData.id;

    if (fichaId) {
      // Atualização de ficha existente com cliente admin
      const { error: updateError } = await adminDb
        .from("home_care_fichas")
        .update(fichaRecord)
        .eq("id", fichaId);

      if (updateError) throw updateError;
    } else {
      // Inserção de nova ficha com cliente admin
      const { data: newFicha, error: insertError } = await adminDb
        .from("home_care_fichas")
        .insert({
          ...fichaRecord,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !newFicha) throw insertError;
      fichaId = newFicha.id;
    }

    // 5. Sincronizar tabela associativa `home_care_ficha_topicos` com cliente admin
    await adminDb.from("home_care_ficha_topicos").delete().eq("ficha_id", fichaId);

    const relacoesTopicos = [
      ...processadosCuidados.map((c) => ({
        ficha_id: fichaId,
        topico_id: c.topico_id,
        grupo: "CUIDADOS",
        ordem: c.ordem,
      })),
      ...processadasRecomendacoes.map((r) => ({
        ficha_id: fichaId,
        topico_id: r.topico_id,
        grupo: "RECOMENDACOES",
        ordem: r.ordem,
      })),
    ];

    if (relacoesTopicos.length > 0) {
      const { error: relError } = await adminDb
        .from("home_care_ficha_topicos")
        .insert(relacoesTopicos);
      if (relError) throw relError;
    }

    // 6. Sincronizar tabela `home_care_cronograma` com cliente admin
    await adminDb.from("home_care_cronograma").delete().eq("ficha_id", fichaId);

    const linhasCronograma = validData.cronograma.map((cr, idx) => ({
      ficha_id: fichaId,
      ordem: idx + 1,
      dia_inicio: cr.dia_inicio,
      dia_fim: cr.dia_fim,
      fase_titulo: cr.fase_titulo?.trim() || null,
      formula_id: cr.formula_id || null,
      nome_formula: cr.nome_formula.trim(),
      posologia: cr.posologia.trim(),
      objetivo_clinico: cr.objetivo_clinico.trim(),
    }));

    if (linhasCronograma.length > 0) {
      const { error: cronoError } = await adminDb
        .from("home_care_cronograma")
        .insert(linhasCronograma);
      if (cronoError) throw cronoError;
    }

    try {
      revalidatePath("/dashboard");
    } catch {}

    return { success: true, fichaId };
  } catch (err: any) {
    console.error("Erro em saveHomeCareFicha:", err);
    return { error: err?.message || "Ocorreu um erro ao salvar a Ficha de Home Care." };
  }
}

/**
 * 5. Deleta uma Ficha de Home Care
 */
export async function deleteHomeCareFicha(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) throw new Error("Banco de dados indisponível");

    const { data: { user }, error: authError } = await serverClient.auth.getUser();
    if (authError || !user) {
      return { error: "Usuário não autenticado." };
    }

    // Limpar relacionamentos dependentes com adminDb
    await adminDb.from("home_care_ficha_topicos").delete().eq("ficha_id", id);
    await adminDb.from("home_care_cronograma").delete().eq("ficha_id", id);

    const { error } = await adminDb.from("home_care_fichas").delete().eq("id", id);
    if (error) throw error;

    try {
      revalidatePath("/dashboard");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("Erro em deleteHomeCareFicha:", err);
    return { error: err?.message || "Falha ao excluir ficha de Home Care." };
  }
}

/**
 * 6. Busca todas as fichas de Home Care de um determinado paciente (com dados completos)
 */
export async function getPatientHomeCareFichas(pacienteId: string): Promise<HomeCareFichaCompleta[]> {
  try {
    const { adminDb } = await getSupabaseClients();
    if (!adminDb || !pacienteId) return [];

    // Busca as fichas do paciente
    const { data: fichas, error: fichasError } = await adminDb
      .from("home_care_fichas")
      .select(`
        *,
        paciente:pacientes (id, nome, cpf, data_nascimento, email, telefone),
        appointment:appointments (id, data, horario_inicio, horario_fim, procedimento)
      `)
      .eq("paciente_id", pacienteId)
      .order("data_home_care", { ascending: false })
      .order("created_at", { ascending: false });

    if (fichasError) {
      console.warn("Aviso ao buscar home_care_fichas:", fichasError.message);
      return [];
    }

    if (!fichas || fichas.length === 0) return [];

    const fichaIds = fichas.map((f: any) => f.id);

    // Busca tópicos relacionados usando adminDb
    const { data: fichaTopicos, error: topicosError } = await adminDb
      .from("home_care_ficha_topicos")
      .select(`
        ficha_id,
        topico_id,
        grupo,
        ordem,
        topico:home_care_topicos (id, titulo, texto)
      `)
      .in("ficha_id", fichaIds)
      .order("ordem", { ascending: true });

    if (topicosError) {
      console.warn("Aviso ao buscar home_care_ficha_topicos:", topicosError.message);
    }

    // Busca linhas do cronograma usando adminDb
    const { data: cronogramas, error: cronoError } = await adminDb
      .from("home_care_cronograma")
      .select("*")
      .in("ficha_id", fichaIds)
      .order("ordem", { ascending: true });

    if (cronoError) {
      console.warn("Aviso ao buscar home_care_cronograma:", cronoError.message);
    }

    // Monta o objeto completo para cada ficha
    const resultado: HomeCareFichaCompleta[] = fichas.map((f: any) => {
      const topicosDaFicha = (fichaTopicos || []).filter((ft: any) => ft.ficha_id === f.id);
      const cronoDaFicha = (cronogramas || []).filter((cr: any) => cr.ficha_id === f.id);

      const cuidados = topicosDaFicha
        .filter((ft: any) => ft.grupo === "CUIDADOS")
        .map((ft: any) => ({
          topico_id: ft.topico_id,
          grupo: "CUIDADOS" as const,
          ordem: ft.ordem,
          titulo: ft.topico?.titulo || "",
          texto: ft.topico?.texto || "",
        }));

      const recomendacoes = topicosDaFicha
        .filter((ft: any) => ft.grupo === "RECOMENDACOES")
        .map((ft: any) => ({
          topico_id: ft.topico_id,
          grupo: "RECOMENDACOES" as const,
          ordem: ft.ordem,
          titulo: ft.topico?.titulo || "",
          texto: ft.topico?.texto || "",
        }));

      return {
        ...f,
        cuidados,
        cronograma: cronoDaFicha,
        recomendacoes,
      };
    });

    return resultado;
  } catch (err) {
    console.error("Erro em getPatientHomeCareFichas:", err);
    return [];
  }
}

/**
 * 7. Busca as fichas de Home Care vinculadas ao paciente atualmente autenticado
 */
export async function getLoggedInPatientHomeCareFichas(): Promise<HomeCareFichaCompleta[]> {
  try {
    const { serverClient, adminDb } = await getSupabaseClients();
    if (!serverClient || !adminDb) return [];

    const { data: { user }, error: userError } = await serverClient.auth.getUser();
    if (userError || !user) return [];

    // Localizar cadastro na tabela pacientes por user_id ou email (não deletado)
    let pacienteId: string | null = null;

    const { data: pacByUserId } = await adminDb
      .from("pacientes")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacByUserId?.id) {
      pacienteId = pacByUserId.id;
    } else if (user.email) {
      const { data: pacByEmail } = await adminDb
        .from("pacientes")
        .select("id")
        .eq("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();

      if (pacByEmail?.id) {
        pacienteId = pacByEmail.id;
      }
    }

    if (!pacienteId) return [];

    return await getPatientHomeCareFichas(pacienteId);
  } catch (err) {
    console.error("Erro em getLoggedInPatientHomeCareFichas:", err);
    return [];
  }
}
