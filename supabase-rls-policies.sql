-- ============================================
-- POLÍTICAS RLS (Row Level Security) - CESCA
-- Execute no Supabase SQL Editor
-- ============================================

-- 1. HABILITAR RLS nas tabelas
-- ============================================

-- Habilitar RLS na tabela profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS na tabela agendamentos
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;


-- 2. POLÍTICAS PARA TABELA PROFILES
-- ============================================

-- Permitir que usuários visualizem seu próprio perfil
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Permitir que usuários atualizem seu próprio perfil
CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Permitir que administradores vejam todos os perfis
CREATE POLICY "Administradores podem ver todos os perfis"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Permitir que administradores criem novos perfis
CREATE POLICY "Administradores podem criar perfis"
ON profiles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Permitir que administradores atualizem qualquer perfil
CREATE POLICY "Administradores podem atualizar perfis"
ON profiles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Permitir que administradores deletem perfis
CREATE POLICY "Administradores podem deletar perfis"
ON profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);


-- 3. POLÍTICAS PARA TABELA AGENDAMENTOS
-- ============================================

-- Permitir que todos os usuários autenticados vejam agendamentos
CREATE POLICY "Usuários autenticados podem ver agendamentos"
ON agendamentos FOR SELECT
USING (auth.role() = 'authenticated');

-- Permitir que usuários autenticados criem agendamentos
CREATE POLICY "Usuários autenticados podem criar agendamentos"
ON agendamentos FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Permitir que administradores atualizem agendamentos
CREATE POLICY "Administradores podem atualizar agendamentos"
ON agendamentos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Permitir que administradores deletem agendamentos
CREATE POLICY "Administradores podem deletar agendamentos"
ON agendamentos FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);


-- 4. TRIGGER PARA CRIAR PERFIL AUTOMATICAMENTE
-- ============================================
-- Este trigger cria automaticamente um perfil quando um novo usuário é criado

-- Primeiro, criar a função que será executada pelo trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    now()
  );
  RETURN new;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. FUNÇÃO AUXILIAR PARA VERIFICAR SE É ADMIN
-- ============================================
-- Esta função pode ser usada em outras partes do código

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'admin'
  );
END;
$$;


-- 6. ADICIONAR COLUNA 'active' SE NÃO EXISTIR
-- ============================================
-- Para soft delete de usuários

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN active BOOLEAN DEFAULT true;
    COMMENT ON COLUMN profiles.active IS 'Indica se o usuário está ativo no sistema';
  END IF;
END $$;


-- 7. POLÍTICA ADICIONAL PARA FILTRAR USUÁRIOS INATIVOS
-- ============================================

-- Atualizar a política de SELECT para não mostrar usuários inativos
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id AND (active = true OR active IS NULL));

DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON profiles;
CREATE POLICY "Administradores podem ver todos os perfis"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND (active = true OR active IS NULL)
  )
);


-- 8. VERIFICAR ESTRUTURA DA TABELA PROFILES
-- ============================================
-- Certifique-se de que sua tabela profiles tenha pelo menos estas colunas:

-- id (uuid, primary key, references auth.users)
-- email (text)
-- name (text)
-- role (text) - valores: 'admin' ou 'user'
-- created_at (timestamp)
-- active (boolean, default true)

-- Caso a tabela não exista, você pode criá-la com:
/*
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  name text,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
*/


-- 9. POLÍTICA PARA ACESSO PÚBLICO AOS AGENDAMENTOS (OPCIONAL)
-- ============================================
-- Se você quiser permitir que o formulário público crie agendamentos sem autenticação
-- CUIDADO: Isso permite que qualquer pessoa crie agendamentos

-- Remover a política existente de INSERT
DROP POLICY IF EXISTS "Usuários autenticados podem criar agendamentos" ON agendamentos;

-- Criar política que permite INSERT público
CREATE POLICY "Qualquer pessoa pode criar agendamentos"
ON agendamentos FOR INSERT
WITH CHECK (true);

-- E para SELECT público (se necessário)
DROP POLICY IF EXISTS "Usuários autenticados podem ver agendamentos" ON agendamentos;

CREATE POLICY "Acesso público para leitura de agendamentos"
ON agendamentos FOR SELECT
USING (true);

-- OU, se quiser manter restrito apenas para autenticados, mantenha as políticas anteriores


-- 10. GRANT PERMISSIONS
-- ============================================
-- Garantir que o service_role tenha acesso total

GRANT ALL ON profiles TO service_role;
GRANT ALL ON agendamentos TO service_role;

-- Garantir que usuários autenticados possam acessar as tabelas
GRANT SELECT, INSERT ON agendamentos TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;


-- ============================================
-- INSTRUÇÕES DE USO:
-- ============================================
--
-- 1. Acesse o Supabase Dashboard
-- 2. Vá em "SQL Editor"
-- 3. Crie uma nova query
-- 4. Cole este SQL completo
-- 5. Execute (Run)
--
-- IMPORTANTE:
-- - Revise as políticas de acordo com suas necessidades
-- - As políticas de acesso público aos agendamentos (seção 9) devem ser
--   usadas com cuidado. Descomente apenas se necessário.
-- - Teste sempre em um ambiente de desenvolvimento primeiro
--
-- ============================================
