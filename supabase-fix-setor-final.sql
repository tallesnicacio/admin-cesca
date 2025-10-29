-- Atualizar registros existentes primeiro
UPDATE caixas SET setor = 'mensalidades_cursos' WHERE setor = 'mensalidades';

-- Remover constraint antiga
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS check_setor_caixa;

-- Adicionar nova constraint
ALTER TABLE caixas ADD CONSTRAINT check_setor_caixa CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos'));

-- Verificar resultado
SELECT setor, COUNT(*) as total FROM caixas GROUP BY setor;
