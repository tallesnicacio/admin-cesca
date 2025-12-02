import React, { useState } from 'react';
import { Modal, Button, Space, Typography, message } from 'antd';
import { MailOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { sendConfirmationEmail } from '../services/emailService';
import logger from '../utils/logger';

const { Text } = Typography;

/**
 * Modal para confirmar envio de email de confirmação
 * Aparece automaticamente após a confirmação do agendamento
 */
function ConfirmacaoEmailModal({
  visible,
  onClose,
  agendamento,
  opcaoEscolhida
}) {
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = async () => {
    try {
      setSending(true);
      logger.log('📧 Enviando email de confirmação...', {
        agendamentoId: agendamento?.id,
        opcaoEscolhida
      });

      const result = await sendConfirmationEmail(agendamento.id, opcaoEscolhida);

      if (result.success) {
        setEmailSent(true);
        message.success('Email enviado com sucesso!');
        logger.log('✅ Email enviado:', result);

        // Fecha o modal após 2 segundos
        setTimeout(() => {
          onClose();
          setEmailSent(false);
        }, 2000);
      } else {
        message.error(result.error || 'Erro ao enviar email');
        logger.error('❌ Erro ao enviar email:', result.error);
      }
    } catch (error) {
      logger.error('❌ Erro ao enviar email:', error);
      message.error('Erro ao enviar email: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleSkip = () => {
    logger.log('⏭️ Usuário optou por não enviar o email');
    onClose();
    setEmailSent(false);
  };

  if (!agendamento) return null;

  // Determinar qual opção foi escolhida
  const tipoAtendimento = opcaoEscolhida === 'segunda'
    ? agendamento.segunda_opcao
    : agendamento.primeira_opcao;

  return (
    <Modal
      title={
        <Space>
          <MailOutlined style={{ color: '#667eea', fontSize: 20 }} />
          <span>Enviar Email de Confirmação</span>
        </Space>
      }
      open={visible}
      onCancel={handleSkip}
      footer={null}
      width={550}
      centered
    >
      {emailSent ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#10b981', marginBottom: 20 }} />
          <Text style={{ display: 'block', fontSize: 18, fontWeight: 500 }}>
            Email enviado com sucesso!
          </Text>
        </div>
      ) : (
        <div style={{ padding: '20px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <ExclamationCircleOutlined style={{ color: '#667eea', fontSize: 20, marginRight: 8 }} />
            <Text style={{ fontSize: 16 }}>
              Deseja enviar um email de confirmação para o consulente?
            </Text>
          </div>

          <div style={{
            background: '#f8f9ff',
            border: '1px solid #e0e7ff',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24
          }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ color: '#667eea' }}>Detalhes do Email:</Text>
            </div>

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ display: 'inline-block', width: 120 }}>Para:</Text>
              <Text strong>{agendamento.email}</Text>
            </div>

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ display: 'inline-block', width: 120 }}>Nome:</Text>
              <Text>{agendamento.nome_completo}</Text>
            </div>

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ display: 'inline-block', width: 120 }}>Atendimento:</Text>
              <Text>{tipoAtendimento}</Text>
            </div>

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ display: 'inline-block', width: 120 }}>Canal:</Text>
              <Text>{agendamento.canal_preferencial}</Text>
            </div>
          </div>

          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24
          }}>
            <Text style={{ fontSize: 13, color: '#92400e' }}>
              💡 <strong>Nota:</strong> O email será enviado automaticamente com os detalhes da confirmação e informará que a equipe entrará em contato em breve.
            </Text>
          </div>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              size="large"
              onClick={handleSkip}
              disabled={sending}
            >
              Não enviar
            </Button>
            <Button
              type="primary"
              size="large"
              icon={<MailOutlined />}
              onClick={handleSendEmail}
              loading={sending}
            >
              {sending ? 'Enviando...' : 'Enviar Email'}
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
}

export default ConfirmacaoEmailModal;
