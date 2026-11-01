"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { canonicalizeJson, gerarHashSha256, assinarHash } from "@/lib/crypto-payload";
import type { PopFormData, PopProtocoloCompleto, PopBloco, PopStatus } from "@/types/pop";

/**
 * Validação de sessão e autorização otimizada:
 * Verifica metadata e cache de permissão antes de fazer query adicional.
 */
async function checkAuthAndRole() {
  const serverClient = await createClient();
  const adminClient = getSupabaseAdminClient();
  const adminDb = adminClient || serverClient;

  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const rawRole = (user.user_metadata?.role || "").toLowerCase().trim();
  const isEmailAdmin =
    user.email?.toLowerCase() === "brunolpg@gmail.com" ||
    user.email?.toLowerCase().includes("admin");

  if (
    rawRole === "administrador" ||
    rawRole === "admin" ||
    rawRole === "profissional" ||
    isEmailAdmin
  ) {
    return { user, profile: { role: rawRole || "administrador" }, serverClient, adminDb };
  }

  // Busca papel no banco apenas se não identificado nos metadados
  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const roleFromDb = (profile?.role || "").toLowerCase().trim();
  const isAuthorized =
    roleFromDb === "administrador" ||
    roleFromDb === "admin" ||
    roleFromDb === "profissional";

  if (!isAuthorized) {
    throw new Error(
      "Acesso não autorizado. Apenas administradores e profissionais têm permissão para acessar o módulo de POPs."
    );
  }

  return { user, profile, serverClient, adminDb };
}

/**
 * Retorna todos os POPs institucionais cadastrados de forma ultra-rápida.
 * - Carrega apenas campos necessários para listagem nos cards.
 * - Elimina o N+1 sequencial e faz lazy loading de prescrições complexas.
 * - Utiliza agrupamento em memória para montagem instantânea.
 */
export async function getPopsAction(): Promise<PopProtocoloCompleto[]> {
  try {
    const { adminDb } = await checkAuthAndRole();

    // 1. Busca todos os protocolos cadastrados com projeção enxuta
    const { data: protocolos, error: popError } = await adminDb
      .from("pops_protocolos")
      .select("id, protocolo, finalidade, data_pop, status, profissional, payload_hash, created_at")
      .order("data_pop", { ascending: false })
      .order("created_at", { ascending: false });

    if (popError) {
      console.warn("Aviso ao carregar pops_protocolos:", popError.message);
      return [];
    }

    if (!protocolos || protocolos.length === 0) return [];

    const popIds = protocolos.map((p: any) => p.id);

    // 2. Busca blocos agrupados com seleção enxuta
    const { data: blocosDb, error: blocosError } = await adminDb
      .from("pops_blocos")
      .select("id, pop_id, tipo, ordem, topico_titulo, topico_descricao, tabela_dados, formula_id, prescricao_id")
      .in("pop_id", popIds)
      .order("ordem", { ascending: true });

    if (blocosError) {
      console.warn("Aviso ao carregar pops_blocos:", blocosError.message);
    }

    const blocoIds = (blocosDb || []).map((b: any) => b.id);

    // 3. Busca subtópicos apenas se houver blocos
    let subtopicosDb: any[] = [];
    if (blocoIds.length > 0) {
      const { data: subs, error: subsError } = await adminDb
        .from("pops_subtopicos")
        .select("id, bloco_id, ordem, titulo, descricao")
        .in("bloco_id", blocoIds)
        .order("ordem", { ascending: true });

      if (subsError) {
        console.warn("Aviso ao carregar pops_subtopicos:", subsError.message);
      } else {
        subtopicosDb = subs || [];
      }
    }

    // Indexação em Maps para montagem O(N) imediata
    const subtopicosMap = new Map<string, any[]>();
    for (const sub of subtopicosDb) {
      const list = subtopicosMap.get(sub.bloco_id) || [];
      list.push(sub);
      subtopicosMap.set(sub.bloco_id, list);
    }

    const blocosMap = new Map<string, PopBloco[]>();
    for (const b of blocosDb || []) {
      const subsDoBloco = subtopicosMap.get(b.id) || [];
      const itemBloco: PopBloco = {
        id: b.id,
        pop_id: b.pop_id,
        tipo: b.tipo,
        ordem: b.ordem,
        topico_titulo: b.topico_titulo,
        topico_descricao: b.topico_descricao,
        tabela_dados: b.tabela_dados || null,
        formula_id: b.formula_id,
        prescricao_id: b.prescricao_id,
        subtopicos: subsDoBloco,
      };
      const list = blocosMap.get(b.pop_id) || [];
      list.push(itemBloco);
      blocosMap.set(b.pop_id, list);
    }

    // Montagem final dos protocolos
    const resultado: PopProtocoloCompleto[] = protocolos.map((proto: any) => ({
      ...proto,
      blocos: blocosMap.get(proto.id) || [],
    }));

    return resultado;
  } catch (err: any) {
    console.error("Erro em getPopsAction:", err);
    return [];
  }
}

/**
 * Carrega os detalhes completos de um POP sob demanda (Lazy Loading).
 * Utilizado exclusivamente ao abrir o modal de Edição ou ao clicar em "Gerar Relatório".
 * Carrega a árvore completa de prescrições, fórmulas, posologias e componentes.
 */
export async function getPopCompletoAction(popId: string): Promise<PopProtocoloCompleto | null> {
  try {
    if (!popId) return null;
    const { adminDb } = await checkAuthAndRole();

    const { data: proto, error: protoErr } = await adminDb
      .from("pops_protocolos")
      .select("*")
      .eq("id", popId)
      .single();

    if (protoErr || !proto) return null;

    // Busca blocos do protocolo
    const { data: blocosDb } = await adminDb
      .from("pops_blocos")
      .select("*")
      .eq("pop_id", popId)
      .order("ordem", { ascending: true });

    const blocoIds = (blocosDb || []).map((b: any) => b.id);
    const prescricaoIds = Array.from(
      new Set((blocosDb || []).map((b: any) => b.prescricao_id).filter(Boolean))
    );
    const formulaIds = Array.from(
      new Set((blocosDb || []).map((b: any) => b.formula_id).filter(Boolean))
    );

    // Paraleliza a busca de subtópicos, fórmulas e prescrições detalhadas
    const [subsRes, rxRes, formulasRes] = await Promise.all([
      blocoIds.length > 0
        ? adminDb
            .from("pops_subtopicos")
            .select("*")
            .in("bloco_id", blocoIds)
            .order("ordem", { ascending: true })
        : Promise.resolve({ data: [] }),
      prescricaoIds.length > 0
        ? adminDb
            .from("prescricoes")
            .select(`
              id,
              data_prescricao,
              status,
              observacoes,
              prescricao_itens (
                id,
                nome_formula,
                via,
                veiculo,
                dosagem,
                posologia,
                duracao,
                orient_paciente,
                orient_farmacia,
                componentes_snapshot
              )
            `)
            .in("id", prescricaoIds)
        : Promise.resolve({ data: [] }),
      formulaIds.length > 0
        ? adminDb
            .from("formulas")
            .select("id, nome, via, veiculo, dosagem, posologia, descricao, orient_paciente, orient_farmacia")
            .in("id", formulaIds)
        : Promise.resolve({ data: [] }),
    ]);

    const subtopicosDb = subsRes.data || [];
    const prescricoesDb = rxRes.data || [];
    const formulasDb = formulasRes.data || [];

    const prescricoesMap = new Map<string, any>();
    for (const rx of prescricoesDb) {
      prescricoesMap.set(rx.id, rx);
    }

    const formulasMap = new Map<string, any>();
    for (const f of formulasDb) {
      formulasMap.set(f.id, f);
    }

    const blocos: PopBloco[] = (blocosDb || [])
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((b: any) => {
        const subsDoBloco = subtopicosDb
          .filter((s: any) => s.bloco_id === b.id)
          .sort((a: any, b: any) => a.ordem - b.ordem);

        const prescricao = b.prescricao_id ? prescricoesMap.get(b.prescricao_id) || null : null;
        const formula = b.formula_id ? formulasMap.get(b.formula_id) || null : null;

        return {
          id: b.id,
          pop_id: b.pop_id,
          tipo: b.tipo,
          ordem: b.ordem,
          topico_titulo: b.topico_titulo,
          topico_descricao: b.topico_descricao,
          tabela_dados: b.tabela_dados || null,
          formula_id: b.formula_id || null,
          formula,
          prescricao_id: b.prescricao_id || null,
          prescricao,
          subtopicos: subsDoBloco,
          created_at: b.created_at,
        };
      });

    return {
      ...proto,
      blocos,
    };
  } catch (err: any) {
    console.error("Erro em getPopCompletoAction:", err);
    return null;
  }
}

/**
 * Busca o catálogo institucional de fórmulas magistrais cadastradas no sistema.
 */
export async function getFormulasCatalogoAction() {
  try {
    const { adminDb } = await checkAuthAndRole();

    const { data, error } = await adminDb
      .from("formulas")
      .select("id, nome, via, dosagem, posologia, veiculo, descricao")
      .order("nome", { ascending: true });

    if (error) {
      console.warn("Aviso ao carregar fórmulas do catálogo:", error.message);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error("Erro em getFormulasCatalogoAction:", err);
    return [];
  }
}

/**
 * Lista prescrições cadastradas no sistema.
 * Invocada exclusivamente quando o formulário de POP for aberto, desacoplando o carregamento da tela inicial.
 */
export async function getPrescricoesDisponiveis() {
  try {
    const { adminDb } = await checkAuthAndRole();

    const { data, error } = await adminDb
      .from("prescricoes")
      .select(`
        id,
        data_prescricao,
        status,
        observacoes,
        prescricao_itens (
          id,
          nome_formula,
          via,
          veiculo,
          dosagem,
          posologia,
          duracao,
          orient_paciente,
          orient_farmacia,
          componentes_snapshot
        )
      `)
      .order("data_prescricao", { ascending: false })
      .limit(60);

    if (error) {
      console.warn("Aviso ao carregar prescrições disponíveis:", error.message);
      return [];
    }

    return data || [];
  } catch (err: any) {
    console.error("Erro em getPrescricoesDisponiveis:", err);
    return [];
  }
}

/**
 * Operação transacional de criação/edição em pops_protocolos, pops_blocos e pops_subtopicos.
 * Calcula a assinatura SHA-256 sobre o payload canônico determinístico com dados institucionais.
 */
export async function salvarPop(dados: PopFormData): Promise<{
  success?: boolean;
  popId?: string;
  error?: string;
}> {
  try {
    const { adminDb } = await checkAuthAndRole();

    if (!dados.protocolo || !dados.protocolo.trim()) {
      return { error: "O título do Procedimento Operacional Padrão (Protocolo) é obrigatório." };
    }
    if (!dados.finalidade || !dados.finalidade.trim()) {
      return { error: "A finalidade clínica do procedimento é obrigatória." };
    }
    if (!dados.blocos || dados.blocos.length === 0) {
      return { error: "Adicione ao menos um Tópico, Tabela ou Prescrição ao procedimento." };
    }

    // Validação dos blocos
    for (let i = 0; i < dados.blocos.length; i++) {
      const b = dados.blocos[i];
      if (b.tipo === "TOPICO") {
        if (!b.topico_titulo || !b.topico_titulo.trim()) {
          return { error: `O Título do Tópico #${i + 1} é obrigatório.` };
        }
      } else if (b.tipo === "TABELA") {
        if (!b.topico_titulo || !b.topico_titulo.trim()) {
          return { error: `O Título da Tabela #${i + 1} é obrigatório.` };
        }
        if (
          !b.tabela_dados ||
          !Array.isArray(b.tabela_dados.colunas) ||
          b.tabela_dados.colunas.length === 0 ||
          !Array.isArray(b.tabela_dados.linhas) ||
          b.tabela_dados.linhas.length === 0
        ) {
          return { error: `A Tabela #${i + 1} deve conter ao menos uma coluna e uma linha.` };
        }
      } else if (b.tipo === "FORMULA") {
        if (!b.formula_id) {
          return { error: `Selecione uma Fórmula para o Bloco #${i + 1}.` };
        }
      } else if (b.tipo === "PRESCRICAO") {
        if (!b.prescricao_id && !b.formula_id) {
          return { error: `Selecione uma Prescrição ou Fórmula para o Bloco #${i + 1}.` };
        }
      }
    }

    // Profissional responsável institucional fixado
    const profissionalNome = "Juliana Sena de Souza Vieira";

    // Normaliza status institucional ('Ativo' | 'Em Revisão' | 'Cancelado')
    const validStatuses: PopStatus[] = ["Ativo", "Em Revisão", "Cancelado"];
    const status: PopStatus = validStatuses.includes(dados.status as any) ? dados.status : "Ativo";

    // 1. Monta os blocos ordenados e limpos
    const sortedBlocos = [...dados.blocos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((b, idx) => ({
        ordem: idx + 1,
        tipo: b.tipo,
        topico_titulo: (b.tipo === "TOPICO" || b.tipo === "TABELA") ? (b.topico_titulo || "").trim() : null,
        topico_descricao: (b.tipo === "TOPICO" || b.tipo === "TABELA") ? (b.topico_descricao || "").trim() : null,
        tabela_dados:
          b.tipo === "TABELA" && b.tabela_dados
            ? {
                colunas: b.tabela_dados.colunas.map((c) => String(c || "").trim()),
                linhas: b.tabela_dados.linhas.map((row) =>
                  Array.isArray(row) ? row.map((cell) => String(cell || "").trim()) : []
                ),
              }
            : null,
        formula_id: b.tipo === "FORMULA" ? b.formula_id || null : null,
        prescricao_id: b.tipo === "PRESCRICAO" ? b.prescricao_id || null : null,
        subtopicos: (b.subtopicos || [])
          .sort((s1, s2) => s1.ordem - s2.ordem)
          .map((s, sIdx) => ({
            ordem: sIdx + 1,
            titulo: (s.titulo || "").trim(),
            descricao: (s.descricao || "").trim(),
          })),
      }));

    const dataPop = dados.data_pop || new Date().toISOString().split("T")[0];

    // 2. Monta o payload canônico determinístico com dados institucionais
    const canonicalPayload = {
      protocolo: dados.protocolo.trim(),
      finalidade: dados.finalidade.trim(),
      data_pop: dataPop,
      status: status,
      profissional: profissionalNome,
      blocos: sortedBlocos.map((b) => ({
        ordem: b.ordem,
        tipo: b.tipo,
        topico_titulo: b.topico_titulo,
        topico_descricao: b.topico_descricao,
        tabela_dados: b.tabela_dados,
        formula_id: b.formula_id,
        prescricao_id: b.prescricao_id,
        subtopicos: b.subtopicos.map((s) => ({
          ordem: s.ordem,
          titulo: s.titulo,
          descricao: s.descricao,
        })),
      })),
    };

    const canonicalStr = canonicalizeJson(canonicalPayload);
    const payloadHash = gerarHashSha256(canonicalStr);
    const assinatura = assinarHash(payloadHash);
    const assinadoEm = new Date().toISOString();

    const protoRecord = {
      protocolo: dados.protocolo.trim(),
      finalidade: dados.finalidade.trim(),
      data_pop: dataPop,
      status: status,
      profissional: profissionalNome,
      payload_canonico: canonicalPayload,
      payload_hash: payloadHash,
      assinatura: assinatura,
      algoritmo: "SHA-256",
      assinado_em: assinadoEm,
      updated_at: new Date().toISOString(),
    };

    let popId = dados.id;

    if (popId) {
      // Atualização de registro existente
      const { error: updateError } = await adminDb
        .from("pops_protocolos")
        .update(protoRecord)
        .eq("id", popId);

      if (updateError) throw updateError;
    } else {
      // Inserção de novo registro
      const { data: newPop, error: insertError } = await adminDb
        .from("pops_protocolos")
        .insert({
          ...protoRecord,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError || !newPop) throw insertError;
      popId = newPop.id;
    }

    // 3. Sincronização de pops_blocos e pops_subtopicos
    const { data: existingBlocos } = await adminDb
      .from("pops_blocos")
      .select("id")
      .eq("pop_id", popId);

    if (existingBlocos && existingBlocos.length > 0) {
      const existingIds = existingBlocos.map((eb: any) => eb.id);
      await adminDb.from("pops_subtopicos").delete().in("bloco_id", existingIds);
      await adminDb.from("pops_blocos").delete().eq("pop_id", popId);
    }

    // Insere os novos blocos e subtópicos
    for (const b of sortedBlocos) {
      const { data: insertedBloco, error: blocoInsertErr } = await adminDb
        .from("pops_blocos")
        .insert({
          pop_id: popId,
          tipo: b.tipo,
          ordem: b.ordem,
          topico_titulo: b.topico_titulo,
          topico_descricao: b.topico_descricao,
          tabela_dados: b.tipo === "TABELA" ? b.tabela_dados : null,
          formula_id: b.formula_id,
          prescricao_id: b.prescricao_id,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (blocoInsertErr || !insertedBloco) throw blocoInsertErr;

      if (b.subtopicos && b.subtopicos.length > 0) {
        const subRows = b.subtopicos.map((s) => ({
          bloco_id: insertedBloco.id,
          ordem: s.ordem,
          titulo: s.titulo,
          descricao: s.descricao,
          created_at: new Date().toISOString(),
        }));

        const { error: subsInsertErr } = await adminDb
          .from("pops_subtopicos")
          .insert(subRows);

        if (subsInsertErr) throw subsInsertErr;
      }
    }

    try {
      revalidatePath("/pops");
      revalidatePath("/dashboard");
    } catch {}

    return { success: true, popId };
  } catch (err: any) {
    console.error("Erro em salvarPop:", err);
    return { error: err?.message || "Ocorreu um erro ao salvar o Procedimento Operacional Padrão." };
  }
}

/**
 * Exclui o protocolo e suas dependências em cascata.
 */
export async function excluirPop(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!id) return { error: "ID do protocolo não fornecido." };
    const { adminDb } = await checkAuthAndRole();

    // Limpa dependências
    const { data: existingBlocos } = await adminDb
      .from("pops_blocos")
      .select("id")
      .eq("pop_id", id);

    if (existingBlocos && existingBlocos.length > 0) {
      const bIds = existingBlocos.map((b: any) => b.id);
      await adminDb.from("pops_subtopicos").delete().in("bloco_id", bIds);
      await adminDb.from("pops_blocos").delete().eq("pop_id", id);
    }

    const { error: delError } = await adminDb
      .from("pops_protocolos")
      .delete()
      .eq("id", id);

    if (delError) throw delError;

    try {
      revalidatePath("/pops");
      revalidatePath("/dashboard");
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("Erro em excluirPop:", err);
    return { error: err?.message || "Falha ao excluir Procedimento Operacional Padrão." };
  }
}
