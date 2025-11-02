import React, { useState, useEffect } from 'react';
import logger from '../utils/logger';
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  Card,
  Spin,
  Empty,
  message,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  FileTextOutlined,
  NumberOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';
import './TrabalhadorManager.css';

const { TextArea } = Input;
const { Option } = Select;

function TrabalhadorManager() {
  const [form] = Form.useForm();
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [filteredTrabalhadores, setFilteredTrabalhadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGrupo, setFilterGrupo] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadTrabalhadores();
  }, []);

  useEffect(() => {
    filterTrabalhadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterStatus, filterGrupo, trabalhadores]);

  const loadTrabalhadores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trabalhadores')
        .select('*')
        .order('numero', { ascending: true, nullsFirst: false })
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setTrabalhadores(data || []);
    } catch (error) {
      logger.error('Erro ao carregar trabalhadores:', error);
      message.error('Erro ao carregar trabalhadores: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterTrabalhadores = () => {
    let filtered = [...trabalhadores];

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.telefone?.includes(searchTerm) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.numero?.toString().includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    if (filterGrupo !== 'all') {
      filtered = filtered.filter(t => t.grupo === filterGrupo);
    }

    setFilteredTrabalhadores(filtered);
  };

  const openCreateModal = () => {
    setModalMode('create');
    form.resetFields();
    setSelectedTrabalhador(null);
    setShowModal(true);
  };

  const openEditModal = (trabalhador) => {
    setModalMode('edit');
    form.setFieldsValue({
      numero: trabalhador.numero || '',
      nome_completo: trabalhador.nome_completo || '',
      grupo: trabalhador.grupo || '',
      funcao_permanente: trabalhador.funcao_permanente || '',
      telefone: trabalhador.telefone || '',
      email: trabalhador.email || '',
      observacoes: trabalhador.observacoes || ''
    });
    setSelectedTrabalhador(trabalhador);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    form.resetFields();
    setSelectedTrabalhador(null);
  };

  const handleSubmit = async (values) => {
    setModalLoading(true);

    try {
      const data = {
        numero: values.numero ? parseInt(values.numero) : null,
        nome_completo: values.nome_completo.trim(),
        grupo: values.grupo || null,
        funcao_permanente: values.funcao_permanente?.trim() || null,
        telefone: values.telefone?.trim() || null,
        email: values.email?.trim() || null,
        observacoes: values.observacoes?.trim() || null
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('trabalhadores')
          .insert([{ ...data, status: 'ativo' }]);

        if (error) throw error;
        message.success('Trabalhador cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('trabalhadores')
          .update(data)
          .eq('id', selectedTrabalhador.id);

        if (error) throw error;
        message.success('Trabalhador atualizado com sucesso!');
      }

      closeModal();
      loadTrabalhadores();
    } catch (error) {
      logger.error('Erro ao salvar trabalhador:', error);
      message.error('Erro ao salvar trabalhador: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangeStatus = async (trabalhador, novoStatus) => {
    try {
      const { error } = await supabase
        .from('trabalhadores')
        .update({ status: novoStatus })
        .eq('id', trabalhador.id);

      if (error) throw error;

      const statusLabel = novoStatus === 'ativo' ? 'ativado' : novoStatus === 'inativo' ? 'inativado' : 'afastado';
      message.success(`Trabalhador ${statusLabel} com sucesso!`);
      loadTrabalhadores();
    } catch (error) {
      logger.error('Erro ao alterar status:', error);
      message.error('Erro ao alterar status: ' + error.message);
    }
  };

  const handleDelete = (trabalhador) => {
    Modal.confirm({
      title: 'Excluir trabalhador',
      content: `Tem certeza que deseja excluir ${trabalhador.nome_completo}? Esta ação não pode ser desfeita e removerá todos os registros de presença associados.`,
      okText: 'Sim, excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('trabalhadores')
            .delete()
            .eq('id', trabalhador.id);

          if (error) throw error;
          message.success('Trabalhador excluído com sucesso!');
          loadTrabalhadores();
        } catch (error) {
          logger.error('Erro ao excluir:', error);
          message.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      ativo: { color: 'green', text: 'Ativo' },
      inativo: { color: 'red', text: 'Inativo' },
      afastado: { color: 'orange', text: 'Afastado' }
    };
    const config = statusConfig[status] || statusConfig.ativo;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'Nº',
      dataIndex: 'numero',
      key: 'numero',
      width: 70,
      render: (numero) => numero || '-',
      sorter: (a, b) => (a.numero || 0) - (b.numero || 0),
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      render: (nome, record) => (
        <Space>
          <strong>{nome}</strong>
          {record.observacoes && (
            <Tooltip title={record.observacoes}>
              <FileTextOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          )}
        </Space>
      ),
      sorter: (a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''),
    },
    {
      title: 'Grupo',
      dataIndex: 'grupo',
      key: 'grupo',
      render: (grupo) => grupo || '-',
      filters: [
        { text: 'Direção', value: 'Direção' },
        { text: 'Médiuns Correntes', value: 'Médiuns Correntes' },
      ],
      onFilter: (value, record) => record.grupo === value,
    },
    {
      title: 'Função',
      dataIndex: 'funcao_permanente',
      key: 'funcao_permanente',
      render: (funcao) => funcao || '-',
    },
    {
      title: 'Telefone',
      dataIndex: 'telefone',
      key: 'telefone',
      render: (telefone) => telefone || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Select
          value={status}
          style={{ width: 110 }}
          size="small"
          bordered={false}
          onChange={(value) => handleChangeStatus(record, value)}
        >
          <Option value="ativo">
            <Tag color="green">Ativo</Tag>
          </Option>
          <Option value="afastado">
            <Tag color="orange">Afastado</Tag>
          </Option>
          <Option value="inativo">
            <Tag color="red">Inativo</Tag>
          </Option>
        </Select>
      ),
      filters: [
        { text: 'Ativo', value: 'ativo' },
        { text: 'Afastado', value: 'afastado' },
        { text: 'Inativo', value: 'inativo' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            size="small"
          >
            Editar
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            size="small"
          >
            Excluir
          </Button>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const totalAtivos = trabalhadores.filter(t => t.status === 'ativo').length;
  const totalInativos = trabalhadores.filter(t => t.status === 'inativo').length;
  const totalAfastados = trabalhadores.filter(t => t.status === 'afastado').length;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Col>
          <h2 style={{ margin: 0 }}>Gerenciar Trabalhadores</h2>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            size="large"
          >
            Novo Trabalhador
          </Button>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total"
              value={trabalhadores.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Ativos"
              value={totalAtivos}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Afastados"
              value={totalAfastados}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Inativos"
              value={totalInativos}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="large"
              />
            </Col>
            <Col xs={12} md={6}>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: '100%' }}
                size="large"
              >
                <Option value="all">Todos os Status</Option>
                <Option value="ativo">Ativos</Option>
                <Option value="inativo">Inativos</Option>
                <Option value="afastado">Afastados</Option>
              </Select>
            </Col>
            <Col xs={12} md={6}>
              <Select
                value={filterGrupo}
                onChange={setFilterGrupo}
                style={{ width: '100%' }}
                size="large"
              >
                <Option value="all">Todos os Grupos</Option>
                <Option value="Direção">Direção</Option>
                <Option value="Médiuns Correntes">Médiuns Correntes</Option>
              </Select>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={filteredTrabalhadores}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            locale={{
              emptyText: <Empty description="Nenhum trabalhador encontrado" />
            }}
          />
        </Space>
      </Card>

      <Modal
        title={modalMode === 'create' ? 'Novo Trabalhador' : 'Editar Trabalhador'}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="nome_completo"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome completo é obrigatório' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Nome completo do trabalhador"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="numero"
                label="Número"
              >
                <Input
                  prefix={<NumberOutlined />}
                  type="number"
                  placeholder="Nº"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="grupo"
                label="Grupo"
              >
                <Select placeholder="Selecione...">
                  <Option value="">Nenhum</Option>
                  <Option value="Direção">Direção</Option>
                  <Option value="Médiuns Correntes">Médiuns Correntes</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="funcao_permanente"
            label="Função Permanente"
          >
            <Input placeholder="Ex: Curimba, Cambono, MT1..." />
          </Form.Item>

          <Form.Item
            name="telefone"
            label="Telefone"
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="(11) 99999-9999"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Email inválido' }]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="email@exemplo.com"
            />
          </Form.Item>

          <Form.Item
            name="observacoes"
            label="Observações"
          >
            <TextArea
              rows={3}
              placeholder="Observações sobre o trabalhador..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={modalLoading}>
                {modalMode === 'create' ? 'Cadastrar' : 'Salvar Alterações'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export default TrabalhadorManager;
