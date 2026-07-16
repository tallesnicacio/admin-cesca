-- Gestão segura de agendamentos: migração somente aditiva, sem DELETE.
BEGIN;

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS gira_data DATE,
  ADD COLUMN IF NOT EXISTS arquivado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_anterior TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_por TEXT,
  ADD COLUMN IF NOT EXISTS email_cancelamento_enviado_at TIMESTAMPTZ;

-- Preserva o histórico e fixa a gira dos confirmados já existentes.
UPDATE agendamentos
SET gira_data = CASE EXTRACT(DOW FROM data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::int
  WHEN 0 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 1
  WHEN 1 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 4
  WHEN 2 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 3
  WHEN 3 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 2
  WHEN 4 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 1
  WHEN 5 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 3
  WHEN 6 THEN (data_confirmacao AT TIME ZONE 'America/Sao_Paulo')::date + 2
END
WHERE gira_data IS NULL AND data_confirmacao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agendamentos_gira_data ON agendamentos(gira_data);
CREATE INDEX IF NOT EXISTS idx_agendamentos_gira_status ON agendamentos(gira_data, status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_arquivado_at ON agendamentos(arquivado_at);

ALTER TABLE suspensoes
  ADD COLUMN IF NOT EXISTS agendamento_id UUID REFERENCES agendamentos(id),
  ADD COLUMN IF NOT EXISTS desativada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS desativada_por TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio_ts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_fim_ts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registrado_por TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

CREATE INDEX IF NOT EXISTS idx_suspensoes_agendamento_id ON suspensoes(agendamento_id);

-- Compatibiliza os campos do banco local com a migração legada do Supabase.
UPDATE suspensoes
SET data_fim = COALESCE(data_fim, data_fim_ts::date),
    ativo = COALESCE(ativo, ativa, true)
WHERE data_fim IS NULL OR ativo IS NULL;

CREATE OR REPLACE FUNCTION criar_suspensao_por_falta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.compareceu = false AND (OLD.compareceu IS NULL OR OLD.compareceu = true) THEN
    INSERT INTO suspensoes (
      email, telefone, agendamento_id, motivo,
      data_inicio, data_fim, ativo,
      data_inicio_ts, data_fim_ts, ativa,
      registrado_por, observacoes
    ) VALUES (
      NEW.email, NEW.telefone, NEW.id, 'Falta não justificada',
      CURRENT_DATE, CURRENT_DATE + 14, true,
      NOW(), NOW() + INTERVAL '14 days', true,
      NEW.responsavel_registro,
      'Suspensão automática por não comparecimento à gira confirmada'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
