-- ==============================================================================
-- ÍNDICES DE PERFORMANCE PARA PRONTUÁRIO CLÍNICO & CONSULTAS POR PACIENTE
-- Dra. Juliana Sena - Gestão Clínica & Prontuário
-- ==============================================================================
-- Objetivo:
--   Acelerar a seleção de pacientes e o carregamento das abas do prontuário
--   (Evoluções, Histórico & Anamnese, Prescrições, Home Care, Exames, Termos,
--   Propostas e Agendamentos) via índices B-Tree compostos nas colunas
--   paciente_id / client_id e ordenações cronológicas.
--
-- Regras:
--   - Apenas CREATE INDEX IF NOT EXISTS (idempotente).
--   - Não altera nenhuma coluna, constraint ou política RLS existente.
-- ==============================================================================

-- 1. Pacientes ativos (listagem ordenada por nome com soft delete)
CREATE INDEX IF NOT EXISTS idx_pacientes_active_nome
ON public.pacientes (nome ASC)
WHERE deleted_at IS NULL;

-- 2. Histórico Clínico & Anamnese (lookup 1:1 por paciente_id)
DO $$
BEGIN
  IF to_regclass('public.historico_clinico') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_historico_clinico_paciente_id
    ON public.historico_clinico (paciente_id);
  END IF;
END $$;

-- 3. Evoluções Clínicas (SOAP) — ordenação cronológica e filtro de sinais vitais
DO $$
BEGIN
  IF to_regclass('public.evolucoes_clinicas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_evolucoes_clinicas_paciente_created
    ON public.evolucoes_clinicas (paciente_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_evolucoes_clinicas_paciente_data_created
    ON public.evolucoes_clinicas (paciente_id, data DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_evolucoes_clinicas_paciente_sinais_vitais
    ON public.evolucoes_clinicas (paciente_id, created_at DESC)
    WHERE sinais_vitais IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_evolucoes_clinicas_appointment_id
    ON public.evolucoes_clinicas (appointment_id)
    WHERE appointment_id IS NOT NULL;
  END IF;
END $$;

-- 4. Tabela associativa Evolução <-> Prescrições
DO $$
BEGIN
  IF to_regclass('public.evolucao_prescricoes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_evolucao_prescricoes_evolucao_id
    ON public.evolucao_prescricoes (evolucao_id);

    CREATE INDEX IF NOT EXISTS idx_evolucao_prescricoes_prescricao_id
    ON public.evolucao_prescricoes (prescricao_id);
  END IF;
END $$;

-- 5. Prescrições Magistrais e Itens
DO $$
BEGIN
  IF to_regclass('public.prescricoes') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente_data
    ON public.prescricoes (paciente_id, data_prescricao DESC);

    CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente_status
    ON public.prescricoes (paciente_id, status);
  END IF;

  IF to_regclass('public.prescricao_itens') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_prescricao_itens_prescricao_id
    ON public.prescricao_itens (prescricao_id);
  END IF;
END $$;

-- 6. Prescrições de Exames Laboratoriais
DO $$
BEGIN
  IF to_regclass('public.prescricoes_exames') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_prescricoes_exames_paciente_data
    ON public.prescricoes_exames (paciente_id, data DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_prescricoes_exames_paciente_status
    ON public.prescricoes_exames (paciente_id, status);
  END IF;
END $$;

-- 7. Avaliações Estéticas (Facial & Corporal — busca do registro mais recente)
DO $$
BEGIN
  IF to_regclass('public.avaliacoes_faciais') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_faciais_paciente_created
    ON public.avaliacoes_faciais (paciente_id, created_at DESC);
  END IF;

  IF to_regclass('public.avaliacoes_corporais') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_avaliacoes_corporais_paciente_created
    ON public.avaliacoes_corporais (paciente_id, created_at DESC);
  END IF;
END $$;

-- 8. Fichas de Home Care, Tópicos e Cronograma
DO $$
BEGIN
  IF to_regclass('public.home_care_fichas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_home_care_fichas_paciente_data_created
    ON public.home_care_fichas (paciente_id, data_home_care DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_home_care_fichas_appointment_id
    ON public.home_care_fichas (appointment_id)
    WHERE appointment_id IS NOT NULL;
  END IF;

  IF to_regclass('public.home_care_ficha_topicos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_home_care_ficha_topicos_ficha_ordem
    ON public.home_care_ficha_topicos (ficha_id, ordem ASC);
  END IF;

  IF to_regclass('public.home_care_cronograma') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_home_care_cronograma_ficha_ordem
    ON public.home_care_cronograma (ficha_id, ordem ASC);
  END IF;
END $$;

-- 9. Termos de Consentimento
DO $$
BEGIN
  IF to_regclass('public.termos') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_termos_paciente_data_created
    ON public.termos (paciente_id, data DESC, created_at DESC);
  END IF;
END $$;

-- 10. Propostas de Planejamento Clínico
DO $$
BEGIN
  IF to_regclass('public.propostas') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_propostas_paciente_created
    ON public.propostas (paciente_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_propostas_paciente_status
    ON public.propostas (paciente_id, status);
  END IF;
END $$;

-- 11. Agendamentos (consultas por paciente ordenadas cronologicamente)
DO $$
BEGIN
  IF to_regclass('public.appointments') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_appointments_client_data_horario
    ON public.appointments (client_id, data DESC, horario_inicio DESC);
  END IF;
END $$;

-- 12. Tabela legada/alternativa clinical_records (se existir no schema)
DO $$
DECLARE
  v_has_paciente_id BOOLEAN;
  v_has_client_id BOOLEAN;
  v_has_created_at BOOLEAN;
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

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clinical_records' AND column_name = 'created_at'
    ) INTO v_has_created_at;

    IF v_has_paciente_id AND v_has_created_at THEN
      CREATE INDEX IF NOT EXISTS idx_clinical_records_paciente_created
      ON public.clinical_records (paciente_id, created_at DESC);
    ELSIF v_has_paciente_id THEN
      CREATE INDEX IF NOT EXISTS idx_clinical_records_paciente_id
      ON public.clinical_records (paciente_id);
    END IF;

    IF v_has_client_id AND v_has_created_at THEN
      CREATE INDEX IF NOT EXISTS idx_clinical_records_client_created
      ON public.clinical_records (client_id, created_at DESC);
    ELSIF v_has_client_id THEN
      CREATE INDEX IF NOT EXISTS idx_clinical_records_client_id
      ON public.clinical_records (client_id);
    END IF;
  END IF;
END $$;

-- 13. Profiles (lookup de avatar_url por email normalizado)
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
    ON public.profiles (LOWER(TRIM(email)));
  END IF;
END $$;
