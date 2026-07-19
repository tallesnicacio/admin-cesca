BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
UPDATE profiles SET role = CASE WHEN is_admin THEN 'admin' ELSE COALESCE(NULLIF(role, ''), 'user') END;

ALTER TABLE caixas ADD COLUMN IF NOT EXISTS setor TEXT DEFAULT 'lanche';
UPDATE caixas SET setor = 'lanche' WHERE setor IS NULL OR setor = '';
ALTER TABLE caixas ALTER COLUMN setor SET NOT NULL;

-- A versão antiga permitia apenas um caixa por data. O domínio correto é um
-- caixa por data e setor, pois outros módulos continuam usando a mesma tabela.
DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'caixas'
       AND c.contype = 'u'
       AND array_length(c.conkey, 1) = 1
       AND c.conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'data')
  LOOP
    EXECUTE format('ALTER TABLE caixas DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_caixas_data_setor ON caixas(data, setor);

CREATE TABLE IF NOT EXISTS pdv_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  preco_centavos INTEGER,
  ativo BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES profiles(id),
  atualizado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pdv_produtos_nome_check CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  CONSTRAINT pdv_produtos_preco_check CHECK (preco_centavos IS NULL OR preco_centavos > 0)
);

CREATE TABLE IF NOT EXISTS pdv_caixa_produtos (
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES pdv_produtos(id),
  nome TEXT NOT NULL,
  preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
  ordem INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (caixa_id, produto_id)
);

CREATE TABLE IF NOT EXISTS pdv_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id UUID NOT NULL REFERENCES caixas(id),
  request_id UUID NOT NULL,
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  doacao_centavos INTEGER NOT NULL DEFAULT 0 CHECK (doacao_centavos >= 0),
  total_centavos INTEGER NOT NULL CHECK (total_centavos > 0),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('pix', 'dinheiro')),
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'cancelada')),
  cancelada_por UUID REFERENCES profiles(id),
  cancelada_em TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (caixa_id, request_id),
  CONSTRAINT pdv_vendas_total_check CHECK (total_centavos = subtotal_centavos + doacao_centavos),
  CONSTRAINT pdv_vendas_cancelamento_check CHECK (
    (status = 'concluida' AND cancelada_por IS NULL AND cancelada_em IS NULL AND motivo_cancelamento IS NULL)
    OR
    (status = 'cancelada' AND cancelada_por IS NOT NULL AND cancelada_em IS NOT NULL AND length(btrim(motivo_cancelamento)) >= 3)
  )
);

CREATE TABLE IF NOT EXISTS pdv_venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES pdv_vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES pdv_produtos(id),
  produto_nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 999),
  preco_unitario_centavos INTEGER NOT NULL CHECK (preco_unitario_centavos > 0),
  total_centavos INTEGER NOT NULL CHECK (total_centavos = quantidade * preco_unitario_centavos),
  UNIQUE (venda_id, produto_id)
);

CREATE TABLE IF NOT EXISTS pdv_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id UUID NOT NULL REFERENCES caixas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('fechamento', 'reabertura')),
  valor_esperado_centavos INTEGER,
  valor_contado_centavos INTEGER,
  diferenca_centavos INTEGER,
  motivo TEXT,
  realizado_por UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pdv_fechamentos_valores_check CHECK (
    (tipo = 'fechamento' AND valor_esperado_centavos IS NOT NULL AND valor_contado_centavos IS NOT NULL AND diferenca_centavos IS NOT NULL)
    OR
    (tipo = 'reabertura' AND length(btrim(motivo)) >= 3)
  )
);

ALTER TABLE movimentacoes_caixa ADD COLUMN IF NOT EXISTS pdv_venda_id UUID REFERENCES pdv_vendas(id);
ALTER TABLE movimentacoes_caixa ADD COLUMN IF NOT EXISTS pdv_evento TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_movimentacoes_pdv_venda_evento
  ON movimentacoes_caixa(pdv_venda_id, pdv_evento)
  WHERE pdv_venda_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pdv_produtos_ativos ON pdv_produtos(ativo, ordem, nome);
CREATE INDEX IF NOT EXISTS idx_pdv_vendas_caixa_status ON pdv_vendas(caixa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdv_vendas_vendedor ON pdv_vendas(vendedor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdv_venda_itens_venda ON pdv_venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_pdv_fechamentos_caixa ON pdv_fechamentos(caixa_id, created_at DESC);

INSERT INTO pdv_produtos (nome, ativo, ordem)
SELECT seed.nome, false, seed.ordem
FROM (VALUES ('Salgado', 10), ('Refrigerante', 20)) AS seed(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM pdv_produtos p WHERE lower(p.nome) = lower(seed.nome)
);

COMMIT;
