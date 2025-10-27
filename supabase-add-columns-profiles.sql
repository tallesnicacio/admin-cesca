-- ============================================
-- ADICIONAR COLUNAS NECESSÁRIAS NA TABELA PROFILES
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Adicionar coluna 'role' se não existir
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- 2. Adicionar coluna 'name' se não existir
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS name TEXT;

-- 3. Adicionar coluna 'active' se não existir
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 4. Adicionar coluna 'created_at' se não existir
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 5. Adicionar comentários nas colunas
COMMENT ON COLUMN profiles.role IS 'Perfil do usuário: admin ou user';
COMMENT ON COLUMN profiles.name IS 'Nome completo do usuário';
COMMENT ON COLUMN profiles.active IS 'Indica se o usuário está ativo no sistema';
COMMENT ON COLUMN profiles.created_at IS 'Data de criação do perfil';

-- 6. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 7. Atualizar usuários existentes sem role para 'user'
UPDATE profiles
SET role = 'user'
WHERE role IS NULL;

-- 8. Atualizar usuários existentes sem name (usar parte do email)
UPDATE profiles
SET name = split_part(email, '@', 1)
WHERE name IS NULL AND email IS NOT NULL;

-- 9. Atualizar usuários existentes sem active para true
UPDATE profiles
SET active = true
WHERE active IS NULL;

-- 10. Verificar estrutura da tabela
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- Agora execute o arquivo supabase-rls-policies.sql
-- para configurar as políticas RLS
-- ============================================
