-- ==============================================================================
-- SCHEMA DDL: MODELOS REUTILIZÁVEIS DE PRESCRIÇÃO DE EXAMES
-- Dra. Juliana Sena - Gestão Clínica & Prontuário Inteligente
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE MODELOS DE PRESCRIÇÃO DE EXAMES (public.prescricoes_exames_modelos)
-- (Independente de paciente: modelos globais reutilizáveis na prescrição de exames)
CREATE TABLE IF NOT EXISTS public.prescricoes_exames_modelos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    grupos_exames JSONB NOT NULL DEFAULT '[]'::jsonb,
    orientacoes TEXT[] NOT NULL DEFAULT '{}'::text[],
    profissional VARCHAR(150) NOT NULL DEFAULT 'Dra. Juliana Sena',
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_prescricoes_exames_modelos_ativo_titulo
ON public.prescricoes_exames_modelos (ativo, titulo ASC);

-- 3. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_prescricoes_exames_modelos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prescricoes_exames_modelos_updated_at ON public.prescricoes_exames_modelos;
CREATE TRIGGER trg_prescricoes_exames_modelos_updated_at
    BEFORE UPDATE ON public.prescricoes_exames_modelos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_prescricoes_exames_modelos_updated_at();

-- 4. PERMISSÕES (GRANT) E ROW LEVEL SECURITY (RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.prescricoes_exames_modelos TO authenticated;
GRANT ALL ON TABLE public.prescricoes_exames_modelos TO service_role;

ALTER TABLE public.prescricoes_exames_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de modelos de prescricao de exames para usuarios autenticados" ON public.prescricoes_exames_modelos;
CREATE POLICY "Permitir leitura de modelos de prescricao de exames para usuarios autenticados"
ON public.prescricoes_exames_modelos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir insercao de modelos de prescricao de exames para usuarios autenticados" ON public.prescricoes_exames_modelos;
CREATE POLICY "Permitir insercao de modelos de prescricao de exames para usuarios autenticados"
ON public.prescricoes_exames_modelos FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualizacao de modelos de prescricao de exames para usuarios autenticados" ON public.prescricoes_exames_modelos;
CREATE POLICY "Permitir atualizacao de modelos de prescricao de exames para usuarios autenticados"
ON public.prescricoes_exames_modelos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusao de modelos de prescricao de exames para usuarios autenticados" ON public.prescricoes_exames_modelos;
CREATE POLICY "Permitir exclusao de modelos de prescricao de exames para usuarios autenticados"
ON public.prescricoes_exames_modelos FOR DELETE TO authenticated USING (true);
