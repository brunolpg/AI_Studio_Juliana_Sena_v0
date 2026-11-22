-- ==============================================================================
-- MIGRAÇÃO IDEMPOTENTE: REMOÇÃO DE REGRAS DE CONVERSÃO PARA TITLE CASE NO BANCO
-- Dra. Juliana Sena - Gestão Clínica & Prontuário
--
-- Objetivo:
--   Remover triggers, funções PL/pgSQL/SQL, constraints CHECK e colunas geradas
--   que apliquem INITCAP(...) ou conversão forçada para Title Case nas tabelas
--   do schema public (pacientes, profiles, formulas, componentes, prescricoes,
--   procedimentos, pops_protocolos, etc.).
--
-- Garantias de Segurança:
--   - 100% idempotente (pode ser executada múltiplas vezes com segurança).
--   - Preserva integralmente triggers de updated_at, soft delete (deleted_at),
--     constraints de domínio/FK/UNIQUE e todas as políticas RLS existentes.
--   - Se alguma trigger de Title Case também atualizava NEW.updated_at, a coluna
--     updated_at continua sendo atualizada via public.handle_updated_at().
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GARANTE FUNÇÃO CANÔNICA DE updated_at (SEM ALTERAÇÃO DE CAPITALIZAÇÃO)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. GARANTE public.handle_new_user() PRESERVANDO A CAPITALIZAÇÃO ORIGINAL DO NOME
--    (alinhado com /sql/supabase-profiles-schema.sql, sem INITCAP)
-- ------------------------------------------------------------------------------
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

    IF LOWER(NEW.email) = 'brunolpg@gmail.com'
       OR LOWER(NEW.email) = 'admin@clinica.com'
       OR raw_role IN ('admin', 'administrador') THEN
        assigned_role := 'administrador'::public.user_role;
    ELSIF LOWER(NEW.email) LIKE '%juliana%'
       OR raw_role IN ('profissional', 'medico', 'esteticista') THEN
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

-- ------------------------------------------------------------------------------
-- 3. DESCOBERTA E REMOÇÃO DINÂMICA DE TRIGGERS, FUNÇÕES, CONSTRAINTS E COLUNAS
--    GERADAS COM REGRAS DE TITLE CASE / INITCAP NO SCHEMA public
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    v_funcdef TEXT;
    v_tables_need_updated_at OID[] := ARRAY[]::OID[];
    v_table_oid OID;
    v_table_name TEXT;
    v_has_updated_at_col BOOLEAN;
    v_has_updated_at_trg BOOLEAN;
    v_dropped_triggers INTEGER := 0;
    v_restored_updated_at INTEGER := 0;
    v_dropped_functions INTEGER := 0;
    v_dropped_constraints INTEGER := 0;
    v_cleared_generated INTEGER := 0;
    v_title_case_name_rx CONSTANT TEXT :=
        '(title[_]?case|initcap|capitalize[_]?word|format[_]?title|normalize[_]?case|to[_]?title)';
    v_title_case_body_rx CONSTANT TEXT :=
        '(\minitcap\s*\(|\m(to_title_case|format_title_case|title_case|titlecase|capitalize_words)\s*\()';
BEGIN
    -- --------------------------------------------------------------------------
    -- 3.1. Remover triggers em public.* que aplicam INITCAP ou Title Case
    -- --------------------------------------------------------------------------
    FOR r IN
        SELECT
            t.tgname,
            c.oid AS table_oid,
            n.nspname,
            c.relname,
            p.oid AS func_oid,
            p.proname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = 'public'
          AND NOT t.tgisinternal
          AND l.lanname IN ('sql', 'plpgsql')
    LOOP
        v_funcdef := pg_get_functiondef(r.func_oid);

        IF r.tgname ~* v_title_case_name_rx
           OR r.proname ~* v_title_case_name_rx
           OR v_funcdef ~* v_title_case_body_rx
        THEN
            -- Se a trigger removida também atualizava NEW.updated_at, agenda garantia de updated_at
            IF v_funcdef ~* '\mnew\.updated_at\s*(:=|=)'
               AND NOT (r.table_oid = ANY(v_tables_need_updated_at))
            THEN
                v_tables_need_updated_at := array_append(v_tables_need_updated_at, r.table_oid);
            END IF;

            EXECUTE format(
                'DROP TRIGGER IF EXISTS %I ON %I.%I;',
                r.tgname,
                r.nspname,
                r.relname
            );
            v_dropped_triggers := v_dropped_triggers + 1;
            RAISE NOTICE '[TitleCase] Trigger removida: %.% -> % (função: %)',
                r.nspname, r.relname, r.tgname, r.proname;
        END IF;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 3.2. Garantir preservação da trigger de updated_at nas tabelas afetadas
    -- --------------------------------------------------------------------------
    FOREACH v_table_oid IN ARRAY v_tables_need_updated_at
    LOOP
        SELECT c.relname
          INTO v_table_name
        FROM pg_class c
        WHERE c.oid = v_table_oid;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns col
            WHERE col.table_schema = 'public'
              AND col.table_name = v_table_name
              AND col.column_name = 'updated_at'
        ) INTO v_has_updated_at_col;

        IF v_has_updated_at_col THEN
            SELECT EXISTS (
                SELECT 1
                FROM pg_trigger t
                JOIN pg_proc p ON p.oid = t.tgfoid
                JOIN pg_language l ON l.oid = p.prolang
                WHERE t.tgrelid = v_table_oid
                  AND NOT t.tgisinternal
                  AND l.lanname IN ('sql', 'plpgsql')
                  AND pg_get_functiondef(p.oid) ~* '\mnew\.updated_at\s*(:=|=)'
            ) INTO v_has_updated_at_trg;

            IF NOT v_has_updated_at_trg THEN
                EXECUTE format(
                    'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
                    'set_' || v_table_name || '_updated_at',
                    v_table_name
                );
                v_restored_updated_at := v_restored_updated_at + 1;
                RAISE NOTICE '[TitleCase] Trigger updated_at restaurada em public.%', v_table_name;
            END IF;
        END IF;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 3.3. Remover funções auxiliares/trigger de Title Case órfãs em public
    --      (sem CASCADE para preservar objetos não relacionados)
    -- --------------------------------------------------------------------------
    FOR r IN
        SELECT
            p.oid AS func_oid,
            n.nspname,
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS identity_args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_language l ON l.oid = p.prolang
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND l.lanname IN ('sql', 'plpgsql')
          AND NOT EXISTS (
              SELECT 1
              FROM pg_depend d
              WHERE d.objid = p.oid
                AND d.deptype = 'e'
          )
          AND p.proname NOT IN (
              'handle_updated_at',
              'handle_appointments_updated_at',
              'handle_pops_updated_at',
              'handle_prescricoes_exames_updated_at',
              'handle_prescricoes_exames_modelos_updated_at',
              'handle_new_user',
              'soft_delete_paciente',
              'is_profissional_or_admin',
              'is_profissional',
              'is_paciente_owner',
              'can_access_patient_photo_object'
          )
    LOOP
        v_funcdef := pg_get_functiondef(r.func_oid);

        IF r.proname ~* v_title_case_name_rx
           OR v_funcdef ~* v_title_case_body_rx
        THEN
            BEGIN
                EXECUTE format(
                    'DROP FUNCTION IF EXISTS %I.%I(%s);',
                    r.nspname,
                    r.proname,
                    r.identity_args
                );
                v_dropped_functions := v_dropped_functions + 1;
                RAISE NOTICE '[TitleCase] Função removida: %.%(%)',
                    r.nspname, r.proname, r.identity_args;
            EXCEPTION
                WHEN dependent_objects_still_exist THEN
                    RAISE NOTICE '[TitleCase] Função %.%(%) mantida por possuir dependentes externos; revise manualmente.',
                        r.nspname, r.proname, r.identity_args;
            END;
        END IF;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 3.4. Remover constraints CHECK que forcem INITCAP / Title Case
    --      (preserva PK, FK, UNIQUE, CHECK de status/sexo/idade e RLS)
    -- --------------------------------------------------------------------------
    FOR r IN
        SELECT
            con.conname,
            n.nspname,
            c.relname,
            pg_get_constraintdef(con.oid) AS condef
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND con.contype = 'c'
    LOOP
        IF r.conname ~* v_title_case_name_rx
           OR r.condef ~* v_title_case_body_rx
        THEN
            EXECUTE format(
                'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;',
                r.nspname,
                r.relname,
                r.conname
            );
            v_dropped_constraints := v_dropped_constraints + 1;
            RAISE NOTICE '[TitleCase] Constraint CHECK removida: %.% -> %',
                r.nspname, r.relname, r.conname;
        END IF;
    END LOOP;

    -- --------------------------------------------------------------------------
    -- 3.5. Remover expressões de colunas GENERATED ALWAYS que usem INITCAP
    --      (converte em coluna normal preservando os valores já armazenados)
    -- --------------------------------------------------------------------------
    FOR r IN
        SELECT
            n.nspname,
            c.relname,
            a.attname,
            pg_get_expr(d.adbin, d.adrelid) AS gen_expr
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attgenerated = 's'
    LOOP
        IF r.gen_expr ~* v_title_case_body_rx THEN
            EXECUTE format(
                'ALTER TABLE %I.%I ALTER COLUMN %I DROP EXPRESSION IF EXISTS;',
                r.nspname,
                r.relname,
                r.attname
            );
            v_cleared_generated := v_cleared_generated + 1;
            RAISE NOTICE '[TitleCase] Expressão GENERATED removida (dados preservados): %.%.%',
                r.nspname, r.relname, r.attname;
        END IF;
    END LOOP;

    RAISE NOTICE '[TitleCase] Migração concluída | triggers_removidas=% | updated_at_restauradas=% | funcoes_removidas=% | checks_removidos=% | generated_convertidas=%',
        v_dropped_triggers,
        v_restored_updated_at,
        v_dropped_functions,
        v_dropped_constraints,
        v_cleared_generated;
END $$;

COMMIT;

-- ==============================================================================
-- VERIFICAÇÃO OPCIONAL (SOMENTE LEITURA):
-- Descomente e execute no SQL Editor do Supabase para confirmar 0 ocorrências:
--
-- SELECT t.tgname, c.relname AS tabela, p.proname AS funcao
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- JOIN pg_proc p ON p.oid = t.tgfoid
-- JOIN pg_language l ON l.oid = p.prolang
-- WHERE n.nspname = 'public'
--   AND NOT t.tgisinternal
--   AND l.lanname IN ('sql', 'plpgsql')
--   AND (
--     t.tgname ~* '(title[_]?case|initcap)'
--     OR p.proname ~* '(title[_]?case|initcap)'
--     OR pg_get_functiondef(p.oid) ~* '\minitcap\s*\('
--   );
-- ==============================================================================
