-- Reconstructed from the read-only production schema captured on 2026-08-12.
-- This migration versions the evaluation module already deployed in the CESCA stack.
-- It intentionally does not seed people or evaluations.

CREATE TABLE IF NOT EXISTS funcoes_avaliacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  niveis_permitidos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS criterios_avaliacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mediuns_treinamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  nivel_treinamento TEXT NOT NULL
    CHECK (nivel_treinamento IN ('MT1', 'MT2', 'MT3')),
  modo_avaliacao TEXT NOT NULL DEFAULT 'por_nivel'
    CHECK (modo_avaliacao IN ('por_nivel', 'personalizado', 'dispensado')),
  motivo_regra_avaliacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  atualizado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  inativado_em TIMESTAMPTZ,
  inativado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mediuns_treinamento_nome
  ON mediuns_treinamento (LOWER(BTRIM(nome_completo)));

CREATE INDEX IF NOT EXISTS idx_mediuns_treinamento_nivel
  ON mediuns_treinamento (nivel_treinamento)
  WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS mediuns_treinamento_funcoes (
  medium_id UUID NOT NULL REFERENCES mediuns_treinamento(id) ON DELETE CASCADE,
  funcao_id UUID NOT NULL REFERENCES funcoes_avaliacao(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (medium_id, funcao_id)
);

CREATE TABLE IF NOT EXISTS avaliacoes_mediuns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medium_id UUID NOT NULL REFERENCES mediuns_treinamento(id) ON DELETE RESTRICT,
  medium_nome_snapshot TEXT NOT NULL,
  funcao_id UUID NOT NULL REFERENCES funcoes_avaliacao(id) ON DELETE RESTRICT,
  funcao_nome_snapshot TEXT NOT NULL,
  data_avaliacao DATE NOT NULL,
  nivel_treinamento TEXT NOT NULL
    CHECK (nivel_treinamento IN ('MT1', 'MT2', 'MT3')),
  resultado TEXT NOT NULL
    CHECK (resultado IN ('apto', 'inapto', 'melhorar')),
  observacoes TEXT,
  avaliador_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avaliador_nome_snapshot TEXT NOT NULL,
  atualizado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  excluido_em TIMESTAMPTZ,
  excluido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  motivo_exclusao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_mediuns_medium
  ON avaliacoes_mediuns (medium_id, nivel_treinamento, data_avaliacao DESC, created_at DESC)
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_mediuns_funcao
  ON avaliacoes_mediuns (funcao_id, data_avaliacao DESC)
  WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_mediuns_avaliador
  ON avaliacoes_mediuns (avaliador_id, created_at DESC)
  WHERE excluido_em IS NULL;

CREATE TABLE IF NOT EXISTS avaliacoes_mediuns_criterios (
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes_mediuns(id) ON DELETE CASCADE,
  criterio_id UUID NOT NULL REFERENCES criterios_avaliacao(id) ON DELETE RESTRICT,
  criterio_nome_snapshot TEXT NOT NULL,
  PRIMARY KEY (avaliacao_id, criterio_id)
);

INSERT INTO funcoes_avaliacao (nome, niveis_permitidos, ordem)
VALUES
  ('Venda de lanche', ARRAY['MT1', 'MT2', 'MT3'], 10),
  ('Venda de artigos', ARRAY['MT1', 'MT2', 'MT3'], 20),
  ('Venda de sebo', ARRAY['MT1', 'MT2', 'MT3'], 30),
  ('Cambonagem', ARRAY['MT1', 'MT2', 'MT3'], 40),
  ('Atendimento fraterno', ARRAY['MT2', 'MT3'], 50),
  ('Fiscalização de trânsito', ARRAY['MT2', 'MT3'], 60),
  ('Ensino infantil', ARRAY['MT2', 'MT3'], 70)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO criterios_avaliacao (nome, ordem)
VALUES
  ('Postura', 10),
  ('Comunicação', 20),
  ('Fechamento de caixa', 30),
  ('Proatividade/iniciativa/agilidade', 40)
ON CONFLICT (nome) DO NOTHING;
