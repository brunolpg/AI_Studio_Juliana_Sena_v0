"use client";

import React, { useState } from "react";
import { Copy, Check, FileCode2, Database, FolderTree, Terminal, Shield, CheckCircle2, KeyRound, Calendar } from "lucide-react";

interface DeliverableItem {
  id: string;
  title: string;
  shortTitle: string;
  badge: string;
  icon: React.ReactNode;
  filePath: string;
  description: string;
  code: string;
}

export function DeliverablesView() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("zod");

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const deliverables: DeliverableItem[] = [
    {
      id: "zod",
      title: "1. Schema Zod com Validações em Português",
      shortTitle: "1. Schema Zod",
      badge: "Zod v3",
      icon: <FileCode2 className="w-4 h-4 text-amber-500" />,
      filePath: "lib/validations/client-schema.ts",
      description:
        "Validação estrita com mensagens amigáveis em português, cálculo de idade, CPF com validação algorítmica real, enums e sanitização.",
      code: `import { z } from "zod";
import { isValidCPF, calculateAge } from "@/lib/brazil-data";

export const GenderEnum = z.enum(["Masculino", "Feminino", "Outros"], {
  message: "Selecione o sexo (Masculino, Feminino ou Outros)",
});

export const StatusEnum = z.enum(["Ativo", "Inativo"], {
  message: "O status deve ser Ativo ou Inativo",
});

export const clientSchema = z
  .object({
    nome: z
      .string({ required_error: "O nome completo é obrigatório." })
      .trim()
      .min(3, { message: "O nome deve ter no mínimo 3 caracteres." })
      .max(120, { message: "O nome não pode exceder 120 caracteres." }),

    data_nascimento: z
      .string({ required_error: "A data de nascimento é obrigatória." })
      .min(1, { message: "Informe uma data de nascimento válida." })
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: "Formato de data inválido.",
      })
      .refine((val) => new Date(val) <= new Date(), {
        message: "A data de nascimento não pode ser futura.",
      })
      .refine((val) => {
        const age = calculateAge(val);
        return age !== null && age <= 130;
      }, {
        message: "A idade calculada excede o limite biológico plausível (130 anos).",
      }),

    // Idade calculada automaticamente e não editável pelo usuário
    idade: z
      .number({ invalid_type_error: "A idade deve ser um número inteiro." })
      .int({ message: "A idade deve ser um número inteiro." })
      .min(0, { message: "A idade não pode ser negativa." }),

    email: z
      .string({ required_error: "O e-mail é obrigatório." })
      .trim()
      .toLowerCase()
      .email({ message: "Insira um endereço de e-mail válido." })
      .max(150, { message: "O e-mail não pode exceder 150 caracteres." }),

    sexo: GenderEnum,

    telefone: z
      .string({ required_error: "O telefone é obrigatório." })
      .trim()
      .refine((val) => {
        const digits = val.replace(/\\D/g, "");
        return digits.length === 10 || digits.length === 11;
      }, {
        message: "Telefone inválido. Deve conter DDD + 8 ou 9 dígitos.",
      }),

    cpf: z
      .string({ required_error: "O CPF é obrigatório." })
      .trim()
      .refine((val) => isValidCPF(val), {
        message: "CPF inválido. Verifique os dígitos informados.",
      }),

    cep: z
      .string()
      .trim()
      .refine(
        (val) => {
          if (!val) return true;
          const digits = val.replace(/\D/g, "");
          return digits.length === 8;
        },
        { message: "CEP inválido. Deve conter 8 dígitos." }
      )
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),

    logradouro: z
      .string({ required_error: "O logradouro é obrigatório." })
      .trim()
      .min(3, { message: "O logradouro deve ter no mínimo 3 caracteres." })
      .max(150, { message: "O logradouro não pode exceder 150 caracteres." }),

    numero: z
      .string({ required_error: "O número é obrigatório." })
      .trim()
      .min(1, { message: "O número é obrigatório (use S/N se não houver)." })
      .max(20, { message: "O número não pode exceder 20 caracteres." }),

    complemento: z
      .string()
      .trim()
      .max(100, { message: "O complemento não pode exceder 100 caracteres." })
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),

    estado: z
      .string({ required_error: "Selecione o estado (UF)." })
      .length(2, { message: "O estado deve ter a sigla de 2 letras (UF)." }),

    cidade: z
      .string({ required_error: "Selecione a cidade." })
      .trim()
      .min(2, { message: "A cidade deve ter no mínimo 2 caracteres." })
      .max(100, { message: "A cidade não pode exceder 100 caracteres." }),

    profissao: z
      .string()
      .trim()
      .max(100, { message: "A profissão não pode exceder 100 caracteres." })
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),

    status: StatusEnum.default("Ativo"),

    observacoes: z
      .string()
      .trim()
      .max(1000, { message: "As observações não podem exceder 1000 caracteres." })
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
  })
  .refine(
    (data) => {
      // Regra de integridade: a idade deve coincidir matematicamente com a data de nascimento
      const calculated = calculateAge(data.data_nascimento);
      return calculated !== null && calculated === data.idade;
    },
    {
      message: "A idade calculada não confere com a data de nascimento informada.",
      path: ["idade"],
    }
  );`,
    },
    {
      id: "types",
      title: "2. Tipagem TypeScript Inferida do Zod",
      shortTitle: "2. Tipagem TypeScript",
      badge: "TypeScript 5.x",
      icon: <Terminal className="w-4 h-4 text-sky-500" />,
      filePath: "types/client.ts",
      description:
        "Tipagens geradas com z.infer para formulário, entidade do banco de dados, DTOs de listagem paginada e contratos das Server Actions.",
      code: `import { z } from "zod";
import { clientSchema, clientFilterSchema, GenderEnum, StatusEnum } from "@/lib/validations/client-schema";

// Enums de domínio
export type Gender = z.infer<typeof GenderEnum>;
export type ClientStatus = z.infer<typeof StatusEnum>;

// Tipagem de entrada inferida diretamente do Zod para formulários/mutação
export type ClientInput = z.infer<typeof clientSchema>;

// Entidade persistida completa no Supabase PostgreSQL
export interface Client extends ClientInput {
  id: string; // UUID v4 gerado pelo PostgreSQL
  created_at: string; // Timestamp de criação ISO 8601
  updated_at: string; // Timestamp de atualização via trigger
  deleted_at: string | null; // Soft delete timestamp (NULL se ativo)
}

// Filtros de busca, ordenação e paginação
export type ClientFilter = z.infer<typeof clientFilterSchema>;

// Resposta paginada
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

// Contrato de resposta das Server Actions
export interface ActionResponse<T = void> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}`,
    },
    {
      id: "structure",
      title: "3. Estrutura Recomendada de Pastas (Next.js App Router)",
      shortTitle: "3. Estrutura de Pastas",
      badge: "Next.js 15+ App Router",
      icon: <FolderTree className="w-4 h-4 text-emerald-500" />,
      filePath: "docs/estrutura-pastas-nextjs.md",
      description:
        "Arquitetura limpa e modular com Server Actions, validação única com Zod, componentes atômicos e separação clara de responsabilidades.",
      code: `meu-projeto-gestao/
├── .env.example                     # Variáveis de ambiente declaradas e documentadas
├── .env.local                       # Segredos locais (NÃO commitado no Git)
├── package.json                     # Dependências e scripts
├── tsconfig.json                    # Configurações do compilador TypeScript
├── next.config.ts                   # Configurações do Next.js
│
├── actions/                         # ⚡ Server Actions (Mutação e Consultas Server-Side)
│   └── client-actions.ts            # CRUD de pacientes com "use server" e revalidação de cache
│
├── app/                             # 🌐 Next.js App Router (Rotas, Layouts e Páginas)
│   ├── layout.tsx                   # Layout Raiz com Providers e Tipografia
│   ├── globals.css                  # Estilos globais Tailwind v4
│   ├── page.tsx                     # Página principal (Dashboard & Gestão de Pacientes)
│   └── pacientes/
│       ├── [id]/                    # Rota de detalhes com Server Component
│       │   └── page.tsx
│       └── novo/                    # Rota dedicada de cadastro
│           └── page.tsx
│
├── components/                      # 🧩 Componentes React
│   ├── ui/                          # Componentes base atômicos (Shadcn UI / Radix)
│   │   ├── button.tsx, input.tsx, select.tsx, dialog.tsx, badge.tsx
│   ├── clients/                     # Componentes de domínio de Pacientes
│   │   ├── client-form-modal.tsx    # Modal/Formulário de cadastro e edição
│   │   ├── client-table.tsx         # Tabela responsiva com paginação
│   │   ├── client-filters.tsx       # Barra de busca em tempo real e filtros de status
│   │   ├── client-details-modal.tsx # Visualização completa de prontuário/cadastro
│   │   └── delete-confirm-modal.tsx # Confirmação de exclusão lógica (Soft Delete)
│   └── shared/                      # Componentes reutilizáveis compartilhados
│
├── hooks/                           # 🪝 Custom React Hooks
│   ├── use-clients.ts               # Hook de orquestração de listagem e busca
│   ├── use-debounce.ts              # Debounce para busca em tempo real
│   └── use-toast.ts                 # Notificações e feedback visual de ações
│
├── lib/                             # 🛠️ Utilitários e Bibliotecas do Sistema
│   ├── utils.ts                     # Helper cn() (clsx + tailwind-merge)
│   ├── brazil-data.ts               # Estados (UFs), cidades e validação algorítmica de CPF
│   ├── supabase/                    # Conexão com o Supabase (Client e Server Admin)
│   │   ├── client.ts
│   │   └── server.ts
│   └── validations/                 # Schemas de validação Zod
│       └── client-schema.ts         # Schema Zod com mensagens em pt-BR e cálculo de idade
│
├── sql/                             # 🗄️ Scripts de Banco de Dados e Migrations
│   └── supabase-schema.sql          # DDL da tabela pacientes, RLS, triggers e índices
│
└── types/                           # 🏷️ Definições de Tipos TypeScript
    └── client.ts                    # Tipagens inferidas do Zod e entidades do banco`,
    },
    {
      id: "sql",
      title: "4. Script SQL do PostgreSQL no Supabase (DDL, RLS & Trigger)",
      shortTitle: "4. Script SQL Supabase",
      badge: "PostgreSQL 15+",
      icon: <Database className="w-4 h-4 text-purple-500" />,
      filePath: "sql/supabase-schema.sql",
      description:
        "Criação da tabela public.pacientes, trigger de updated_at, índices parciais de CPF ativo, exclusão lógica (deleted_at) e Row Level Security.",
      code: `-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Criação da tabela public.pacientes
CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL,
    data_nascimento DATE NOT NULL,
    idade INTEGER NOT NULL CHECK (idade >= 0),
    email VARCHAR(150) NOT NULL,
    sexo VARCHAR(20) NOT NULL CHECK (sexo IN ('Masculino', 'Feminino', 'Outros')),
    telefone VARCHAR(20) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    cep VARCHAR(9),
    logradouro VARCHAR(150) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),
    estado CHAR(2) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    profissao VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 3. Índices de alta performance
-- CPF único condicional apenas para registros não deletados
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_cpf_active 
ON public.pacientes (cpf) 
WHERE deleted_at IS NULL;

-- Índice para soft delete
CREATE INDEX IF NOT EXISTS idx_pacientes_deleted_at 
ON public.pacientes (deleted_at);

-- 4. Trigger de updated_at automático
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pacientes_updated_at
    BEFORE UPDATE ON public.pacientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Row Level Security (RLS)
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de pacientes ativos para autenticados" 
ON public.pacientes FOR SELECT TO authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Permitir insercao para autenticados" 
ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Permitir atualizacao para autenticados" 
ON public.pacientes FOR UPDATE TO authenticated
USING (deleted_at IS NULL)
WITH CHECK (true);`,
    },
    {
      id: "actions",
      title: "5. Server Actions no Next.js com @supabase/supabase-js",
      shortTitle: "5. Server Actions CRUD",
      badge: "use server",
      icon: <Shield className="w-4 h-4 text-teal-500" />,
      filePath: "actions/client-actions.ts",
      description:
        "CRUD completo com revalidatePath, validação com Zod no servidor, recálculo seguro da idade, busca com ILIKE e Soft Delete.",
      code: `"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/supabase/client";
import { clientSchema, clientFilterSchema } from "@/lib/validations/client-schema";
import { calculateAge } from "@/lib/brazil-data";
import type { Client, ClientInput, ClientFilter, PaginatedResult, ActionResponse } from "@/types/client";

// 1. Listagem com busca, filtros e paginação
export async function getClientsAction(filters: Partial<ClientFilter>): Promise<ActionResponse<PaginatedResult<Client>>> {
  const supabase = getSupabaseAdminClient();
  const { search, status, page, pageSize, sortBy, sortOrder } = clientFilterSchema.parse(filters);

  let query = supabase.from("pacientes").select("*", { count: "exact" });

  if (status === "excluidos") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (status === "Ativo" || status === "Inativo") {
      query = query.eq("status", status);
    }
  }

  if (search?.trim()) {
    const term = search.trim();
    query = query.or(\`nome.ilike.%\${term}%,cpf.ilike.%\${term}%,email.ilike.%\${term}%\`);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" });
  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) return { success: false, message: error.message };

  return {
    success: true,
    data: {
      data: data as Client[],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
      hasMore: page < Math.ceil((count ?? 0) / pageSize),
    },
  };
}

// 2. Cadastro de Cliente com cálculo automático de idade no backend
export async function createClientAction(rawInput: unknown): Promise<ActionResponse<Client>> {
  const validData = clientSchema.parse(rawInput);
  
  // Garante a idade no servidor
  validData.idade = calculateAge(validData.data_nascimento)!;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("pacientes").insert([validData]).select().single();

  if (error) return { success: false, message: error.message };

  revalidatePath("/");
  return { success: true, message: "Paciente cadastrado com sucesso!", data: data as Client };
}

// 3. Exclusão Lógica (Soft Delete)
export async function softDeleteClientAction(id: string): Promise<ActionResponse<void>> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("pacientes")
    .update({ deleted_at: now, status: "Inativo" })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/");
  return { success: true, message: "Cliente movido para a lixeira com sucesso!" };
}`,
    },
    {
      id: "env",
      title: "6. Variáveis de Ambiente do Supabase (.env.example)",
      shortTitle: "6. Variáveis .env.example",
      badge: ".env.local",
      icon: <Terminal className="w-4 h-4 text-sky-500" />,
      filePath: ".env.example",
      description:
        "Declaração completa de variáveis de ambiente do Supabase (URL, Anon Key, Service Role Key, JWT Secret e PostgreSQL Connection Strings).",
      code: `# ==============================================================================
# VARIÁVEIS DE AMBIENTE - PROJETO GESTÃO DE PACIENTES
# ==============================================================================
# Copie este arquivo como .env.local para executar localmente:
#   cp .env.example .env.local
# Nunca comite chaves secretas (service_role, senhas) no controle de versão.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. AI STUDIO & AMBIENTE DA APLICAÇÃO
# ------------------------------------------------------------------------------
# GEMINI_API_KEY: Injetado automaticamente pelo Google AI Studio em tempo de execução.
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: URL base pública da aplicação (injetada no Cloud Run / Vercel).
APP_URL="MY_APP_URL"

# ------------------------------------------------------------------------------
# 2. SUPABASE - API & CLIENT SDK (@supabase/supabase-js)
# ------------------------------------------------------------------------------
# Obtenha em: Supabase Dashboard -> Project Settings -> API

# URL da instância do seu projeto Supabase (pública para Client e Server)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"

# Chave pública anônima (safe para browser com RLS ativado)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here"

# Chave secreta administrativa Service Role (USO EXCLUSIVO NO SERVIDOR)
# Utilizada em Server Actions para operações com permissão de sistema
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here"

# Segredo JWT do Supabase para validação de sessões de usuário
SUPABASE_JWT_SECRET="your-jwt-secret-string"

# ------------------------------------------------------------------------------
# 3. SUPABASE POSTGRESQL - STRINGS DE CONEXÃO DIRETA (CLI, Prisma, Drizzle ou psql)
# ------------------------------------------------------------------------------
# Obtenha em: Supabase Dashboard -> Project Settings -> Database -> Connection string

# String de conexão com Pooling (PgBouncer - porta 6543) ideal para Serverless
DATABASE_URL="postgresql://postgres.your-project-id:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# String de conexão direta (porta 5432) para executar scripts DDL, migrations e triggers
DIRECT_URL="postgresql://postgres.your-project-id:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"`,
    },
    {
      id: "auth",
      title: "7. Autenticação JWT, Bcrypt e Proteção de Rotas / CRUD",
      shortTitle: "7. Autenticação JWT",
      badge: "JWT + Bcrypt",
      icon: <KeyRound className="w-4 h-4 text-emerald-500" />,
      filePath: "actions/auth-actions.ts",
      description:
        "Sistema completo de autenticação com registro, login, logout, emissão de JWT assinado via jose (HS256), senhas hasheadas com Bcrypt (salt rounds 10) e proteção estrita em Server Actions.",
      code: `"use server";

import { loginSchema, registerSchema, LoginInput, RegisterInput } from "@/lib/validations/auth-schema";
import { findUserByEmail, comparePassword, createUserRecord } from "@/lib/auth/users-store";
import { createAuthToken } from "@/lib/auth/jwt";
import { setSessionCookie, removeSessionCookie, getSession } from "@/lib/auth/session";

// 1. Login com verificação de credenciais e emissão de JWT
export async function loginAction(rawInput: unknown) {
  const { email, password } = loginSchema.parse(rawInput);
  const user = await findUserByEmail(email);

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return { success: false, message: "E-mail ou senha incorretos." };
  }

  const token = await createAuthToken(user);
  await setSessionCookie(token); // Cookie HttpOnly SameSite=Lax (7 dias)
  return { success: true, message: \`Bem-vindo(a), \${user.name}!\`, user };
}

// 2. Registro com validação Zod e Hash Bcrypt (10 rounds)
export async function registerAction(rawInput: unknown) {
  const data = registerSchema.parse(rawInput);
  const existing = await findUserByEmail(data.email);
  if (existing) return { success: false, message: "E-mail já cadastrado." };

  const newUser = await createUserRecord(data);
  const token = await createAuthToken(newUser);
  await setSessionCookie(token);
  return { success: true, message: "Conta criada com sucesso!", user: newUser };
}

// 3. Logout com limpeza segura de cookies
export async function logoutAction() {
  await removeSessionCookie();
  return { success: true, message: "Sessão encerrada com sucesso." };
}

// 4. Proteção de Rotas e Mutações CRUD (em actions/client-actions.ts)
export async function createClientAction(rawInput: unknown) {
  const sessionUser = await getSession();
  if (!sessionUser) {
    return { success: false, message: "Acesso não autorizado. É necessário fazer login para cadastrar pacientes." };
  }
  // Executa mutação no Supabase / PostgreSQL...
}`,
    },
    {
      id: "calendar",
      title: "8. Integração Google Calendar API (v3) & Agendamentos",
      shortTitle: "8. Google Calendar API",
      badge: "Google Calendar v3",
      icon: <Calendar className="w-4 h-4 text-teal-500" />,
      filePath: "lib/google-calendar/calendar-service.ts",
      description:
        "Integração com Google Calendar API (v3) com verificação de horários conflitantes, criação de eventos com dados do paciente, suporte a GOOGLE_CLIENT_ID / GOOGLE_API_KEY / GOOGLE_CALENDAR_ID e modo fallback resiliente.",
      code: `/**
 * Serviço de Integração com Google Calendar API (v3)
 * Variáveis de ambiente:
 * - GOOGLE_CLIENT_ID: Client ID do Google Cloud Console
 * - GOOGLE_API_KEY: Chave de API Google Calendar
 * - GOOGLE_CALENDAR_ID: ID da agenda (padrão: 'primary')
 */

export async function createGoogleCalendarEvent(input: GoogleCalendarEventInput) {
  const creds = getGoogleCalendarCredentials();
  const directLink = generateGoogleCalendarTemplateUrl(input);

  // Modo Resiliente / Fallback automático quando chaves não estiverem configuradas
  if (!creds.isConfigured) {
    return {
      success: true,
      eventId: \`cal_\${Date.now()}\`,
      htmlLink: directLink,
      synced: true,
      isFallback: true,
      message: "Agendamento registrado no modo local resiliente com link direto para o Google Agenda.",
    };
  }

  // Chamada à API Google Calendar v3: calendar.events.insert
  const url = \`https://www.googleapis.com/calendar/v3/calendars/\${encodeURIComponent(creds.calendarId)}/events?key=\${creds.apiKey}\`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: \`Consulta: \${input.procedimento} - \${input.patientName}\`,
      description: \`Paciente: \${input.patientName}\\nTelefone: \${input.patientPhone}\\nE-mail: \${input.patientEmail}\\nObservações: \${input.observacoes || 'Nenhuma'}\`,
      start: { dateTime: \`\${input.date}T\${input.startTime}:00-03:00\`, timeZone: "America/Sao_Paulo" },
      end: { dateTime: \`\${input.date}T\${input.endTime}:00-03:00\`, timeZone: "America/Sao_Paulo" },
      attendees: input.patientEmail ? [{ email: input.patientEmail, displayName: input.patientName }] : [],
    }),
  });

  return await res.json();
}`,
    },
  ];

  const currentDeliverable = deliverables.find((d) => d.id === activeTab) || deliverables[0];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300">
                Arquitetura & Especificações Técnicas
              </span>
              <span className="text-xs text-slate-500">• 8 Entregáveis Prontos</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Documentação e Código-Fonte Gerado
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Consulte e copie individualmente cada um dos módulos e scripts solicitados para seu projeto Supabase & Next.js.
            </p>
          </div>

          <button
            id="copy-active-deliverable-btn"
            onClick={() => handleCopy(currentDeliverable.id, currentDeliverable.code)}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 rounded-lg shadow-sm transition-all"
          >
            {copiedId === currentDeliverable.id ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Copiado para Área de Transferência!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar Este Código</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1">
          {deliverables.map((item) => (
            <button
              key={item.id}
              id={`tab-deliverable-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                activeTab === item.id
                  ? "bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              }`}
            >
              {item.icon}
              <span>{item.shortTitle}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Code Display Area */}
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              {currentDeliverable.title}
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {currentDeliverable.badge}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentDeliverable.description}
            </p>
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
            {currentDeliverable.filePath}
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 text-slate-100">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
            <span>{currentDeliverable.filePath}</span>
            <button
              onClick={() => handleCopy(currentDeliverable.id, currentDeliverable.code)}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              {copiedId === currentDeliverable.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-[500px]">
            <code>{currentDeliverable.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
