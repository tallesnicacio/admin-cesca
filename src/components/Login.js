import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import './Login.css';

const { Title, Text } = Typography;

function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (values) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) throw error;

      // Verificar se o usuário é admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile?.is_admin) {
        await supabase.auth.signOut();
        throw new Error('Acesso negado. Apenas administradores podem acessar.');
      }
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card
        className="login-card"
        style={{
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2} style={{ marginBottom: 8 }}>Admin CESCA</Title>
            <Text type="secondary">Painel Administrativo</Text>
          </div>

          {error && (
            <Alert
              message="Erro ao fazer login"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
            />
          )}

          <Form
            name="login"
            onFinish={handleLogin}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Por favor, insira seu email!' },
                { type: 'email', message: 'Por favor, insira um email válido!' }
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="seu@email.com"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Senha"
              rules={[{ required: true, message: 'Por favor, insira sua senha!' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="••••••••"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default Login;
