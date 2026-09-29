-- 1. Criação do tipo ENUM para os perfis
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('paciente', 'profissional', 'administrador');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criação da tabela public.profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    avatar_url TEXT NULL,
    role user_role NOT NULL DEFAULT 'paciente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Habilitar RLS e criar políticas básicas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de perfis autenticados"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários atualizam próprio perfil"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. Trigger para sincronizar auth.users com public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    assigned_role user_role;
BEGIN
    -- Captura o nome do Google OAuth ou do metadata do form de cadastro
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
    
    -- Lógica de atribuição de perfil inicial
    IF NEW.email = 'admin@clinica.com' THEN
        assigned_role := 'administrador';
    ELSIF NEW.raw_user_meta_data->>'role' = 'profissional' THEN
        assigned_role := 'profissional';
    ELSE
        assigned_role := 'paciente';
    END IF;

    INSERT INTO public.profiles (id, nome, email, avatar_url, role)
    VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url', assigned_role)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    For EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
