/**
 * Utilitário para detectar conflitos de horários em escalas
 */

/**
 * Converte horário HH:MM para minutos desde meia-noite
 */
export function horarioParaMinutos(horario) {
  if (!horario) return 0;
  const [horas, minutos] = horario.split(':').map(Number);
  return horas * 60 + minutos;
}

/**
 * Verifica se dois horários se sobrepõem
 * Retorna TRUE se há conflito (sobreposição)
 */
export function horariosSeChocam(inicio1, fim1, inicio2, fim2) {
  const i1 = horarioParaMinutos(inicio1);
  const f1 = horarioParaMinutos(fim1);
  const i2 = horarioParaMinutos(inicio2);
  const f2 = horarioParaMinutos(fim2);

  // Há conflito se: (início1 < fim2) E (fim1 > início2)
  return (i1 < f2) && (f1 > i2);
}

/**
 * Detecta se um trabalhador já está escalado em outro lugar no mesmo horário
 * @param {string} trabalhadorId - ID do trabalhador
 * @param {string} data - Data no formato YYYY-MM-DD
 * @param {string} horarioInicio - Horário início HH:MM
 * @param {string} horarioFim - Horário fim HH:MM
 * @param {Array} escalasExistentes - Array de escalas já alocadas
 * @param {string} escalaIdAtual - ID da escala atual (para ignorar na verificação)
 * @returns {Object} { temConflito: boolean, conflitos: Array }
 */
export function detectarConflito(
  trabalhadorId,
  data,
  horarioInicio,
  horarioFim,
  escalasExistentes = [],
  escalaIdAtual = null
) {
  // Filtrar escalas do mesmo trabalhador na mesma data
  const escalasDoTrabalhador = escalasExistentes.filter(
    (escala) =>
      escala.trabalhador_id === trabalhadorId &&
      escala.data_atendimento === data &&
      escala.id !== escalaIdAtual
  );

  // Verificar sobreposição de horários
  const conflitos = escalasDoTrabalhador.filter((escala) => {
    return horariosSeChocam(
      horarioInicio,
      horarioFim,
      escala.horario_inicio,
      escala.horario_fim
    );
  });

  return {
    temConflito: conflitos.length > 0,
    conflitos: conflitos.map((c) => ({
      tipo: c.tipo_nome || c.tipo_atendimento_nome,
      horario: `${c.horario_inicio} - ${c.horario_fim}`,
      data: c.data_atendimento,
    })),
  };
}

/**
 * Verifica se trabalhador tem capacitação para o tipo de atendimento
 */
export function temCapacitacao(trabalhadorId, tipoAtendimentoId, capacitacoes) {
  return capacitacoes.some(
    (cap) =>
      cap.trabalhador_id === trabalhadorId &&
      cap.tipo_atendimento_id === tipoAtendimentoId &&
      cap.ativo
  );
}

/**
 * Verifica se trabalhador tem restrição na data
 */
export function temRestricao(trabalhadorId, data, restricoes) {
  return restricoes.some(
    (rest) =>
      rest.trabalhador_id === trabalhadorId &&
      rest.data_restricao === data &&
      rest.ativo
  );
}

/**
 * Obtém função fixa de um trabalhador para um tipo de atendimento
 */
export function obterFuncaoFixa(trabalhadorId, tipoAtendimentoId, funcoesFixas) {
  return funcoesFixas.find(
    (funcao) =>
      funcao.trabalhador_id === trabalhadorId &&
      funcao.tipo_atendimento_id === tipoAtendimentoId &&
      funcao.ativo
  );
}

/**
 * Valida se uma alocação é possível
 */
export function validarAlocacao(
  trabalhadorId,
  tipoAtendimento,
  data,
  escalasExistentes,
  capacitacoes,
  restricoes
) {
  const erros = [];

  // 1. Verificar capacitação
  if (!temCapacitacao(trabalhadorId, tipoAtendimento.id, capacitacoes)) {
    erros.push('Trabalhador não tem capacitação para este tipo de atendimento');
  }

  // 2. Verificar restrição de data
  if (temRestricao(trabalhadorId, data, restricoes)) {
    erros.push('Trabalhador tem restrição cadastrada para esta data');
  }

  // 3. Verificar conflito de horário
  const conflito = detectarConflito(
    trabalhadorId,
    data,
    tipoAtendimento.horario_inicio,
    tipoAtendimento.horario_fim,
    escalasExistentes
  );

  if (conflito.temConflito) {
    erros.push(
      `Conflito de horário: já escalado em ${conflito.conflitos[0].tipo}`
    );
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}
