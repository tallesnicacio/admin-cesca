-- ============================================
-- REMOVER CAMPO FUNÇÃO DO SISTEMA DE PRESENÇA
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Data: 2025-10-26
-- ============================================

-- 1. Remover a constraint CHECK da coluna funcao
ALTER TABLE presencas
  DROP CONSTRAINT IF EXISTS presencas_funcao_check;

-- 2. Definir todas as funções como NULL (opcional)
UPDATE presencas SET funcao = NULL WHERE funcao IS NOT NULL;

-- 3. Remover o índice da coluna funcao
DROP INDEX IF EXISTS idx_presencas_funcao;

-- 4. Remover o comentário da coluna funcao
COMMENT ON COLUMN presencas.funcao IS NULL;

-- 5. Opcional: Remover a coluna funcao completamente (descomente se desejar)
-- ALTER TABLE presencas DROP COLUMN IF EXISTS funcao;

-- 6. Dropar a view de funções se existir
DROP VIEW IF EXISTS vw_presenca_funcoes;

-- ============================================
-- OBSERVAÇÕES:
-- ============================================
-- - A coluna 'funcao' permanecerá na tabela mas sem constraint
-- - Todos os valores de função existentes serão setados para NULL
-- - O índice na coluna funcao foi removido
-- - A view vw_presenca_funcoes foi removida
-- - Para remover completamente a coluna, descomente a linha 18
-- ============================================
