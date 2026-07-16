/**
 * Utilitários para cálculo e agrupamento de giras
 */

/**
 * Calcula a próxima data de gira (segunda ou sexta-feira) a partir de uma data
 * @param {Date} dataReferencia - Data de referência (padrão: hoje)
 * @returns {Date} Data da próxima gira
 */
export function getProximaGira(dataReferencia = new Date()) {
  const data = new Date(dataReferencia)
  const diaSemana = data.getDay() // 0 = domingo, 1 = segunda, 5 = sexta

  let diasAteProximaGira = 0

  if (diaSemana === 0) { // Domingo
    diasAteProximaGira = 1 // Próxima segunda
  } else if (diaSemana === 1) { // Segunda
    diasAteProximaGira = 4 // Próxima sexta
  } else if (diaSemana === 2 || diaSemana === 3 || diaSemana === 4) { // Terça, Quarta ou Quinta
    diasAteProximaGira = 5 - diaSemana // Próxima sexta
  } else if (diaSemana === 5) { // Sexta
    diasAteProximaGira = 3 // Próxima segunda
  } else if (diaSemana === 6) { // Sábado
    diasAteProximaGira = 2 // Próxima segunda
  }

  const proximaGira = new Date(data)
  proximaGira.setDate(data.getDate() + diasAteProximaGira)
  proximaGira.setHours(0, 0, 0, 0) // Zerar horas para comparação

  return proximaGira
}

/**
 * Calcula a data da gira para a qual um agendamento foi confirmado
 * @param {string} dataConfirmacao - Data de confirmação do agendamento (ISO string)
 * @returns {Date} Data da gira correspondente
 */
export function getDataGiraDoAgendamento(dataConfirmacao) {
  if (!dataConfirmacao) return null
  const data = new Date(dataConfirmacao)
  return getProximaGira(data)
}

/**
 * Formata uma data no padrão brasileiro com dia da semana
 * @param {Date} data - Data a ser formatada
 * @returns {string} Data formatada (ex: "segunda-feira, 04 de dezembro de 2025")
 */
export function formatarDataGira(data) {
  if (!data) return ''
  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

/**
 * Formata uma data no padrão curto brasileiro
 * @param {Date} data - Data a ser formatada
 * @returns {string} Data formatada (ex: "04/12/2025")
 */
export function formatarDataCurta(data) {
  if (!data) return ''
  return data.toLocaleDateString('pt-BR')
}

/**
 * Agrupa agendamentos confirmados por data de gira
 * @param {Array} agendamentos - Lista de agendamentos
 * @returns {Object} Objeto com datas como chave e arrays de agendamentos como valor
 */
export function agruparPorGira(agendamentos) {
  const grupos = {}

  agendamentos
    .filter(ag => ag.status === 'Confirmado')
    .forEach(agendamento => {
      const dataGira = getDataGiraDoAgendamento(agendamento.data_confirmacao)
      if (!dataGira) return

      const chave = dataGira.toISOString().split('T')[0] // YYYY-MM-DD

      if (!grupos[chave]) {
        grupos[chave] = {
          data: dataGira,
          agendamentos: []
        }
      }

      grupos[chave].agendamentos.push(agendamento)
    })

  return grupos
}

/**
 * Retorna lista de giras ordenadas da mais recente para a mais antiga
 * @param {Object} gruposPorGira - Objeto retornado por agruparPorGira()
 * @returns {Array} Array de objetos { chave, data, agendamentos, total }
 */
export function getGirasOrdenadas(gruposPorGira) {
  return Object.entries(gruposPorGira)
    .map(([chave, grupo]) => ({
      chave,
      data: grupo.data,
      agendamentos: grupo.agendamentos,
      total: grupo.agendamentos.length,
      confirmados: grupo.agendamentos.filter(ag => ag.compareceu === true).length,
      ausentes: grupo.agendamentos.filter(ag => ag.compareceu === false).length,
      pendentes: grupo.agendamentos.filter(ag => ag.compareceu === null).length
    }))
    .sort((a, b) => b.data - a.data) // Mais recente primeiro
}

/**
 * Verifica se uma gira já passou (é anterior a hoje)
 * @param {Date} dataGira - Data da gira
 * @returns {boolean} true se a gira já passou
 */
export function giraJaPassou(dataGira) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return dataGira < hoje
}

/**
 * Calcula estatísticas de presença de uma gira
 * @param {Array} agendamentos - Lista de agendamentos da gira
 * @returns {Object} Objeto com estatísticas
 */
export function calcularEstatisticasGira(agendamentos) {
  const total = agendamentos.length
  const confirmados = agendamentos.filter(ag => ag.compareceu === true).length
  const ausentes = agendamentos.filter(ag => ag.compareceu === false).length
  const pendentes = agendamentos.filter(ag => ag.compareceu === null).length

  const percentualPresenca = total > 0 ? ((confirmados / total) * 100).toFixed(1) : 0
  const percentualAusencia = total > 0 ? ((ausentes / total) * 100).toFixed(1) : 0

  return {
    total,
    confirmados,
    ausentes,
    pendentes,
    percentualPresenca,
    percentualAusencia
  }
}
