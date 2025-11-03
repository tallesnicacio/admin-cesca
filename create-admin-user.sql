-- =====================================================
-- Admin CESCA - Criar Usuário Administrador
-- =====================================================
-- Script para criar o primeiro usuário administrador
-- após a limpeza da base de dados.
--
-- ATENÇÃO: Este script deve ser executado APÓS criar
-- o usuário via Supabase Auth Dashboard ou via signup.
-- =====================================================

-- =====================================================
-- INSTRUÇÕES
-- =====================================================
-- 1. Primeiro, crie o usuário via Supabase Dashboard:
--    Authentication > Users > Add User
--    OU faça signup na aplicação
--
-- 2. Depois, execute este script substituindo:
--    - 'EMAIL_DO_USUARIO' pelo email real
--    - Opcionalmente, preencha outros campos
-- =====================================================

-- =====================================================
-- ATUALIZAR USUÁRIO EXISTENTE PARA ADMIN
-- =====================================================

-- Opção 1: Usando o email do usuário
UPDATE profiles
SET
  is_admin = true,
  is_active = true,
  name = 'Administrador',  -- Substitua pelo nome real
  phone = NULL,             -- Opcional: adicione telefone
  cpf = NULL                -- Opcional: adicione CPF
WHERE email = 'EMAIL_DO_USUARIO';  -- ⚠️ SUBSTITUIR AQUI

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- Listar todos os usuários admin
SELECT
  id,
  name,
  email,
  cpf,
  phone,
  is_admin,
  is_active,
  created_at
FROM profiles
WHERE is_admin = true;

-- =====================================================
-- CRIAR PERFIL MANUALMENTE (se não existir)
-- =====================================================

-- ⚠️ DESCOMENTE E AJUSTE SE NECESSÁRIO
-- Use isso apenas se o perfil não foi criado automaticamente

/*
INSERT INTO profiles (id, name, email, cpf, phone, is_admin, is_active)
VALUES (
  'UUID_DO_AUTH_USERS',  -- ⚠️ Obtenha do auth.users
  'Nome do Admin',
  'admin@cesca.digital',
  NULL,
  NULL,
  true,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  is_admin = true,
  is_active = true;
*/

-- =====================================================
-- CONSULTAR UUID DO AUTH.USERS
-- =====================================================

-- Use esta query para encontrar o UUID do usuário
SELECT
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Verifique se o usuário admin foi criado corretamente.';
  RAISE NOTICE '🔐 Use as credenciais para fazer login em: https://admin.cesca.digital';
END $$;
