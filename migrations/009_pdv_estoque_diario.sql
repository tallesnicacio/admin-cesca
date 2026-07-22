BEGIN;

-- Estoque pertence ao catálogo congelado do caixa do dia. Colunas nulas são
-- mantidas apenas para caixas históricos criados antes desta funcionalidade.
ALTER TABLE pdv_caixa_produtos
  ADD COLUMN IF NOT EXISTS estoque_inicial INTEGER;

ALTER TABLE pdv_caixa_produtos
  ADD COLUMN IF NOT EXISTS estoque_disponivel INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pdv_caixa_produtos_estoque_check'
      AND conrelid = 'pdv_caixa_produtos'::regclass
  ) THEN
    ALTER TABLE pdv_caixa_produtos
      ADD CONSTRAINT pdv_caixa_produtos_estoque_check CHECK (
        (estoque_inicial IS NULL AND estoque_disponivel IS NULL)
        OR
        (
          estoque_inicial IS NOT NULL
          AND estoque_disponivel IS NOT NULL
          AND estoque_inicial >= 0
          AND estoque_disponivel >= 0
          AND estoque_disponivel <= estoque_inicial
        )
      );
  END IF;
END $$;

COMMIT;
