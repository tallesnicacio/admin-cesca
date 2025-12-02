import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space, Alert } from 'antd';
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import logger from '../utils/logger';

const { Title, Text } = Typography;

function AlterarSenha() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      // Validar que a nova senha é diferente (opcional)
      if (values.newPassword === values.currentPassword) {
        message.warning('A nova senha deve ser diferente da senha atual');
        setLoading(false);
        return;
      }

      // Atualizar senha usando Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword
      });

      if (error) throw error;

      message.success('Senha alterada com sucesso!');
      form.resetFields();

      // Opcional: Fazer logout após alterar senha
      // await supabase.auth.signOut();

    } catch (error) {
      logger.error('Erro ao alterar senha:', error);

      let errorMessage = 'Erro ao alterar senha';

      if (error.message?.includes('New password should be different')) {
        errorMessage = 'A nova senha deve ser diferente da senha atual';
      } else if (error.message?.includes('Password should be at least')) {
        errorMessage = 'A senha deve ter pelo menos 6 caracteres';
      } else if (error.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Alterar Senha
        </Title>
        <Text type="secondary" style={{ fontSize: 15 }}>
          Atualize sua senha para manter sua conta segura
        </Text>
      </div>

      <Card
        style={{
          borderRadius: 16,
          border: '1px solid #f0f0f0',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        }}
      >
        <Alert
          message="Dica de Segurança"
          description="Use uma senha forte com pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos."
          type="info"
          showIcon
          style={{ marginBottom: 24, borderRadius: 12 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="currentPassword"
            label="Senha Atual"
            rules={[
              { required: true, message: 'Digite sua senha atual' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#999' }} />}
              placeholder="Digite sua senha atual"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Nova Senha"
            rules={[
              { required: true, message: 'Digite a nova senha' },
              { min: 6, message: 'A senha deve ter pelo menos 6 caracteres' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/,
                message: 'A senha deve conter letras maiúsculas, minúsculas e números'
              }
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#999' }} />}
              placeholder="Digite a nova senha"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirmar Nova Senha"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: 'Confirme a nova senha' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('As senhas não coincidem'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<CheckCircleOutlined style={{ color: '#999' }} />}
              placeholder="Confirme a nova senha"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => form.resetFields()}
                size="large"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                size="large"
                icon={<LockOutlined />}
              >
                Alterar Senha
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            <strong>Importante:</strong> Após alterar sua senha, certifique-se de atualizá-la em todos os dispositivos onde você acessa o sistema.
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default AlterarSenha;
