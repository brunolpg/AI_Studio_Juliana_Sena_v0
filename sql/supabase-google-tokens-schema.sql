-- ==============================================================================
-- SCRIPT DDL: CRIAÇÃO DA TABELA DE TOKENS DO GOOGLE OAUTH (google_tokens)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.google_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    expiry_date BIGINT NULL,
    scope TEXT NULL,
    token_type TEXT NULL,
    calendar_id TEXT DEFAULT 'primary',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Acesso exclusivo pelo servidor (service role) ou pelo próprio usuário autenticado
DROP POLICY IF EXISTS "Usuários gerenciam seus próprios tokens do Google" ON public.google_tokens;
CREATE POLICY "Usuários gerenciam seus próprios tokens do Google"
ON public.google_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.google_tokens TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.google_tokens TO authenticated;
