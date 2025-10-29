-- ===================================================================
-- MIGRAÇÃO: Adicionar campo 'setor' à tabela caixas
-- ===================================================================
-- Permite ter 3 caixas separados por dia (lanche, lojinha, mensalidades)
-- Data: 2025-10-28
-- ===================================================================

BEGIN;

-- 1. Remover a constraint UNIQUE em 'data' (se existir)
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS caixas_data_key;

-- 2. Adicionar coluna 'setor'
ALTER TABLE caixas
ADD COLUMN IF NOT EXISTS setor TEXT;

-- 3. Atualizar registros existentes (se houver) com setor padrão
UPDATE caixas
SET setor = 'lanche'
WHERE setor IS NULL;

-- 4. Tornar coluna 'setor' obrigatória
ALTER TABLE caixas
ALTER COLUMN setor SET NOT NULL;

-- 5. Adicionar constraint CHECK para valores válidos
ALTER TABLE caixas
ADD CONSTRAINT check_setor_caixa
CHECK (setor IN ('lanche', 'lojinha', 'mensalidades'));

-- 6. Adicionar constraint UNIQUE em (data, setor)
-- Permite apenas um caixa por setor por dia
ALTER TABLE caixas
ADD CONSTRAINT caixas_data_setor_unique
UNIQUE (data, setor);

-- 7. Adicionar índice para consultas por setor
CREATE INDEX IF NOT EXISTS idx_caixas_setor ON caixas(setor);

-- 8. Adicionar comentários
COMMENT ON COLUMN caixas.setor IS 'Setor do caixa: lanche, lojinha ou mensalidades';

COMMIT;

-- ===================================================================
-- Mensagem de sucesso
-- ===================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Migração concluída com sucesso!';
  RAISE NOTICE '  - Coluna setor adicionada à tabela caixas';
  RAISE NOTICE '  - Constraint UNIQUE (data, setor) criada';
  RAISE NOTICE '  - Agora é possível ter até 3 caixas por dia (um para cada setor)';
  RAISE NOTICE '';
END $$;
