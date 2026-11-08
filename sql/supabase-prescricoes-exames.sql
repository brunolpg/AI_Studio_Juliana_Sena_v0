-- ==============================================================================
-- SCHEMA DDL: PRESCRIÇÃO DE EXAMES LABORATORIAIS E COMPLEMENTARES
-- Dra. Juliana Sena - Gestão Clínica & Prontuário Inteligente
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA PRINCIPAL DE PRESCRIÇÃO DE EXAMES (public.prescricoes_exames)
CREATE TABLE IF NOT EXISTS public.prescricoes_exames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    descricao TEXT,
    grupos_exames JSONB NOT NULL DEFAULT '[]'::jsonb,
    orientacoes TEXT[] NOT NULL DEFAULT '{}'::text[],
    status VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Suspenso', 'Concluído', 'Cancelado')),
    justificativa_suspensao TEXT,
    data_suspensao TIMESTAMPTZ,
    profissional VARCHAR(150) NOT NULL DEFAULT 'Dra. Juliana Sena',
    payload_canonico JSONB,
    payload_hash TEXT,
    assinatura TEXT,
    algoritmo VARCHAR(50) DEFAULT 'SHA-256',
    assinado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. ÍNDICES DE PERFORMANCE E CONSULTAS CLÍNICAS
CREATE INDEX IF NOT EXISTS idx_prescricoes_exames_paciente_data 
ON public.prescricoes_exames (paciente_id, data DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prescricoes_exames_status 
ON public.prescricoes_exames (status);

-- 3. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_prescricoes_exames_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prescricoes_exames_updated_at ON public.prescricoes_exames;
CREATE TRIGGER trg_prescricoes_exames_updated_at
    BEFORE UPDATE ON public.prescricoes_exames
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_prescricoes_exames_updated_at();

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.prescricoes_exames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de prescricoes de exames para usuarios autenticados"
ON public.prescricoes_exames FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir insercao de prescricoes de exames para usuarios autenticados"
ON public.prescricoes_exames FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualizacao de prescricoes de exames para usuarios autenticados"
ON public.prescricoes_exames FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusao de prescricoes de exames para usuarios autenticados"
ON public.prescricoes_exames FOR DELETE TO authenticated USING (true);
