-- ==============================================================================
-- SCHEMA DDL: PROCEDIMENTOS OPERACIONAIS PADRÃO (POPs) & PROTOCOLOS CLÍNICOS
-- Dra. Juliana Sena - Gestão Clínica & Prontuário Inteligente
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA PRINCIPAL DE PROTOCOLOS (pops_protocolos)
CREATE TABLE IF NOT EXISTS public.pops_protocolos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    protocolo TEXT NOT NULL,
    finalidade TEXT NOT NULL,
    data_pop DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Concluído', 'Em Revisão', 'Cancelado')),
    profissional TEXT NOT NULL DEFAULT 'Juliana Sena de Souza Vieira',
    payload_canonico JSONB,
    payload_hash TEXT,
    assinatura TEXT,
    algoritmo VARCHAR(50) DEFAULT 'SHA-256',
    assinado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_pops_protocolos_paciente ON public.pops_protocolos (paciente_id, data_pop DESC);
CREATE INDEX IF NOT EXISTS idx_pops_protocolos_appointment ON public.pops_protocolos (appointment_id);

-- 2. TABELA DE BLOCOS INTERCALADOS (pops_blocos)
CREATE TABLE IF NOT EXISTS public.pops_blocos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pop_id UUID NOT NULL REFERENCES public.pops_protocolos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('TOPICO', 'PRESCRICAO')),
    ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem >= 1),
    topico_titulo TEXT,
    topico_descricao TEXT,
    prescricao_id UUID REFERENCES public.prescricoes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pops_blocos_pop_ordem ON public.pops_blocos (pop_id, ordem ASC);

-- 3. TABELA DE SUBTÓPICOS HIERÁRQUICOS (pops_subtopicos)
CREATE TABLE IF NOT EXISTS public.pops_subtopicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bloco_id UUID NOT NULL REFERENCES public.pops_blocos(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL DEFAULT 1 CHECK (ordem >= 1),
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pops_subtopicos_bloco_ordem ON public.pops_subtopicos (bloco_id, ordem ASC);

-- 4. TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION public.handle_pops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pops_protocolos_updated_at ON public.pops_protocolos;
CREATE TRIGGER trg_pops_protocolos_updated_at
    BEFORE UPDATE ON public.pops_protocolos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_pops_updated_at();

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.pops_protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pops_blocos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pops_subtopicos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Acesso permitido para usuários autenticados autorizados
CREATE POLICY "Permitir leitura de POPs para profissionais autenticados"
ON public.pops_protocolos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção de POPs para profissionais autenticados"
ON public.pops_protocolos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização de POPs para profissionais autenticados"
ON public.pops_protocolos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir exclusão de POPs para profissionais autenticados"
ON public.pops_protocolos FOR DELETE TO authenticated USING (true);

-- Políticas para blocos e subtópicos
CREATE POLICY "Permitir gerenciamento de blocos de POPs"
ON public.pops_blocos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir gerenciamento de subtópicos de POPs"
ON public.pops_subtopicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
