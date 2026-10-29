-- ==============================================================================
-- SCRIPT DDL: CRIAÇÃO E CONFIGURAÇÃO DO BUCKET DE PRESCRIÇÕES NO SUPABASE STORAGE
-- ==============================================================================
-- Bucket: 'prescricoes' (público para download e conferência de receitas assinadas)
-- Inclui: Inserção do bucket, RLS e políticas de acesso (SELECT, INSERT, UPDATE)
-- ==============================================================================

-- 1. Inserir o bucket caso não exista
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'prescricoes',
    'prescricoes',
    true,
    5242880, -- 5MB limite por arquivo
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Garantir RLS habilitado na tabela storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de políticas existentes para garantir idempotência
DROP POLICY IF EXISTS "Permitir leitura pública ou para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update para autenticados" ON storage.objects;

-- 4. Políticas de acesso para o bucket de prescrições
CREATE POLICY "Permitir leitura pública ou para autenticados" 
ON storage.objects
FOR SELECT 
USING (bucket_id = 'prescricoes');

CREATE POLICY "Permitir upload para autenticados" 
ON storage.objects
FOR INSERT 
WITH CHECK (bucket_id = 'prescricoes');

CREATE POLICY "Permitir update para autenticados" 
ON storage.objects
FOR UPDATE 
USING (bucket_id = 'prescricoes');
