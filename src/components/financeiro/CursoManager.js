import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  BookOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons';
import {
  Card,
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
  Divider,
  Checkbox,
  InputNumber
} from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

function CursoManager({ userProfile }) {
  // Estados principais
  const [cursos, setCursos] = useState([]);
  const [filteredCursos, setFilteredCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterAtivo, setFilterAtivo] = useState('all');

  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // create | edit
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);

  // Estados do modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cursoToDelete, setCursoToDelete] = useState(null);

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar cursos ao montar componente
  useEffect(() => {
    loadCursos();
  }, []);

  // Filtrar cursos quando searchTerm, filters ou cursos mudarem
  useEffect(() => {
    filterCursos();
  }, [searchTerm, filterTipo, filterAtivo, cursos]);

  // Função para carregar cursos do banco
  const loadCursos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setCursos(data || []);
    } catch (error) {
      console.error('Erro ao carregar cursos:', error);
      message.error('Erro ao carregar cursos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Função para filtrar cursos
  const filterCursos = () => {
    let filtered = [...cursos];

    // Filtro de busca (nome, descrição)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(curso =>
        curso.nome?.toLowerCase().includes(term) ||
        curso.descricao?.toLowerCase().includes(term)
      );
    }

    // Filtro de tipo
    if (filterTipo !== 'all') {
      filtered = filtered.filter(curso => curso.tipo === filterTipo);
    }

    // Filtro de ativo
    if (filterAtivo !== 'all') {
      const isAtivo = filterAtivo === 'true';
      filtered = filtered.filter(curso => curso.ativo === isAtivo);
    }

    setFilteredCursos(filtered);
  };

  // Abrir modal para criar novo curso
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      tipo: 'regular',
      dia_vencimento: 10,
      ativo: true
    });
    setShowModal(true);
  };

  // Abrir modal para editar curso
  const openEditModal = (curso) => {
    setModalMode('edit');
    setEditingId(curso.id);
    form.setFieldsValue({
      nome: curso.nome || '',
      descricao: curso.descricao || '',
      tipo: curso.tipo || 'regular',
      valor_mensalidade: curso.valor_mensalidade || '',
      dia_vencimento: curso.dia_vencimento || 10,
      duracao_meses: curso.duracao_meses || '',
      ativo: curso.ativo !== false
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
        nome: values.nome.trim(),
        descricao: values.descricao?.trim() || null,
        tipo: values.tipo,
        valor_mensalidade: parseFloat(values.valor_mensalidade),
        dia_vencimento: parseInt(values.dia_vencimento),
        duracao_meses: values.tipo === 'avulso' ? parseInt(values.duracao_meses) : null,
        ativo: values.ativo
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('cursos')
          .insert([dataToSave]);

        if (error) throw error;
        message.success('Curso cadastrado com sucesso!');
      } else {
        const { error } = await supabase
          .from('cursos')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        message.success('Curso atualizado com sucesso!');
      }

      closeModal();
      loadCursos();
    } catch (error) {
      console.error('Erro ao salvar curso:', error);
      if (error.code === '23505') {
        message.error('Já existe um curso com este nome');
      } else if (error.code === '23514') {
        message.error('Erro de validação: verifique os campos');
      } else {
        message.error('Erro ao salvar curso: ' + error.message);
      }
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleDelete = (curso) => {
    console.log('handleDelete chamado para:', curso);
    setCursoToDelete(curso);
    setShowDeleteModal(true);
  };

  // Confirmar e executar exclusão
  const confirmDelete = async () => {
    if (!cursoToDelete) return;

    try {
      console.log('Tentando excluir curso ID:', cursoToDelete.id);
      const { error } = await supabase
        .from('cursos')
        .delete()
        .eq('id', cursoToDelete.id);

      if (error) throw error;

      message.success('Curso excluído com sucesso!');
      setShowDeleteModal(false);
      setCursoToDelete(null);
      loadCursos();
    } catch (error) {
      console.error('Erro ao excluir curso:', error);
      if (error.code === '23503') {
        message.error('Não é possível excluir este curso pois existem matrículas vinculadas');
      } else {
        message.error('Erro ao excluir curso: ' + error.message);
      }
    }
  };

  // Cancelar exclusão
  const cancelDelete = () => {
    console.log('Exclusão cancelada');
    setShowDeleteModal(false);
    setCursoToDelete(null);
  };

  // Formatar valor monetário
  const formatMoeda = (valor) => {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          Carregando cursos...
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
            <BookOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Gerenciar Cursos
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Cursos regulares e avulsos disponíveis
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
            Novo Curso
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filtros */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: isMobile ? '100%' : 300 }}
            size="large"
            allowClear
          />

          <Select
            placeholder="Tipo"
            value={filterTipo}
            onChange={setFilterTipo}
            style={{ width: isMobile ? '100%' : 160 }}
            size="large"
          >
            <Select.Option value="all">Todos os tipos</Select.Option>
            <Select.Option value="regular">Regular</Select.Option>
            <Select.Option value="avulso">Avulso</Select.Option>
          </Select>

          <Select
            placeholder="Status"
            value={filterAtivo}
            onChange={setFilterAtivo}
            style={{ width: isMobile ? '100%' : 140 }}
            size="large"
          >
            <Select.Option value="all">Todos</Select.Option>
            <Select.Option value="true">Ativos</Select.Option>
            <Select.Option value="false">Inativos</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Total"
              value={cursos.length}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Regulares"
              value={cursos.filter(c => c.tipo === 'regular').length}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Avulsos"
              value={cursos.filter(c => c.tipo === 'avulso').length}
              valueStyle={{ color: '#8b5cf6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Ativos"
              value={cursos.filter(c => c.ativo).length}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Cards de Cursos */}
      {filteredCursos.length === 0 ? (
        <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0', textAlign: 'center', padding: '60px 20px' }}>
          <BookOutlined style={{ fontSize: 64, color: '#d1d5db' }} />
          <Title level={4} type="secondary">Nenhum curso encontrado</Title>
          {searchTerm && (
            <Button type="link" onClick={() => setSearchTerm('')}>
              Limpar filtros
            </Button>
          )}
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredCursos.map((curso) => (
            <Col xs={24} sm={12} lg={8} key={curso.id}>
              <Card
                style={{
                  borderRadius: 16,
                  border: curso.ativo ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                  opacity: curso.ativo ? 1 : 0.7
                }}
                bodyStyle={{ padding: 20 }}
              >
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                      {curso.nome}
                    </Title>
                    <Space size={4}>
                      <Tag color={curso.tipo === 'regular' ? 'blue' : 'purple'}>
                        {curso.tipo === 'regular' ? 'Regular' : 'Avulso'}
                      </Tag>
                      {!curso.ativo && (
                        <Tag color="default">Inativo</Tag>
                      )}
                    </Space>
                  </div>
                  <Space size="small">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => openEditModal(curso)}
                      title="Editar"
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDelete(curso)}
                      title="Excluir"
                    />
                  </Space>
                </div>

                {curso.descricao && (
                  <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 14 }}>
                    {curso.descricao}
                  </Text>
                )}

                <Divider style={{ margin: '12px 0' }} />

                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Mensalidade</Text>
                    <div>
                      <Text strong style={{ fontSize: 18, color: '#10b981' }}>
                        {formatMoeda(curso.valor_mensalidade)}
                      </Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Vencimento</Text>
                    <div>
                      <Text strong>Dia {curso.dia_vencimento}</Text>
                    </div>
                  </Col>
                  {curso.tipo === 'avulso' && (
                    <Col span={24}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Duração</Text>
                      <div>
                        <Text strong>
                          {curso.duracao_meses} {curso.duracao_meses === 1 ? 'mês' : 'meses'}
                        </Text>
                      </div>
                    </Col>
                  )}
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal de Criar/Editar */}
      <Modal
        title={modalMode === 'create' ? 'Novo Curso' : 'Editar Curso'}
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
            name="nome"
            label="Nome do Curso"
            rules={[{ required: true, message: 'Nome do curso é obrigatório' }]}
          >
            <Input size="large" placeholder="Ex: Curso de Umbanda Básico" />
          </Form.Item>

          <Form.Item
            name="descricao"
            label="Descrição"
          >
            <TextArea
              rows={3}
              placeholder="Descrição do curso (opcional)"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="tipo"
                label="Tipo de Curso"
                rules={[{ required: true }]}
              >
                <Select size="large">
                  <Select.Option value="regular">Regular (Recorrente)</Select.Option>
                  <Select.Option value="avulso">Avulso (Duração Fixa)</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.tipo !== curr.tipo}>
                {({ getFieldValue }) => (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -16 }}>
                    {getFieldValue('tipo') === 'regular'
                      ? 'Gera mensalidades automaticamente todos os meses'
                      : 'Duração fixa, não gera mensalidades após o período'
                    }
                  </Text>
                )}
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.tipo !== curr.tipo}>
                {({ getFieldValue }) =>
                  getFieldValue('tipo') === 'avulso' ? (
                    <Form.Item
                      name="duracao_meses"
                      label="Duração (meses)"
                      rules={[
                        { required: true, message: 'Duração é obrigatória para cursos avulsos' },
                        {
                          validator: (_, value) => {
                            if (!value || value < 1) {
                              return Promise.reject('Duração deve ser de pelo menos 1 mês');
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <InputNumber
                        size="large"
                        min={1}
                        placeholder="Ex: 3"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="valor_mensalidade"
                label="Valor da Mensalidade"
                rules={[
                  { required: true, message: 'Valor da mensalidade é obrigatório' },
                  {
                    validator: (_, value) => {
                      if (!value || parseFloat(value) <= 0) {
                        return Promise.reject('Valor deve ser maior que zero');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber
                  size="large"
                  min={0}
                  step={0.01}
                  placeholder="Ex: 80.00"
                  style={{ width: '100%' }}
                  prefix="R$"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="dia_vencimento"
                label="Dia de Vencimento"
                rules={[
                  { required: true, message: 'Dia de vencimento é obrigatório' },
                  {
                    validator: (_, value) => {
                      const dia = parseInt(value);
                      if (!dia || dia < 1 || dia > 31) {
                        return Promise.reject('Dia deve estar entre 1 e 31');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber
                  size="large"
                  min={1}
                  max={31}
                  placeholder="1 a 31"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="ativo"
            valuePropName="checked"
          >
            <Checkbox>Curso ativo (aceita novas matrículas)</Checkbox>
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

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        title="Excluir Curso"
        open={showDeleteModal}
        onOk={confirmDelete}
        onCancel={cancelDelete}
        okText="Excluir"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
        centered
      >
        <p>
          Tem certeza que deseja excluir o curso <strong>"{cursoToDelete?.nome}"</strong>?
        </p>
        <p style={{ marginTop: 16, color: '#666' }}>
          Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

export default CursoManager;
