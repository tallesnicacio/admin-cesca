-- ============================================
-- MIGRAÇÃO DEFINITIVA - Admin CESCA
-- ============================================
-- Corrige TODAS as incompatibilidades entre
-- o código React e o schema do banco
-- Data: 2025-10-28
-- ============================================

-- ============================================
-- PARTE 1: TABELA TRABALHADORES
-- ============================================

-- 1.1 Remover constraint antiga de status
DO $$
BEGIN
  ALTER TABLE trabalhadores DROP CONSTRAINT IF EXISTS trabalhadores_status_check;
END $$;

-- 1.2 Adicionar coluna 'numero' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'numero'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN numero INTEGER;
    RAISE NOTICE '✓ Coluna numero adicionada';
  ELSE
    RAISE NOTICE '- Coluna numero já existe';
  END IF;
END $$;

-- 1.3 Adicionar coluna 'grupo' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'grupo'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN grupo TEXT;
    RAISE NOTICE '✓ Coluna grupo adicionada';
  ELSE
    RAISE NOTICE '- Coluna grupo já existe';
  END IF;
END $$;

-- 1.4 Adicionar coluna 'funcao_permanente' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'funcao_permanente'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN funcao_permanente TEXT;
    RAISE NOTICE '✓ Coluna funcao_permanente adicionada';
  ELSE
    RAISE NOTICE '- Coluna funcao_permanente já existe';
  END IF;
END $$;

-- 1.5 Adicionar constraint atualizado de status (com 'afastado')
ALTER TABLE trabalhadores ADD CONSTRAINT trabalhadores_status_check
  CHECK (status IN ('ativo', 'inativo', 'afastado'));

-- 1.6 Criar índices (se não existirem)
CREATE INDEX IF NOT EXISTS idx_trabalhadores_numero ON trabalhadores(numero);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_grupo ON trabalhadores(grupo);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_funcao ON trabalhadores(funcao_permanente);

-- 1.7 Comentários
COMMENT ON COLUMN trabalhadores.numero IS 'Número identificador do trabalhador';
COMMENT ON COLUMN trabalhadores.grupo IS 'Grupo do trabalhador: Direção ou Médiuns Correntes';
COMMENT ON COLUMN trabalhadores.funcao_permanente IS 'Função padrão/permanente do trabalhador';
COMMENT ON COLUMN trabalhadores.status IS 'Status do trabalhador: ativo, inativo ou afastado';

-- ============================================
-- PARTE 2: TABELA TIPOS_ATENDIMENTO
-- ============================================

-- 2.1 Adicionar coluna 'horario_inicio' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'horario_inicio'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN horario_inicio TEXT DEFAULT '19:30';
    RAISE NOTICE '✓ Coluna horario_inicio adicionada';
  ELSE
    RAISE NOTICE '- Coluna horario_inicio já existe';
  END IF;
END $$;

-- 2.2 Adicionar coluna 'horario_fim' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'horario_fim'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN horario_fim TEXT DEFAULT '22:00';
    RAISE NOTICE '✓ Coluna horario_fim adicionada';
  ELSE
    RAISE NOTICE '- Coluna horario_fim já existe';
  END IF;
END $$;

-- 2.3 Verificar se dia_semana existe (já deveria existir como dias_funcionamento)
-- Se não existir, adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tipos_atendimento' AND column_name = 'dia_semana'
  ) THEN
    ALTER TABLE tipos_atendimento ADD COLUMN dia_semana TEXT[];
    RAISE NOTICE '✓ Coluna dia_semana adicionada';
  ELSE
    RAISE NOTICE '- Coluna dia_semana já existe';
  END IF;
END $$;

-- 2.4 Atualizar valores padrão para registros existentes
UPDATE tipos_atendimento
SET dia_semana = ARRAY['segunda', 'sexta']
WHERE dia_semana IS NULL;

-- 2.5 Criar índice
CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_horarios ON tipos_atendimento(horario_inicio, horario_fim);

-- 2.6 Comentários
COMMENT ON COLUMN tipos_atendimento.horario_inicio IS 'Horário de início padrão para este tipo de atendimento';
COMMENT ON COLUMN tipos_atendimento.horario_fim IS 'Horário de fim padrão para este tipo de atendimento';
COMMENT ON COLUMN tipos_atendimento.dia_semana IS 'Array de dias da semana (segunda, sexta)';

-- ============================================
-- PARTE 3: TABELA CAIXAS (Garantir independência)
-- ============================================

-- 3.1 Verificar se a constraint de unicidade existe
DO $$
BEGIN
  -- Remover constraint antiga se existir (pode estar impedindo múltiplos caixas)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'caixas_data_unique'
    AND table_name = 'caixas'
  ) THEN
    ALTER TABLE caixas DROP CONSTRAINT caixas_data_unique;
    RAISE NOTICE '✓ Constraint caixas_data_unique removida (era muito restritiva)';
  END IF;

  -- Garantir que existe a constraint correta (data + setor)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'caixas_data_setor_unique'
    AND table_name = 'caixas'
  ) THEN
    ALTER TABLE caixas ADD CONSTRAINT caixas_data_setor_unique UNIQUE(data, setor);
    RAISE NOTICE '✓ Constraint caixas_data_setor_unique criada';
  ELSE
    RAISE NOTICE '- Constraint caixas_data_setor_unique já existe';
  END IF;
END $$;

-- 3.2 Verificar campos necessários na tabela caixas
DO $$
BEGIN
  -- Verificar se campo setor existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'caixas' AND column_name = 'setor'
  ) THEN
    ALTER TABLE caixas ADD COLUMN setor TEXT NOT NULL;
    RAISE NOTICE '✓ Coluna setor adicionada em caixas';
  ELSE
    RAISE NOTICE '- Coluna setor já existe em caixas';
  END IF;
END $$;

-- ============================================
-- PARTE 4: VERIFICAÇÃO FINAL
-- ============================================

-- 4.1 Listar todas as colunas de trabalhadores
DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_name = 'trabalhadores';

  RAISE NOTICE '';
  RAISE NOTICE '📋 Colunas da tabela trabalhadores:';
  RAISE NOTICE '   %', cols;
END $$;

-- 4.2 Listar todas as colunas de tipos_atendimento
DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_name = 'tipos_atendimento';

  RAISE NOTICE '';
  RAISE NOTICE '📋 Colunas da tabela tipos_atendimento:';
  RAISE NOTICE '   %', cols;
END $$;

-- 4.3 Verificar constraints de caixas
DO $$
DECLARE
  constraints TEXT;
BEGIN
  SELECT string_agg(constraint_name, ', ')
  INTO constraints
  FROM information_schema.table_constraints
  WHERE table_name = 'caixas'
  AND constraint_type = 'UNIQUE';

  RAISE NOTICE '';
  RAISE NOTICE '📋 Constraints UNIQUE da tabela caixas:';
  RAISE NOTICE '   %', constraints;
END $$;

-- ============================================
-- MENSAGEM FINAL
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ MIGRAÇÃO DEFINITIVA CONCLUÍDA!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 Tabelas atualizadas:';
  RAISE NOTICE '   ✓ trabalhadores (com numero, grupo, funcao_permanente, status)';
  RAISE NOTICE '   ✓ tipos_atendimento (com horario_inicio, horario_fim, dia_semana)';
  RAISE NOTICE '   ✓ caixas (com constraint correta de unicidade)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Próximos passos:';
  RAISE NOTICE '   1. Verifique as colunas listadas acima';
  RAISE NOTICE '   2. Teste o carregamento de trabalhadores';
  RAISE NOTICE '   3. Teste abertura/fechamento de caixas independentes';
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
END $$;
