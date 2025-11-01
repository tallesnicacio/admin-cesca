-- ================================================================
-- SOLUÇÃO COMPLETA: CORREÇÃO DOS AGENDAMENTOS
-- Execute este script no SQL Editor do Supabase Cloud
-- Data: 2025-11-01
-- ================================================================

-- ================================================================
-- PARTE 1: DIAGNÓSTICO
-- ================================================================

-- 1.1 Verificar estrutura da tabela agendamentos
SELECT
  '=== ESTRUTURA DA TABELA ===' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agendamentos'
ORDER BY ordinal_position;

-- 1.2 Verificar políticas RLS existentes
SELECT
  '=== POLÍTICAS RLS ATUAIS ===' as info,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'agendamentos';

-- 1.3 Verificar se RLS está habilitado
SELECT
  '=== STATUS RLS ===' as info,
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'agendamentos';

-- ================================================================
-- PARTE 2: ADICIONAR COLUNAS FALTANTES
-- ================================================================

-- Adicionar coluna data_confirmacao se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos'
    AND column_name = 'data_confirmacao'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN data_confirmacao TIMESTAMPTZ;
    RAISE NOTICE 'Coluna data_confirmacao adicionada';
  ELSE
    RAISE NOTICE 'Coluna data_confirmacao já existe';
  END IF;
END $$;

-- Adicionar coluna atendente se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos'
    AND column_name = 'atendente'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN atendente TEXT;
    RAISE NOTICE 'Coluna atendente adicionada';
  ELSE
    RAISE NOTICE 'Coluna atendente já existe';
  END IF;
END $$;

-- Adicionar coluna opcao_escolhida se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos'
    AND column_name = 'opcao_escolhida'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN opcao_escolhida TEXT;
    RAISE NOTICE 'Coluna opcao_escolhida adicionada';
  ELSE
    RAISE NOTICE 'Coluna opcao_escolhida já existe';
  END IF;
END $$;

-- Adicionar constraint se a coluna foi criada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos'
    AND column_name = 'opcao_escolhida'
  ) THEN
    -- Remover constraint antiga se existir
    ALTER TABLE agendamentos
    DROP CONSTRAINT IF EXISTS agendamentos_opcao_escolhida_check;

    -- Adicionar nova constraint
    ALTER TABLE agendamentos
    ADD CONSTRAINT agendamentos_opcao_escolhida_check
    CHECK (opcao_escolhida IN ('primeira', 'segunda') OR opcao_escolhida IS NULL);

    RAISE NOTICE 'Constraint da coluna opcao_escolhida configurada';
  END IF;
END $$;

-- Adicionar coluna observacoes se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos'
    AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN observacoes TEXT;
    RAISE NOTICE 'Coluna observacoes adicionada';
  ELSE
    RAISE NOTICE 'Coluna observacoes já existe';
  END IF;
END $$;

-- ================================================================
-- PARTE 3: CONFIGURAR RLS CORRETAMENTE
-- ================================================================

-- 3.1 Habilitar RLS (se não estiver)
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- 3.2 Remover todas as políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Permitir inserção pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Public users can insert agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Enable insert for anon users" ON agendamentos;
DROP POLICY IF EXISTS "public_insert_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir leitura autenticada de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_select_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir atualização autenticada de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_update_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Authenticated users can delete agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_delete_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "anon_insert_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "anon_select_agendamentos" ON agendamentos;

-- 3.3 Criar política para INSERT público (formulário web pode criar agendamentos)
CREATE POLICY "public_insert_agendamentos"
  ON agendamentos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 3.4 Criar política para SELECT (usuários anônimos E autenticados podem ver)
-- Isso permite que o formulário público veja as opções e também que admins vejam tudo
CREATE POLICY "public_select_agendamentos"
  ON agendamentos
  FOR SELECT
  TO public
  USING (true);

-- 3.5 Criar política para UPDATE (SOMENTE usuários autenticados podem atualizar)
CREATE POLICY "authenticated_update_agendamentos"
  ON agendamentos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3.6 Criar política para DELETE (SOMENTE usuários autenticados podem excluir)
CREATE POLICY "authenticated_delete_agendamentos"
  ON agendamentos
  FOR DELETE
  TO authenticated
  USING (true);

-- ================================================================
-- PARTE 4: VERIFICAÇÕES FINAIS
-- ================================================================

-- 4.1 Listar políticas criadas
SELECT
  '=== POLÍTICAS RLS CONFIGURADAS ===' as info,
  policyname,
  cmd as operacao,
  roles as quem_pode
FROM pg_policies
WHERE tablename = 'agendamentos'
ORDER BY policyname;

-- 4.2 Verificar estrutura final
SELECT
  '=== ESTRUTURA FINAL DA TABELA ===' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agendamentos'
ORDER BY ordinal_position;

-- 4.3 Testar UPDATE (simula o que o código faz)
-- ATENÇÃO: Isso só funcionará se você estiver autenticado!
-- Se der erro "policy violation", então o problema é autenticação

-- Verificar agendamentos pendentes
SELECT
  '=== AGENDAMENTOS PENDENTES ===' as info,
  id,
  nome_completo,
  status,
  primeira_opcao,
  segunda_opcao
FROM agendamentos
WHERE status = 'Pendente de confirmação'
LIMIT 3;

-- ================================================================
-- MENSAGEM FINAL
-- ================================================================

SELECT '🎉 SCRIPT EXECUTADO COM SUCESSO!' as mensagem,
       'Agora teste no painel admin: tente confirmar um agendamento' as proximo_passo,
       'Se ainda der erro, verifique se você está autenticado no sistema' as dica;
