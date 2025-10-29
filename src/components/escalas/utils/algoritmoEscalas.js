/**
 * Algoritmo de geração automática de escalas
 */

import {
  temCapacitacao,
  temRestricao,
  detectarConflito,
  obterFuncaoFixa,
} from './detectorConflitos';

/**
 * Calcula todas as segundas e sextas de um mês
 */
export function calcularDiasEscala(ano, mes) {
  const datas = [];
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);

  for (let dia = primeiroDia; dia <= ultimoDia; dia.setDate(dia.getDate() + 1)) {
    const diaSemana = dia.getDay();
    // 1 = Segunda, 5 = Sexta
    if (diaSemana === 1 || diaSemana === 5) {
      const dataStr = dia.toISOString().split('T')[0];
      datas.push({
        data: dataStr,
        diaSemana: diaSemana === 1 ? 'Segunda' : 'Sexta',
        diaSemanaNum: diaSemana,
      });
    }
  }

  return datas;
}

/**
 * Obtém trabalhadores capacitados para um tipo de atendimento
 */
function obterTrabalhadoresCapacitados(tipoAtendimentoId, trabalhadores, capacitacoes) {
  return trabalhadores.filter((trab) =>
    temCapacitacao(trab.id, tipoAtendimentoId, capacitacoes)
  );
}

/**
 * Calcula a carga de trabalho atual de cada trabalhador
 */
function calcularCargaTrabalho(trabalhadoresIds, escalasExistentes) {
  const carga = {};

  trabalhadoresIds.forEach((id) => {
    carga[id] = escalasExistentes.filter((e) => e.trabalhador_id === id).length;
  });

  return carga;
}

/**
 * Seleciona o melhor trabalhador disponível baseado em critérios
 */
function selecionarMelhorTrabalhador(
  candidatos,
  data,
  tipoAtendimento,
  escalasExistentes,
  restricoes,
  cargaTrabalho
) {
  // Filtrar candidatos válidos
  const candidatosValidos = candidatos.filter((trab) => {
    // Verificar restrição
    if (temRestricao(trab.id, data, restricoes)) return false;

    // Verificar conflito
    const conflito = detectarConflito(
      trab.id,
      data,
      tipoAtendimento.horario_inicio,
      tipoAtendimento.horario_fim,
      escalasExistentes
    );

    return !conflito.temConflito;
  });

  if (candidatosValidos.length === 0) return null;

  // Ordenar por menor carga de trabalho
  candidatosValidos.sort((a, b) => {
    const cargaA = cargaTrabalho[a.id] || 0;
    const cargaB = cargaTrabalho[b.id] || 0;
    return cargaA - cargaB;
  });

  return candidatosValidos[0];
}

/**
 * Gera escalas automaticamente para um mês
 * @param {number} ano - Ano
 * @param {number} mes - Mês (1-12)
 * @param {Array} tiposAtendimento - Tipos de atendimento
 * @param {Array} trabalhadores - Trabalhadores disponíveis
 * @param {Array} capacitacoes - Capacitações dos trabalhadores
 * @param {Array} funcoesFixas - Funções fixas
 * @param {Array} restricoes - Restrições de datas
 * @returns {Object} { escalas: Array, avisos: Array, erros: Array }
 */
export function gerarEscalasAutomaticas(
  ano,
  mes,
  tiposAtendimento,
  trabalhadores,
  capacitacoes,
  funcoesFixas,
  restricoes
) {
  const escalasGeradas = [];
  const avisos = [];
  const erros = [];

  // 1. Calcular datas (segundas e sextas)
  const datas = calcularDiasEscala(ano, mes);

  if (datas.length === 0) {
    erros.push('Nenhuma segunda ou sexta-feira encontrada no mês selecionado');
    return { escalas: [], avisos, erros };
  }

  // 2. Calcular carga de trabalho inicial
  const todosIds = trabalhadores.map((t) => t.id);
  const cargaTrabalho = calcularCargaTrabalho(todosIds, escalasGeradas);

  // 3. Iterar sobre cada data e tipo de atendimento
  datas.forEach((diaInfo) => {
    const { data, diaSemana } = diaInfo;

    tiposAtendimento.forEach((tipo) => {
      // Pular se tipo não está ativo
      if (!tipo.ativo) return;

      // Pular se tipo não é do dia da semana correto
      if (tipo.dia_semana && tipo.dia_semana !== diaSemana.toLowerCase()) {
        return;
      }

      // ETAPA 1: Verificar se há função fixa
      const funcaoFixa = funcoesFixas.find(
        (ff) => ff.tipo_atendimento_id === tipo.id && ff.ativo
      );

      if (funcaoFixa) {
        // Alocar trabalhador fixo
        const trabalhador = trabalhadores.find((t) => t.id === funcaoFixa.trabalhador_id);

        if (!trabalhador) {
          erros.push(
            `Função fixa configurada mas trabalhador não encontrado: ${tipo.nome} em ${data}`
          );
          return;
        }

        // Validar função fixa
        if (temRestricao(trabalhador.id, data, restricoes)) {
          avisos.push(
            `${trabalhador.nome_completo} tem função fixa em ${tipo.nome} mas tem restrição em ${data}`
          );
          // Não alocar se tem restrição
          return;
        }

        const conflito = detectarConflito(
          trabalhador.id,
          data,
          tipo.horario_inicio,
          tipo.horario_fim,
          escalasGeradas
        );

        if (conflito.temConflito) {
          erros.push(
            `CONFLITO: ${trabalhador.nome_completo} tem função fixa em ${tipo.nome} mas já está escalado em ${conflito.conflitos[0].tipo} no mesmo horário (${data})`
          );
          return;
        }

        // Alocar
        escalasGeradas.push({
          id: `temp_${Date.now()}_${Math.random()}`,
          trabalhador_id: trabalhador.id,
          trabalhador_nome: trabalhador.nome_completo,
          tipo_atendimento_id: tipo.id,
          tipo_nome: tipo.nome,
          data_atendimento: data,
          dia_semana: diaSemana,
          horario_inicio: tipo.horario_inicio,
          horario_fim: tipo.horario_fim,
          funcao: funcaoFixa.funcao,
          funcao_fixa: true,
        });

        cargaTrabalho[trabalhador.id] = (cargaTrabalho[trabalhador.id] || 0) + 1;
        return;
      }

      // ETAPA 2: Alocação automática (sem função fixa)
      const candidatos = obterTrabalhadoresCapacitados(tipo.id, trabalhadores, capacitacoes);

      if (candidatos.length === 0) {
        erros.push(
          `Nenhum trabalhador capacitado para ${tipo.nome} em ${data}`
        );
        return;
      }

      const selecionado = selecionarMelhorTrabalhador(
        candidatos,
        data,
        tipo,
        escalasGeradas,
        restricoes,
        cargaTrabalho
      );

      if (!selecionado) {
        avisos.push(
          `Não foi possível alocar ninguém para ${tipo.nome} em ${data} (conflitos ou restrições)`
        );
        return;
      }

      // Alocar
      escalasGeradas.push({
        id: `temp_${Date.now()}_${Math.random()}`,
        trabalhador_id: selecionado.id,
        trabalhador_nome: selecionado.nome_completo,
        tipo_atendimento_id: tipo.id,
        tipo_nome: tipo.nome,
        data_atendimento: data,
        dia_semana: diaSemana,
        horario_inicio: tipo.horario_inicio,
        horario_fim: tipo.horario_fim,
        funcao: null,
        funcao_fixa: false,
      });

      cargaTrabalho[selecionado.id] = (cargaTrabalho[selecionado.id] || 0) + 1;
    });
  });

  return {
    escalas: escalasGeradas,
    avisos,
    erros,
    estatisticas: {
      totalDias: datas.length,
      totalEscalas: escalasGeradas.length,
      totalTipos: tiposAtendimento.filter((t) => t.ativo).length,
      distribuicaoCarga: cargaTrabalho,
    },
  };
}

/**
 * Formata data para exibição
 */
export function formatarData(dataStr) {
  const data = new Date(dataStr + 'T00:00:00');
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Agrupa escalas por data
 */
export function agruparEscalasPorData(escalas) {
  const grupos = {};

  escalas.forEach((escala) => {
    if (!grupos[escala.data_atendimento]) {
      grupos[escala.data_atendimento] = {
        data: escala.data_atendimento,
        dia_semana: escala.dia_semana,
        escalas: [],
      };
    }
    grupos[escala.data_atendimento].escalas.push(escala);
  });

  return Object.values(grupos).sort((a, b) => a.data.localeCompare(b.data));
}
