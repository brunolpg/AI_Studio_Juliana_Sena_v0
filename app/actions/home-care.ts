"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { canonicalizeJson, gerarHashSha256, assinarHash } from "@/lib/crypto-payload";
import { homeCareFichaSchema } from "@/lib/validations/home-care";
import type {
  HomeCareTopico,
  HomeCareFichaCompleta,
  SaveHomeCareFichaInput,
} from "@/types/home-care";

/**
 * Obtém o cliente Supabase adequado (Server Client com sessão ou fallback Admin).
 */
async function getClient() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  return { serverClient, adminClient, db: adminClient || serverClient };
}

/**
 * 1. Busca os tópicos de catálogo pré-cadastrados e as fórmulas magistrais
 */
export async function getHomeCareCatalogAndFormulas(): Promise<{
  topicos: HomeCareTopico[];
  formulas: Array<{ id: string; nome: string; posologia?: string | null; via?: string }>;
}> {
  try {
    const { db } = await getClient();
    if (!db) {
      return { topicos: [], formulas: [] };
    }

    // Busca tópicos de catálogo
    const { data: topicosData, error: topicosError } = await db
      .from("home_care_topicos")
      .select("*")
      .order("grupo", { ascending: true })
      .order("titulo", { ascending: true });

    if (topicosError) {
      console.warn("Aviso ao carregar home_care_topicos:", topicosError.message);
    }

    // Busca fórmulas magistrais
    const { data: formulasData, error: formulasError } = await db
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
    const { db } = await getClient();
    if (!db || !pacienteId) return [];

    const { data, error } = await db
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
    const { db } = await getClient();
    if (!db) return [];

    const { data, error } = await db
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
    const { db } = await getClient();
    if (!db) throw new Error("Banco de dados indisponível");

    const { error } = await db
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
    const { serverClient, db } = await getClient();
    if (!db) {
      return { error: "Serviço de banco de dados não configurado." };
    }

    // Identificar profissional logado ou default
    let profissionalNome = validData.profissional || "Dra. Juliana Sena";
    if (serverClient) {
      try {
        const { data: { user } } = await serverClient.auth.getUser();
        if (user) {
          profissionalNome =
            user.user_metadata?.nome ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            profissionalNome;
        }
      } catch {}
    }

    // 1. Processar e sincronizar Tópicos de CUIDADOS
    const processadosCuidados: Array<{ topico_id: string; titulo: string; texto: string; ordem: number }> = [];
    for (let i = 0; i < validData.cuidados.length; i++) {
      const item = validData.cuidados[i];
      let topicoId = item.topico_id;

      if (topicoId) {
        // Sincronização automática: atualiza tópico existente no catálogo central
        await db
          .from("home_care_topicos")
          .update({
            titulo: item.titulo.trim(),
            texto: item.texto.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", topicoId);
      } else {
        // Cria novo tópico no catálogo central
        const { data: novoTopico, error: topicoError } = await db
          .from("home_care_topicos")
          .insert({
            grupo: "CUIDADOS",
            titulo: item.titulo.trim(),
            texto: item.texto.trim(),
          })
          .select("id")
          .single();

        if (topicoError || !novoTopico) {
          throw new Error(`Falha ao cadastrar tópico no catálogo: ${topicoError?.message}`);
        }
        topicoId = novoTopico.id;
      }

      processadosCuidados.push({
        topico_id: topicoId!,
        titulo: item.titulo.trim(),
        texto: item.texto.trim(),
        ordem: i + 1,
      });
    }

    // 2. Processar e sincronizar Tópicos de RECOMENDAÇÕES (se habilitado)
    const processadasRecomendacoes: Array<{ topico_id: string; titulo: string; texto: string; ordem: number }> = [];
    if (validData.incluir_recomendacoes && validData.recomendacoes?.length) {
      for (let i = 0; i < validData.recomendacoes.length; i++) {
        const item = validData.recomendacoes[i];
        let topicoId = item.topico_id;

        if (topicoId) {
          await db
            .from("home_care_topicos")
            .update({
              titulo: item.titulo.trim(),
              texto: item.texto.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", topicoId);
        } else {
          const { data: novoTopico, error: topicoError } = await db
            .from("home_care_topicos")
            .insert({
              grupo: "RECOMENDACOES",
              titulo: item.titulo.trim(),
              texto: item.texto.trim(),
            })
            .select("id")
            .single();

          if (topicoError || !novoTopico) {
            throw new Error(`Falha ao cadastrar recomendação no catálogo: ${topicoError?.message}`);
          }
          topicoId = novoTopico.id;
        }

        processadasRecomendacoes.push({
          topico_id: topicoId!,
          titulo: item.titulo.trim(),
          texto: item.texto.trim(),
          ordem: i + 1,
        });
      }
    }

    // 3. Montar payload canônico determinístico
    const canonicalPayload = {
      paciente_id: validData.paciente_id,
      appointment_id: validData.appointment_id || null,
      titulo_protocolo: validData.titulo_protocolo.trim(),
      data_home_care: validData.data_home_care,
      profissional: profissionalNome,
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
      // Atualização de ficha existente
      const { error: updateError } = await db
        .from("home_care_fichas")
        .update(fichaRecord)
        .eq("id", fichaId);

      if (updateError) throw updateError;
    } else {
      // Inserção de nova ficha
      const { data: newFicha, error: insertError } = await db
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

    // 4. Sincronizar tabela associativa `home_care_ficha_topicos`
    await db.from("home_care_ficha_topicos").delete().eq("ficha_id", fichaId);

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
      const { error: relError } = await db
        .from("home_care_ficha_topicos")
        .insert(relacoesTopicos);
      if (relError) throw relError;
    }

    // 5. Sincronizar tabela `home_care_cronograma`
    await db.from("home_care_cronograma").delete().eq("ficha_id", fichaId);

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
      const { error: cronoError } = await db
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
    const { db } = await getClient();
    if (!db) throw new Error("Banco de dados indisponível");

    // Limpar relacionamentos dependentes
    await db.from("home_care_ficha_topicos").delete().eq("ficha_id", id);
    await db.from("home_care_cronograma").delete().eq("ficha_id", id);

    const { error } = await db.from("home_care_fichas").delete().eq("id", id);
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
    const { db } = await getClient();
    if (!db || !pacienteId) return [];

    // Busca as fichas do paciente
    const { data: fichas, error: fichasError } = await db
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

    // Busca tópicos relacionados
    const { data: fichaTopicos, error: topicosError } = await db
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

    // Busca linhas do cronograma
    const { data: cronogramas, error: cronoError } = await db
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
    const { serverClient, db } = await getClient();
    if (!serverClient || !db) return [];

    const { data: { user }, error: userError } = await serverClient.auth.getUser();
    if (userError || !user) return [];

    // Localizar cadastro na tabela pacientes por user_id ou email (não deletado)
    let pacienteId: string | null = null;

    const { data: pacByUserId } = await db
      .from("pacientes")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacByUserId?.id) {
      pacienteId = pacByUserId.id;
    } else if (user.email) {
      const { data: pacByEmail } = await db
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
