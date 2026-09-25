"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { clientSchema, clientFilterSchema } from "@/lib/validations/client-schema";
import { calculateAge } from "@/lib/brazil-data";
import { INITIAL_CLIENTS } from "@/lib/mock-data";
import { getSession } from "@/lib/auth/session";
import type {
  Client,
  ClientInput,
  ClientFilter,
  PaginatedResult,
  ActionResponse,
} from "@/types/client";

// Armazenamento em memória para demonstração / preview enquanto as chaves do Supabase não forem injetadas
let memoryClients: Client[] = [...INITIAL_CLIENTS];

/**
 * Normaliza erros do Zod em um mapa chave/valor amigável
 */
function formatZodErrors(errors: unknown): Record<string, string[]> {
  if (typeof errors === "object" && errors !== null && "issues" in errors) {
    const issues = (errors as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const formatted: Record<string, string[]> = {};
    for (const issue of issues) {
      const key = issue.path[0] ? String(issue.path[0]) : "geral";
      if (!formatted[key]) {
        formatted[key] = [];
      }
      formatted[key].push(issue.message);
    }
    return formatted;
  }
  return { geral: ["Erro de validação nos dados fornecidos."] };
}

/**
 * 1. LISTAGEM COM BUSCA EM TEMPO REAL, FILTROS POR STATUS E PAGINAÇÃO
 */
export async function getClientsAction(
  rawFilters: Partial<ClientFilter>
): Promise<ActionResponse<PaginatedResult<Client>>> {
  try {
    const filterParsed = clientFilterSchema.safeParse(rawFilters);
    if (!filterParsed.success) {
      return {
        success: false,
        message: "Filtros inválidos",
        errors: formatZodErrors(filterParsed.error),
      };
    }

    const { search, status, page, pageSize, sortBy, sortOrder } = filterParsed.data;
    const supabase = getSupabaseAdminClient();

    // Se o Supabase estiver configurado, executa queries nativas no PostgreSQL
    if (supabase) {
      let query = supabase.from("pacientes").select("*", { count: "exact" });

      // Filtro de Soft Delete e Status
      if (status === "excluidos") {
        query = query.not("deleted_at", "is", null);
      } else {
        query = query.is("deleted_at", null);
        if (status === "Ativo" || status === "Inativo") {
          query = query.eq("status", status);
        }
      }

      // Busca textual em tempo real (Nome, CPF ou E-mail)
      if (search && search.trim().length > 0) {
        const term = search.trim();
        query = query.or(`nome.ilike.%${term}%,cpf.ilike.%${term}%,email.ilike.%${term}%`);
      }

      // Ordenação
      query = query.order(sortBy, { ascending: sortOrder === "asc" });

      // Paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error("Erro Supabase getClients:", error);
        return {
          success: false,
          message: `Erro ao consultar banco de dados: ${error.message}`,
        };
      }

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        success: true,
        data: {
          data: (data as Client[]) || [],
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    }

    // Fallback em memória (para uso imediato no AI Studio Preview sem configuração prévia de chaves)
    let filtered = [...memoryClients];

    if (status === "excluidos") {
      filtered = filtered.filter((c) => c.deleted_at !== null);
    } else {
      filtered = filtered.filter((c) => c.deleted_at === null);
      if (status === "Ativo" || status === "Inativo") {
        filtered = filtered.filter((c) => c.status === status);
      }
    }

    if (search && search.trim().length > 0) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.nome.toLowerCase().includes(term) ||
          c.cpf.includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.cidade.toLowerCase().includes(term)
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "nome") {
        comparison = a.nome.localeCompare(b.nome);
      } else if (sortBy === "idade") {
        comparison = a.idade - b.idade;
      } else if (sortBy === "cidade") {
        comparison = a.cidade.localeCompare(b.cidade);
      } else {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = filtered.slice(startIndex, startIndex + pageSize);

    return {
      success: true,
      data: {
        data: paginatedItems,
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  } catch (error) {
    console.error("Erro inesperado em getClientsAction:", error);
    return {
      success: false,
      message: "Ocorreu um erro interno ao processar a listagem.",
    };
  }
}

/**
 * 2. BUSCA POR ID
 */
export async function getClientByIdAction(id: string): Promise<ActionResponse<Client>> {
  try {
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        return {
          success: false,
          message: "Cliente/Paciente não encontrado no banco de dados.",
        };
      }

      return { success: true, data: data as Client };
    }

    const found = memoryClients.find((c) => c.id === id);
    if (!found) {
      return { success: false, message: "Paciente não encontrado." };
    }

    return { success: true, data: found };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao buscar paciente: ${(error as Error).message}`,
    };
  }
}

/**
 * 3. CRIAÇÃO DE PACIENTE COM VALIDAÇÃO ZOD E CÁLCULO SEGURO DE IDADE
 */
export async function createClientAction(
  rawInput: unknown
): Promise<ActionResponse<Client>> {
  try {
    // 0. Verificação de autorização baseada em sessão JWT
    const sessionUser = await getSession();
    if (!sessionUser) {
      return {
        success: false,
        message: "Acesso não autorizado. É necessário fazer login para cadastrar pacientes.",
      };
    }

    // 1. Validação estrita dos dados recebidos via Zod
    const validationResult = clientSchema.safeParse(rawInput);
    if (!validationResult.success) {
      return {
        success: false,
        message: "Por favor, corrija os erros no formulário antes de salvar.",
        errors: formatZodErrors(validationResult.error),
      };
    }

    const validData: ClientInput = validationResult.data;

    // 2. Garantia de integridade no servidor: recalcula a idade a partir da data de nascimento
    const calculatedAge = calculateAge(validData.data_nascimento);
    if (calculatedAge === null) {
      return {
        success: false,
        message: "Data de nascimento inválida.",
        errors: { data_nascimento: ["Não foi possível calcular a idade do paciente."] },
      };
    }
    validData.idade = calculatedAge;

    const supabase = getSupabaseAdminClient();

    // Inserção no Supabase PostgreSQL
    if (supabase) {
      // Verifica duplicidade de CPF ativo
      const { data: existingCpf } = await supabase
        .from("pacientes")
        .select("id")
        .eq("cpf", validData.cpf)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingCpf) {
        return {
          success: false,
          message: "Já existe um paciente ativo cadastrado com este CPF.",
          errors: { cpf: ["Este CPF já está registrado para outro paciente ativo."] },
        };
      }

      const { data, error } = await supabase
        .from("pacientes")
        .insert([
          {
            ...validData,
            deleted_at: null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Erro Supabase createClient:", error);
        return {
          success: false,
          message: `Erro ao salvar paciente no Supabase: ${error.message}`,
        };
      }

      revalidatePath("/");
      return {
        success: true,
        message: "Paciente cadastrado com sucesso!",
        data: data as Client,
      };
    }

    // Fallback de memória
    const cpfConflict = memoryClients.some(
      (c) => c.cpf === validData.cpf && c.deleted_at === null
    );
    if (cpfConflict) {
      return {
        success: false,
        message: "Já existe um paciente ativo com este CPF.",
        errors: { cpf: ["Este CPF já está em uso."] },
      };
    }

    const now = new Date().toISOString();
    const newClient: Client = {
      ...validData,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    memoryClients.unshift(newClient);
    revalidatePath("/");

    return {
      success: true,
      message: "Paciente cadastrado com sucesso!",
      data: newClient,
    };
  } catch (error) {
    console.error("Erro em createClientAction:", error);
    return {
      success: false,
      message: `Erro interno do servidor: ${(error as Error).message}`,
    };
  }
}

/**
 * 4. ATUALIZAÇÃO DE PACIENTE (EDIÇÃO COMPLETA)
 */
export async function updateClientAction(
  id: string,
  rawInput: unknown
): Promise<ActionResponse<Client>> {
  try {
    if (!id) {
      return { success: false, message: "ID do paciente é obrigatório." };
    }

    // 0. Verificação de autorização baseada em sessão JWT
    const sessionUser = await getSession();
    if (!sessionUser) {
      return {
        success: false,
        message: "Acesso não autorizado. É necessário fazer login para editar dados de pacientes.",
      };
    }

    // Validação Zod
    const validationResult = clientSchema.safeParse(rawInput);
    if (!validationResult.success) {
      return {
        success: false,
        message: "Verifique os erros nos campos informados.",
        errors: formatZodErrors(validationResult.error),
      };
    }

    const validData: ClientInput = validationResult.data;

    // Recalcula idade no servidor
    const calculatedAge = calculateAge(validData.data_nascimento);
    if (calculatedAge === null) {
      return {
        success: false,
        message: "Data de nascimento inválida.",
        errors: { data_nascimento: ["Não foi possível calcular a idade."] },
      };
    }
    validData.idade = calculatedAge;

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      // Verifica duplicidade de CPF com outro paciente ativo
      const { data: existingCpf } = await supabase
        .from("pacientes")
        .select("id")
        .eq("cpf", validData.cpf)
        .neq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingCpf) {
        return {
          success: false,
          message: "Este CPF já está cadastrado para outro paciente.",
          errors: { cpf: ["CPF já em uso por outro cadastro."] },
        };
      }

      const { data, error } = await supabase
        .from("pacientes")
        .update({
          ...validData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `Erro ao atualizar paciente: ${error.message}`,
        };
      }

      revalidatePath("/");
      return {
        success: true,
        message: "Dados do paciente atualizados com sucesso!",
        data: data as Client,
      };
    }

    // Fallback de memória
    const index = memoryClients.findIndex((c) => c.id === id);
    if (index === -1) {
      return { success: false, message: "Paciente não encontrado para edição." };
    }

    const cpfConflict = memoryClients.some(
      (c) => c.cpf === validData.cpf && c.id !== id && c.deleted_at === null
    );
    if (cpfConflict) {
      return {
        success: false,
        message: "CPF já em uso por outro paciente.",
        errors: { cpf: ["CPF duplicado."] },
      };
    }

    const updatedClient: Client = {
      ...memoryClients[index],
      ...validData,
      updated_at: new Date().toISOString(),
    };

    memoryClients[index] = updatedClient;
    revalidatePath("/");

    return {
      success: true,
      message: "Dados do paciente atualizados com sucesso!",
      data: updatedClient,
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao atualizar paciente: ${(error as Error).message}`,
    };
  }
}

/**
 * 5. EXCLUSÃO LÓGICA (SOFT DELETE)
 * Atualiza o campo deleted_at com a data/hora atual e inativa o status,
 * preservando o histórico de dados e auditoria no PostgreSQL.
 */
export async function softDeleteClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    if (!id) {
      return { success: false, message: "ID do paciente é obrigatório." };
    }

    // 0. Verificação de autorização baseada em sessão JWT
    const sessionUser = await getSession();
    if (!sessionUser) {
      return {
        success: false,
        message: "Acesso não autorizado. É necessário fazer login para mover pacientes para a lixeira.",
      };
    }

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("pacientes")
        .update({
          deleted_at: now,
          status: "Inativo",
          updated_at: now,
        })
        .eq("id", id);

      if (error) {
        return {
          success: false,
          message: `Erro ao inativar paciente: ${error.message}`,
        };
      }

      revalidatePath("/");
      return {
        success: true,
        message: "Paciente movido para a lixeira com sucesso!",
      };
    }

    // Fallback de memória
    const client = memoryClients.find((c) => c.id === id);
    if (!client) {
      return { success: false, message: "Paciente não localizado." };
    }

    client.deleted_at = new Date().toISOString();
    client.status = "Inativo";
    client.updated_at = new Date().toISOString();

    revalidatePath("/");
    return {
      success: true,
      message: "Paciente movido para a lixeira (exclusão lógica) com sucesso!",
    };
  } catch (error) {
    return {
      success: false,
      message: `Falha na exclusão lógica: ${(error as Error).message}`,
    };
  }
}

/**
 * 6. RESTAURAÇÃO DE PACIENTE EXCLUÍDO
 */
export async function restoreClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    // 0. Verificação de autorização baseada em sessão JWT
    const sessionUser = await getSession();
    if (!sessionUser) {
      return {
        success: false,
        message: "Acesso não autorizado. É necessário fazer login para restaurar pacientes.",
      };
    }

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("pacientes")
        .update({
          deleted_at: null,
          status: "Ativo",
          updated_at: now,
        })
        .eq("id", id);

      if (error) {
        return {
          success: false,
          message: `Erro ao restaurar: ${error.message}`,
        };
      }

      revalidatePath("/");
      return {
        success: true,
        message: "Paciente restaurado com sucesso!",
      };
    }

    const client = memoryClients.find((c) => c.id === id);
    if (!client) {
      return { success: false, message: "Paciente não localizado." };
    }

    client.deleted_at = null;
    client.status = "Ativo";
    client.updated_at = new Date().toISOString();

    revalidatePath("/");
    return {
      success: true,
      message: "Paciente restaurado com sucesso para a lista ativa!",
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao restaurar: ${(error as Error).message}`,
    };
  }
}

/**
 * 7. EXCLUSÃO DEFINITIVA (HARD DELETE)
 */
export async function permanentDeleteClientAction(id: string): Promise<ActionResponse<void>> {
  try {
    // 0. Verificação de autorização baseada em sessão JWT
    const sessionUser = await getSession();
    if (!sessionUser) {
      return {
        success: false,
        message: "Acesso não autorizado. É necessário fazer login para excluir registros permanentemente.",
      };
    }

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      const { error } = await supabase.from("pacientes").delete().eq("id", id);
      if (error) {
        return {
          success: false,
          message: `Erro ao excluir definitivamente: ${error.message}`,
        };
      }

      revalidatePath("/");
      return {
        success: true,
        message: "Registro excluído permanentemente do banco de dados.",
      };
    }

    memoryClients = memoryClients.filter((c) => c.id !== id);
    revalidatePath("/");
    return {
      success: true,
      message: "Registro excluído permanentemente.",
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao excluir permanentemente: ${(error as Error).message}`,
    };
  }
}
