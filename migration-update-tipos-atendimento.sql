-- ============================================
-- MIGRAÇÃO: Atualizar tabela tipos_atendimento
-- ============================================
-- Adiciona colunas faltantes para horários
-- Data: 2025-10-28
-- ============================================

-- 1. Adicionar coluna 'horario_inicio' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'horario_inicio'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN horario_inicio TEXT DEFAULT '19:30';
    COMMENT ON COLUMN tipos_atendimento.horario_inicio IS 'Horário de início padrão para este tipo de atendimento';
  END IF;
END $$;

-- 2. Adicionar coluna 'horario_fim' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'horario_fim'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN horario_fim TEXT DEFAULT '22:00';
    COMMENT ON COLUMN tipos_atendimento.horario_fim IS 'Horário de fim padrão para este tipo de atendimento';
  END IF;
END $$;

-- 3. Adicionar coluna 'dia_semana' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'dia_semana'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN dia_semana TEXT[];
    COMMENT ON COLUMN tipos_atendimento.dia_semana IS 'Array de dias da semana (segunda, sexta)';
  END IF;
END $$;

-- 4. Atualizar valores padrão para registros existentes (se dia_semana estiver NULL)
UPDATE tipos_atendimento
SET dia_semana = ARRAY['segunda', 'sexta']
WHERE dia_semana IS NULL;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_horarios ON tipos_atendimento(horario_inicio, horario_fim);

-- ============================================
-- Mensagem de sucesso
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✓ Tabela tipos_atendimento atualizada!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Colunas adicionadas/verificadas:';
  RAISE NOTICE '  ✓ horario_inicio (TEXT) - Default: 19:30';
  RAISE NOTICE '  ✓ horario_fim (TEXT) - Default: 22:00';
  RAISE NOTICE '  ✓ dia_semana (TEXT[]) - Default: [segunda, sexta]';
  RAISE NOTICE '';
  RAISE NOTICE 'Execute este SQL no Supabase SQL Editor';
  RAISE NOTICE '============================================';
END $$;
