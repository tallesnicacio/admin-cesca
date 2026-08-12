-- Migration: Controle de presença e suspensão de consulentes
-- Descrição: Adiciona campos para registrar presença em giras e suspender consulentes faltosos
-- Autor: Claude
-- Data: 2025-12-02

-- 1. Adicionar campos de presença na tabela agendamentos
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS compareceu BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_registro_presenca TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responsavel_registro TEXT DEFAULT NULL;

-- 2. Criar tabela de suspensões
CREATE TABLE IF NOT EXISTS suspensoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  agendamento_id UUID REFERENCES agendamentos(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL DEFAULT 'Falta não justificada',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  registrado_por TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_compareceu ON agendamentos(compareceu);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_compareceu ON agendamentos(status, compareceu);
CREATE INDEX IF NOT EXISTS idx_suspensoes_email ON suspensoes(email);
CREATE INDEX IF NOT EXISTS idx_suspensoes_telefone ON suspensoes(telefone);
CREATE INDEX IF NOT EXISTS idx_suspensoes_ativa ON suspensoes(ativa);
CREATE INDEX IF NOT EXISTS idx_suspensoes_data_fim ON suspensoes(data_fim);
CREATE INDEX IF NOT EXISTS idx_suspensoes_email_ativa ON suspensoes(email, ativa);
CREATE INDEX IF NOT EXISTS idx_suspensoes_telefone_ativa ON suspensoes(telefone, ativa);

-- 4. Criar função para desativar suspensões expiradas automaticamente
CREATE OR REPLACE FUNCTION desativar_suspensoes_expiradas()
RETURNS void AS $$
BEGIN
  UPDATE suspensoes
  SET ativa = false,
      updated_at = CURRENT_TIMESTAMP
  WHERE ativa = true
    AND data_fim < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar função para verificar se um email/telefone está suspenso
CREATE OR REPLACE FUNCTION verificar_suspensao(
  p_email TEXT,
  p_telefone TEXT
)
RETURNS TABLE(
  suspenso BOOLEAN,
  data_fim TIMESTAMP WITH TIME ZONE,
  motivo TEXT,
  dias_restantes INTEGER
) AS $$
BEGIN
  -- Primeiro desativar suspensões expiradas
  PERFORM desativar_suspensoes_expiradas();

  -- Verificar se há suspensão ativa
  RETURN QUERY
  SELECT
    true as suspenso,
    s.data_fim,
    s.motivo,
    EXTRACT(DAY FROM (s.data_fim - CURRENT_TIMESTAMP))::INTEGER as dias_restantes
  FROM suspensoes s
  WHERE s.ativa = true
    AND (LOWER(s.email) = LOWER(p_email) OR s.telefone = p_telefone)
    AND s.data_fim > CURRENT_TIMESTAMP
  ORDER BY s.data_fim DESC
  LIMIT 1;

  -- Se não encontrou nenhuma suspensão ativa, retornar false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMP WITH TIME ZONE, NULL::TEXT, NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar função trigger para criar suspensão automática ao marcar falta
CREATE OR REPLACE FUNCTION criar_suspensao_por_falta()
RETURNS TRIGGER AS $$
BEGIN
  -- Se marcou como NÃO compareceu (false) e antes era NULL ou true
  IF NEW.compareceu = false AND (OLD.compareceu IS NULL OR OLD.compareceu = true) THEN
    -- Criar suspensão de 2 semanas
    INSERT INTO suspensoes (
      email,
      telefone,
      agendamento_id,
      motivo,
      data_inicio,
      data_fim,
      ativa,
      registrado_por,
      observacoes
    ) VALUES (
      NEW.email,
      NEW.telefone,
      NEW.id,
      'Falta não justificada',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL '14 days',
      true,
      NEW.responsavel_registro,
      'Suspensão automática por não comparecimento à gira confirmada'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger na tabela agendamentos
DROP TRIGGER IF EXISTS trigger_suspensao_por_falta ON agendamentos;
CREATE TRIGGER trigger_suspensao_por_falta
  AFTER UPDATE OF compareceu ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION criar_suspensao_por_falta();

-- 8. Comentários para documentação
COMMENT ON COLUMN agendamentos.compareceu IS 'Indica se o consulente compareceu à gira: true=compareceu, false=não compareceu, null=ainda não registrado';
COMMENT ON COLUMN agendamentos.data_registro_presenca IS 'Data e hora em que a presença foi registrada';
COMMENT ON COLUMN agendamentos.responsavel_registro IS 'Nome do responsável que registrou a presença';

COMMENT ON TABLE suspensoes IS 'Registro de suspensões de consulentes que não compareceram às giras';
COMMENT ON COLUMN suspensoes.email IS 'Email do consulente suspenso';
COMMENT ON COLUMN suspensoes.telefone IS 'Telefone do consulente suspenso';
COMMENT ON COLUMN suspensoes.agendamento_id IS 'Referência ao agendamento que originou a suspensão';
COMMENT ON COLUMN suspensoes.motivo IS 'Motivo da suspensão';
COMMENT ON COLUMN suspensoes.data_inicio IS 'Data de início da suspensão';
COMMENT ON COLUMN suspensoes.data_fim IS 'Data de término da suspensão';
COMMENT ON COLUMN suspensoes.ativa IS 'Se a suspensão está ativa (desativada automaticamente após data_fim)';
COMMENT ON COLUMN suspensoes.registrado_por IS 'Nome do responsável que registrou a suspensão';

COMMENT ON FUNCTION verificar_suspensao IS 'Verifica se um email ou telefone está suspenso e retorna detalhes da suspensão';
COMMENT ON FUNCTION desativar_suspensoes_expiradas IS 'Desativa automaticamente suspensões que já expiraram';
COMMENT ON FUNCTION criar_suspensao_por_falta IS 'Função trigger que cria suspensão automática ao marcar falta';
