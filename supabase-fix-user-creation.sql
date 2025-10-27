-- ============================================
-- CORREÇÃO COMPLETA - CRIAÇÃO DE USUÁRIOS
-- Resolver erros 400, 403, 406
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Data: 2025-10-26
-- ============================================

-- ============================================
-- PASSO 1: CONFIRMAR TODOS OS USUÁRIOS
-- ============================================
-- Isso resolve o erro 400 (Bad Request) no login
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

SELECT 'PASSO 1 CONCLUÍDO: Usuários confirmados' as status;

-- ============================================
-- PASSO 2: CRIAR PERFIS PARA USUÁRIOS SEM PERFIL
-- ============================================
-- Isso resolve o erro 406 (perfil não encontrado)
INSERT INTO public.profiles (id, email, name, role, is_admin, created_at, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.email) as name,
  COALESCE(u.raw_user_meta_data->>'role', 'user') as role,
  COALESCE((u.raw_user_meta_data->>'role')::text = 'admin', false) as is_admin,
  u.created_at,
  NOW() as updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

SELECT 'PASSO 2 CONCLUÍDO: Perfis criados' as status;

-- ============================================
-- PASSO 3: AJUSTAR POLÍTICAS RLS (Row Level Security)
-- ============================================
-- Isso resolve o erro 403 (Forbidden) ao criar perfil

-- Remover políticas antigas
DROP POLICY IF EXISTS "Enable insert for authenticated users via trigger" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Permitir INSERT de perfil (necessário para signup)
-- Esta política permite que um usuário autenticado crie seu próprio perfil
CREATE POLICY "Enable insert for authenticated users during signup"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Permitir que usuários vejam seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Permitir que usuários atualizem seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

SELECT 'PASSO 3 CONCLUÍDO: Políticas RLS ajustadas' as status;

-- ============================================
-- PASSO 4: CRIAR/ATUALIZAR TRIGGER
-- ============================================
-- Criar perfil automaticamente quando novo usuário é criado

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, is_admin, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, profiles.name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    is_admin = COALESCE(EXCLUDED.is_admin, profiles.is_admin),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger (se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

SELECT 'PASSO 4 CONCLUÍDO: Trigger criado' as status;

-- ============================================
-- PASSO 5: VERIFICAÇÃO FINAL
-- ============================================
-- Listar todos os usuários com seus perfis
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  u.created_at as user_created,
  p.name,
  p.role,
  p.is_admin,
  CASE
    WHEN p.id IS NULL THEN '❌ SEM PERFIL'
    WHEN u.email_confirmed_at IS NULL THEN '⚠️ EMAIL NÃO CONFIRMADO'
    ELSE '✅ OK'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- ============================================
-- RESUMO DO QUE FOI FEITO
-- ============================================
/*

✅ PASSO 1: Todos os usuários foram confirmados (email_confirmed_at)
   - Agora podem fazer login sem erro 400

✅ PASSO 2: Perfis criados para usuários sem perfil
   - Resolve erro 406 "perfil não encontrado"

✅ PASSO 3: Políticas RLS ajustadas
   - Resolve erro 403 ao criar perfil
   - Permite INSERT durante signup

✅ PASSO 4: Trigger automático criado
   - Novos usuários terão perfil criado automaticamente
   - Não precisará criar manualmente

PRÓXIMO PASSO NO DASHBOARD:
- Vá em: Authentication → Providers → Email
- Desative: "Confirm email" (se quiser que login seja imediato)

*/

SELECT '🎉 CONFIGURAÇÃO COMPLETA! Verifique a tabela acima.' as resultado;
