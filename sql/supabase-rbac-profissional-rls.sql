-- ==============================================================================
-- MIGRATION RLS: RBAC PARA DADOS DE PACIENTES E PRONTUÁRIOS (PROFISSIONAL E ADMIN)
-- Dra. Juliana Sena - Gestão Clínica & Prontuário
-- ==============================================================================
-- Objetivo:
--   Autorizar o acesso completo às tabelas de pacientes e registros clínicos para:
--     1. Usuários com role = 'profissional' ou role IN ('administrador', 'admin')
--        na tabela public.profiles;
--     2. O próprio paciente autenticado (user_id = auth.uid()), apenas para
--        leitura de seus próprios registros (e edição da própria anamnese em
--        historico_clinico, quando aplicável no Portal do Paciente).
--   Obs.: A restrição de privacidade para fotos de pacientes no Supabase Storage
--         permanece estritamente ativa em sql/supabase-patient-photos-privacy-rls.sql.
--
-- Tabelas protegidas (SELECT, INSERT, UPDATE, DELETE):
--   - public.pacientes (respeitando soft delete: deleted_at IS NULL)
--   - public.historico_clinico
--   - public.clinical_records (se existir) e public.evolucoes_clinicas
--   - public.prescricoes e public.prescricao_itens
--   - public.prescricoes_exames
--   - public.propostas
--   - Demais tabelas clínicas auxiliares (se existirem):
--     avaliacoes_faciais, avaliacoes_corporais, home_care_fichas,
--     home_care_ficha_topicos, home_care_cronograma
-- ==============================================================================

-- 1. Garante colunas auxiliares em public.pacientes (idempotente)
ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.pacientes
ADD COLUMN IF NOT EXISTS foto_perfil TEXT;

CREATE INDEX IF NOT EXISTS idx_pacientes_user_id
ON public.pacientes (user_id)
WHERE deleted_at IS NULL;

-- Garante permissões explícitas de tabela para usuários autenticados (sujeitas à RLS)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;

-- 2. Funções auxiliares SECURITY DEFINER (evitam recursão de RLS e validam role)
CREATE OR REPLACE FUNCTION public.is_profissional()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (
        p.id = auth.uid()
        OR (
          COALESCE(auth.jwt() ->> 'email', '') <> ''
          AND LOWER(TRIM(p.email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
      )
      AND LOWER(TRIM(p.role::text)) = 'profissional'
  )
  OR LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', ''))) = 'profissional';
$$;

CREATE OR REPLACE FUNCTION public.is_profissional_ou_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (
        p.id = auth.uid()
        OR (
          COALESCE(auth.jwt() ->> 'email', '') <> ''
          AND LOWER(TRIM(p.email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
      )
      AND LOWER(TRIM(p.role::text)) IN ('profissional', 'administrador', 'admin')
  )
  OR LOWER(TRIM(COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', ''))) IN ('profissional', 'administrador', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_paciente_owner(p_paciente_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pacientes pac
    WHERE pac.id = p_paciente_id
      AND pac.deleted_at IS NULL
      AND (
        pac.user_id = auth.uid()
        OR (
          COALESCE(auth.jwt() ->> 'email', '') <> ''
          AND LOWER(TRIM(pac.email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_profissional() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profissional() TO authenticated;

REVOKE ALL ON FUNCTION public.is_profissional_ou_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profissional_ou_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_paciente_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_paciente_owner(UUID) TO authenticated;

-- 3. Remove quaisquer políticas permissivas anteriores nas tabelas alvo
DO $$
DECLARE
  v_table TEXT;
  v_pol RECORD;
  v_tables TEXT[] := ARRAY[
    'pacientes',
    'historico_clinico',
    'clinical_records',
    'evolucoes_clinicas',
    'prescricoes',
    'prescricao_itens',
    'prescricoes_exames',
    'propostas',
    'avaliacoes_faciais',
    'avaliacoes_corporais',
    'home_care_fichas',
    'home_care_ficha_topicos',
    'home_care_cronograma'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_table
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_table);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ==============================================================================
-- 4. POLÍTICAS RLS: public.pacientes
--    - SELECT (equipe): profissional e administrador podem listar pacientes ativos
--      (consultas filtram deleted_at IS NULL por padrão) e gerenciar a Lixeira.
--    - SELECT (paciente): apenas o próprio cadastro ativo (deleted_at IS NULL).
--    - INSERT / UPDATE / DELETE: profissional ou administrador.
-- ==============================================================================
CREATE POLICY "pacientes_select_profissional_ou_admin"
ON public.pacientes
FOR SELECT
TO authenticated
USING (public.is_profissional_ou_admin());

CREATE POLICY "pacientes_select_proprio_paciente"
ON public.pacientes
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    user_id = auth.uid()
    OR (
      COALESCE(auth.jwt() ->> 'email', '') <> ''
      AND LOWER(TRIM(email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
    )
  )
);

CREATE POLICY "pacientes_insert_profissional"
ON public.pacientes
FOR INSERT
TO authenticated
WITH CHECK (public.is_profissional_ou_admin());

CREATE POLICY "pacientes_update_profissional"
ON public.pacientes
FOR UPDATE
TO authenticated
USING (public.is_profissional_ou_admin())
WITH CHECK (public.is_profissional_ou_admin());

CREATE POLICY "pacientes_delete_profissional"
ON public.pacientes
FOR DELETE
TO authenticated
USING (public.is_profissional_ou_admin());

-- ==============================================================================
-- 5. POLÍTICAS RLS: public.historico_clinico
--    - SELECT / INSERT / UPDATE: profissional ou próprio paciente (Portal)
--    - DELETE: exclusivo para profissional
-- ==============================================================================
DO $$
BEGIN
  IF to_regclass('public.historico_clinico') IS NOT NULL THEN
    CREATE POLICY "historico_clinico_select_profissional_ou_proprio"
    ON public.historico_clinico
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "historico_clinico_insert_profissional_ou_proprio"
    ON public.historico_clinico
    FOR INSERT
    TO authenticated
    WITH CHECK (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "historico_clinico_update_profissional_ou_proprio"
    ON public.historico_clinico
    FOR UPDATE
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    )
    WITH CHECK (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "historico_clinico_delete_profissional"
    ON public.historico_clinico
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;

-- ==============================================================================
-- 6. POLÍTICAS RLS: public.clinical_records e public.evolucoes_clinicas
--    - SELECT: profissional ou próprio paciente (se aplicável)
--    - INSERT / UPDATE / DELETE: exclusivo para profissional
-- ==============================================================================
DO $$
DECLARE
  v_has_paciente_id BOOLEAN;
  v_has_client_id BOOLEAN;
BEGIN
  IF to_regclass('public.clinical_records') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clinical_records' AND column_name = 'paciente_id'
    ) INTO v_has_paciente_id;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clinical_records' AND column_name = 'client_id'
    ) INTO v_has_client_id;

    IF v_has_paciente_id THEN
      EXECUTE '
        CREATE POLICY "clinical_records_select_profissional_ou_proprio"
        ON public.clinical_records FOR SELECT TO authenticated
        USING (public.is_profissional_ou_admin() OR public.is_paciente_owner(paciente_id))
      ';
    ELSIF v_has_client_id THEN
      EXECUTE '
        CREATE POLICY "clinical_records_select_profissional_ou_proprio"
        ON public.clinical_records FOR SELECT TO authenticated
        USING (public.is_profissional_ou_admin() OR public.is_paciente_owner(client_id))
      ';
    ELSE
      EXECUTE '
        CREATE POLICY "clinical_records_select_profissional"
        ON public.clinical_records FOR SELECT TO authenticated
        USING (public.is_profissional_ou_admin())
      ';
    END IF;

    CREATE POLICY "clinical_records_insert_profissional"
    ON public.clinical_records FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "clinical_records_update_profissional"
    ON public.clinical_records FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "clinical_records_delete_profissional"
    ON public.clinical_records FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.evolucoes_clinicas') IS NOT NULL THEN
    CREATE POLICY "evolucoes_clinicas_select_profissional_ou_proprio"
    ON public.evolucoes_clinicas
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "evolucoes_clinicas_insert_profissional"
    ON public.evolucoes_clinicas
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "evolucoes_clinicas_update_profissional"
    ON public.evolucoes_clinicas
    FOR UPDATE
    TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "evolucoes_clinicas_delete_profissional"
    ON public.evolucoes_clinicas
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;

-- ==============================================================================
-- 7. POLÍTICAS RLS: public.prescricoes e public.prescricao_itens
--    - SELECT: profissional ou próprio paciente (Portal do Paciente)
--    - INSERT / UPDATE / DELETE: exclusivo para profissional
-- ==============================================================================
DO $$
BEGIN
  IF to_regclass('public.prescricoes') IS NOT NULL THEN
    CREATE POLICY "prescricoes_select_profissional_ou_proprio"
    ON public.prescricoes
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "prescricoes_insert_profissional"
    ON public.prescricoes
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricoes_update_profissional"
    ON public.prescricoes
    FOR UPDATE
    TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricoes_delete_profissional"
    ON public.prescricoes
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.prescricao_itens') IS NOT NULL THEN
    CREATE POLICY "prescricao_itens_select_profissional_ou_proprio"
    ON public.prescricao_itens
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR EXISTS (
        SELECT 1
        FROM public.prescricoes pr
        WHERE pr.id = prescricao_id
          AND public.is_paciente_owner(pr.paciente_id)
      )
    );

    CREATE POLICY "prescricao_itens_insert_profissional"
    ON public.prescricao_itens
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricao_itens_update_profissional"
    ON public.prescricao_itens
    FOR UPDATE
    TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricao_itens_delete_profissional"
    ON public.prescricao_itens
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;

-- ==============================================================================
-- 8. POLÍTICAS RLS: public.prescricoes_exames
--    - SELECT: profissional ou próprio paciente (Portal do Paciente)
--    - INSERT / UPDATE / DELETE: exclusivo para profissional
-- ==============================================================================
DO $$
BEGIN
  IF to_regclass('public.prescricoes_exames') IS NOT NULL THEN
    CREATE POLICY "prescricoes_exames_select_profissional_ou_proprio"
    ON public.prescricoes_exames
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "prescricoes_exames_insert_profissional"
    ON public.prescricoes_exames
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricoes_exames_update_profissional"
    ON public.prescricoes_exames
    FOR UPDATE
    TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "prescricoes_exames_delete_profissional"
    ON public.prescricoes_exames
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;

-- ==============================================================================
-- 9. POLÍTICAS RLS: public.propostas
--    - SELECT: profissional ou próprio paciente (Portal do Paciente)
--    - INSERT / UPDATE / DELETE: exclusivo para profissional
-- ==============================================================================
DO $$
BEGIN
  IF to_regclass('public.propostas') IS NOT NULL THEN
    CREATE POLICY "propostas_select_profissional_ou_proprio"
    ON public.propostas
    FOR SELECT
    TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR public.is_paciente_owner(paciente_id)
    );

    CREATE POLICY "propostas_insert_profissional"
    ON public.propostas
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "propostas_update_profissional"
    ON public.propostas
    FOR UPDATE
    TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "propostas_delete_profissional"
    ON public.propostas
    FOR DELETE
    TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;

-- ==============================================================================
-- 10. TABELAS CLÍNICAS COMPLEMENTARES (Avaliações Estéticas e Home Care)
-- ==============================================================================
DO $$
BEGIN
  IF to_regclass('public.avaliacoes_faciais') IS NOT NULL THEN
    CREATE POLICY "avaliacoes_faciais_select_profissional_ou_proprio"
    ON public.avaliacoes_faciais FOR SELECT TO authenticated
    USING (public.is_profissional_ou_admin() OR public.is_paciente_owner(paciente_id));

    CREATE POLICY "avaliacoes_faciais_insert_profissional"
    ON public.avaliacoes_faciais FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "avaliacoes_faciais_update_profissional"
    ON public.avaliacoes_faciais FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "avaliacoes_faciais_delete_profissional"
    ON public.avaliacoes_faciais FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.avaliacoes_corporais') IS NOT NULL THEN
    CREATE POLICY "avaliacoes_corporais_select_profissional_ou_proprio"
    ON public.avaliacoes_corporais FOR SELECT TO authenticated
    USING (public.is_profissional_ou_admin() OR public.is_paciente_owner(paciente_id));

    CREATE POLICY "avaliacoes_corporais_insert_profissional"
    ON public.avaliacoes_corporais FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "avaliacoes_corporais_update_profissional"
    ON public.avaliacoes_corporais FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "avaliacoes_corporais_delete_profissional"
    ON public.avaliacoes_corporais FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.home_care_fichas') IS NOT NULL THEN
    CREATE POLICY "home_care_fichas_select_profissional_ou_proprio"
    ON public.home_care_fichas FOR SELECT TO authenticated
    USING (public.is_profissional_ou_admin() OR public.is_paciente_owner(paciente_id));

    CREATE POLICY "home_care_fichas_insert_profissional"
    ON public.home_care_fichas FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_fichas_update_profissional"
    ON public.home_care_fichas FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_fichas_delete_profissional"
    ON public.home_care_fichas FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.home_care_ficha_topicos') IS NOT NULL THEN
    CREATE POLICY "home_care_ficha_topicos_select_profissional_ou_proprio"
    ON public.home_care_ficha_topicos FOR SELECT TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR EXISTS (
        SELECT 1
        FROM public.home_care_fichas hcf
        WHERE hcf.id = ficha_id
          AND public.is_paciente_owner(hcf.paciente_id)
      )
    );

    CREATE POLICY "home_care_ficha_topicos_insert_profissional"
    ON public.home_care_ficha_topicos FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_ficha_topicos_update_profissional"
    ON public.home_care_ficha_topicos FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_ficha_topicos_delete_profissional"
    ON public.home_care_ficha_topicos FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;

  IF to_regclass('public.home_care_cronograma') IS NOT NULL THEN
    CREATE POLICY "home_care_cronograma_select_profissional_ou_proprio"
    ON public.home_care_cronograma FOR SELECT TO authenticated
    USING (
      public.is_profissional_ou_admin()
      OR EXISTS (
        SELECT 1
        FROM public.home_care_fichas hcf
        WHERE hcf.id = ficha_id
          AND public.is_paciente_owner(hcf.paciente_id)
      )
    );

    CREATE POLICY "home_care_cronograma_insert_profissional"
    ON public.home_care_cronograma FOR INSERT TO authenticated
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_cronograma_update_profissional"
    ON public.home_care_cronograma FOR UPDATE TO authenticated
    USING (public.is_profissional_ou_admin())
    WITH CHECK (public.is_profissional_ou_admin());

    CREATE POLICY "home_care_cronograma_delete_profissional"
    ON public.home_care_cronograma FOR DELETE TO authenticated
    USING (public.is_profissional_ou_admin());
  END IF;
END $$;
