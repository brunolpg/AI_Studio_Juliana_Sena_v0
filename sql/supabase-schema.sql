-- ==============================================================================
-- SCRIPT DDL: CRIAÇÃO DA TABELA DE CLIENTES / PACIENTES NO SUPABASE (POSTGRESQL)
-- Inclui: Validações, Constraints, Índices de Performance, Trigger de updated_at,
-- Suporte a Soft Delete (deleted_at) e Políticas de Row Level Security (RLS).
-- ==============================================================================

-- 1. Habilitar extensões necessárias (se ainda não estiverem ativas)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Opcional, para buscas textuais otimizadas

-- 2. Criação da tabela public.clientes
CREATE TABLE IF NOT EXISTS public.clientes (
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
    
    -- Metadados de auditoria e Soft Delete
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- ==============================================================================
-- 3. ÍNDICES E CONSTRAINTS DE ALTA PERFORMANCE
-- ==============================================================================

-- CPF Único Parcial: Garante que apenas clientes ativos ou não deletados tenham CPF único.
-- Isso permite regras de conformidade sem travar histórico de clientes deletados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_cpf_active 
ON public.clientes (cpf) 
WHERE deleted_at IS NULL;

-- Índice para filtragem rápida por Soft Delete (deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at 
ON public.clientes (deleted_at);

-- Índice composto para consultas frequentes de status e data de criação
CREATE INDEX IF NOT EXISTS idx_clientes_status_created 
ON public.clientes (status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Índice para busca textual rápida por Nome e Email
CREATE INDEX IF NOT EXISTS idx_clientes_nome_trgm 
ON public.clientes USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clientes_email 
ON public.clientes (email) 
WHERE deleted_at IS NULL;

-- ==============================================================================
-- 4. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DA COLUNA updated_at
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_clientes_updated_at ON public.clientes;

CREATE TRIGGER set_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 5. CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Ativação do RLS na tabela
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Política 1: Leitura de Clientes Ativos (Apenas registros onde deleted_at IS NULL)
-- Usuários autenticados podem consultar clientes não excluídos
CREATE POLICY "Permitir leitura de clientes ativos para usuarios autenticados" 
ON public.clientes
FOR SELECT 
TO authenticated
USING (deleted_at IS NULL);

-- Política 2: Inserção de novos clientes por usuários autenticados
CREATE POLICY "Permitir insercao para usuarios autenticados" 
ON public.clientes
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Política 3: Atualização de clientes por usuários autenticados
CREATE POLICY "Permitir atualizacao para usuarios autenticados" 
ON public.clientes
FOR UPDATE 
TO authenticated
USING (deleted_at IS NULL)
WITH CHECK (true);

-- Política 4: Soft Delete (Atualização do campo deleted_at)
-- Recomendado bloquear DELETE físico direto e direcionar para UPDATE no deleted_at
CREATE POLICY "Bloquear delecao fisica direta para usuarios comuns" 
ON public.clientes
FOR DELETE 
TO authenticated
USING (false);

-- Política de Administrador / Service Role: Permite acesso total irrestrito (bypass de RLS)
-- O Supabase já faz bypass automático com a SERVICE_ROLE_KEY, mas a política abaixo
-- pode ser usada caso haja uma role específica de 'admin' no seu auth.users.

-- ==============================================================================
-- 6. FUNÇÃO RPC AUXILIAR PARA SOFT DELETE ATÔMICO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_cliente(client_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.clientes
    SET 
        deleted_at = timezone('utc'::text, now()),
        status = 'Inativo'
    WHERE id = client_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
