-- 1. Habilitar extensões necessárias (se ainda não estiverem ativas)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Criação da tabela public.pacientes (CORRIGIDO PARA PUBLIC)
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
    
    -- Metadados de auditoria e Soft Delete
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 3. ÍNDICES E CONSTRAINTS DE ALTA PERFORMANCE (CORRIGIDO PARA PUBLIC)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_cpf_active 
ON public.pacientes (cpf) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pacientes_deleted_at 
ON public.pacientes (deleted_at);

CREATE INDEX IF NOT EXISTS idx_pacientes_status_created 
ON public.pacientes (status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pacientes_nome_trgm 
ON public.pacientes USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pacientes_email 
ON public.pacientes (email) 
WHERE deleted_at IS NULL;

-- 4. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DA COLUNA updated_at (CORRIGIDO PARA PUBLIC)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_pacientes_updated_at ON public.pacientes;

CREATE TRIGGER set_pacientes_updated_at
    BEFORE UPDATE ON public.pacientes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. CONFIGURAÇÃO DE SEGURANÇA (ROW LEVEL SECURITY - RLS) (CORRIGIDO PARA PUBLIC)
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de pacientes ativos para usuarios autenticados" 
ON public.pacientes FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Permitir insercao para usuarios autenticados" 
ON public.pacientes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualizacao para usuarios autenticados" 
ON public.pacientes FOR UPDATE TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);

CREATE POLICY "Bloquear delecao fisica direta para usuarios comuns" 
ON public.pacientes FOR DELETE TO authenticated USING (false);

-- 6. FUNÇÃO RPC AUXILIAR PARA SOFT DELETE ATÔMICO (CORRIGIDO PARA PUBLIC)
CREATE OR REPLACE FUNCTION public.soft_delete_paciente(client_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.pacientes
    SET 
        deleted_at = timezone('utc'::text, now()),
        status = 'Inativo'
    WHERE id = client_uuid AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;