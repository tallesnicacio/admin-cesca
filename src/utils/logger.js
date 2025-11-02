/**
 * Utilitário de logging para o Admin CESCA
 *
 * Em desenvolvimento: mostra todos os logs
 * Em produção: silencia logs (exceto errors críticos)
 *
 * @example
 * import logger from '../utils/logger';
 *
 * logger.info('Carregando dados...');
 * logger.error('Erro ao carregar:', error);
 * logger.debug('Estado atual:', state);
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  /**
   * Log de informação geral
   * Produção: silenciado
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log de informação
   * Produção: silenciado
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log de warning
   * Produção: silenciado
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log de debug
   * Produção: silenciado
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log de erro
   * Produção: SEMPRE exibido (erros críticos)
   * Em produção futura, pode enviar para serviço de monitoramento (Sentry, etc)
   */
  error: (...args) => {
    console.error(...args);

    // TODO: Em produção, enviar para serviço de monitoramento
    // if (!isDevelopment) {
    //   sendToSentry(...args);
    // }
  },
};

export default logger;
