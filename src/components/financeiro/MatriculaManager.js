import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  BookOutlined,
  CalendarOutlined
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
  Divider,
  DatePicker
} from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

function MatriculaManager({ userProfile }) {
  // Estados principais
  const [matriculas, setMatriculas] = useState([]);
  const [filteredMatriculas, setFilteredMatriculas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCurso, setFilterCurso] = useState('all');

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

  // Carregar dados ao montar componente
  useEffect(() => {
    loadData();
  }, []);

  // Filtrar matrículas quando filtros mudarem
  useEffect(() => {
    filterMatriculas();
  }, [searchTerm, filterStatus, filterCurso, matriculas]);

  // Função para carregar todos os dados
  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMatriculas(),
        loadAlunos(),
        loadCursos()
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Carregar matrículas com joins
  const loadMatriculas = async () => {
    const { data, error } = await supabase
      .from('matriculas')
      .select(`
        *,
        aluno:alunos(id, nome_completo, cpf, telefone, email),
        curso:cursos(id, nome, tipo, valor_mensalidade, dia_vencimento, duracao_meses)
      `)
      .order('data_matricula', { ascending: false });

    if (error) throw error;
    setMatriculas(data || []);
  };

  // Carregar alunos ativos
  const loadAlunos = async () => {
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('status', 'ativo')
      .order('nome_completo', { ascending: true });

    if (error) throw error;
    setAlunos(data || []);
  };

  // Carregar cursos ativos
  const loadCursos = async () => {
    const { data, error } = await supabase
      .from('cursos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    setCursos(data || []);
  };

  // Função para filtrar matrículas
  const filterMatriculas = () => {
    let filtered = [...matriculas];

    // Filtro de busca (nome aluno, nome curso)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(mat =>
        mat.aluno?.nome_completo?.toLowerCase().includes(term) ||
        mat.curso?.nome?.toLowerCase().includes(term)
      );
    }

    // Filtro de status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(mat => mat.status === filterStatus);
    }

    // Filtro de curso
    if (filterCurso !== 'all') {
      filtered = filtered.filter(mat => mat.curso_id === filterCurso);
    }

    setFilteredMatriculas(filtered);
  };

  // Abrir modal para criar nova matrícula
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      data_matricula: dayjs(),
      data_inicio: dayjs(),
      status: 'ativa'
    });
    setShowModal(true);
  };

  // Abrir modal para editar matrícula
  const openEditModal = (matricula) => {
    setModalMode('edit');
    setEditingId(matricula.id);
    form.setFieldsValue({
      aluno_id: matricula.aluno_id,
      curso_id: matricula.curso_id,
      data_matricula: matricula.data_matricula ? dayjs(matricula.data_matricula) : null,
      data_inicio: matricula.data_inicio ? dayjs(matricula.data_inicio) : null,
      data_fim: matricula.data_fim ? dayjs(matricula.data_fim) : null,
      dia_vencimento_personalizado: matricula.dia_vencimento_personalizado || '',
      status: matricula.status || 'ativa',
      observacoes: matricula.observacoes || ''
    });
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    form.resetFields();
    setEditingId(null);
  };

  // Atualizar data_fim quando curso mudar (para cursos avulsos)
  const handleCursoChange = (cursoId) => {
    const curso = cursos.find(c => c.id === cursoId);
    const dataInicio = form.getFieldValue('data_inicio');

    if (curso && curso.tipo === 'avulso' && curso.duracao_meses && dataInicio) {
      const dataFim = dayjs(dataInicio).add(curso.duracao_meses, 'month');
      form.setFieldsValue({ data_fim: dataFim });
    } else if (curso && curso.tipo === 'regular') {
      form.setFieldsValue({ data_fim: null });
    }
  };

  // Submeter formulário (criar ou editar)
  const handleSubmit = async (values) => {
    try {
      const dataToSave = {
        aluno_id: values.aluno_id,
        curso_id: values.curso_id,
        data_matricula: values.data_matricula.format('YYYY-MM-DD'),
        data_inicio: values.data_inicio.format('YYYY-MM-DD'),
        data_fim: values.data_fim ? values.data_fim.format('YYYY-MM-DD') : null,
        dia_vencimento_personalizado: values.dia_vencimento_personalizado || null,
        status: values.status,
        observacoes: values.observacoes?.trim() || null
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('matriculas')
          .insert([dataToSave]);

        if (error) throw error;
        message.success('Matrícula cadastrada com sucesso!');
      } else {
        const { error } = await supabase
          .from('matriculas')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
        message.success('Matrícula atualizada com sucesso!');
      }

      closeModal();
      loadMatriculas();
    } catch (error) {
      console.error('Erro ao salvar matrícula:', error);
      message.error('Erro ao salvar matrícula: ' + error.message);
    }
  };

  // Confirmar exclusão
  const handleDelete = async (matricula) => {
    Modal.confirm({
      title: 'Excluir Matrícula',
      content: `Tem certeza que deseja excluir a matrícula de "${matricula.aluno?.nome_completo}" no curso "${matricula.curso?.nome}"? Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('matriculas')
            .delete()
            .eq('id', matricula.id);

          if (error) throw error;

          message.success('Matrícula excluída com sucesso!');
          loadMatriculas();
        } catch (error) {
          console.error('Erro ao excluir matrícula:', error);
          if (error.code === '23503') {
            message.error('Não é possível excluir esta matrícula pois existem mensalidades vinculadas');
          } else {
            message.error('Erro ao excluir matrícula: ' + error.message);
          }
        }
      }
    });
  };

  // Formatar data para exibição
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  // Formatar valor monetário
  const formatMoeda = (valor) => {
    if (!valor && valor !== 0) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Aluno',
      dataIndex: 'aluno',
      key: 'aluno',
      render: (aluno, record) => (
        <div>
          <Text strong>{aluno?.nome_completo || 'N/A'}</Text>
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
      title: 'Curso',
      dataIndex: 'curso',
      key: 'curso',
      render: (curso, record) => (
        <div>
          <Text strong>{curso?.nome || 'N/A'}</Text>
          <div>
            <Tag color={curso?.tipo === 'regular' ? 'blue' : 'purple'}>
              {curso?.tipo === 'regular' ? 'Regular' : 'Avulso'}
            </Tag>
            {record.dia_vencimento_personalizado && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                Venc. dia {record.dia_vencimento_personalizado}
              </Text>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Mensalidade',
      key: 'mensalidade',
      render: (_, record) => (
        <Text strong style={{ color: '#10b981' }}>
          {formatMoeda(record.curso?.valor_mensalidade)}
        </Text>
      )
    },
    {
      title: 'Data Início',
      dataIndex: 'data_inicio',
      key: 'data_inicio',
      render: (text) => formatDate(text)
    },
    {
      title: 'Data Fim',
      dataIndex: 'data_fim',
      key: 'data_fim',
      render: (text) => formatDate(text)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          ativa: 'green',
          trancada: 'orange',
          cancelada: 'red',
          concluida: 'blue'
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
          Carregando matrículas...
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
                Gerenciar Matrículas
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Vincular alunos aos cursos
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
            Nova Matrícula
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filtros */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por aluno ou curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: isMobile ? '100%' : 350 }}
            size="large"
            allowClear
          />

          <Select
            placeholder="Curso"
            value={filterCurso}
            onChange={setFilterCurso}
            style={{ width: isMobile ? '100%' : 200 }}
            size="large"
          >
            <Select.Option value="all">Todos os cursos</Select.Option>
            {cursos.map(curso => (
              <Select.Option key={curso.id} value={curso.id}>{curso.nome}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: isMobile ? '100%' : 160 }}
            size="large"
          >
            <Select.Option value="all">Todos os status</Select.Option>
            <Select.Option value="ativa">Ativa</Select.Option>
            <Select.Option value="trancada">Trancada</Select.Option>
            <Select.Option value="cancelada">Cancelada</Select.Option>
            <Select.Option value="concluida">Concluída</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Total"
              value={matriculas.length}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Ativas"
              value={matriculas.filter(m => m.status === 'ativa').length}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Trancadas"
              value={matriculas.filter(m => m.status === 'trancada').length}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Statistic
              title="Concluídas"
              value={matriculas.filter(m => m.status === 'concluida').length}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabela de Matrículas */}
      <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0' }}>
        {filteredMatriculas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <BookOutlined style={{ fontSize: 64, color: '#d1d5db' }} />
            <Title level={4} type="secondary">Nenhuma matrícula encontrada</Title>
            {searchTerm && (
              <Button type="link" onClick={() => setSearchTerm('')}>
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredMatriculas}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total de ${total} matrículas`
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* Modal de Criar/Editar */}
      <Modal
        title={modalMode === 'create' ? 'Nova Matrícula' : 'Editar Matrícula'}
        open={showModal}
        onCancel={closeModal}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 24 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="aluno_id"
                label="Aluno"
                rules={[{ required: true, message: 'Selecione um aluno' }]}
              >
                <Select
                  size="large"
                  placeholder="Selecione um aluno"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                  disabled={modalMode === 'edit'}
                >
                  {alunos.map(aluno => (
                    <Select.Option key={aluno.id} value={aluno.id}>
                      {aluno.nome_completo}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="curso_id"
                label="Curso"
                rules={[{ required: true, message: 'Selecione um curso' }]}
              >
                <Select
                  size="large"
                  placeholder="Selecione um curso"
                  onChange={handleCursoChange}
                  disabled={modalMode === 'edit'}
                >
                  {cursos.map(curso => (
                    <Select.Option key={curso.id} value={curso.id}>
                      {curso.nome} - {formatMoeda(curso.valor_mensalidade)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.curso_id !== curr.curso_id}>
                {({ getFieldValue }) => {
                  const cursoId = getFieldValue('curso_id');
                  const curso = cursos.find(c => c.id === cursoId);
                  return curso ? (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -16 }}>
                      {curso.tipo === 'regular'
                        ? 'Curso regular: gera mensalidades recorrentes'
                        : `Curso avulso: ${curso.duracao_meses} meses`
                      }
                    </Text>
                  ) : null;
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="data_matricula"
                label="Data da Matrícula"
                rules={[{ required: true, message: 'Data da matrícula é obrigatória' }]}
              >
                <DatePicker
                  size="large"
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="Selecione a data"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="data_inicio"
                label="Data de Início"
                rules={[{ required: true, message: 'Data de início é obrigatória' }]}
              >
                <DatePicker
                  size="large"
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="Selecione a data"
                  onChange={() => {
                    const cursoId = form.getFieldValue('curso_id');
                    if (cursoId) handleCursoChange(cursoId);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.curso_id !== curr.curso_id}>
                {({ getFieldValue }) => {
                  const cursoId = getFieldValue('curso_id');
                  const curso = cursos.find(c => c.id === cursoId);
                  const isAvulso = curso?.tipo === 'avulso';

                  return (
                    <Form.Item
                      name="data_fim"
                      label="Data de Término"
                      rules={[
                        {
                          validator: (_, value) => {
                            const dataInicio = getFieldValue('data_inicio');
                            if (value && dataInicio && dayjs(value).isBefore(dayjs(dataInicio))) {
                              return Promise.reject('Data de término deve ser posterior à data de início');
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <DatePicker
                        size="large"
                        format="DD/MM/YYYY"
                        style={{ width: '100%' }}
                        placeholder="Selecione a data"
                        disabled={isAvulso}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="dia_vencimento_personalizado"
                label="Dia Vencimento Personalizado"
                rules={[
                  {
                    validator: (_, value) => {
                      if (value && (value < 1 || value > 31)) {
                        return Promise.reject('Dia deve estar entre 1 e 31');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input
                  type="number"
                  size="large"
                  min={1}
                  max={31}
                  placeholder="Deixe vazio para usar padrão do curso"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true }]}
          >
            <Select size="large">
              <Select.Option value="ativa">Ativa</Select.Option>
              <Select.Option value="trancada">Trancada</Select.Option>
              <Select.Option value="cancelada">Cancelada</Select.Option>
              <Select.Option value="concluida">Concluída</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="observacoes"
            label="Observações"
          >
            <TextArea
              rows={3}
              placeholder="Informações adicionais sobre a matrícula"
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

export default MatriculaManager;
