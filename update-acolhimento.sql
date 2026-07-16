-- Atualizar opção "Caboclos" para "Acolhimento Espiritual"
UPDATE opcoes_atendimento
SET
  label = '🪶 Acolhimento Espiritual',
  descricao = 'Atendimento espiritual com entidades que oferecem consultas, orientações e trabalhos de cura através da sabedoria ancestral.'
WHERE value = 'Caboclos';

-- Atualizar regra que menciona Caboclos
UPDATE regras_formulario
SET texto = 'Vidência com Mãe Pequena Núbia e Caboclo Estrela com Mãe Meire só acontecem por encaminhamento após Acolhimento Espiritual.'
WHERE texto LIKE '%Caboclos%';

-- Verificar as alterações
SELECT value, label, descricao FROM opcoes_atendimento WHERE value = 'Caboclos';
SELECT texto FROM regras_formulario WHERE texto LIKE '%Acolhimento%';
