import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  Select,
  Space,
  Typography,
  Modal,
  message,
  Row,
  Col,
  List,
  Empty,
  Spin,
  Tag,
  Alert,
} from 'antd';
import {
  PushpinOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const FuncoesFixasConfig = () => {
  const [funcoesFixas, setFuncoesFixas] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    trabalhador_id: '',
    tipo_atendimento_id: ''
  });

  // Carregar dados
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar funções fixas com joins
      const { data: funcoesData, error: funcoesError } = await supabase
        .from('funcoes_fixas')
        .select(`
          *,
          trabalhador:trabalhadores(id, nome_completo),
          tipo_atendimento:tipos_atendimento(id, nome)
        `);

      if (funcoesError) throw funcoesError;

      // Carregar trabalhadores ativos
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (trabError) throw trabError;

      // Carregar tipos ativos
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tiposError) throw tiposError;

      setFuncoesFixas(funcoesData || []);
      setTrabalhadores(trabData || []);
      setTiposAtendimento(tiposData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.trabalhador_id) {
      errors.trabalhador = 'Selecione um trabalhador';
    }

    if (!formData.tipo_atendimento_id) {
      errors.tipo = 'Selecione um tipo de atendimento';
    }

    // Verificar se já existe
    const jaExiste = funcoesFixas.some(
      f => f.trabalhador_id === formData.trabalhador_id &&
           f.tipo_atendimento_id === formData.tipo_atendimento_id
    );

    if (jaExiste) {
      errors.duplicado = 'Esta função fixa já existe';
    }

    return errors;
  };

  // Adicionar função fixa
  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => message.error(error));
      return;
    }

    try {
      const { error } = await supabase
        .from('funcoes_fixas')
        .insert({
          trabalhador_id: formData.trabalhador_id,
          tipo_atendimento_id: formData.tipo_atendimento_id
        });

      if (error) throw error;

      message.success('Função fixa adicionada com sucesso!');
      setShowModal(false);
      setFormData({
        trabalhador_id: '',
        tipo_atendimento_id: ''
      });
      fetchData();
    } catch (error) {
      console.error('Erro ao adicionar função fixa:', error);
      if (error.code === '23505') {
        message.error('Esta função fixa já existe');
      } else {
        message.error('Erro ao adicionar função fixa');
      }
    }
  };

  // Deletar função fixa
  const handleDelete = async (funcao) => {
    Modal.confirm({
      title: 'Confirmar Remoção',
      content: `Remover função fixa de ${funcao.trabalhador?.nome_completo || funcao.trabalhador?.nome} no ${funcao.tipo_atendimento?.nome}?`,
      okText: 'Remover',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('funcoes_fixas')
            .delete()
            .eq('id', funcao.id);

          if (error) throw error;

          message.success('Função fixa removida com sucesso!');
          fetchData();
        } catch (error) {
          console.error('Erro ao remover função fixa:', error);
          message.error('Erro ao remover função fixa');
        }
      }
    });
  };

  // Agrupar por trabalhador
  const funcoesPorTrabalhador = funcoesFixas.reduce((acc, funcao) => {
    const trabId = funcao.trabalhador_id;
    if (!acc[trabId]) {
      acc[trabId] = {
        trabalhador: funcao.trabalhador,
        funcoes: []
      };
    }
    acc[trabId].funcoes.push(funcao);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <PushpinOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Funções Fixas
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Defina trabalhadores que sempre atuam em determinados tipos
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setFormData({
                trabalhador_id: '',
                tipo_atendimento_id: ''
              });
              setShowModal(true);
            }}
            size="large"
          >
            Nova Função Fixa
          </Button>
        </Space>
      </div>

      {/* Info Box */}
      <Alert
        message="Sobre Funções Fixas"
        description="Funções fixas garantem que determinados trabalhadores sempre sejam escalados para tipos específicos de atendimento. Exemplo: Fábia sempre atua no Baralho."
        type="info"
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 24, borderRadius: 12 }}
        showIcon
      />

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            Carregando funções fixas...
          </Text>
        </div>
      ) : funcoesFixas.length === 0 ? (
        <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">Nenhuma função fixa configurada</Text>
                <Button type="link" onClick={() => setShowModal(true)}>
                  Adicionar primeira função fixa
                </Button>
              </Space>
            }
          />
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {Object.values(funcoesPorTrabalhador).map(({ trabalhador, funcoes }) => (
            <Card
              key={trabalhador.id}
              style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
              title={
                <Space>
                  <UserOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
                  <Text strong style={{ fontSize: 16 }}>
                    {trabalhador.nome_completo || trabalhador.nome}
                  </Text>
                  <Tag color="blue">{funcoes.length} {funcoes.length === 1 ? 'função' : 'funções'}</Tag>
                </Space>
              }
            >
              <List
                dataSource={funcoes}
                renderItem={(funcao) => (
                  <List.Item
                    actions={[
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(funcao)}
                        title="Remover"
                      >
                        Remover
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<PushpinOutlined style={{ fontSize: 18, color: '#667eea' }} />}
                      title={<Text strong>{funcao.tipo_atendimento?.nome}</Text>}
                      description="Função fixa - sempre escalado para este tipo"
                    />
                  </List.Item>
                )}
              />
            </Card>
          ))}
        </Space>
      )}

      {/* Modal */}
      <Modal
        title="Nova Função Fixa"
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSubmit}
        okText="Adicionar"
        cancelText="Cancelar"
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="Selecione o trabalhador e o tipo de atendimento em que ele sempre deve atuar."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Trabalhador: *
            </Text>
            <Select
              value={formData.trabalhador_id || undefined}
              onChange={(value) => setFormData({ ...formData, trabalhador_id: value })}
              placeholder="Selecione um trabalhador"
              style={{ width: '100%' }}
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {trabalhadores.map(trab => (
                <Option key={trab.id} value={trab.id}>
                  <Space>
                    <UserOutlined />
                    {trab.nome_completo || trab.nome}
                  </Space>
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Tipo de Atendimento: *
            </Text>
            <Select
              value={formData.tipo_atendimento_id || undefined}
              onChange={(value) => setFormData({ ...formData, tipo_atendimento_id: value })}
              placeholder="Selecione um tipo"
              style={{ width: '100%' }}
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {tiposAtendimento.map(tipo => (
                <Option key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </Option>
              ))}
            </Select>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default FuncoesFixasConfig;
