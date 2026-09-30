-- 1. Garante que o tipo user_role exista no schema public com os valores corretos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON n.oid = t.typnamespace 
        WHERE t.typname = 'user_role' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.user_role AS ENUM ('paciente', 'profissional', 'administrador');
    ELSE
        ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'paciente';
        ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'profissional';
        ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'administrador';
    END IF;
END $$;

-- 2. Criação / atualização da tabela public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    avatar_url TEXT NULL,
    role public.user_role NOT NULL DEFAULT 'paciente'::public.user_role,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Habilita RLS e permissões da tabela
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de perfis autenticados" ON public.profiles;
CREATE POLICY "Leitura pública de perfis autenticados"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuários atualizam próprio perfil" ON public.profiles;
CREATE POLICY "Usuários atualizam próprio perfil"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Permitir inserção via trigger e auth" ON public.profiles;
CREATE POLICY "Permitir inserção via trigger e auth"
ON public.profiles FOR INSERT WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

-- 4. Função atualizada com atribuição automática para Dra. Juliana (profissional) e Bruno Gonçalves (administrador)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_name TEXT;
    raw_role TEXT;
    assigned_role public.user_role;
BEGIN
    user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'nome',
        split_part(NEW.email, '@', 1),
        'Usuário'
    );
    
    raw_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));

    -- Regras de atribuição de perfil
    IF LOWER(NEW.email) = 'brunolpg@gmail.com' OR LOWER(NEW.email) = 'admin@clinica.com' OR raw_role IN ('admin', 'administrador') THEN
        assigned_role := 'administrador'::public.user_role;
    ELSIF LOWER(NEW.email) LIKE '%juliana%' OR raw_role IN ('profissional', 'medico', 'esteticista') THEN
        assigned_role := 'profissional'::public.user_role;
    ELSE
        assigned_role := 'paciente'::public.user_role;
    END IF;

    INSERT INTO public.profiles (id, nome, email, avatar_url, role)
    VALUES (
        NEW.id,
        LEFT(user_name, 120),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url',
        assigned_role
    )
    ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Falha ao sincronizar profile para user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
