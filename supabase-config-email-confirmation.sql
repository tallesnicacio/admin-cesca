-- ================================================
-- SUPABASE - CONFIGURAÇÃO DE EMAIL CONFIRMATION
-- Sistema de criação de usuários com confirmação de email
-- ================================================

-- ============================================
-- 1. CONFIGURAR REDIRECT URL (Via Dashboard)
-- ============================================
-- Você precisa configurar no Supabase Dashboard:
-- Authentication → URL Configuration → Redirect URLs
-- Adicionar: https://admin.cesca.digital/auth/callback
-- Adicionar: https://admin.cesca.digital/set-password


-- ============================================
-- 2. CONFIGURAR EMAIL TEMPLATES (Via Dashboard)
-- ============================================
-- Authentication → Email Templates → Confirm Signup
--
-- Substitua o template padrão por:
/*
<h2>Bem-vindo ao Admin CESCA</h2>
<p>Olá {{ .Name }},</p>
<p>Uma conta foi criada para você no sistema Admin CESCA.</p>
<p>Clique no link abaixo para confirmar seu email e criar sua senha:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/set-password">Confirmar Email e Criar Senha</a></p>
<p>Este link expira em 24 horas.</p>
<p>Se você não solicitou esta conta, ignore este email.</p>
*/


-- ============================================
-- 3. FUNÇÃO PARA CRIAR USUÁRIO (Backend/Edge Function)
-- ============================================
-- Esta função será chamada pelo Edge Function ou backend
CREATE OR REPLACE FUNCTION create_user_with_email_confirmation(
  p_email TEXT,
  p_name TEXT,
  p_role TEXT DEFAULT 'user'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Validar email
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;

  -- Validar role
  IF p_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Role inválido. Use: admin ou user';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email já cadastrado';
  END IF;

  -- NOTA: A criação do usuário deve ser feita via Edge Function
  -- usando supabase.auth.admin.createUser() com Service Role Key
  -- Esta função apenas valida e registra metadados adicionais

  SELECT json_build_object(
    'success', true,
    'message', 'Validação bem-sucedida. Prossiga com criação via Edge Function.',
    'email', p_email,
    'name', p_name,
    'role', p_role
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================
-- 4. TRIGGER PARA CRIAR PERFIL APÓS CONFIRMAÇÃO
-- ============================================
-- Criar perfil de usuário automaticamente após confirmação de email
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Inserir perfil de usuário (se você tiver tabela de perfis)
  -- Ajuste conforme sua estrutura
  INSERT INTO public.users (
    id,
    email,
    name,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    role = COALESCE(EXCLUDED.role, users.role),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Criar trigger (se não existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();


-- ============================================
-- 5. POLICY PARA USUÁRIOS VISUALIZAREM PRÓPRIO PERFIL
-- ============================================
-- Permitir que usuários vejam e atualizem seu próprio perfil
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy para UPDATE próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy para INSERT (via trigger apenas)
CREATE POLICY "Enable insert for authenticated users via trigger"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);


-- ============================================
-- 6. VERIFICAR CONFIGURAÇÕES
-- ============================================
-- Verificar se tabela users existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'users'
  ) THEN
    -- Criar tabela users se não existir
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Adicionar índices
    CREATE INDEX idx_users_email ON public.users(email);
    CREATE INDEX idx_users_role ON public.users(role);

    RAISE NOTICE 'Tabela users criada com sucesso';
  ELSE
    RAISE NOTICE 'Tabela users já existe';
  END IF;
END $$;


-- ============================================
-- 7. FUNÇÃO AUXILIAR - REENVIAR EMAIL DE CONFIRMAÇÃO
-- ============================================
-- Para reenviar email de confirmação (se necessário)
CREATE OR REPLACE FUNCTION resend_confirmation_email(
  p_user_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_confirmed BOOLEAN;
  v_result JSON;
BEGIN
  -- Buscar usuário
  SELECT id, email_confirmed_at IS NOT NULL
  INTO v_user_id, v_confirmed
  FROM auth.users
  WHERE email = p_user_email;

  -- Verificar se usuário existe
  IF v_user_id IS NULL THEN
    SELECT json_build_object(
      'success', false,
      'message', 'Usuário não encontrado'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- Verificar se já foi confirmado
  IF v_confirmed THEN
    SELECT json_build_object(
      'success', false,
      'message', 'Email já confirmado'
    ) INTO v_result;
    RETURN v_result;
  END IF;

  -- NOTA: O reenvio real deve ser feito via Edge Function
  -- usando supabase.auth.admin.generateLink()

  SELECT json_build_object(
    'success', true,
    'message', 'Utilize Edge Function para reenviar email',
    'user_id', v_user_id
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================
-- 8. LOGS DE AUDITORIA (OPCIONAL)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'signup', 'email_confirmed', 'password_set', 'login'
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_auth_logs_user_id ON public.user_auth_logs(user_id);
CREATE INDEX idx_user_auth_logs_event_type ON public.user_auth_logs(event_type);
CREATE INDEX idx_user_auth_logs_created_at ON public.user_auth_logs(created_at DESC);

-- Função para registrar log
CREATE OR REPLACE FUNCTION log_user_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_auth_logs (
    user_id,
    event_type,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_ip_address,
    p_user_agent,
    p_metadata
  );
END;
$$;


-- ============================================
-- INSTRUÇÕES DE USO
-- ============================================
/*

PASSO A PASSO PARA IMPLEMENTAR:

1. CONFIGURAR NO SUPABASE DASHBOARD:
   a) Vá em: Authentication → URL Configuration
   b) Adicione em "Redirect URLs":
      - https://admin.cesca.digital/auth/callback
      - https://admin.cesca.digital/set-password

   c) Em "Site URL", configure:
      - https://admin.cesca.digital

2. CONFIGURAR EMAIL TEMPLATE:
   a) Vá em: Authentication → Email Templates
   b) Selecione: "Confirm signup"
   c) Altere "Confirm your signup" subject para: "Confirme seu email - Admin CESCA"
   d) Cole o template HTML fornecido acima no corpo do email

3. EXECUTAR ESTE SCRIPT SQL:
   a) Vá em: SQL Editor no Supabase Dashboard
   b) Cole e execute este script completo

4. ATUALIZAR EDGE FUNCTION (create-user):
   - Use o arquivo supabase/functions/create-user/index.ts atualizado
   - O usuário será criado com email_confirm: false
   - Email de confirmação será enviado automaticamente

5. CRIAR PÁGINAS NO FRONTEND:
   a) /auth/callback - Para processar o token de confirmação
   b) /set-password - Para o usuário definir a senha

6. FLUXO COMPLETO:
   Admin cria usuário → Email enviado → Usuário clica no link →
   Email confirmado → Redireciona para /set-password →
   Usuário define senha → Login habilitado

*/

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT 'Configuração concluída! Verifique as instruções acima.' AS status;
