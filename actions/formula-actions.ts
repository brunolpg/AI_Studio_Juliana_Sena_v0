"use server";

import { getSupabaseClient } from "@/lib/supabase/client";
import { revalidatePath } from "next/cache";

export async function getFormulasAction() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, data: [], error: "Supabase não configurado." };

    const { data, error } = await supabase
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

    if (error) {
      console.error("Erro ao buscar fórmulas:", error);
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error("Erro inesperado ao buscar fórmulas:", err);
    return { success: false, data: [], error: err.message || "Erro desconhecido" };
  }
}

export async function getComponentesAndUnidadesAction() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, componentes: [], unidades: [], error: "Supabase não configurado." };

    const [compRes, unRes] = await Promise.all([
      supabase.from("componentes").select("id, nome, unidade_id, unidades(id, unidade)").order("nome", { ascending: true }),
      supabase.from("unidades").select("id, unidade").order("unidade", { ascending: true }),
    ]);

    return {
      success: true,
      componentes: compRes.data || [],
      unidades: unRes.data || [],
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
    const supabase = getSupabaseClient();
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
        // Tenta limpar a fórmula criada caso falhe
        await supabase.from("formulas").delete().eq("id", formulaId);
        return { success: false, error: `Erro ao salvar componentes: ${itemsError.message}` };
      }
    }

    revalidatePath("/formulas");
    return { success: true, formulaId };
  } catch (err: any) {
    console.error("Erro inesperado ao criar fórmula:", err);
    return { success: false, error: err.message || "Erro interno ao cadastrar fórmula." };
  }
}

export async function createUnidadeQuickAction(nomeUnidade: string) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    const { data, error } = await supabase
      .from("unidades")
      .insert({ unidade: nomeUnidade.trim() })
      .select("id, unidade")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/formulas");
    return { success: true, unidade: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createComponenteQuickAction(nomeComponente: string, unidadeId: string) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    const { data, error } = await supabase
      .from("componentes")
      .insert({ nome: nomeComponente.trim(), unidade_id: unidadeId })
      .select("id, nome, unidade_id, unidades(id, unidade)")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/formulas");
    return { success: true, componente: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteFormulaAction(formulaId: string) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return { success: false, error: "Supabase não configurado." };

    // Deleta os componentes associados primeiro (ou cascade se configurado)
    await supabase.from("formula_componentes").delete().eq("formula_id", formulaId);
    const { error } = await supabase.from("formulas").delete().eq("id", formulaId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/formulas");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
