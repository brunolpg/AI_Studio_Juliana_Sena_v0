-- ==============================================================================
-- MIGRATION SQL: PRIVACIDADE ESTRITA DE FOTOS DE PACIENTES NO SUPABASE STORAGE
-- ==============================================================================
-- Objetivo:
--   Bloquear leitura (SELECT) e escrita (INSERT, UPDATE, DELETE) de fotos de
--   pacientes (fotos de perfil e fotos clínicas/áreas tratadas) para o perfil
--   'administrador', permitindo acesso exclusivamente a 'profissional' e ao
--   próprio 'paciente' dono do registro/arquivo.
--
-- Buckets protegidos:
--   - 'prontuarios-fotos' (fotos da área tratada e evoluções clínicas)
--   - 'avatars'           (fotos de perfil)
--   - 'anexos-consultas'  (somente objetos de imagem: .png, .jpg, .jpeg, .webp, .bmp, .gif;
--                          documentos PDF permanecem acessíveis para gestão administrativa)
-- ==============================================================================

-- 1. Garante coluna user_id em public.pacientes para vínculo seguro com auth.users
ALTER TABLE public.pacientes
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Garante existência dos buckets utilizados pelas fotos de pacientes (sem sobrescrever buckets já existentes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    (
        'prontuarios-fotos',
        'prontuarios-fotos',
        false,
        10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/bmp']::text[]
    ),
    (
        'avatars',
        'avatars',
        false,
        5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    ),
    (
        'anexos-consultas',
        'anexos-consultas',
        false,
        10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Função auxiliar de autorização para objetos de fotos de pacientes no Storage
CREATE OR REPLACE FUNCTION public.can_access_patient_photo_object(
    target_bucket_id TEXT,
    object_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, storage, pg_temp
AS $$
DECLARE
    current_uid UUID;
    current_role TEXT;
    current_email TEXT;
    first_folder TEXT;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT p.role::text, LOWER(TRIM(COALESCE(p.email, '')))
      INTO current_role, current_email
      FROM public.profiles p
     WHERE p.id = current_uid;

    -- Bloqueio explícito para perfil 'administrador'
    IF current_role IS NULL OR current_role = 'administrador' THEN
        RETURN FALSE;
    END IF;

    -- Acesso completo exclusivamente para o profissional de saúde
    IF current_role = 'profissional' THEN
        RETURN TRUE;
    END IF;

    -- Para 'paciente', permite apenas objetos vinculados à sua própria ficha/usuário
    IF current_role = 'paciente' THEN
        first_folder := (storage.foldername(object_name))[1];

        -- Caminho iniciado pelo próprio auth.uid() (ex.: avatars/<uid>/...)
        IF first_folder = current_uid::text OR object_name LIKE current_uid::text || '/%' THEN
            RETURN TRUE;
        END IF;

        -- Caminho iniciado pelo paciente_id pertencente ao usuário autenticado (ex.: prontuarios-fotos/<paciente_id>/...)
        IF EXISTS (
            SELECT 1
              FROM public.pacientes pac
             WHERE pac.deleted_at IS NULL
               AND (
                   pac.user_id = current_uid
                   OR (current_email <> '' AND LOWER(TRIM(COALESCE(pac.email, ''))) = current_email)
               )
               AND (
                   first_folder = pac.id::text
                   OR object_name LIKE pac.id::text || '/%'
               )
        ) THEN
            RETURN TRUE;
        END IF;

        -- Para anexos de consulta em 'anexos-consultas' (consultas/<appointment_id>_* ou anexos/<appointment_id>_*)
        IF target_bucket_id = 'anexos-consultas' AND EXISTS (
            SELECT 1
              FROM public.appointments apt
              JOIN public.pacientes pac ON pac.id = apt.client_id
             WHERE pac.deleted_at IS NULL
               AND (
                   pac.user_id = current_uid
                   OR (current_email <> '' AND LOWER(TRIM(COALESCE(pac.email, ''))) = current_email)
               )
               AND (
                   object_name LIKE 'consultas/' || apt.id::text || '\_%' ESCAPE '\'
                   OR object_name LIKE 'anexos/' || apt.id::text || '\_%' ESCAPE '\'
               )
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

-- 4. Habilita RLS em storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 5. Limpeza idempotente de políticas anteriores dos buckets de fotos de pacientes
DROP POLICY IF EXISTS "Paciente fotos SELECT restrito ao profissional e dono" ON storage.objects;
DROP POLICY IF EXISTS "Paciente fotos INSERT restrito ao profissional e dono" ON storage.objects;
DROP POLICY IF EXISTS "Paciente fotos UPDATE restrito ao profissional e dono" ON storage.objects;
DROP POLICY IF EXISTS "Paciente fotos DELETE restrito ao profissional e dono" ON storage.objects;

DROP POLICY IF EXISTS "Anexos consultas SELECT com privacidade de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Anexos consultas INSERT com privacidade de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Anexos consultas UPDATE com privacidade de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Anexos consultas DELETE com privacidade de fotos" ON storage.objects;

-- 6. Políticas estritas para buckets dedicados a fotos de pacientes ('prontuarios-fotos' e 'avatars')
CREATE POLICY "Paciente fotos SELECT restrito ao profissional e dono"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id IN ('prontuarios-fotos', 'avatars')
    AND public.can_access_patient_photo_object(bucket_id, name)
);

CREATE POLICY "Paciente fotos INSERT restrito ao profissional e dono"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('prontuarios-fotos', 'avatars')
    AND public.can_access_patient_photo_object(bucket_id, name)
);

CREATE POLICY "Paciente fotos UPDATE restrito ao profissional e dono"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id IN ('prontuarios-fotos', 'avatars')
    AND public.can_access_patient_photo_object(bucket_id, name)
)
WITH CHECK (
    bucket_id IN ('prontuarios-fotos', 'avatars')
    AND public.can_access_patient_photo_object(bucket_id, name)
);

CREATE POLICY "Paciente fotos DELETE restrito ao profissional e dono"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id IN ('prontuarios-fotos', 'avatars')
    AND public.can_access_patient_photo_object(bucket_id, name)
);

-- 7. Políticas para 'anexos-consultas': imagens seguem privacidade estrita (sem 'administrador');
--    documentos PDF permanecem acessíveis para gestão administrativa, profissional e paciente dono.
CREATE POLICY "Anexos consultas SELECT com privacidade de fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'anexos-consultas'
    AND (
        CASE
            WHEN name ~* '\.(png|jpe?g|bmp|webp|gif)$' THEN
                public.can_access_patient_photo_object(bucket_id, name)
            ELSE
                EXISTS (
                    SELECT 1
                      FROM public.profiles p
                     WHERE p.id = auth.uid()
                       AND p.role::text IN ('profissional', 'administrador', 'paciente')
                )
        END
    )
);

CREATE POLICY "Anexos consultas INSERT com privacidade de fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'anexos-consultas'
    AND (
        CASE
            WHEN name ~* '\.(png|jpe?g|bmp|webp|gif)$' THEN
                public.can_access_patient_photo_object(bucket_id, name)
            ELSE
                EXISTS (
                    SELECT 1
                      FROM public.profiles p
                     WHERE p.id = auth.uid()
                       AND p.role::text IN ('profissional', 'administrador', 'paciente')
                )
        END
    )
);

CREATE POLICY "Anexos consultas UPDATE com privacidade de fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'anexos-consultas'
    AND (
        CASE
            WHEN name ~* '\.(png|jpe?g|bmp|webp|gif)$' THEN
                public.can_access_patient_photo_object(bucket_id, name)
            ELSE
                EXISTS (
                    SELECT 1
                      FROM public.profiles p
                     WHERE p.id = auth.uid()
                       AND p.role::text IN ('profissional', 'administrador', 'paciente')
                )
        END
    )
)
WITH CHECK (
    bucket_id = 'anexos-consultas'
    AND (
        CASE
            WHEN name ~* '\.(png|jpe?g|bmp|webp|gif)$' THEN
                public.can_access_patient_photo_object(bucket_id, name)
            ELSE
                EXISTS (
                    SELECT 1
                      FROM public.profiles p
                     WHERE p.id = auth.uid()
                       AND p.role::text IN ('profissional', 'administrador', 'paciente')
                )
        END
    )
);

CREATE POLICY "Anexos consultas DELETE com privacidade de fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'anexos-consultas'
    AND (
        CASE
            WHEN name ~* '\.(png|jpe?g|bmp|webp|gif)$' THEN
                public.can_access_patient_photo_object(bucket_id, name)
            ELSE
                EXISTS (
                    SELECT 1
                      FROM public.profiles p
                     WHERE p.id = auth.uid()
                       AND p.role::text IN ('profissional', 'administrador', 'paciente')
                )
        END
    )
);
