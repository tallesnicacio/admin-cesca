import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, List, Spin, Result } from 'antd';
import { LockOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './SetPassword.css';

const { Title, Text } = Typography;

function SetPassword() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userName, setUserName] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const [password, setPassword] = useState('');

  const navigate = useNavigate();

  // Validação de senha
  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', valid: password.length >= 8 },
    { label: 'Uma letra maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', valid: /[a-z]/.test(password) },
    { label: 'Um número', valid: /[0-9]/.test(password) },
    { label: 'Um caractere especial (!@#$%^&*)', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
  ];

  const isPasswordValid = passwordRequirements.every(req => req.valid);

  useEffect(() => {
    checkEmailConfirmation();
  }, []);

  const checkEmailConfirmation = async () => {
    try {
      setCheckingToken(true);

      // Verificar se há uma sessão ativa (após confirmação de email)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Link inválido ou expirado. Por favor, solicite um novo link de confirmação.');
        setIsValidToken(false);
        setCheckingToken(false);
        return;
      }

      // Usuário confirmou o email com sucesso
      setIsValidToken(true);
      setUserName(session.user.user_metadata?.name || session.user.email);
      setCheckingToken(false);

    } catch (err) {
      console.error('Erro ao verificar token:', err);
      setError('Erro ao validar confirmação de email');
      setIsValidToken(false);
      setCheckingToken(false);
    }
  };

  const handleSetPassword = async (values) => {
    setError('');

    try {
      setLoading(true);

      // Atualizar senha do usuário
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: values.password
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      console.error('Erro ao definir senha:', err);
      setError(err.message || 'Erro ao definir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checkingToken) {
    return (
      <div className="set-password-container">
        <Card style={{ maxWidth: 400, width: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Verificando confirmação de email...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="set-password-container">
        <Result
          status="error"
          title="Link Inválido ou Expirado"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate('/login')}>
              Voltar para Login
            </Button>
          }
          style={{ maxWidth: 500, background: 'white', borderRadius: 8, padding: 40 }}
        />
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="set-password-container">
        <Result
          status="success"
          title="Senha Definida com Sucesso!"
          subTitle="Você será redirecionado para a página de login..."
          style={{ maxWidth: 500, background: 'white', borderRadius: 8, padding: 40 }}
        />
      </div>
    );
  }

  // Set password form
  return (
    <div className="set-password-container">
      <Card
        style={{
          maxWidth: 500,
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <LockOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
            <Title level={2} style={{ marginBottom: 8 }}>Defina sua Senha</Title>
            <Text type="secondary">
              Olá, {userName}! Crie uma senha segura para acessar o sistema.
            </Text>
          </div>

          {error && (
            <Alert
              message="Erro"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError('')}
            />
          )}

          <Form
            form={form}
            name="setPassword"
            onFinish={handleSetPassword}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="password"
              label="Nova Senha"
              rules={[
                { required: true, message: 'Por favor, insira sua senha!' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const reqs = [
                      { valid: value.length >= 8, msg: 'Mínimo 8 caracteres' },
                      { valid: /[A-Z]/.test(value), msg: 'Uma letra maiúscula' },
                      { valid: /[a-z]/.test(value), msg: 'Uma letra minúscula' },
                      { valid: /[0-9]/.test(value), msg: 'Um número' },
                      { valid: /[!@#$%^&*(),.?":{}|<>]/.test(value), msg: 'Um caractere especial' }
                    ];
                    const failed = reqs.find(r => !r.valid);
                    if (failed) return Promise.reject(new Error(failed.msg));
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Digite sua nova senha"
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </Form.Item>

            {password && (
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  A senha deve conter:
                </Text>
                <List
                  size="small"
                  dataSource={passwordRequirements}
                  renderItem={(item) => (
                    <List.Item style={{ border: 'none', padding: '4px 0' }}>
                      {item.valid ? (
                        <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#d1d5db', marginRight: 8 }} />
                      )}
                      <Text type={item.valid ? 'success' : 'secondary'}>{item.label}</Text>
                    </List.Item>
                  )}
                />
              </div>
            )}

            <Form.Item
              name="confirmPassword"
              label="Confirmar Senha"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Por favor, confirme sua senha!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('As senhas não coincidem!'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Digite novamente sua senha"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                disabled={!isPasswordValid}
                block
              >
                {loading ? 'Definindo senha...' : 'Definir Senha e Acessar'}
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
            Ao definir sua senha, você poderá acessar o sistema Admin CESCA.
          </Text>
        </Space>
      </Card>
    </div>
  );
}

export default SetPassword;
