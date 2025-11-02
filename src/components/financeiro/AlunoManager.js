import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useDebounce } from '../../hooks/useDebounce';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Form,
  Modal,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
  Spin,
  Divider
} from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

function AlunoManager({ userProfile }) {
  // Estados principais
  const [alunos, setAlunos] = useState([]);
  const [filteredAlunos, setFilteredAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Debounce search term para melhorar performance
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create | edit
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar alunos ao montar componente
  useEffect(() => {
    loadAlunos();
  }, []);

  // Filtrar alunos quando debouncedSearchTerm, filterStatus ou alunos mudarem
  useEffect(() => {
    filterAlunos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filterStatus, alunos]);

  // Função para carregar alunos do banco
  const loadAlunos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alunos')
        .select('*')
        .order('nome_completo', { ascending: true });

      if (error) throw error;
      setAlunos(data || []);
    } catch (error) {
      console.error('Erro ao carregar alunos:', error);
      message.error('Erro ao carregar alunos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para filtrar alunos
  const filterAlunos = () => {
    let filtered = [...alunos];

    // Filtro de busca (nome, CPF, telefone, email)
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(aluno =>
        aluno.nome_completo?.toLowerCase().includes(term) ||
        aluno.cpf?.toLowerCase().includes(term) ||
        aluno.telefone?.includes(term) ||
        aluno.email?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(aluno => aluno.status === filterStatus);
    }

    setFilteredAlunos(filtered);
  };

  // Abrir modal para criar novo aluno
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ativo' });
    setShowModal(true);
  };

  // Abrir modal para editar aluno
  const openEditModal = (aluno) => {
    setModalMode('edit');
    setEditingId(aluno.id);
    form.setFieldsValue({
      nome_completo: aluno.nome_completo || '',
      cpf: aluno.cpf || '',
      telefone: aluno.telefone || '',
      email: aluno.email || '',
      data_nascimento: aluno.data_nascimento || '',
      endereco: aluno.endereco || '',
      status: aluno.status || 'ativo',
      observacoes: aluno.observacoes || ''
    });
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    form.resetFields();
    setEditingId(null);
  };

  // Submeter formulário (criar ou editar)
  const handleSubmit = async (values) => {
    try {
      const dataToSave = {
        nome_completo: values.nome_completo.trim(),
        cpf: values.cpf?.trim() || null,
        telefone: values.telefone?.trim() || null,
        email: values.email?.trim() || null,
        data_nascimento: values.data_nascimento || null,
        endereco: values.endereco?.trim() || null,
        status: values.status,
        observacoes: values.observacoes?.trim() || null
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('alunos')
          .insert([dataToSave]);

        if (error) throw error;
        message.success('Aluno cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('alunos')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        message.success('Aluno atualizado com sucesso!');
      }

      closeModal();
      loadAlunos();
    } catch (error) {
      console.error('Erro ao salvar aluno:', error);
      if (error.code === '23505') {
        message.error('CPF já cadastrado no sistema');
      } else {
        message.error('Erro ao salvar aluno: ' + error.message);
      }
    }
  };

  // Confirmar exclusão
  const handleDelete = async (aluno) => {
    Modal.confirm({
      title: 'Excluir Aluno',
      content: `Tem certeza que deseja excluir o aluno "${aluno.nome_completo}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('alunos')
            .delete()
            .eq('id', aluno.id);

          if (error) throw error;

          message.success('Aluno excluído com sucesso!');
          loadAlunos();
        } catch (error) {
          console.error('Erro ao excluir aluno:', error);
          if (error.code === '23503') {
            message.error('Não é possível excluir este aluno pois existem matrículas vinculadas');
          } else {
            message.error('Erro ao excluir aluno: ' + error.message);
          }
        }
      }
    });
  };

  // Formatar CPF para exibição
  const formatCPF = (cpf) => {
    if (!cpf) return '-';
    const numeros = cpf.replace(/\D/g, '');
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Formatar telefone para exibição
  const formatTelefone = (tel) => {
    if (!tel) return '-';
    const numeros = tel.replace(/\D/g, '');
    if (numeros.length === 11) {
      return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  };

  // Formatar data para exibição
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Nome Completo',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.observacoes && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.observacoes.substring(0, 30)}
                {record.observacoes.length > 30 ? '...' : ''}
              </Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'CPF',
      dataIndex: 'cpf',
      key: 'cpf',
      render: (text) => formatCPF(text)
    },
    {
      title: 'Telefone',
      dataIndex: 'telefone',
      key: 'telefone',
      render: (text) => formatTelefone(text)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text) => text || '-'
    },
    {
      title: 'Nascimento',
      dataIndex: 'data_nascimento',
      key: 'data_nascimento',
      render: (text) => formatDate(text)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          ativo: 'green',
          inativo: 'red',
          trancado: 'orange'
        };
        return <Tag color={colors[status]}>{status}</Tag>;
      }
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            title="Editar"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            title="Excluir"
          />
        </Space>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          Carregando alunos...
        </Text>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <UserOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Gerenciar Alunos
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Cadastro de alunos dos cursos
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ borderRadius: 8 }}
          >
            Novo Aluno
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filtros */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por nome, CPF, telefone ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: isMobile ? '100%' : 350 }}
            size="large"
            allowClear
          />

          <Select
            placeholder="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: isMobile ? '100%' : 200 }}
            size="large"
          >
            <Select.Option value="all">Todos os status</Select.Option>
            <Select.Option value="ativo">Ativo</Select.Option>
            <Select.Option value="inativo">Inativo</Select.Option>
            <Select.Option value="trancado">Trancado</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Total"
              value={alunos.length}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Ativos"
              value={alunos.filter(a => a.status === 'ativo').length}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Inativos"
              value={alunos.filter(a => a.status === 'inativo').length}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Trancados"
              value={alunos.filter(a => a.status === 'trancado').length}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabela de Alunos */}
      <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0' }}>
        {filteredAlunos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <UserOutlined style={{ fontSize: 64, color: '#d1d5db' }} />
            <Title level={4} type="secondary">Nenhum aluno encontrado</Title>
            {searchTerm && (
              <Button type="link" onClick={() => setSearchTerm('')}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredAlunos}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total de ${total} alunos`
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* Modal de Criar/Editar */}
      <Modal
        title={modalMode === 'create' ? 'Novo Aluno' : 'Editar Aluno'}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={700}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="nome_completo"
            label="Nome Completo"
            rules={[{ required: true, message: 'Nome completo é obrigatório' }]}
          >
            <Input size="large" placeholder="Nome completo do aluno" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="cpf"
                label="CPF"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      const cpfNumeros = value.replace(/\D/g, '');
                      if (cpfNumeros.length !== 11) {
                        return Promise.reject('CPF deve ter 11 dígitos');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input size="large" placeholder="000.000.000-00" maxLength={14} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="data_nascimento"
                label="Data de Nascimento"
              >
                <Input type="date" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="telefone"
                label="Telefone"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      const telefoneNumeros = value.replace(/\D/g, '');
                      if (telefoneNumeros.length < 10) {
                        return Promise.reject('Telefone deve ter pelo menos 10 dígitos');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input size="large" placeholder="(00) 00000-0000" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  {
                    type: 'email',
                    message: 'Email inválido'
                  }
                ]}
              >
                <Input size="large" placeholder="email@exemplo.com" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="endereco"
            label="Endereço"
          >
            <Input size="large" placeholder="Rua, número, bairro, cidade" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true }]}
          >
            <Select size="large">
              <Select.Option value="ativo">Ativo</Select.Option>
              <Select.Option value="inativo">Inativo</Select.Option>
              <Select.Option value="trancado">Trancado</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="observacoes"
            label="Observações"
          >
            <TextArea
              rows={3}
              placeholder="Informações adicionais sobre o aluno"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={closeModal} size="large">
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" size="large">
                {modalMode === 'create' ? 'Cadastrar' : 'Salvar Alterações'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AlunoManager;
