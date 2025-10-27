-- Script para configurar Storage Bucket para comprovantes de despesas
-- Execute este script no SQL Editor do Supabase

-- ======================================
-- STORAGE BUCKET
-- ======================================

-- Criar bucket para comprovantes de despesas
INSERT INTO storage.buckets (id, name, public)
VALUES ('despesas', 'despesas', false)
ON CONFLICT (id) DO NOTHING;

-- ======================================
-- STORAGE POLICIES (RLS)
-- ======================================

-- Policy: Admins podem fazer upload de comprovantes
CREATE POLICY "Admins podem fazer upload de comprovantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'despesas' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Policy: Admins podem visualizar comprovantes
CREATE POLICY "Admins podem visualizar comprovantes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'despesas' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Policy: Admins podem atualizar comprovantes
CREATE POLICY "Admins podem atualizar comprovantes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'despesas' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Policy: Admins podem deletar comprovantes
CREATE POLICY "Admins podem deletar comprovantes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'despesas' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- ======================================
-- CONFIGURAÇÕES DO BUCKET
-- ======================================

-- Configurar tamanho máximo de arquivo: 5MB
-- Formatos permitidos: PDF, JPG, JPEG, PNG
-- (Isso é configurado via painel do Supabase Storage ou via API)

-- ======================================
-- VERIFICAÇÃO
-- ======================================

-- Verificar se o bucket foi criado
SELECT * FROM storage.buckets WHERE id = 'despesas';

-- Verificar policies criadas
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%comprovantes%';
