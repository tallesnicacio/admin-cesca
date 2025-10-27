-- Adiciona coluna para registrar qual opção foi escolhida na aprovação
-- Execute este SQL no Supabase SQL Editor

ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS opcao_escolhida TEXT CHECK (opcao_escolhida IN ('primeira', 'segunda'));

-- Adiciona comentário na coluna para documentação
COMMENT ON COLUMN agendamentos.opcao_escolhida IS 'Registra qual opção de atendimento foi aceita: primeira ou segunda';
