-- ==============================================================================
-- SCRIPT DDL: CRIAÇÃO DA TABELA DE AGENDAMENTOS (APPOINTMENTS) NO SUPABASE
-- ==============================================================================
-- Tabela: public.appointments
-- Relacionamento: references public.pacientes(id) on delete cascade
-- Inclui: Validações, Constraints, Índices de Performance, Trigger de updated_at,
-- e Políticas de Row Level Security (RLS).
-- ==============================================================================

-- 1. Habilitar extensões necessárias (se ainda não estiverem ativas)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criação da tabela public.appointments
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    horario_inicio VARCHAR(5) NOT NULL,
    horario_fim VARCHAR(5) NOT NULL,
    procedimento TEXT NOT NULL,
    observacoes TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Confirmado' CHECK (status IN ('Confirmado', 'Pendente', 'Concluído', 'Cancelado')),
    google_event_id TEXT NULL,
    google_html_link TEXT NULL,
    synced_with_google BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. ÍNDICES B-TREE DE ALTA PERFORMANCE
-- ==============================================================================

-- Índice composto para verificação rápida de conflitos e filtragem por data e horário
CREATE INDEX IF NOT EXISTS idx_appointments_date_time 
ON public.appointments (data, horario_inicio);

-- Índice para consultas por paciente e junções com a tabela de pacientes
CREATE INDEX IF NOT EXISTS idx_appointments_client 
ON public.appointments (client_id);

-- Índice para filtragem rápida por status da consulta (Confirmado, Pendente, Cancelado, Concluído)
CREATE INDEX IF NOT EXISTS idx_appointments_status 
ON public.appointments (status);

-- Índice para ordenação temporal e relatórios
CREATE INDEX IF NOT EXISTS idx_appointments_created_at 
ON public.appointments (created_at DESC);

-- ==============================================================================
-- 4. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DA COLUNA updated_at
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_appointments_updated_at ON public.appointments;

CREATE TRIGGER set_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_appointments_updated_at();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Política 1: Leitura de agendamentos para usuários autenticados
CREATE POLICY "Permitir leitura de agendamentos para usuarios autenticados" 
ON public.appointments
FOR SELECT 
TO authenticated
USING (true);

-- Política 2: Inserção de agendamentos para usuários autenticados
CREATE POLICY "Permitir insercao de agendamentos para usuarios autenticados" 
ON public.appointments
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Política 3: Atualização de agendamentos para usuários autenticados
CREATE POLICY "Permitir atualizacao de agendamentos para usuarios autenticados" 
ON public.appointments
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Política 4: Exclusão de agendamentos para usuários autenticados
CREATE POLICY "Permitir exclusao de agendamentos para usuarios autenticados" 
ON public.appointments
FOR DELETE 
TO authenticated
USING (true);

-- Política para leitura e escrita pela Service Role (admin)
-- O Supabase já faz bypass automático com SUPABASE_SERVICE_ROLE_KEY.
