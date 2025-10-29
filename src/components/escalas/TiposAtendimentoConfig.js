import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  InputNumber,
  Input,
  Space,
  Typography,
  Modal,
  message,
  Row,
  Col,
  Empty,
  Spin,
  Switch,
  Tag,
  Checkbox,
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const TiposAtendimentoConfig = () => {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    qtd_pessoas_necessarias: 1,
    dias_funcionamento: [],
    ativo: true
  });

  const diasSemana = [
    { value: 'segunda', label: 'Segunda-feira' },
    { value: 'terca', label: 'Terça-feira' },
    { value: 'quarta', label: 'Quarta-feira' },
    { value: 'quinta', label: 'Quinta-feira' },
    { value: 'sexta', label: 'Sexta-feira' },
    { value: 'sabado', label: 'Sábado' },
    { value: 'domingo', label: 'Domingo' }
  ];

  // Carregar tipos de atendimento
  const fetchTipos = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .order('nome');

      if (error) throw error;

      setTipos(data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos de atendimento:', error);
      message.error('Erro ao carregar tipos de atendimento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTipos();
  }, [fetchTipos]);

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.nome?.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (!formData.qtd_pessoas_necessarias || formData.qtd_pessoas_necessarias < 1) {
      errors.qtd_pessoas_necessarias = 'Quantidade deve ser no mínimo 1';
    }

    if (formData.dias_funcionamento.length === 0) {
      errors.dias_funcionamento = 'Selecione pelo menos um dia';
    }

    return errors;
  };

  // Criar/Editar tipo
  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => message.error(error));
      return;
    }

    try {
      const dataToSave = {
        nome: formData.nome.trim(),
        qtd_pessoas_necessarias: parseInt(formData.qtd_pessoas_necessarias),
        dias_funcionamento: formData.dias_funcionamento,
        ativo: formData.ativo
      };

      if (editingTipo) {
        const { error } = await supabase
          .from('tipos_atendimento')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingTipo.id);

        if (error) throw error;
        message.success('Tipo de atendimento atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('tipos_atendimento')
          .insert(dataToSave);

        if (error) throw error;
        message.success('Tipo de atendimento cadastrado com sucesso!');
      }

      setShowModal(false);
      setEditingTipo(null);
      setFormData({
        nome: '',
        qtd_pessoas_necessarias: 1,
        dias_funcionamento: [],
        ativo: true
      });
      fetchTipos();
    } catch (error) {
      console.error('Erro ao salvar tipo de atendimento:', error);
      if (error.code === '23505') {
        message.error('Já existe um tipo de atendimento com este nome');
      } else {
        message.error('Erro ao salvar tipo de atendimento');
      }
    }
  };

  // Deletar tipo
  const handleDelete = async (tipo) => {
    Modal.confirm({
      title: 'Confirmar Exclusão',
      content: `Deseja realmente excluir o tipo "${tipo.nome}"? Atenção: Isso pode afetar escalas existentes.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('tipos_atendimento')
            .delete()
            .eq('id', tipo.id);

          if (error) throw error;

          message.success('Tipo de atendimento excluído com sucesso!');
          fetchTipos();
        } catch (error) {
          console.error('Erro ao excluir tipo de atendimento:', error);
          if (error.code === '23503') {
            message.error('Não é possível excluir: existem capacitações ou escalas vinculadas a este tipo');
          } else {
            message.error('Erro ao excluir tipo de atendimento');
          }
        }
      }
    });
  };

  // Alternar status ativo/inativo
  const toggleAtivo = async (tipo) => {
    try {
      const { error } = await supabase
        .from('tipos_atendimento')
        .update({
          ativo: !tipo.ativo,
          updated_at: new Date().toISOString()
        })
        .eq('id', tipo.id);

      if (error) throw error;

      message.success(`Tipo ${!tipo.ativo ? 'ativado' : 'desativado'} com sucesso!`);
      fetchTipos();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      message.error('Erro ao alterar status');
    }
  };

  // Abrir modal de edição
  const handleEdit = (tipo) => {
    setEditingTipo(tipo);
    setFormData({
      nome: tipo.nome,
      qtd_pessoas_necessarias: tipo.qtd_pessoas_necessarias,
      dias_funcionamento: tipo.dias_funcionamento || [],
      ativo: tipo.ativo
    });
    setShowModal(true);
  };

  // Formatar dias de funcionamento para exibição
  const formatDias = (dias) => {
    if (!dias || dias.length === 0) return 'Nenhum dia configurado';

    const diasFormatados = dias.map(d => {
      const dia = diasSemana.find(ds => ds.value === d);
      return dia ? dia.label.substring(0, 3) : d;
    });

    return diasFormatados.join(', ');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <SettingOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Tipos de Atendimento
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Configure os tipos de atendimento e suas características
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingTipo(null);
              setFormData({
                nome: '',
                qtd_pessoas_necessarias: 1,
                dias_funcionamento: [],
                ativo: true
              });
              setShowModal(true);
            }}
            size="large"
          >
            Novo Tipo
          </Button>
        </Space>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            Carregando tipos de atendimento...
          </Text>
        </div>
      ) : tipos.length === 0 ? (
        <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">Nenhum tipo de atendimento cadastrado</Text>
                <Button type="link" onClick={() => setShowModal(true)}>
                  Cadastrar primeiro tipo
                </Button>
              </Space>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {tipos.map((tipo) => (
            <Col key={tipo.id} xs={24} sm={12} lg={8}>
              <Card
                style={{
                  borderRadius: 12,
                  border: '1px solid #f0f0f0',
                  opacity: tipo.ativo ? 1 : 0.6
                }}
                title={
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: 16 }}>{tipo.nome}</Text>
                    <Tag
                      color={tipo.ativo ? 'success' : 'default'}
                      icon={tipo.ativo ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    >
                      {tipo.ativo ? 'Ativo' : 'Inativo'}
                    </Tag>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(tipo)}
                      title="Editar"
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(tipo)}
                      title="Excluir"
                    />
                  </Space>
                }
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Space>
                      <UserOutlined style={{ color: '#3b82f6' }} />
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Pessoas Necessárias
                        </Text>
                        <Text strong style={{ fontSize: 16 }}>{tipo.qtd_pessoas_necessarias}</Text>
                      </div>
                    </Space>
                  </div>

                  <div>
                    <Space align="start">
                      <CalendarOutlined style={{ color: '#3b82f6', marginTop: 4 }} />
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Dias de Funcionamento
                        </Text>
                        <Text style={{ fontSize: 13 }}>{formatDias(tipo.dias_funcionamento)}</Text>
                      </div>
                    </Space>
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    <Button
                      onClick={() => toggleAtivo(tipo)}
                      icon={tipo.ativo ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                      style={{ width: '100%' }}
                    >
                      {tipo.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal de Cadastro/Edição */}
      <Modal
        title={editingTipo ? 'Editar Tipo de Atendimento' : 'Novo Tipo de Atendimento'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSubmit}
        okText={<><SaveOutlined /> {editingTipo ? 'Atualizar' : 'Cadastrar'}</>}
        cancelText="Cancelar"
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Nome do Tipo: *
            </Text>
            <Input
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Baralho, Passe, Corrente..."
              size="large"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Nome único para identificar este tipo de atendimento
            </Text>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Quantidade de Pessoas Necessárias: *
            </Text>
            <InputNumber
              min={1}
              max={50}
              value={formData.qtd_pessoas_necessarias}
              onChange={(value) => setFormData({ ...formData, qtd_pessoas_necessarias: value })}
              style={{ width: '100%' }}
              size="large"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Quantas pessoas são necessárias para este atendimento
            </Text>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Dias de Funcionamento: *
            </Text>
            <Checkbox.Group
              value={formData.dias_funcionamento}
              onChange={(checkedValues) => setFormData({ ...formData, dias_funcionamento: checkedValues })}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {diasSemana.map(dia => (
                  <Checkbox key={dia.value} value={dia.value}>
                    {dia.label}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Selecione os dias em que este atendimento acontece
            </Text>
          </div>

          <div>
            <Space>
              <Switch
                checked={formData.ativo}
                onChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Text strong>Tipo ativo</Text>
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Tipos inativos não aparecerão na geração de escalas
            </Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default TiposAtendimentoConfig;
