-- Migration 005: Adiciona campos para identificação de consulente menor de idade
-- Permite registrar quando o consulente é menor e o nome do responsável legal
-- que irá acompanhar o atendimento.

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS menor_de_idade BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_responsavel TEXT;

COMMENT ON COLUMN agendamentos.menor_de_idade IS 'Indica se o consulente é menor de idade';
COMMENT ON COLUMN agendamentos.nome_responsavel IS 'Nome do responsável legal que acompanhará o atendimento (obrigatório quando menor_de_idade = true)';
