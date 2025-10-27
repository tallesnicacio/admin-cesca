-- Adicionar colunas para controlar restrições de dia e horário

-- Adicionar colunas à tabela configuracoes
ALTER TABLE configuracoes
ADD COLUMN IF NOT EXISTS ignorar_restricao_dias BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ignorar_restricao_horario BOOLEAN DEFAULT false;

-- Atualizar configuração existente para manter comportamento atual (respeitar restrições)
UPDATE configuracoes
SET ignorar_restricao_dias = false,
    ignorar_restricao_horario = false
WHERE ignorar_restricao_dias IS NULL OR ignorar_restricao_horario IS NULL;

-- Mensagem
DO $$
BEGIN
  RAISE NOTICE 'Colunas de restrição adicionadas com sucesso!';
  RAISE NOTICE 'ignorar_restricao_dias: se true, permite agendamentos em qualquer dia da semana';
  RAISE NOTICE 'ignorar_restricao_horario: se true, permite agendamentos em qualquer horário';
END $$;
