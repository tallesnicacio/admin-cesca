-- Migration: Adicionar tabela de configurações do sistema
-- Autor: Claude
-- Data: 2025-11-05

-- Criar tabela de configurações
CREATE TABLE IF NOT EXISTS configuracoes (
  id SERIAL PRIMARY KEY,
  agendamentos_ativos BOOLEAN NOT NULL DEFAULT true,
  ignorar_restricao_dias BOOLEAN NOT NULL DEFAULT false,
  ignorar_restricao_horario BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configuração inicial
INSERT INTO configuracoes (agendamentos_ativos, ignorar_restricao_dias, ignorar_restricao_horario)
VALUES (true, false, false)
ON CONFLICT DO NOTHING;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_configuracoes_id ON configuracoes(id);

-- Comentários
COMMENT ON TABLE configuracoes IS 'Configurações globais do sistema de agendamento';
COMMENT ON COLUMN configuracoes.agendamentos_ativos IS 'Define se os agendamentos estão abertos ou suspensos';
COMMENT ON COLUMN configuracoes.ignorar_restricao_dias IS 'Se true, permite agendamentos em qualquer dia (não apenas quarta e sábado)';
COMMENT ON COLUMN configuracoes.ignorar_restricao_horario IS 'Se true, permite agendamentos em qualquer horário (não apenas após 7h)';
