-- Reconstructed from the read-only production schema captured on 2026-08-12.
-- Versions the offline-sync, promotion, and split-donation schema already used
-- by the deployed PDV. No production data is copied by this migration.

BEGIN;

ALTER TABLE pdv_produtos
  ADD COLUMN IF NOT EXISTS preco_promocional_centavos INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_produtos_preco_promocional_check'
      AND conrelid = 'pdv_produtos'::regclass
  ) THEN
    ALTER TABLE pdv_produtos
      ADD CONSTRAINT pdv_produtos_preco_promocional_check
      CHECK (preco_promocional_centavos IS NULL OR preco_promocional_centavos > 0);
  END IF;
END $$;

ALTER TABLE pdv_caixa_produtos
  ADD COLUMN IF NOT EXISTS preco_promocional_centavos INTEGER,
  ADD COLUMN IF NOT EXISTS promocao_ativa BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS promocao_atualizada_por UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS promocao_atualizada_em TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_caixa_produtos_preco_promocional_check'
      AND conrelid = 'pdv_caixa_produtos'::regclass
  ) THEN
    ALTER TABLE pdv_caixa_produtos
      ADD CONSTRAINT pdv_caixa_produtos_preco_promocional_check
      CHECK (preco_promocional_centavos IS NULL OR preco_promocional_centavos > 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pdv_dispositivos (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  primeiro_usuario_id UUID NOT NULL REFERENCES profiles(id),
  ultimo_usuario_id UUID NOT NULL REFERENCES profiles(id),
  primeiro_acesso_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acesso_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pdv_vendas
  ADD COLUMN IF NOT EXISTS forma_pagamento_doacao TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS dispositivo_id UUID,
  ADD COLUMN IF NOT EXISTS registrada_em_dispositivo TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sincronizada_em TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_vendas_pagamento_doacao_check'
      AND conrelid = 'pdv_vendas'::regclass
  ) THEN
    ALTER TABLE pdv_vendas
      ADD CONSTRAINT pdv_vendas_pagamento_doacao_check
      CHECK (forma_pagamento_doacao IS NULL OR forma_pagamento_doacao IN ('pix', 'dinheiro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_vendas_origem_check'
      AND conrelid = 'pdv_vendas'::regclass
  ) THEN
    ALTER TABLE pdv_vendas
      ADD CONSTRAINT pdv_vendas_origem_check
      CHECK (origem IN ('online', 'offline'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_vendas_dispositivo_fk'
      AND conrelid = 'pdv_vendas'::regclass
  ) THEN
    ALTER TABLE pdv_vendas
      ADD CONSTRAINT pdv_vendas_dispositivo_fk
      FOREIGN KEY (dispositivo_id) REFERENCES pdv_dispositivos(id);
  END IF;
END $$;

ALTER TABLE pdv_venda_itens
  ADD COLUMN IF NOT EXISTS promocional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS pdv_promocao_eventos (
  id UUID PRIMARY KEY,
  caixa_id UUID NOT NULL REFERENCES caixas(id),
  produto_id UUID NOT NULL REFERENCES pdv_produtos(id),
  dispositivo_id UUID NOT NULL REFERENCES pdv_dispositivos(id),
  usuario_id UUID NOT NULL REFERENCES profiles(id),
  ativa BOOLEAN NOT NULL,
  origem TEXT NOT NULL DEFAULT 'offline' CHECK (origem IN ('online', 'offline')),
  registrada_em_dispositivo TIMESTAMPTZ NOT NULL,
  sincronizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_sincronizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispositivo_id UUID NOT NULL REFERENCES pdv_dispositivos(id),
  caixa_id UUID NOT NULL REFERENCES caixas(id),
  usuario_id UUID NOT NULL REFERENCES profiles(id),
  quantidade_recebida INTEGER NOT NULL DEFAULT 0,
  quantidade_sincronizada INTEGER NOT NULL DEFAULT 0,
  quantidade_duplicada INTEGER NOT NULL DEFAULT 0,
  quantidade_com_erro INTEGER NOT NULL DEFAULT 0,
  conflito_estoque BOOLEAN NOT NULL DEFAULT FALSE,
  recalculou_fechamento BOOLEAN NOT NULL DEFAULT FALSE,
  detalhes JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_sincronizacao_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sincronizacao_id UUID NOT NULL REFERENCES pdv_sincronizacoes(id) ON DELETE CASCADE,
  caixa_id UUID NOT NULL REFERENCES caixas(id),
  venda_id UUID REFERENCES pdv_vendas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('estoque_negativo', 'venda_pos_fechamento', 'relogio_dispositivo')),
  mensagem TEXT NOT NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdv_vendas_dispositivo
  ON pdv_vendas(dispositivo_id, sincronizada_em DESC);
CREATE INDEX IF NOT EXISTS idx_pdv_sincronizacoes_caixa
  ON pdv_sincronizacoes(caixa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdv_alertas_caixa
  ON pdv_sincronizacao_alertas(caixa_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_cesca_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      pdv_dispositivos,
      pdv_promocao_eventos,
      pdv_sincronizacoes,
      pdv_sincronizacao_alertas
    TO admin_cesca_user;
  END IF;
END $$;

COMMIT;
