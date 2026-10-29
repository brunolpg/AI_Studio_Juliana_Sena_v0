"use server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { toSentenceCase } from "@/lib/utils";

export async function getFormulasAction() {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, data: [], error: "Supabase não configurado." };

    let data: any[] | null = null;
    let error: any = null;

    // 1. Tenta consulta completa com formula_componentes, componentes e unidades
    const res = await supabase
      .from("formulas")
      .select(`
        *,
        formula_componentes (
          id,
          quantidade,
          componente_id,
          componentes (
            id,
            nome,
            unidade_id,
            unidades (
              id,
              unidade
            )
          )
        )
      `)
      .order("nome", { ascending: true });

    data = res.data;
    error = res.error;

    // Fallback 1: Caso a relação aninhada com unidades falhe no PostgREST
    if (error || !data) {
      console.warn("Aviso ao consultar fórmulas com unidades, tentando fallback simplificado:", error?.message);
      const fallbackRes = await supabase
        .from("formulas")
        .select(`
          *,
          formula_componentes (
            id,
            quantidade,
            componente_id,
            componentes (
              id,
              nome,
              unidade_id
            )
          )
        `)
        .order("nome", { ascending: true });

      if (fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
      }
    }

    // Fallback 2: Caso a relação formula_componentes falhe, consulta direto a tabela formulas
    if (error || !data) {
      console.warn("Tentando consulta simples na tabela formulas:", error?.message);
      const simpleRes = await supabase
        .from("formulas")
        .select("*")
        .order("nome", { ascending: true });

      if (simpleRes.data) {
        data = simpleRes.data;
        error = null;
      }
    }

    // Fallback 3: Caso formulas esteja vazio, verifica se os modelos estão em prescription_templates
    if (!error && (!data || data.length === 0)) {
      try {
        const templatesRes = await supabase
          .from("prescription_templates")
          .select("*")
          .order("nome", { ascending: true });
        if (templatesRes.data && templatesRes.data.length > 0) {
          data = templatesRes.data;
        }
      } catch {
        // Tabela opcional, ignora se não existir
      }
    }

    if (error) {
      console.error("Erro ao buscar fórmulas no Supabase:", error);
      return { success: false, data: [], error: error.message };
    }

    // Mapeamento normalizado garantindo que componentes e formula_componentes estejam acessíveis
    const mapped = (data || []).map((f: any) => {
      const rawComps = f.formula_componentes || f.componentes || f.ativos || f.items || [];
      const formattedComps = rawComps.map((fc: any) => ({
        id: fc.componente_id || fc.id,
        nome: toSentenceCase(fc.componentes?.nome || fc.nome || fc.name || "Ativo"),
        quantidade: fc.quantidade,
        unidade_id: fc.componentes?.unidade_id || fc.unidade_id,
        unidade_sigla:
          fc.componentes?.unidades?.unidade ||
          fc.unidade_sigla ||
          fc.unidade ||
          "%",
      }));

      return {
        ...f,
        via: f.via ? (f.via.toLowerCase().includes("oral") ? "oral" : "tópico") : "tópico",
        componentes: formattedComps,
        formula_componentes: f.formula_componentes || rawComps,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    console.error("Erro inesperado ao buscar fórmulas:", err);
    return { success: false, data: [], error: err.message || "Erro desconhecido" };
  }
}

export async function getComponentesAndUnidadesAction() {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, componentes: [], unidades: [], error: "Supabase não configurado." };

    let componentesData: any[] = [];
    let unidadesData: any[] = [];

    const compRes = await supabase
      .from("componentes")
      .select("id, nome, unidade_id, unidades(id, unidade)")
      .order("nome", { ascending: true });

    if (compRes.error) {
      const fallbackComp = await supabase
        .from("componentes")
        .select("id, nome, unidade_id")
        .order("nome", { ascending: true });
      componentesData = fallbackComp.data || [];
    } else {
      componentesData = compRes.data || [];
    }

    const unRes = await supabase.from("unidades").select("id, unidade").order("unidade", { ascending: true });
    unidadesData = unRes.data || [];

    const mappedComps = componentesData.map((c: any) => ({
      ...c,
      nome: toSentenceCase(c.nome),
    }));

    return {
      success: true,
      componentes: mappedComps,
      unidades: unidadesData,
    };
  } catch (err: any) {
    console.error("Erro ao buscar componentes/unidades:", err);
    return { success: false, componentes: [], unidades: [], error: err.message };
  }
}

export async function createFormulaAction(formData: {
  nome: string;
  descricao?: string | null;
  via: "oral" | "tópico";
  veiculo?: string | null;
  dosagem?: number | null;
  tipo_veiculo?: "dose(s)" | "sachê(s)" | "comprimido(s)" | null;
  posologia?: string | null;
  orient_paciente?: string | null;
  orient_farmacia?: string | null;
  componentes: { componente_id: string; quantidade: number }[];
}) {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    // 1. Inserir fórmula
    const { data: formulaData, error: formulaError } = await supabase
      .from("formulas")
      .insert({
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        via: formData.via,
        veiculo: formData.veiculo?.trim() || null,
        dosagem: formData.dosagem ?? null,
        tipo_veiculo: formData.tipo_veiculo || null,
        posologia: formData.posologia?.trim() || null,
        orient_paciente: formData.orient_paciente?.trim() || null,
        orient_farmacia: formData.orient_farmacia?.trim() || null,
      })
      .select("id")
      .single();

    if (formulaError || !formulaData) {
      return { success: false, error: formulaError?.message || "Falha ao criar fórmula." };
    }

    const formulaId = formulaData.id;

    // 2. Inserir componentes da fórmula
    if (formData.componentes && formData.componentes.length > 0) {
      const itemsToInsert = formData.componentes.map((c) => ({
        formula_id: formulaId,
        componente_id: c.componente_id,
        quantidade: c.quantidade,
      }));

      const { error: itemsError } = await supabase
        .from("formula_componentes")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Erro ao inserir componentes da fórmula:", itemsError);
        await supabase.from("formulas").delete().eq("id", formulaId);
        return { success: false, error: `Erro ao salvar componentes: ${itemsError.message}` };
      }
    }

    revalidatePath("/formulas");
    revalidatePath("/dashboard/formulas");
    return { success: true, formulaId };
  } catch (err: any) {
    console.error("Erro inesperado ao criar fórmula:", err);
    return { success: false, error: err.message || "Erro interno ao cadastrar fórmula." };
  }
}

export async function createUnidadeQuickAction(nomeUnidade: string) {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    const { data, error } = await supabase
      .from("unidades")
      .insert({ unidade: nomeUnidade.trim() })
      .select("id, unidade")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/formulas");
    revalidatePath("/dashboard/formulas");
    return { success: true, unidade: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createComponenteQuickAction(nomeComponente: string, unidadeId: string) {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    const formattedNome = toSentenceCase(nomeComponente);

    const { data, error } = await supabase
      .from("componentes")
      .insert({ nome: formattedNome, unidade_id: unidadeId })
      .select("id, nome, unidade_id, unidades(id, unidade)")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/formulas");
    revalidatePath("/dashboard/formulas");
    return { success: true, componente: { ...data, nome: toSentenceCase(data.nome) } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteFormulaAction(formulaId: string) {
  try {
    const supabase = getSupabaseAdminClient() || (await createClient());
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    await supabase.from("formula_componentes").delete().eq("formula_id", formulaId);
    const { error } = await supabase.from("formulas").delete().eq("id", formulaId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/formulas");
    revalidatePath("/dashboard/formulas");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
