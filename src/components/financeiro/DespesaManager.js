import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  UploadOutlined,
  DownloadOutlined,
  DollarOutlined
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
  Upload,
  DatePicker,
  InputNumber
} from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const DespesaManager = () => {
  const [despesas, setDespesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('todas');
  const [mesFilter, setMesFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState(null);
  const [selectedDespesa, setSelectedDespesa] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [selectedFile, setSelectedFile] = useState(null);
  const [stats, setStats] = useState({
    totalAPagar: 0,
    totalPago: 0,
    totalVencido: 0,
    quantidade: 0
  });

  const categorias = [
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz/Energia' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'internet', label: 'Internet' },
    { value: 'material_escritorio', label: 'Material de Escritório' },
    { value: 'material_limpeza', label: 'Material de Limpeza' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'aluguel', label: 'Aluguel' },
    { value: 'outras', label: 'Outras' }
  ];

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar despesas
  const fetchDespesas = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('despesas')
        .select('*')
        .order('data_vencimento', { ascending: false });

      // Filtros
      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (categoriaFilter !== 'todas') {
        query = query.eq('categoria', categoriaFilter);
      }

      if (mesFilter && anoFilter) {
        const mes = parseInt(mesFilter);
        const ano = parseInt(anoFilter);
        const dataInicio = new Date(ano, mes - 1, 1);
        const dataFim = new Date(ano, mes, 0);

        query = query
          .gte('data_vencimento', dataInicio.toISOString().split('T')[0])
          .lte('data_vencimento', dataFim.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filtro por busca
      let filteredData = data || [];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(d =>
          d.descricao?.toLowerCase().includes(searchLower) ||
          d.fornecedor?.toLowerCase().includes(searchLower)
        );
      }

      // Atualizar status automático de vencidas
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      filteredData = filteredData.map(d => {
        if (d.status === 'a_pagar') {
          const vencimento = new Date(d.data_vencimento);
          if (vencimento < hoje) {
            return { ...d, status: 'vencido' };
          }
        }
        return d;
      });

      setDespesas(filteredData);
      calculateStats(filteredData);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      message.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoriaFilter, mesFilter, anoFilter, searchTerm]);

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas]);

  // Calcular estatísticas
  const calculateStats = (data) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const stats = data.reduce((acc, d) => {
      acc.quantidade++;
      const vencimento = new Date(d.data_vencimento);

      if (d.status === 'a_pagar') {
        acc.totalAPagar += parseFloat(d.valor || 0);
        if (vencimento < hoje) {
          acc.totalVencido += parseFloat(d.valor || 0);
        }
      } else if (d.status === 'pago') {
        acc.totalPago += parseFloat(d.valor || 0);
      } else if (d.status === 'vencido') {
        acc.totalVencido += parseFloat(d.valor || 0);
      }

      return acc;
    }, {
      totalAPagar: 0,
      totalPago: 0,
      totalVencido: 0,
      quantidade: 0
    });

    setStats(stats);
  };

  // Criar/Editar despesa
  const handleSubmit = async (values) => {
    try {
      const dataToSave = {
        descricao: values.descricao.trim(),
        categoria: values.categoria,
        valor: parseFloat(values.valor),
        data_emissao: values.data_emissao || new Date().toISOString().split('T')[0],
        data_vencimento: values.data_vencimento.format('YYYY-MM-DD'),
        fornecedor: values.fornecedor?.trim() || null,
        observacoes: values.observacoes?.trim() || null,
        status: 'a_pagar'
      };

      let despesaId;

      if (editingDespesa) {
        const { error } = await supabase
          .from('despesas')
          .update({ ...dataToSave, updated_at: new Date().toISOString() })
          .eq('id', editingDespesa.id);

        if (error) throw error;
        despesaId = editingDespesa.id;
        message.success('Despesa atualizada com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('despesas')
          .insert(dataToSave)
          .select()
          .single();

        if (error) throw error;
        despesaId = data.id;
        message.success('Despesa cadastrada com sucesso!');
      }

      // Upload de comprovante se houver
      if (selectedFile) {
        await uploadComprovante(despesaId, selectedFile);
      }

      setShowModal(false);
      setEditingDespesa(null);
      form.resetFields();
      setSelectedFile(null);
      fetchDespesas();
    } catch (error) {
      console.error('Erro ao salvar despesa:', error);
      message.error('Erro ao salvar despesa');
    }
  };

  // Upload de comprovante
  const uploadComprovante = async (despesaId, file) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${despesaId}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('despesas')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('despesas')
        .update({
          comprovante_url: filePath,
          updated_at: new Date().toISOString()
        })
        .eq('id', despesaId);

      if (updateError) throw updateError;

      message.success('Comprovante enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      message.error('Erro ao enviar comprovante');
    } finally {
      setUploading(false);
    }
  };

  // Download de comprovante
  const handleDownloadComprovante = async (despesa) => {
    if (!despesa.comprovante_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('despesas')
        .download(despesa.comprovante_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprovante_${despesa.descricao}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success('Download iniciado!');
    } catch (error) {
      console.error('Erro ao baixar comprovante:', error);
      message.error('Erro ao baixar comprovante');
    }
  };

  // Marcar como pago
  const handleMarkAsPaid = async (values) => {
    if (!selectedDespesa) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('despesas')
        .update({
          status: 'pago',
          data_pagamento: values.data_pagamento.format('YYYY-MM-DD'),
          forma_pagamento: values.forma_pagamento,
          pago_por: user?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDespesa.id);

      if (error) throw error;

      message.success('Despesa marcada como paga!');
      setShowPaymentModal(false);
      setSelectedDespesa(null);
      paymentForm.resetFields();
      fetchDespesas();
    } catch (error) {
      console.error('Erro ao marcar como pago:', error);
      message.error('Erro ao marcar como pago');
    }
  };

  // Deletar despesa
  const handleDelete = async (despesa) => {
    Modal.confirm({
      title: 'Excluir Despesa',
      content: `Deseja realmente excluir a despesa "${despesa.descricao}"?`,
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          // Deletar comprovante se existir
          if (despesa.comprovante_url) {
            await supabase.storage
              .from('despesas')
              .remove([despesa.comprovante_url]);
          }

          const { error } = await supabase
            .from('despesas')
            .delete()
            .eq('id', despesa.id);

          if (error) throw error;

          message.success('Despesa excluída com sucesso!');
          fetchDespesas();
        } catch (error) {
          console.error('Erro ao excluir despesa:', error);
          message.error('Erro ao excluir despesa');
        }
      }
    });
  };

  // Abrir modal de edição
  const handleEdit = (despesa) => {
    setEditingDespesa(despesa);
    form.setFieldsValue({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: despesa.valor,
      data_vencimento: dayjs(despesa.data_vencimento),
      fornecedor: despesa.fornecedor || '',
      observacoes: despesa.observacoes || ''
    });
    setShowModal(true);
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Obter label da categoria
  const getCategoriaLabel = (categoria) => {
    const cat = categorias.find(c => c.value === categoria);
    return cat ? cat.label : categoria;
  };

  // Obter badge de status
  const getStatusBadge = (despesa) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(despesa.data_vencimento);

    if (despesa.status === 'a_pagar' && vencimento < hoje) {
      return <Tag color="error" icon={<WarningOutlined />}>Vencida</Tag>;
    }

    const statusMap = {
      a_pagar: { label: 'A Pagar', color: 'warning', icon: <ClockCircleOutlined /> },
      pago: { label: 'Pago', color: 'success', icon: <CheckCircleOutlined /> },
      vencido: { label: 'Vencida', color: 'error', icon: <WarningOutlined /> }
    };

    const statusInfo = statusMap[despesa.status] || statusMap.a_pagar;
    return <Tag color={statusInfo.color} icon={statusInfo.icon}>{statusInfo.label}</Tag>;
  };

  // Obter label do mês
  const getMesLabel = (mes) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || mes;
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Descrição',
      dataIndex: 'descricao',
      key: 'descricao',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          {record.observacoes && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{record.observacoes}</Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Categoria',
      dataIndex: 'categoria',
      key: 'categoria',
      render: (text) => getCategoriaLabel(text)
    },
    {
      title: 'Fornecedor',
      dataIndex: 'fornecedor',
      key: 'fornecedor',
      render: (text) => text || '-'
    },
    {
      title: 'Vencimento',
      dataIndex: 'data_vencimento',
      key: 'data_vencimento',
      render: (text) => formatDate(text)
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
      render: (valor) => <Text strong>{formatCurrency(valor)}</Text>
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => getStatusBadge(record)
    },
    {
      title: 'Comprovante',
      key: 'comprovante',
      render: (_, record) => (
        record.comprovante_url ? (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadComprovante(record)}
          />
        ) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {record.status !== 'pago' && (
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setSelectedDespesa(record);
                paymentForm.setFieldsValue({
                  data_pagamento: dayjs(),
                  forma_pagamento: 'dinheiro'
                });
                setShowPaymentModal(true);
              }}
              title="Marcar como Pago"
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            title="Editar"
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            title="Excluir"
          />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <FileTextOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Gestão de Despesas
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Controle de contas e comprovantes
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingDespesa(null);
              form.resetFields();
              form.setFieldsValue({ categoria: 'outras' });
              setSelectedFile(null);
              setShowModal(true);
            }}
            style={{ borderRadius: 8 }}
          >
            Nova Despesa
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filtros */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por descrição ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: isMobile ? '100%' : 300 }}
            size="large"
            allowClear
          />

          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: isMobile ? '100%' : 150 }}
            size="large"
          >
            <Select.Option value="todos">Todos os Status</Select.Option>
            <Select.Option value="a_pagar">A Pagar</Select.Option>
            <Select.Option value="pago">Pago</Select.Option>
            <Select.Option value="vencido">Vencida</Select.Option>
          </Select>

          <Select
            placeholder="Categoria"
            value={categoriaFilter}
            onChange={setCategoriaFilter}
            style={{ width: isMobile ? '100%' : 180 }}
            size="large"
          >
            <Select.Option value="todas">Todas as Categorias</Select.Option>
            {categorias.map(cat => (
              <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Mês"
            value={mesFilter}
            onChange={setMesFilter}
            style={{ width: isMobile ? '100%' : 130 }}
            size="large"
            allowClear
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => (
              <Select.Option key={mes} value={mes}>{getMesLabel(mes)}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Ano"
            value={anoFilter}
            onChange={setAnoFilter}
            style={{ width: isMobile ? '100%' : 100 }}
            size="large"
            allowClear
          >
            {[2024, 2025, 2026].map(ano => (
              <Select.Option key={ano} value={ano}>{ano}</Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* Estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #f59e0b' }}>
            <Statistic
              title="A Pagar"
              value={stats.totalAPagar}
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              formatter={(value) => formatCurrency(value)}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #10b981' }}>
            <Statistic
              title="Pago"
              value={stats.totalPago}
              prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
              formatter={(value) => formatCurrency(value)}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #ef4444' }}>
            <Statistic
              title="Vencidas"
              value={stats.totalVencido}
              prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
              formatter={(value) => formatCurrency(value)}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #3b82f6' }}>
            <Statistic
              title="Total Despesas"
              value={stats.quantidade}
              prefix={<DollarOutlined style={{ color: '#3b82f6' }} />}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Carregando despesas...</Text>
        </div>
      ) : despesas.length === 0 ? (
        <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0', textAlign: 'center', padding: '60px 20px' }}>
          <FileTextOutlined style={{ fontSize: 64, color: '#d1d5db' }} />
          <Title level={4} type="secondary">Nenhuma despesa encontrada</Title>
          <Button type="link" onClick={() => setShowModal(true)}>
            Cadastrar primeira despesa
          </Button>
        </Card>
      ) : (
        <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0' }}>
          <Table
            columns={columns}
            dataSource={despesas}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {/* Modal de Cadastro/Edição */}
      <Modal
        title={editingDespesa ? 'Editar Despesa' : 'Nova Despesa'}
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          setEditingDespesa(null);
          form.resetFields();
          setSelectedFile(null);
        }}
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
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="descricao"
                label="Descrição"
                rules={[{ required: true, message: 'Descrição é obrigatória' }]}
              >
                <Input size="large" placeholder="Ex: Conta de luz" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="categoria"
                label="Categoria"
                rules={[{ required: true, message: 'Categoria é obrigatória' }]}
              >
                <Select size="large">
                  {categorias.map(cat => (
                    <Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="valor"
                label="Valor"
                rules={[
                  { required: true, message: 'Valor é obrigatório' },
                  {
                    validator: (_, value) => {
                      if (!value || value <= 0) {
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
                  placeholder="0.00"
                  style={{ width: '100%' }}
                  prefix="R$"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="data_vencimento"
                label="Data de Vencimento"
                rules={[{ required: true, message: 'Data de vencimento é obrigatória' }]}
              >
                <DatePicker
                  size="large"
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="Selecione a data"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="fornecedor"
            label="Fornecedor"
          >
            <Input size="large" placeholder="Nome do fornecedor (opcional)" />
          </Form.Item>

          <Form.Item
            name="observacoes"
            label="Observações"
          >
            <TextArea
              rows={3}
              placeholder="Informações adicionais (opcional)"
            />
          </Form.Item>

          <Form.Item label="Comprovante (PDF ou Imagem)">
            <Upload
              beforeUpload={(file) => {
                setSelectedFile(file);
                return false;
              }}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />} size="large">
                {selectedFile ? selectedFile.name : 'Escolher arquivo'}
              </Button>
            </Upload>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              Formatos aceitos: PDF, JPG, PNG (máx. 5MB)
            </Text>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowModal(false)} size="large">
                Cancelar
              </Button>
              <Button type="primary" htmlType="submit" size="large" loading={uploading}>
                {editingDespesa ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Pagamento */}
      <Modal
        title="Marcar como Pago"
        open={showPaymentModal}
        onCancel={() => {
          setShowPaymentModal(false);
          setSelectedDespesa(null);
          paymentForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {selectedDespesa && (
          <>
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
              <div><Text strong>Despesa:</Text> {selectedDespesa.descricao}</div>
              <div><Text strong>Valor:</Text> {formatCurrency(selectedDespesa.valor)}</div>
              <div><Text strong>Vencimento:</Text> {formatDate(selectedDespesa.data_vencimento)}</div>
            </div>

            <Form
              form={paymentForm}
              layout="vertical"
              onFinish={handleMarkAsPaid}
              style={{ marginTop: 16 }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="data_pagamento"
                    label="Data do Pagamento"
                    rules={[{ required: true, message: 'Data do pagamento é obrigatória' }]}
                  >
                    <DatePicker
                      size="large"
                      format="DD/MM/YYYY"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="forma_pagamento"
                    label="Forma de Pagamento"
                    rules={[{ required: true, message: 'Forma de pagamento é obrigatória' }]}
                  >
                    <Select size="large">
                      <Select.Option value="dinheiro">Dinheiro</Select.Option>
                      <Select.Option value="pix">PIX</Select.Option>
                      <Select.Option value="transferencia">Transferência</Select.Option>
                      <Select.Option value="debito_automatico">Débito Automático</Select.Option>
                      <Select.Option value="cartao_credito">Cartão de Crédito</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => setShowPaymentModal(false)} size="large">
                    Cancelar
                  </Button>
                  <Button type="primary" htmlType="submit" size="large" icon={<CheckCircleOutlined />}>
                    Confirmar Pagamento
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default DespesaManager;
