-- =====================================================
-- Admin CESCA - Script de Limpeza de Dados
-- =====================================================
-- ATENÇÃO: Este script remove TODOS os dados das tabelas
-- mantendo apenas a estrutura do banco de dados.
--
-- Use este script para preparar o sistema para produção
-- com uma base de dados limpa.
--
-- IMPORTANTE: Execute com cuidado! Esta ação é IRREVERSÍVEL!
-- =====================================================

-- =====================================================
-- DESABILITAR TRIGGERS TEMPORARIAMENTE
-- =====================================================
SET session_replication_role = 'replica';

-- =====================================================
-- LIMPEZA DE DADOS - Ordem respeitando foreign keys
-- =====================================================

-- 1. MÓDULO: QUIZ E TREINAMENTO
TRUNCATE TABLE quiz_attempts CASCADE;
TRUNCATE TABLE questions CASCADE;
TRUNCATE TABLE quizzes CASCADE;

-- 2. MÓDULO: AGENDAMENTOS
TRUNCATE TABLE agendamentos CASCADE;
-- Manter configurações (apenas limpar se necessário)
-- TRUNCATE TABLE configuracoes CASCADE;

-- 3. MÓDULO: FINANCEIRO
TRUNCATE TABLE movimentacoes_caixa CASCADE;
TRUNCATE TABLE caixas CASCADE;
TRUNCATE TABLE despesas CASCADE;
TRUNCATE TABLE mensalidades CASCADE;
TRUNCATE TABLE matriculas CASCADE;
TRUNCATE TABLE cursos CASCADE;
TRUNCATE TABLE alunos CASCADE;

-- 4. MÓDULO: ESCALAS
TRUNCATE TABLE substituicoes CASCADE;
TRUNCATE TABLE escalas CASCADE;
TRUNCATE TABLE funcoes_fixas CASCADE;
TRUNCATE TABLE restricoes CASCADE;
TRUNCATE TABLE capacitacoes CASCADE;
TRUNCATE TABLE tipos_atendimento CASCADE;

-- 5. MÓDULO: PRESENÇA E ADVERTÊNCIAS
TRUNCATE TABLE advertencias CASCADE;
TRUNCATE TABLE presencas CASCADE;
TRUNCATE TABLE trabalhadores CASCADE;

-- 6. USUÁRIOS
-- Manter apenas os 3 administradores principais:
-- - talles.nicacio@gmail.com
-- - batistagodoil@gmail.com
-- - rovef.amorim@gmail.com
--
-- Deletar todos os outros usuários
DELETE FROM profiles
WHERE email NOT IN (
  'talles.nicacio@gmail.com',
  'batistagodoil@gmail.com',
  'rovef.amorim@gmail.com'
);

-- Garantir que os 3 usuários mantidos sejam administradores
UPDATE profiles
SET
  is_admin = true,
  is_active = true
WHERE email IN (
  'talles.nicacio@gmail.com',
  'batistagodoil@gmail.com',
  'rovef.amorim@gmail.com'
);

-- =====================================================
-- REABILITAR TRIGGERS
-- =====================================================
SET session_replication_role = 'origin';

-- =====================================================
-- RESETAR SEQUÊNCIAS (se necessário)
-- =====================================================
-- As tabelas usam UUID com gen_random_uuid()
-- então não há sequências para resetar

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Contar registros em cada tabela
SELECT 'quiz_attempts' as tabela, COUNT(*) as registros FROM quiz_attempts
UNION ALL
SELECT 'questions', COUNT(*) FROM questions
UNION ALL
SELECT 'quizzes', COUNT(*) FROM quizzes
UNION ALL
SELECT 'agendamentos', COUNT(*) FROM agendamentos
UNION ALL
SELECT 'configuracoes', COUNT(*) FROM configuracoes
UNION ALL
SELECT 'movimentacoes_caixa', COUNT(*) FROM movimentacoes_caixa
UNION ALL
SELECT 'caixas', COUNT(*) FROM caixas
UNION ALL
SELECT 'despesas', COUNT(*) FROM despesas
UNION ALL
SELECT 'mensalidades', COUNT(*) FROM mensalidades
UNION ALL
SELECT 'matriculas', COUNT(*) FROM matriculas
UNION ALL
SELECT 'cursos', COUNT(*) FROM cursos
UNION ALL
SELECT 'alunos', COUNT(*) FROM alunos
UNION ALL
SELECT 'substituicoes', COUNT(*) FROM substituicoes
UNION ALL
SELECT 'escalas', COUNT(*) FROM escalas
UNION ALL
SELECT 'funcoes_fixas', COUNT(*) FROM funcoes_fixas
UNION ALL
SELECT 'restricoes', COUNT(*) FROM restricoes
UNION ALL
SELECT 'capacitacoes', COUNT(*) FROM capacitacoes
UNION ALL
SELECT 'tipos_atendimento', COUNT(*) FROM tipos_atendimento
UNION ALL
SELECT 'advertencias', COUNT(*) FROM advertencias
UNION ALL
SELECT 'presencas', COUNT(*) FROM presencas
UNION ALL
SELECT 'trabalhadores', COUNT(*) FROM trabalhadores
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
ORDER BY tabela;

-- =====================================================
-- DADOS INICIAIS (OPCIONAL)
-- =====================================================

-- Inserir configuração padrão se a tabela estiver vazia
INSERT INTO configuracoes (agendamentos_ativos, ignorar_restricao_dias, ignorar_restricao_horario)
SELECT true, false, false
WHERE NOT EXISTS (SELECT 1 FROM configuracoes);

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ Limpeza de dados concluída com sucesso!';
  RAISE NOTICE '📊 Execute a consulta de verificação acima para confirmar.';
  RAISE NOTICE '⚠️  Lembre-se de criar um usuário admin para acessar o sistema.';
END $$;
