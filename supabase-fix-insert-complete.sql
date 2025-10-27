-- Fix completo para permitir inserções públicas em agendamentos

-- 1. Remover todas as políticas de INSERT existentes
DROP POLICY IF EXISTS "Permitir inserção pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Public users can insert agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Enable insert for anon users" ON agendamentos;

-- 2. Criar nova política para INSERT público
CREATE POLICY "public_insert_agendamentos"
  ON agendamentos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 3. Verificar se RLS está habilitado (deve estar)
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- 4. Garantir que a política de leitura também existe para authenticated users
DROP POLICY IF EXISTS "Permitir leitura autenticada de agendamentos" ON agendamentos;

CREATE POLICY "authenticated_select_agendamentos"
  ON agendamentos
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Garantir que a política de UPDATE existe para authenticated users
DROP POLICY IF EXISTS "Permitir atualização autenticada de agendamentos" ON agendamentos;

CREATE POLICY "authenticated_update_agendamentos"
  ON agendamentos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Garantir que a política de DELETE existe para authenticated users
DROP POLICY IF EXISTS "Authenticated users can delete agendamentos" ON agendamentos;

CREATE POLICY "authenticated_delete_agendamentos"
  ON agendamentos
  FOR DELETE
  TO authenticated
  USING (true);

-- Verificação
DO $$
BEGIN
  RAISE NOTICE 'Políticas de RLS atualizadas com sucesso!';
  RAISE NOTICE 'INSERT: Liberado para todos (public)';
  RAISE NOTICE 'SELECT, UPDATE, DELETE: Apenas authenticated users';
END $$;
