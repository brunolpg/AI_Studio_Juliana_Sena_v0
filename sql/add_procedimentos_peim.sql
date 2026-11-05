-- ==============================================================================
-- SCRIPT DML: ADICIONAR PROCEDIMENTOS PEIM (ESTÉTICA CORPORAL)
-- ==============================================================================
-- Tabela: public.procedimentos
-- Adiciona os novos pacotes de PEIM (3 e 5 sessões)
-- ==============================================================================

-- Adiciona a coluna descricao se ainda não existir
ALTER TABLE public.procedimentos ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Registra os novos procedimentos PEIM
INSERT INTO public.procedimentos (procedimento, categoria, duracao, valor, descricao)
VALUES 
  ('PEIM - Pacote 3 sessões', 'Estética Corporal', 1, 500.00, 'Procedimento Estético Injetável para Microvasos - Pacote com 3 sessões'),
  ('PEIM - Pacote 5 sessões', 'Estética Corporal', 1, 800.00, 'Procedimento Estético Injetável para Microvasos - Pacote com 5 sessões')
ON CONFLICT DO NOTHING;
