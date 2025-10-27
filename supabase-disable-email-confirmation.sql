-- ============================================
-- DESABILITAR CONFIRMAÇÃO DE EMAIL OBRIGATÓRIA
-- Para sistemas internos - Admin CESCA
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Data: 2025-10-26
-- ============================================

-- 1. CONFIRMAR TODOS OS USUÁRIOS EXISTENTES
-- Isso permite que usuários já criados façam login imediatamente
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. VERIFICAR RESULTADOS
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- ============================================
-- INSTRUÇÕES PARA O SUPABASE DASHBOARD
-- ============================================
/*

IMPORTANTE: Você também precisa ajustar no Supabase Dashboard:

1. Vá em: Authentication → Providers → Email
2. Desative a opção: "Confirm email"
   OU
   Configure para: "Enable email confirmations: OFF"

Isso garante que novos usuários não precisem confirmar email.

ALTERNATIVA (se não quiser desabilitar completamente):
- Mantenha a confirmação ativada
- O código do frontend agora usa emailConfirm: true ao criar usuário
- Isso confirma o email automaticamente via código

*/

-- ============================================
-- OBSERVAÇÕES
-- ============================================
/*

Com esta configuração:
- Usuários podem fazer login imediatamente após criação
- Não é necessário confirmar email
- Ideal para sistemas internos/administrativos
- A senha é definida pelo admin no momento da criação

Se preferir manter confirmação de email:
- Não execute este script
- Implemente o fluxo completo de confirmação
- Use o arquivo: supabase-config-email-confirmation.sql

*/
