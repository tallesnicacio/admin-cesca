-- ===================================================================
-- CORREÇÃO: Atualizar constraint do campo 'setor' para usar mensalidades_cursos
-- ===================================================================
-- Data: 2025-10-28
-- ===================================================================

BEGIN;

-- 1. Remover a constraint antiga
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS check_setor_caixa;

-- 2. Adicionar nova constraint com valor correto
ALTER TABLE caixas
ADD CONSTRAINT check_setor_caixa
CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos'));

-- 3. Atualizar registros existentes de 'mensalidades' para 'mensalidades_cursos'
UPDATE caixas
SET setor = 'mensalidades_cursos'
WHERE setor = 'mensalidades';

-- 4. Atualizar comentário
COMMENT ON COLUMN caixas.setor IS 'Setor do caixa: lanche, lojinha ou mensalidades_cursos';

COMMIT;

-- Mensagem de sucesso
SELECT 'Constraint corrigida com sucesso!' as resultado;
