-- Adicionar política para permitir inserções públicas na tabela agendamentos
-- Isso é necessário para o quiz-cesca poder salvar agendamentos sem autenticação

-- A política atual "Permitir inserção pública de agendamentos" já existe,
-- mas pode estar com problema. Vamos recriá-la.

DROP POLICY IF EXISTS "Permitir inserção pública de agendamentos" ON agendamentos;

CREATE POLICY "Permitir inserção pública de agendamentos"
  ON agendamentos FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Política de inserção pública criada com sucesso!';
  RAISE NOTICE 'Agora o quiz-cesca pode salvar agendamentos sem autenticação.';
END $$;
