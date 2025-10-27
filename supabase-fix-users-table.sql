-- ================================================
-- FIX: Criar tabela users e configurar confirmação de email
-- ================================================

-- ============================================
-- 1. CRIAR TABELA USERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. MIGRAR DADOS DE auth.users PARA public.users
-- ============================================
-- Inserir usuários existentes na tabela users
INSERT INTO public.users (id, email, name, role, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', email) as name,
  COALESCE(raw_user_meta_data->>'role', 'user') as role,
  created_at,
  NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. CRIAR TRIGGER PARA SINCRONIZAR
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar novo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- ============================================
-- 4. POLÍTICAS RLS
-- ============================================
-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users via trigger" ON public.users;

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

-- Policy para INSERT (via trigger)
CREATE POLICY "Enable insert for authenticated users via trigger"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 5. TABELA DE LOGS (OPCIONAL)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_logs_user_id ON public.user_auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_logs_event_type ON public.user_auth_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_user_auth_logs_created_at ON public.user_auth_logs(created_at DESC);

-- ============================================
-- 6. FUNÇÃO PARA REGISTRAR LOG
-- ============================================
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
-- VERIFICAÇÃO FINAL
-- ============================================
SELECT
  'Configuração concluída!' as status,
  (SELECT COUNT(*) FROM public.users) as total_users,
  (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL) as pending_confirmation;
