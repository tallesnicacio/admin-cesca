-- Migration 006: Adiciona CPF do responsável legal (obrigatório quando menor_de_idade = true)
-- Armazenado apenas com dígitos (11 caracteres), sem máscara.

ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS cpf_responsavel TEXT;

COMMENT ON COLUMN agendamentos.cpf_responsavel IS 'CPF (somente dígitos) do responsável legal — preenchido quando menor_de_idade = true';
