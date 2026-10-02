-- ==============================================================================
-- SCRIPT DDL: CRIAÇÃO DA TABELA DE PROCEDIMENTOS NO SUPABASE E POPULAÇÃO DE DADOS
-- ==============================================================================
-- Tabela: public.procedimentos
-- Inclui: Validações, RLS (Row Level Security) e Políticas de Leitura Pública
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedimento TEXT NOT NULL,
    categoria TEXT NOT NULL,
    duracao NUMERIC NOT NULL DEFAULT 1,
    valor NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilita RLS e leitura pública/autenticada
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.procedimentos;

CREATE POLICY "Permitir leitura para todos" 
ON public.procedimentos 
FOR SELECT 
USING (true);

-- Limpa registros anteriores para evitar duplicações se reexecutado
DELETE FROM public.procedimentos;

INSERT INTO public.procedimentos (procedimento, categoria, duracao, valor) VALUES
-- Consulta
('Consulta Estética', 'Consulta', 1, 200),

-- Estética Facial
('Botox (Face inteira)', 'Estética Facial', 2, 1800),
('Toxina Botulínica (Terço Superior)', 'Estética Facial', 2, 1200),
('Limpeza de Pele Profunda', 'Estética Facial', 2, 250),
('Microagulhamento Facial', 'Estética Facial', 1, 500),
('Peeling Químico Facial', 'Estética Facial', 1, 400),
('Acne Inflamatória com PDT', 'Estética Facial', 1, 250),
('Peeling ATA (Ácido Tricloroacético)', 'Estética Facial', 1, 700),
('Intradermoterapia Facial', 'Estética Facial', 1, 500),
('Hydra Deep Lips', 'Estética Facial', 1, 600),

-- Estética Corporal
('Intradermoterapia Corporal', 'Estética Corporal', 1, 500),
('Microagulhamento Corporal para Estrias', 'Estética Corporal', 1, 550),
('Suplementação Intramuscular (IM)', 'Estética Corporal', 1, 250),
('Peeling Químico Corporal e Íntimo', 'Estética Corporal', 1, 450),
('Limpeza de Pele Corporal', 'Estética Corporal', 1, 300),

-- Controle de Hiperidrose
('Toxina Botulínica – Axilar', 'Controle de Hiperidrose', 1, 1500),
('Toxina Botulínica – Palmar', 'Controle de Hiperidrose', 1, 1500),
('Toxina Botulínica – Plantar', 'Controle de Hiperidrose', 1, 2000),

-- Terapia Capilar
('Microagulhamento Capilar + Laserterapia', 'Terapia Capilar', 1, 550),
('Intradermoterapia Capilar + Laserterapia', 'Terapia Capilar', 1, 500),

-- Laserterapia
('Terapia de Laser Clínico Avançado', 'Laserterapia', 1, 250),
('Fotobiomodulação Terapêutica', 'Laserterapia', 1, 250),
('Ilibiterapia (Laserterapia ILIB)', 'Laserterapia', 1, 200),
('Laserterapia Pediátrica', 'Laserterapia', 1, 250);

-- Criação de Índices para Busca de Performance
CREATE INDEX IF NOT EXISTS idx_procedimentos_categoria ON public.procedimentos (categoria);
CREATE INDEX IF NOT EXISTS idx_procedimentos_nome ON public.procedimentos (procedimento);
