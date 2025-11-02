import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Card, Button, Tag, Alert, Spin, Typography, Divider, Space, Row, Col } from 'antd';
import {
  PoweroffOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { message } from 'antd';

const { Title, Text, Paragraph } = Typography;

function Configuracoes() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      message.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('configuracoes')
        .update({
          agendamentos_ativos: !config.agendamentos_ativos,
          ultima_alteracao: new Date().toISOString(),
          alterado_por: 'Admin'
        })
        .eq('id', config.id);

      if (error) throw error;
      message.success(`Agendamentos ${!config.agendamentos_ativos ? 'ATIVADOS' : 'DESATIVADOS'} com sucesso!`);
      loadConfig();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      message.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRestriction = async (field) => {
    if (!config) return;

    try {
      setSaving(true);
      const newValue = !config[field];
      const { error } = await supabase
        .from('configuracoes')
        .update({
          [field]: newValue,
          ultima_alteracao: new Date().toISOString(),
          alterado_por: 'Admin'
        })
        .eq('id', config.id);

      if (error) throw error;

      const messages = {
        ignorar_restricao_dias: newValue
          ? 'Agendamentos liberados para TODOS os dias da semana!'
          : 'Agendamentos restritos apenas para Quartas e Sábados',
        ignorar_restricao_horario: newValue
          ? 'Agendamentos liberados para QUALQUER horário!'
          : 'Agendamentos restritos apenas após 7h'
      };

      message.success(messages[field]);
      loadConfig();
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      message.error('Erro ao atualizar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Carregando configurações...</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <Title level={2} style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Configurações do Sistema
        </Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15 }}>
          Gerencie as configurações de agendamentos e restrições
        </Text>
      </div>

      <Divider style={{ margin: isMobile ? '16px 0' : '24px 0', borderColor: '#f0f0f0' }} />

      <Row gutter={[16, 16]}>
        {/* Status dos Agendamentos */}
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #f0f0f0', height: '100%' }}
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <PoweroffOutlined style={{ fontSize: 20, color: '#667eea' }} />
                  <Text strong style={{ fontSize: isMobile ? 15 : 16 }}>Status dos Agendamentos</Text>
                </Space>
                <Tag
                  icon={config?.agendamentos_ativos ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  color={config?.agendamentos_ativos ? 'success' : 'error'}
                >
                  {config?.agendamentos_ativos ? 'ATIVOS' : 'DESATIVADOS'}
                </Tag>
              </Space>
            }
          >
            <Paragraph style={{ fontSize: isMobile ? 13 : 14, marginBottom: 16 }}>
              {config?.agendamentos_ativos
                ? 'Os usuários podem fazer novos agendamentos no sistema quiz-cesca.'
                : 'Os agendamentos estão temporariamente suspensos. Os usuários verão uma mensagem informando sobre a suspensão.'}
            </Paragraph>

            {config?.ultima_alteracao && (
              <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: isMobile ? 12 : 13 }}>
                Última alteração: {new Date(config.ultima_alteracao).toLocaleString('pt-BR')}
                {config.alterado_por && ` por ${config.alterado_por}`}
              </Text>
            )}

            <Alert
              message="Atenção"
              description="Esta configuração afeta diretamente o formulário de agendamentos no quiz-cesca."
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
            />

            <Button
              type="primary"
              danger={config?.agendamentos_ativos}
              icon={<PoweroffOutlined />}
              onClick={handleToggle}
              disabled={saving}
              loading={saving}
              size={isMobile ? 'middle' : 'large'}
              style={{ width: '100%' }}
            >
              {config?.agendamentos_ativos
                ? 'Desativar Agendamentos'
                : 'Ativar Agendamentos'}
            </Button>
          </Card>
        </Col>

        {/* Restrição de Dias da Semana */}
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #f0f0f0', height: '100%' }}
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <CalendarOutlined style={{ fontSize: 20, color: '#667eea' }} />
                  <Text strong style={{ fontSize: isMobile ? 15 : 16 }}>Restrição de Dias</Text>
                </Space>
                <Tag
                  icon={config?.ignorar_restricao_dias ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  color={config?.ignorar_restricao_dias ? 'success' : 'default'}
                >
                  {config?.ignorar_restricao_dias ? 'LIBERADO' : 'RESTRITO'}
                </Tag>
              </Space>
            }
          >
            <Paragraph style={{ fontSize: isMobile ? 13 : 14, marginBottom: 24 }}>
              {config?.ignorar_restricao_dias
                ? 'Agendamentos permitidos em TODOS os dias da semana.'
                : 'Agendamentos permitidos apenas às Quartas-feiras e Sábados (padrão).'}
            </Paragraph>

            <Button
              type="primary"
              danger={config?.ignorar_restricao_dias}
              icon={<CalendarOutlined />}
              onClick={() => handleToggleRestriction('ignorar_restricao_dias')}
              disabled={saving}
              loading={saving}
              size={isMobile ? 'middle' : 'large'}
              style={{ width: '100%' }}
            >
              {config?.ignorar_restricao_dias
                ? 'Restringir para Qua/Sáb'
                : 'Liberar Todos os Dias'}
            </Button>
          </Card>
        </Col>

        {/* Restrição de Horário */}
        <Col xs={24} lg={12}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #f0f0f0', height: '100%' }}
            title={
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space>
                  <ClockCircleOutlined style={{ fontSize: 20, color: '#667eea' }} />
                  <Text strong style={{ fontSize: isMobile ? 15 : 16 }}>Restrição de Horário</Text>
                </Space>
                <Tag
                  icon={config?.ignorar_restricao_horario ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                  color={config?.ignorar_restricao_horario ? 'success' : 'default'}
                >
                  {config?.ignorar_restricao_horario ? 'LIBERADO' : 'RESTRITO'}
                </Tag>
              </Space>
            }
          >
            <Paragraph style={{ fontSize: isMobile ? 13 : 14, marginBottom: 24 }}>
              {config?.ignorar_restricao_horario
                ? 'Agendamentos permitidos em QUALQUER horário do dia.'
                : 'Agendamentos permitidos apenas após 7h da manhã (padrão).'}
            </Paragraph>

            <Button
              type="primary"
              danger={config?.ignorar_restricao_horario}
              icon={<ClockCircleOutlined />}
              onClick={() => handleToggleRestriction('ignorar_restricao_horario')}
              disabled={saving}
              loading={saving}
              size={isMobile ? 'middle' : 'large'}
              style={{ width: '100%' }}
            >
              {config?.ignorar_restricao_horario
                ? 'Restringir após 7h'
                : 'Liberar Qualquer Horário'}
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Configuracoes;
