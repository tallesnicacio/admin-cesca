import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import {
  Card,
  Row,
  Col,
  Button,
  Input,
  Select,
  Table,
  Modal,
  Form,
  DatePicker,
  Space,
  Typography,
  Tag,
  Empty,
  Spin,
  message
} from 'antd';
import {
  WarningOutlined,
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function AdvertenciaManager({ userProfile }) {
  const [advertencias, setAdvertencias] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [filteredAdvertencias, setFilteredAdvertencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterTrabalhador, setFilterTrabalhador] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAdvertencia, setSelectedAdvertencia] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, advertenciaId: null });
  const [modalLoading, setModalLoading] = useState(false);
  const [resumo, setResumo] = useState([]);
  const [showResumo, setShowResumo] = useState(false);
  const [form] = Form.useForm();

  const tiposAdvertencia = ['1º Verbal', '2º Verbal', '3º Verbal', '4º Verbal', '5º Verbal'];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAdvertencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, filterTipo, filterTrabalhador, advertencias]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar trabalhadores
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .order('numero', { ascending: true, nullsFirst: false })
        .order('nome_completo', { ascending: true });

      if (trabError) throw trabError;
      setTrabalhadores(trabData || []);

      // Carregar advertências com histórico
      const { data: advData, error: advError } = await supabase
        .from('vw_advertencias_historico')
        .select('*')
        .order('data_advertencia', { ascending: false });

      if (advError) throw advError;
      setAdvertencias(advData || []);

      // Carregar resumo
      const { data: resumoData, error: resumoError } = await supabase
        .from('vw_advertencias_resumo')
        .select('*')
        .order('total_advertencias', { ascending: false });

      if (resumoError) throw resumoError;
      setResumo(resumoData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterAdvertencias = () => {
    let filtered = [...advertencias];

    // Busca por nome do trabalhador
    if (searchTerm) {
      filtered = filtered.filter(adv =>
        adv.trabalhador_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo
    if (filterTipo !== 'all') {
      filtered = filtered.filter(adv => adv.tipo === filterTipo);
    }

    // Filtro por trabalhador
    if (filterTrabalhador !== 'all') {
      filtered = filtered.filter(adv => adv.trabalhador_id === filterTrabalhador);
    }

    setFilteredAdvertencias(filtered);
  };

  const handleOpenModal = (mode, advertencia = null) => {
    setModalMode(mode);
    setSelectedAdvertencia(advertencia);

    if (mode === 'edit' && advertencia) {
      form.setFieldsValue({
        trabalhador_id: advertencia.trabalhador_id,
        tipo: advertencia.tipo,
        data_advertencia: dayjs(advertencia.data_advertencia),
        motivo: advertencia.motivo || '',
        observacoes: advertencia.observacoes || ''
      });
    } else {
      form.setFieldsValue({
        trabalhador_id: '',
        tipo: '1º Verbal',
        data_advertencia: dayjs(),
        motivo: '',
        observacoes: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedAdvertencia(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      setModalLoading(true);

      const payload = {
        trabalhador_id: values.trabalhador_id,
        tipo: values.tipo,
        data_advertencia: values.data_advertencia.format('YYYY-MM-DD'),
        motivo: values.motivo,
        observacoes: values.observacoes || '',
        aplicado_por: userProfile?.id
      };

      if (modalMode === 'create') {
        const { error } = await supabase
          .from('advertencias')
          .insert([payload]);

        if (error) throw error;
        message.success('Advertência registrada com sucesso!');
      } else {
        const { error } = await supabase
          .from('advertencias')
          .update(payload)
          .eq('id', selectedAdvertencia.id);

        if (error) throw error;
        message.success('Advertência atualizada com sucesso!');
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Erro ao salvar advertência:', error);
      message.error('Erro ao salvar advertência: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (advertenciaId) => {
    setDeleteModal({ isOpen: true, advertenciaId });
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('advertencias')
        .delete()
        .eq('id', deleteModal.advertenciaId);

      if (error) throw error;

      message.success('Advertência excluída com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao excluir advertência:', error);
      message.error('Erro ao excluir advertência: ' + error.message);
    } finally {
      setDeleteModal({ isOpen: false, advertenciaId: null });
    }
  };

  const getTipoBadgeColor = (tipo) => {
    switch (tipo) {
      case '1º Verbal': return 'blue';
      case '2º Verbal': return 'orange';
      case '3º Verbal': return 'red';
      case '4º Verbal': return 'volcano';
      case '5º Verbal': return 'magenta';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getStatsCards = () => {
    const total = advertencias.length;
    const trabalhadores_com_advertencia = new Set(advertencias.map(a => a.trabalhador_id)).size;
    const ultimas_30_dias = advertencias.filter(a => {
      const diff = new Date() - new Date(a.data_advertencia + 'T00:00:00');
      return diff <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    return { total, trabalhadores_com_advertencia, ultimas_30_dias };
  };

  const stats = getStatsCards();

  // Colunas para a tabela de histórico
  const historicColumns = [
    {
      title: 'Nº',
      dataIndex: 'trabalhador_numero',
      key: 'trabalhador_numero',
      width: 80,
      render: (num) => num || '-'
    },
    {
      title: 'Trabalhador',
      dataIndex: 'trabalhador_nome',
      key: 'trabalhador_nome',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Grupo',
      dataIndex: 'grupo',
      key: 'grupo',
      width: 120,
      render: (grupo) => (
        <Tag color={grupo === 'Direção' ? 'purple' : 'green'}>
          {grupo || '-'}
        </Tag>
      )
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 120,
      render: (tipo) => (
        <Tag color={getTipoBadgeColor(tipo)}>{tipo}</Tag>
      )
    },
    {
      title: 'Data',
      dataIndex: 'data_advertencia',
      key: 'data_advertencia',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: 'Motivo',
      dataIndex: 'motivo',
      key: 'motivo',
      ellipsis: true
    },
    {
      title: 'Aplicado Por',
      dataIndex: 'aplicado_por_nome',
      key: 'aplicado_por_nome',
      width: 150,
      render: (nome) => nome || '-'
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal('edit', record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      )
    }
  ];

  // Colunas para a tabela de resumo
  const resumoColumns = [
    {
      title: 'Nº',
      dataIndex: 'numero',
      key: 'numero',
      width: 80,
      render: (num) => num || '-'
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Grupo',
      dataIndex: 'grupo',
      key: 'grupo',
      width: 120,
      render: (grupo) => (
        <Tag color={grupo === 'Direção' ? 'purple' : 'green'}>
          {grupo || '-'}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusConfig = {
          ativo: { color: 'success', text: 'Ativo' },
          afastado: { color: 'warning', text: 'Afastado' },
          inativo: { color: 'default', text: 'Inativo' }
        };
        const config = statusConfig[status] || statusConfig.inativo;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '1º Verbal',
      dataIndex: 'advertencias_1',
      key: 'advertencias_1',
      width: 90,
      align: 'center',
      render: (val) => val || 0
    },
    {
      title: '2º Verbal',
      dataIndex: 'advertencias_2',
      key: 'advertencias_2',
      width: 90,
      align: 'center',
      render: (val) => val || 0
    },
    {
      title: '3º Verbal',
      dataIndex: 'advertencias_3',
      key: 'advertencias_3',
      width: 90,
      align: 'center',
      render: (val) => val || 0
    },
    {
      title: '4º Verbal',
      dataIndex: 'advertencias_4',
      key: 'advertencias_4',
      width: 90,
      align: 'center',
      render: (val) => val || 0
    },
    {
      title: '5º Verbal',
      dataIndex: 'advertencias_5',
      key: 'advertencias_5',
      width: 90,
      align: 'center',
      render: (val) => val || 0
    },
    {
      title: 'Total',
      dataIndex: 'total_advertencias',
      key: 'total_advertencias',
      width: 80,
      align: 'center',
      render: (total) => (
        <Text strong style={{ color: total >= 3 ? '#ff4d4f' : '#1890ff' }}>
          {total}
        </Text>
      )
    },
    {
      title: 'Última',
      dataIndex: 'ultima_advertencia',
      key: 'ultima_advertencia',
      width: 120,
      render: (date) => formatDate(date)
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" tip="Carregando advertências..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <WarningOutlined style={{ fontSize: 32, color: '#faad14' }} />
              <div>
                <Title level={2} style={{ margin: 0 }}>Gerenciar Advertências</Title>
                <Text type="secondary">Controle de advertências verbais aplicadas aos trabalhadores</Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => handleOpenModal('create')}
            >
              Nova Advertência
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <WarningOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                <Text type="secondary">Total de Advertências</Text>
              </Space>
              <Title level={2} style={{ margin: 0 }}>{stats.total}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <UserOutlined style={{ fontSize: 24, color: '#eb2f96' }} />
                <Text type="secondary">Trabalhadores com Advertência</Text>
              </Space>
              <Title level={2} style={{ margin: 0 }}>{stats.trabalhadores_com_advertencia}</Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <CalendarOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                <Text type="secondary">Últimos 30 Dias</Text>
              </Space>
              <Title level={2} style={{ margin: 0 }}>{stats.ultimas_30_dias}</Title>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Toggle Resumo */}
      <Card bordered={false} style={{ marginBottom: 24 }}>
        <Button
          type={showResumo ? 'default' : 'primary'}
          icon={<TrophyOutlined />}
          onClick={() => setShowResumo(!showResumo)}
          size="large"
        >
          {showResumo ? 'Ver Histórico' : 'Ver Resumo por Trabalhador'}
        </Button>
      </Card>

      {showResumo ? (
        /* RESUMO POR TRABALHADOR */
        <Card>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Input
              placeholder="Buscar trabalhador..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="large"
              allowClear
            />
          </Space>

          <Table
            columns={resumoColumns}
            dataSource={resumo
              .filter(r => r.total_advertencias > 0)
              .filter(r => !searchTerm || r.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()))
            }
            rowKey="trabalhador_id"
            scroll={{ x: 1200 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nenhuma advertência registrada"
                />
              )
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} trabalhadores`
            }}
          />
        </Card>
      ) : (
        /* HISTÓRICO DE ADVERTÊNCIAS */
        <Card>
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="large">
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Input
                  placeholder="Buscar por nome do trabalhador..."
                  prefix={<SearchOutlined />}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="large"
                  allowClear
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder="Todos os Tipos"
                  value={filterTipo}
                  onChange={setFilterTipo}
                  style={{ width: '100%' }}
                  size="large"
                >
                  <Option value="all">Todos os Tipos</Option>
                  {tiposAdvertencia.map(tipo => (
                    <Option key={tipo} value={tipo}>{tipo}</Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder="Todos os Trabalhadores"
                  value={filterTrabalhador}
                  onChange={setFilterTrabalhador}
                  style={{ width: '100%' }}
                  size="large"
                  showSearch
                  optionFilterProp="children"
                >
                  <Option value="all">Todos os Trabalhadores</Option>
                  {trabalhadores.map(trab => (
                    <Option key={trab.id} value={trab.id}>
                      {trab.numero ? `${trab.numero} - ` : ''}{trab.nome_completo}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Space>

          <Table
            columns={historicColumns}
            dataSource={filteredAdvertencias}
            rowKey="id"
            scroll={{ x: 1200 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nenhuma advertência encontrada"
                />
              )
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Total: ${total} advertências`
            }}
          />
        </Card>
      )}

      {/* Modal de Criar/Editar */}
      <Modal
        title={
          <Space>
            {modalMode === 'create' ? <PlusOutlined /> : <EditOutlined />}
            <span>{modalMode === 'create' ? 'Nova Advertência' : 'Editar Advertência'}</span>
          </Space>
        }
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            tipo: '1º Verbal',
            data_advertencia: dayjs()
          }}
        >
          <Form.Item
            label={
              <Space>
                <UserOutlined />
                <span>Trabalhador</span>
              </Space>
            }
            name="trabalhador_id"
            rules={[{ required: true, message: 'Selecione um trabalhador' }]}
          >
            <Select
              placeholder="Selecione um trabalhador"
              size="large"
              showSearch
              optionFilterProp="children"
              disabled={modalMode === 'edit'}
            >
              {trabalhadores.map(trab => (
                <Option key={trab.id} value={trab.id}>
                  {trab.numero ? `${trab.numero} - ` : ''}{trab.nome_completo}
                  {trab.grupo ? ` (${trab.grupo})` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <WarningOutlined />
                <span>Tipo de Advertência</span>
              </Space>
            }
            name="tipo"
            rules={[{ required: true, message: 'Selecione o tipo de advertência' }]}
          >
            <Select size="large">
              {tiposAdvertencia.map(tipo => (
                <Option key={tipo} value={tipo}>{tipo}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <CalendarOutlined />
                <span>Data da Advertência</span>
              </Space>
            }
            name="data_advertencia"
            rules={[{ required: true, message: 'Informe a data da advertência' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              size="large"
              format="DD/MM/YYYY"
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <FileTextOutlined />
                <span>Motivo</span>
              </Space>
            }
            name="motivo"
            rules={[{ required: true, message: 'Informe o motivo da advertência' }]}
          >
            <TextArea
              rows={3}
              placeholder="Descreva o motivo da advertência..."
            />
          </Form.Item>

          <Form.Item
            label={
              <Space>
                <FileTextOutlined />
                <span>Observações</span>
              </Space>
            }
            name="observacoes"
          >
            <TextArea
              rows={2}
              placeholder="Observações adicionais (opcional)..."
            />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={handleCloseModal} disabled={modalLoading}>
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" loading={modalLoading}>
                Salvar
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        title="Excluir Advertência"
        open={deleteModal.isOpen}
        onOk={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, advertenciaId: null })}
        okText="Excluir"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
      >
        <p>Tem certeza que deseja excluir esta advertência? Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}

export default AdvertenciaManager;
