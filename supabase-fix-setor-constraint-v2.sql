-- ===================================================================
-- CORREÇÃO: Atualizar constraint do campo 'setor' (versão corrigida)
-- ===================================================================
-- Data: 2025-10-28
-- ===================================================================

BEGIN;

-- PASSO 1: Atualizar PRIMEIRO os registros existentes
UPDATE caixas
SET setor = 'mensalidades_cursos'
WHERE setor = 'mensalidades';

-- PASSO 2: Remover a constraint antiga
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS check_setor_caixa;

-- PASSO 3: Adicionar nova constraint com valor correto
ALTER TABLE caixas
ADD CONSTRAINT check_setor_caixa
CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos'));

-- PASSO 4: Atualizar comentário
COMMENT ON COLUMN caixas.setor IS 'Setor do caixa: lanche, lojinha ou mensalidades_cursos';

COMMIT;

-- Verificar resultado
SELECT setor, COUNT(*) as total
FROM caixas
GROUP BY setor;
