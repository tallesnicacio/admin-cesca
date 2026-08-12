import { supabase } from '../supabaseClient';
import logger from '../utils/logger';

/**
 * Serviço para envio de emails via Supabase Edge Function + Resend
 */

/**
 * Envia email de confirmação para um agendamento
 * @param {string} agendamentoId - ID do agendamento
 * @param {string} opcaoEscolhida - 'primeira' ou 'segunda'
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
export const sendConfirmationEmail = async (agendamentoId, opcaoEscolhida = 'primeira') => {
  try {
    logger.log('📧 Iniciando envio de email de confirmação...');
    logger.log('📋 Parâmetros:', { agendamentoId, opcaoEscolhida });

    // Obter token de autenticação
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      logger.error('❌ Não há sessão ativa');
      throw new Error('Usuário não autenticado');
    }

    logger.log('🔑 Token obtido, chamando Edge Function...');

    // Chamar a Edge Function
    const { data, error } = await supabase.functions.invoke('send-confirmation-email', {
      body: {
        agendamentoId,
        opcaoEscolhida
      }
    });

    if (error) {
      logger.error('❌ Erro ao chamar Edge Function:', error);
      throw error;
    }

    const responseData = data?.data || data;

    logger.log('✅ Email enviado com sucesso:', responseData);

    return {
      success: true,
      message: responseData?.message || 'Email enviado com sucesso',
      emailId: responseData?.emailId
    };

  } catch (error) {
    const errorMessage = typeof error === 'string'
      ? error
      : error?.message || 'Erro ao enviar email';

    logger.error('❌ Erro ao enviar email:', error);
    return {
      success: false,
      error: errorMessage
    };
  }
};
