"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { canonicalizeJson, gerarHashSha256, assinarHash } from "@/lib/crypto-payload";
import type { PopFormData, PopProtocoloCompleto, PopBloco, PopSubtopico } from "@/types/pop";

/**
 * Validação de sessão e autorização:
 * Exclusivo para usuários autenticados com perfis 'administrador' ou 'profissional'.
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

  // Busca papel no banco
  const { data: profile } = await adminDb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const rawRole = (profile?.role || (user as any).user_metadata?.role || "")
    .toLowerCase()
    .trim();

  const isEmailAdmin =
    user.email?.toLowerCase() === "brunolpg@gmail.com" ||
    user.email?.toLowerCase().includes("admin");

  const isAuthorized =
    rawRole === "administrador" ||
    rawRole === "admin" ||
    rawRole === "profissional" ||
    isEmailAdmin;

  if (!isAuthorized) {
    throw new Error(
      "Acesso não autorizado. Apenas administradores e profissionais têm permissão para acessar o módulo de POPs."
    );
  }

  return { user, profile, serverClient, adminDb };
}

/**
 * Retorna todos os POPs cadastrados de um paciente ativo (deleted_at IS NULL)
 * com seus blocos e subtópicos ordenados por ordem ASC.
 */
export async function getPopsByPaciente(pacienteId: string): Promise<PopProtocoloCompleto[]> {
  try {
    if (!pacienteId) return [];
    const { adminDb } = await checkAuthAndRole();

    // 1. Verifica se o paciente está ativo
    const { data: paciente, error: pacError } = await adminDb
      .from("pacientes")
      .select("id, nome, cpf, data_nascimento, email, telefone, idade")
      .eq("id", pacienteId)
      .is("deleted_at", null)
      .maybeSingle();

    if (pacError || !paciente) {
      return [];
    }

    // 2. Busca os POPs do paciente
    const { data: protocolos, error: popError } = await adminDb
      .from("pops_protocolos")
      .select(`
        *,
        appointment:appointments (id, data, horario_inicio, horario_fim, procedimento)
      `)
      .eq("paciente_id", pacienteId)
      .order("data_pop", { ascending: false })
      .order("created_at", { ascending: false });

    if (popError) {
      console.warn("Aviso ao carregar pops_protocolos:", popError.message);
      return [];
    }

    if (!protocolos || protocolos.length === 0) return [];

    const popIds = protocolos.map((p: any) => p.id);

    // 3. Busca blocos vinculados aos POPs
    const { data: blocosDb, error: blocosError } = await adminDb
      .from("pops_blocos")
      .select("*")
      .in("pop_id", popIds)
      .order("ordem", { ascending: true });

    if (blocosError) {
      console.warn("Aviso ao carregar pops_blocos:", blocosError.message);
    }

    const blocoIds = (blocosDb || []).map((b: any) => b.id);

    // 4. Busca subtópicos vinculados aos blocos
    let subtopicosDb: any[] = [];
    if (blocoIds.length > 0) {
      const { data: subs, error: subsError } = await adminDb
        .from("pops_subtopicos")
        .select("*")
        .in("bloco_id", blocoIds)
        .order("ordem", { ascending: true });

      if (subsError) {
        console.warn("Aviso ao carregar pops_subtopicos:", subsError.message);
      } else {
        subtopicosDb = subs || [];
      }
    }

    // 5. Busca prescrições vinculadas aos blocos do tipo PRESCRICAO
    const prescricaoIds = Array.from(
      new Set((blocosDb || []).map((b: any) => b.prescricao_id).filter(Boolean))
    );

    let prescricoesMap = new Map<string, any>();
    if (prescricaoIds.length > 0) {
      const { data: prescricoesDb, error: rxErr } = await adminDb
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
        .in("id", prescricaoIds);

      if (!rxErr && prescricoesDb) {
        for (const rx of prescricoesDb) {
          prescricoesMap.set(rx.id, rx);
        }
      }
    }

    // 6. Montagem dos protocolos completos
    const resultado: PopProtocoloCompleto[] = protocolos.map((proto: any) => {
      const blocosDoPop = (blocosDb || [])
        .filter((b: any) => b.pop_id === proto.id)
        .sort((a: any, b: any) => a.ordem - b.ordem)
        .map((b: any) => {
          const subsDoBloco = subtopicosDb
            .filter((s: any) => s.bloco_id === b.id)
            .sort((a: any, b: any) => a.ordem - b.ordem);

          const prescricao = b.prescricao_id ? prescricoesMap.get(b.prescricao_id) || null : null;

          return {
            id: b.id,
            pop_id: b.pop_id,
            tipo: b.tipo,
            ordem: b.ordem,
            topico_titulo: b.topico_titulo,
            topico_descricao: b.topico_descricao,
            prescricao_id: b.prescricao_id,
            prescricao,
            subtopicos: subsDoBloco,
            created_at: b.created_at,
          } as PopBloco;
        });

      return {
        ...proto,
        paciente,
        blocos: blocosDoPop,
      };
    });

    return resultado;
  } catch (err: any) {
    console.error("Erro em getPopsByPaciente:", err);
    return [];
  }
}

/**
 * Lista as prescrições cadastradas do paciente com prescricao_itens
 * para seleção no formulário de POP.
 */
export async function getPrescricoesDisponiveis(pacienteId: string) {
  try {
    if (!pacienteId) return [];
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
      .eq("paciente_id", pacienteId)
      .order("data_prescricao", { ascending: false });

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
 * Calcula a assinatura SHA-256 sobre o payload canônico determinístico.
 */
export async function salvarPop(dados: PopFormData): Promise<{
  success?: boolean;
  popId?: string;
  error?: string;
}> {
  try {
    const { adminDb } = await checkAuthAndRole();

    if (!dados.paciente_id) {
      return { error: "Paciente é obrigatório." };
    }
    if (!dados.protocolo || !dados.protocolo.trim()) {
      return { error: "O título do Procedimento Operacional Padrão (Protocolo) é obrigatório." };
    }
    if (!dados.finalidade || !dados.finalidade.trim()) {
      return { error: "A finalidade clínica do procedimento é obrigatória." };
    }
    if (!dados.blocos || dados.blocos.length === 0) {
      return { error: "Adicione ao menos um Tópico ou Prescrição ao procedimento." };
    }

    // Validação dos blocos
    for (let i = 0; i < dados.blocos.length; i++) {
      const b = dados.blocos[i];
      if (b.tipo === "TOPICO") {
        if (!b.topico_titulo || !b.topico_titulo.trim()) {
          return { error: `O Título do Tópico #${i + 1} é obrigatório.` };
        }
      } else if (b.tipo === "PRESCRICAO") {
        if (!b.prescricao_id) {
          return { error: `Selecione uma Prescrição para o Bloco #${i + 1}.` };
        }
      }
    }

    // Padroniza profissional responsável oficial
    let profissionalNome = dados.profissional;
    if (
      !profissionalNome ||
      profissionalNome.toLowerCase().includes("bruno") ||
      profissionalNome.includes("@") ||
      profissionalNome === "Dra. Juliana Sena"
    ) {
      profissionalNome = "Juliana Sena de Souza Vieira";
    }

    // 1. Monta os blocos ordenados e limpos
    const sortedBlocos = [...dados.blocos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((b, idx) => ({
        ordem: idx + 1,
        tipo: b.tipo,
        topico_titulo: b.tipo === "TOPICO" ? (b.topico_titulo || "").trim() : null,
        topico_descricao: b.tipo === "TOPICO" ? (b.topico_descricao || "").trim() : null,
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

    // 2. Monta o payload canônico determinístico
    const canonicalPayload = {
      paciente_id: dados.paciente_id,
      appointment_id: dados.appointment_id || null,
      protocolo: dados.protocolo.trim(),
      finalidade: dados.finalidade.trim(),
      data_pop: dataPop,
      status: dados.status || "Ativo",
      profissional: profissionalNome,
      blocos: sortedBlocos.map((b) => ({
        ordem: b.ordem,
        tipo: b.tipo,
        topico_titulo: b.topico_titulo,
        topico_descricao: b.topico_descricao,
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
      paciente_id: dados.paciente_id,
      appointment_id: dados.appointment_id || null,
      protocolo: dados.protocolo.trim(),
      finalidade: dados.finalidade.trim(),
      data_pop: dataPop,
      status: dados.status || "Ativo",
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
    // Busca blocos existentes para exclusão de dependências
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
