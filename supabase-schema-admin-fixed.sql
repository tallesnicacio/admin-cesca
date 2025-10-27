-- Schema complementar para Admin CESCA (CORRIGIDO)
-- Execute este SQL DEPOIS do schema de agendamentos
-- Este script adiciona a tabela de profiles para autenticação de admins

-- 1. Remover políticas antigas que causam recursão
DROP POLICY IF EXISTS "Usuários podem ver seus próprios perfis" ON profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Admins podem atualizar perfis" ON profiles;
DROP POLICY IF EXISTS "Admins podem deletar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Admins podem atualizar configurações" ON configuracoes;

-- 2. Tabela de perfis de usuários (admins)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- Trigger para atualizar updated_at em profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas CORRIGIDAS para profiles (sem recursão)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin = true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Políticas para agendamentos (admins)
CREATE POLICY "Authenticated users can delete agendamentos"
  ON agendamentos FOR DELETE
  USING (auth.role() = 'authenticated');

-- Políticas para configurações (admins)
CREATE POLICY "Authenticated users can update configuracoes"
  ON configuracoes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', new.email));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Schema de perfis criado com sucesso!';
  RAISE NOTICE 'Para criar um admin, execute:';
  RAISE NOTICE 'UPDATE profiles SET is_admin = true WHERE email = ''seu-email@exemplo.com'';';
END $$;
