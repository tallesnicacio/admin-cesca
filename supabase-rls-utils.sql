-- ============================================
-- SCRIPTS ÚTEIS PARA GERENCIAR RLS - CESCA
-- ============================================

-- 1. VERIFICAR QUAIS TABELAS TÊM RLS HABILITADO
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- 2. LISTAR TODAS AS POLÍTICAS RLS EXISTENTES
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- 3. REMOVER TODAS AS POLÍTICAS DE UMA TABELA
-- ============================================
-- Para profiles:
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Administradores podem ver todos os perfis" ON profiles;
DROP POLICY IF EXISTS "Administradores podem criar perfis" ON profiles;
DROP POLICY IF EXISTS "Administradores podem atualizar perfis" ON profiles;
DROP POLICY IF EXISTS "Administradores podem deletar perfis" ON profiles;

-- Para agendamentos:
DROP POLICY IF EXISTS "Usuários autenticados podem ver agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Usuários autenticados podem criar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Administradores podem atualizar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Administradores podem deletar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Qualquer pessoa pode criar agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Acesso público para leitura de agendamentos" ON agendamentos;


-- 4. DESABILITAR RLS (EMERGÊNCIA - USE COM CUIDADO!)
-- ============================================
-- ATENÇÃO: Isso remove toda a segurança de nível de linha
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos DISABLE ROW LEVEL SECURITY;


-- 5. TESTAR SE UM USUÁRIO É ADMIN
-- ============================================
-- Substitua 'user-uuid-aqui' pelo UUID do usuário
SELECT public.is_admin('user-uuid-aqui'::uuid);


-- 6. PROMOVER UM USUÁRIO A ADMIN
-- ============================================
-- Substitua 'email@exemplo.com' pelo email do usuário
UPDATE profiles
SET role = 'admin'
WHERE email = 'email@exemplo.com';


-- 7. REBAIXAR UM ADMIN A USUÁRIO COMUM
-- ============================================
UPDATE profiles
SET role = 'user'
WHERE email = 'email@exemplo.com';


-- 8. DESATIVAR UM USUÁRIO (SOFT DELETE)
-- ============================================
UPDATE profiles
SET active = false
WHERE email = 'email@exemplo.com';


-- 9. REATIVAR UM USUÁRIO
-- ============================================
UPDATE profiles
SET active = true
WHERE email = 'email@exemplo.com';


-- 10. LISTAR TODOS OS ADMINISTRADORES
-- ============================================
SELECT id, email, name, role, created_at, active
FROM profiles
WHERE role = 'admin'
ORDER BY created_at DESC;


-- 11. LISTAR USUÁRIOS INATIVOS
-- ============================================
SELECT id, email, name, role, created_at, active
FROM profiles
WHERE active = false
ORDER BY created_at DESC;


-- 12. VERIFICAR PERMISSÕES DE UM USUÁRIO
-- ============================================
-- Substitua 'user-uuid-aqui' pelo UUID do usuário
SELECT
  p.email,
  p.name,
  p.role,
  p.active,
  CASE
    WHEN p.role = 'admin' THEN 'Acesso total ao sistema'
    WHEN p.role = 'user' THEN 'Acesso básico'
    ELSE 'Sem permissões definidas'
  END as permissions
FROM profiles p
WHERE p.id = 'user-uuid-aqui'::uuid;


-- 13. CONTAR USUÁRIOS POR ROLE
-- ============================================
SELECT
  role,
  COUNT(*) as total,
  COUNT(CASE WHEN active = true THEN 1 END) as ativos,
  COUNT(CASE WHEN active = false THEN 1 END) as inativos
FROM profiles
GROUP BY role
ORDER BY role;


-- 14. CRIAR PRIMEIRO ADMIN (BOOTSTRAP)
-- ============================================
-- Use este script apenas uma vez para criar o primeiro administrador
-- Substitua os valores conforme necessário

-- Primeiro, crie o usuário no Supabase Dashboard em Authentication > Users
-- Depois execute este comando com o email do usuário criado:

UPDATE profiles
SET
  role = 'admin',
  name = 'Administrador Principal',
  active = true
WHERE email = 'seu-email@exemplo.com';


-- 15. VERIFICAR USUÁRIOS SEM PERFIL
-- ============================================
-- Lista usuários que existem no auth.users mas não têm perfil
SELECT
  u.id,
  u.email,
  u.created_at,
  'Sem perfil criado' as status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;


-- 16. CRIAR PERFIL PARA USUÁRIO EXISTENTE
-- ============================================
-- Se algum usuário não tiver perfil, use este script
INSERT INTO profiles (id, email, name, role, created_at)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  'user',
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;


-- 17. AUDITORIA - ÚLTIMAS ALTERAÇÕES EM AGENDAMENTOS
-- ============================================
SELECT
  id,
  nome_completo,
  email,
  status,
  atendente,
  data_solicitacao,
  data_confirmacao,
  opcao_escolhida
FROM agendamentos
ORDER BY data_solicitacao DESC
LIMIT 50;


-- 18. LIMPAR CACHE DE POLÍTICAS (SE HOUVER PROBLEMAS)
-- ============================================
-- Execute isso se as políticas não estiverem sendo aplicadas corretamente
NOTIFY pgrst, 'reload schema';


-- 19. VERIFICAR SE AS FUNÇÕES FORAM CRIADAS
-- ============================================
SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('handle_new_user', 'is_admin')
ORDER BY routine_name;


-- 20. VERIFICAR SE OS TRIGGERS ESTÃO ATIVOS
-- ============================================
SELECT
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name = 'on_auth_user_created';


-- ============================================
-- DICAS DE TROUBLESHOOTING:
-- ============================================
--
-- 1. Se você não consegue acessar nenhum dado:
--    - Verifique se RLS está habilitado (script 1)
--    - Verifique se as políticas existem (script 2)
--    - Verifique se seu usuário é admin (script 5)
--
-- 2. Se um usuário não aparece após criar:
--    - Verifique se o trigger está ativo (script 20)
--    - Verifique se há usuários sem perfil (script 15)
--    - Crie o perfil manualmente se necessário (script 16)
--
-- 3. Se as políticas não estão funcionando:
--    - Limpe o cache (script 18)
--    - Verifique as permissões GRANT
--    - Teste com service_role key temporariamente
--
-- 4. Primeiro acesso ao sistema:
--    - Crie um usuário pelo Supabase Dashboard
--    - Promova-o a admin usando script 14
--    - Faça login com esse usuário
--
-- ============================================
