-- ============================================
-- MIGRAÇÃO: Atualizar tabela trabalhadores
-- ============================================
-- Adiciona colunas faltantes para compatibilidade
-- com os componentes React
-- Data: 2025-10-28
-- ============================================

-- 1. Adicionar coluna 'numero' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'numero'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN numero INTEGER;
    CREATE INDEX IF NOT EXISTS idx_trabalhadores_numero ON trabalhadores(numero);
    COMMENT ON COLUMN trabalhadores.numero IS 'Número identificador do trabalhador';
  END IF;
END $$;

-- 2. Adicionar coluna 'grupo' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'grupo'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN grupo TEXT;
    CREATE INDEX IF NOT EXISTS idx_trabalhadores_grupo ON trabalhadores(grupo);
    COMMENT ON COLUMN trabalhadores.grupo IS 'Grupo do trabalhador: Direção ou Médiuns Correntes';
  END IF;
END $$;

-- 3. Adicionar coluna 'funcao_permanente' (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trabalhadores' AND column_name = 'funcao_permanente'
  ) THEN
    ALTER TABLE trabalhadores ADD COLUMN funcao_permanente TEXT;
    CREATE INDEX IF NOT EXISTS idx_trabalhadores_funcao ON trabalhadores(funcao_permanente);
    COMMENT ON COLUMN trabalhadores.funcao_permanente IS 'Função padrão/permanente do trabalhador';
  END IF;
END $$;

-- 4. Atualizar constraint do campo 'status' para incluir 'afastado'
DO $$
BEGIN
  -- Remover constraint antiga se existir
  ALTER TABLE trabalhadores DROP CONSTRAINT IF EXISTS trabalhadores_status_check;

  -- Adicionar nova constraint
  ALTER TABLE trabalhadores ADD CONSTRAINT trabalhadores_status_check
    CHECK (status IN ('ativo', 'inativo', 'afastado'));
END $$;

-- 5. Comentários atualizados
COMMENT ON TABLE trabalhadores IS 'Cadastro de trabalhadores espirituais da casa (atualizado com campos de escalas)';
COMMENT ON COLUMN trabalhadores.status IS 'Status do trabalhador: ativo, inativo ou afastado';

-- ============================================
-- Mensagem de sucesso
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '✓ Tabela trabalhadores atualizada!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Colunas adicionadas/verificadas:';
  RAISE NOTICE '  ✓ numero (INTEGER)';
  RAISE NOTICE '  ✓ grupo (TEXT)';
  RAISE NOTICE '  ✓ funcao_permanente (TEXT)';
  RAISE NOTICE '';
  RAISE NOTICE 'Status atualizado para aceitar:';
  RAISE NOTICE '  ✓ ativo';
  RAISE NOTICE '  ✓ inativo';
  RAISE NOTICE '  ✓ afastado';
  RAISE NOTICE '';
  RAISE NOTICE 'Execute este SQL no Supabase SQL Editor';
  RAISE NOTICE '============================================';
END $$;
