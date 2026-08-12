CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE caixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  setor TEXT DEFAULT 'lanche',
  valor_inicial NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_final_esperado NUMERIC(10,2),
  valor_final_real NUMERIC(10,2),
  diferenca NUMERIC(10,2),
  status TEXT DEFAULT 'aberto',
  aberto_por UUID REFERENCES profiles(id),
  fechado_por UUID REFERENCES profiles(id),
  hora_abertura TIMESTAMPTZ DEFAULT NOW(),
  hora_fechamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimentacoes_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  setor TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  descricao TEXT NOT NULL,
  forma_pagamento TEXT,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reproduz o gatilho legado existente em produção. Ele recalcula o valor
-- esperado com todas as movimentações quando o caixa muda para fechado.
CREATE OR REPLACE FUNCTION calcular_diferenca_caixa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
    SELECT NEW.valor_inicial +
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO NEW.valor_final_esperado
    FROM movimentacoes_caixa
    WHERE caixa_id = NEW.id;
    NEW.diferenca := NEW.valor_final_real - NEW.valor_final_esperado;
    NEW.hora_fechamento := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calcular_diferenca_caixa
BEFORE UPDATE ON caixas
FOR EACH ROW EXECUTE FUNCTION calcular_diferenca_caixa();
