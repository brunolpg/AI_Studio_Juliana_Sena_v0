import { z } from "zod";
import { clientSchema, clientFilterSchema, GenderEnum, StatusEnum } from "@/lib/validations/client-schema";

/**
 * Tipos fundamentais inferidos a partir dos Enums do Zod
 */
export type Gender = z.infer<typeof GenderEnum>;
export type ClientStatus = z.infer<typeof StatusEnum>;

/**
 * 2. Tipagem TypeScript inferida diretamente do Zod para o formulário / payload de entrada
 */
export type ClientInput = z.infer<typeof clientSchema>;

/**
 * Tipagem de formulário bruto (antes da conversão/validação estrita)
 */
export type ClientFormRawValues = Omit<ClientInput, "idade"> & {
  idade: number | string;
};

/**
 * Tipagem completa da entidade Cliente/Paciente persistida no banco de dados (Supabase PostgreSQL)
 * Contém colunas geradas pelo banco e metadados de controle de concorrência e soft delete.
 */
export interface Client extends ClientInput {
  id: string; // UUID v4 gerado pelo PostgreSQL
  foto_perfil?: string | null; // Foto de perfil em Base64
  created_at: string; // Timestamp ISO 8601 de criação
  updated_at: string; // Timestamp ISO 8601 atualizado via trigger
  deleted_at: string | null; // Timestamp de soft delete (NULL se ativo no sistema)
}

/**
 * Tipagem inferida para filtros de consulta e paginação
 */
export type ClientFilter = z.infer<typeof clientFilterSchema>;

/**
 * Estrutura padronizada para retornos paginados de listagem
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Estrutura padronizada de resposta para Server Actions (Success / Error)
 */
export interface ActionResponse<T = void> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}
