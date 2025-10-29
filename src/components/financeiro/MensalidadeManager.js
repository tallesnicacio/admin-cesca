// MensalidadeManager.js
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Button,
  Modal,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Space,
  Typography,
  Card,
  message,
  Spin,
  Table,
  Tag,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd';
import {
  SearchOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  CreditCardOutlined,
  WalletOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const MensalidadeManager = () => {
  const [mensalidades, setMensalidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [mesFilter, setMesFilter] = useState('');
  const [anoFilter, setAnoFilter] = useState('');
  const [formaPagamentoFilter, setFormaPagamentoFilter] = useState('todos');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState(null);
  const [paymentData, setPaymentData] = useState({
    valor_pago: '',
    data_pagamento: dayjs(),
    forma_pagamento: 'dinheiro',
    observacoes: ''
  });
  const [stats, setStats] = useState({
    totalPendente: 0,
    totalPago: 0,
    totalAtrasado: 0,
    quantidade: 0
  });

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar mensalidades
  const fetchMensalidades = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('mensalidades')
        .select(`
          *,
          matricula:matriculas (
            id,
            aluno:alunos (
              id,
              nome_completo,
              cpf,
              telefone
            ),
            curso:cursos (
              id,
              nome,
              tipo
            )
          )
        `)
        .order('ano_referencia', { ascending: false })
        .order('mes_referencia', { ascending: false })
        .order('data_vencimento', { ascending: false });

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      if (mesFilter) {
        query = query.eq('mes_referencia', parseInt(mesFilter));
      }

      if (anoFilter) {
        query = query.eq('ano_referencia', parseInt(anoFilter));
      }

      if (formaPagamentoFilter !== 'todos') {
        query = query.eq('forma_pagamento', formaPagamentoFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredData = data || [];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(m =>
          m.matricula?.aluno?.nome_completo?.toLowerCase().includes(searchLower) ||
          m.matricula?.aluno?.cpf?.includes(searchTerm)
        );
      }

      setMensalidades(filteredData);
      calculateStats(filteredData);
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
      message.error('Erro ao carregar mensalidades');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mesFilter, anoFilter, formaPagamentoFilter, searchTerm]);

  useEffect(() => {
    fetchMensalidades();
  }, [fetchMensalidades]);

  // Calcular estatísticas
  const calculateStats = (data) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const stats = data.reduce((acc, m) => {
      acc.quantidade++;

      const vencimento = new Date(m.data_vencimento);
      const isAtrasado = m.status === 'pendente' && vencimento < hoje;

      if (m.status === 'pendente') {
        acc.totalPendente += parseFloat(m.valor || 0);
        if (isAtrasado) {
          acc.totalAtrasado += parseFloat(m.valor || 0);
        }
      } else if (m.status === 'pago') {
        acc.totalPago += parseFloat(m.valor_pago || 0);
      }

      return acc;
    }, {
      totalPendente: 0,
      totalPago: 0,
      totalAtrasado: 0,
      quantidade: 0
    });

    setStats(stats);
  };

  // Abrir modal de pagamento
  const handleOpenPaymentModal = (mensalidade) => {
    setSelectedMensalidade(mensalidade);
    setPaymentData({
      valor_pago: mensalidade.valor.toString(),
      data_pagamento: dayjs(),
      forma_pagamento: 'dinheiro',
      observacoes: ''
    });
    setShowPaymentModal(true);
  };

  // Registrar pagamento
  const handleRegisterPayment = async () => {
    if (!selectedMensalidade) return;

    try {
      const valorPago = parseFloat(paymentData.valor_pago);

      if (isNaN(valorPago) || valorPago <= 0) {
        message.error('Valor pago deve ser maior que zero');
        return;
      }

      const { error } = await supabase
        .from('mensalidades')
        .update({
          valor_pago: valorPago,
          data_pagamento: paymentData.data_pagamento.format('YYYY-MM-DD'),
          forma_pagamento: paymentData.forma_pagamento,
          status: 'pago',
          observacoes: paymentData.observacoes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedMensalidade.id);

      if (error) throw error;

      message.success('Pagamento registrado com sucesso!');
      setShowPaymentModal(false);
      setSelectedMensalidade(null);
      fetchMensalidades();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      message.error('Erro ao registrar pagamento');
    }
  };

  // Cancelar mensalidade
  const handleCancelMensalidade = async (mensalidade) => {
    Modal.confirm({
      title: 'Cancelar Mensalidade',
      content: `Deseja realmente cancelar esta mensalidade de ${mensalidade.matricula?.aluno?.nome_completo}?`,
      okText: 'Cancelar Mensalidade',
      okType: 'danger',
      cancelText: 'Voltar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('mensalidades')
            .update({
              status: 'cancelado',
              updated_at: new Date().toISOString()
            })
            .eq('id', mensalidade.id);

          if (error) throw error;

          message.success('Mensalidade cancelada com sucesso!');
          fetchMensalidades();
        } catch (error) {
          console.error('Erro ao cancelar mensalidade:', error);
          message.error('Erro ao cancelar mensalidade');
        }
      }
    });
  };

  // Gerar mensalidades do mês
  const handleGerarMensalidades = async () => {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    Modal.confirm({
      title: 'Gerar Mensalidades',
      content: `Deseja gerar as mensalidades para ${mes}/${ano}? Isso criará mensalidades para todas as matrículas ativas que ainda não possuem mensalidade neste mês.`,
      okText: 'Gerar',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          setLoading(true);

          const { data, error } = await supabase.rpc('gerar_mensalidades_mes', {
            p_mes: mes,
            p_ano: ano
          });

          if (error) throw error;

          const resultado = data[0];

          if (resultado.erros && resultado.erros.length > 0) {
            message.warning(
              `Mensalidades geradas com avisos: ${resultado.mensalidades_criadas} criadas, ${resultado.matriculas_processadas} processadas`
            );
          } else {
            message.success(
              `${resultado.mensalidades_criadas} mensalidades criadas de ${resultado.matriculas_processadas} matrículas processadas`
            );
          }

          fetchMensalidades();
        } catch (error) {
          console.error('Erro ao gerar mensalidades:', error);
          message.error('Erro ao gerar mensalidades: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
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

  // Obter label do mês
  const getMesLabel = (mes) => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[mes - 1] || mes;
  };

  // Obter badge de status
  const getStatusBadge = (mensalidade) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(mensalidade.data_vencimento);

    if (mensalidade.status === 'pendente' && vencimento < hoje) {
      return <Tag color="error" icon={<WarningOutlined />}>Atrasado</Tag>;
    }

    const statusMap = {
      pendente: { label: 'Pendente', color: 'warning', icon: <ClockCircleOutlined /> },
      pago: { label: 'Pago', color: 'success', icon: <CheckCircleOutlined /> },
      cancelado: { label: 'Cancelado', color: 'default', icon: <CloseCircleOutlined /> }
    };

    const statusInfo = statusMap[mensalidade.status] || statusMap.pendente;
    return <Tag color={statusInfo.color} icon={statusInfo.icon}>{statusInfo.label}</Tag>;
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Aluno',
      key: 'aluno',
      render: (_, record) => (
        <div>
          <Text strong>{record.matricula?.aluno?.nome_completo || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.matricula?.aluno?.cpf || ''}</Text>
        </div>
      )
    },
    {
      title: 'Curso',
      key: 'curso',
      render: (_, record) => (
        <div>
          <Text>{record.matricula?.curso?.nome || 'N/A'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.matricula?.curso?.tipo || ''}</Text>
        </div>
      )
    },
    {
      title: 'Referência',
      key: 'referencia',
      render: (_, record) => (
        <Text strong>
          {getMesLabel(record.mes_referencia)}/{record.ano_referencia}
        </Text>
      )
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
      title: 'Pagamento',
      key: 'pagamento',
      render: (_, record) => (
        record.status === 'pago' ? (
          <div>
            <Text strong style={{ color: '#10b981' }}>{formatCurrency(record.valor_pago)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(record.data_pagamento)}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.forma_pagamento}</Text>
          </div>
        ) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        record.status === 'pendente' && (
          <Space>
            <Button
              size="small"
              icon={<CreditCardOutlined />}
              onClick={() => handleOpenPaymentModal(record)}
            >
              Pagar
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleCancelMensalidade(record)}
            >
              Cancelar
            </Button>
          </Space>
        )
      )
    }
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <DollarOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Gestão de Mensalidades
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Controle de pagamentos e inadimplência
              </Text>
            </div>
          </Space>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleGerarMensalidades}
            disabled={loading}
          >
            Gerar Mensalidades do Mês
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Filtros */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space wrap style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por aluno ou CPF..."
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
            <Select.Option value="pendente">Pendente</Select.Option>
            <Select.Option value="pago">Pago</Select.Option>
            <Select.Option value="cancelado">Cancelado</Select.Option>
          </Select>

          <Select
            placeholder="Mês"
            value={mesFilter}
            onChange={setMesFilter}
            style={{ width: isMobile ? '100%' : 150 }}
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
            style={{ width: isMobile ? '100%' : 120 }}
            size="large"
            allowClear
          >
            {[2024, 2025, 2026].map(ano => (
              <Select.Option key={ano} value={ano}>{ano}</Select.Option>
            ))}
          </Select>

          <Select
            placeholder="Forma de Pagamento"
            value={formaPagamentoFilter}
            onChange={setFormaPagamentoFilter}
            style={{ width: isMobile ? '100%' : 180 }}
            size="large"
          >
            <Select.Option value="todos">Todas as Formas</Select.Option>
            <Select.Option value="dinheiro">Dinheiro</Select.Option>
            <Select.Option value="pix">PIX</Select.Option>
            <Select.Option value="cartao_debito">Cartão Débito</Select.Option>
            <Select.Option value="cartao_credito">Cartão Crédito</Select.Option>
            <Select.Option value="transferencia">Transferência</Select.Option>
          </Select>
        </Space>
      </Card>

      {/* Estatísticas */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #f59e0b' }}>
            <Statistic
              title="A Receber"
              value={stats.totalPendente}
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              formatter={(value) => formatCurrency(value)}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #10b981' }}>
            <Statistic
              title="Recebido"
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
              title="Em Atraso"
              value={stats.totalAtrasado}
              prefix={<WarningOutlined style={{ color: '#ef4444' }} />}
              formatter={(value) => formatCurrency(value)}
              valueStyle={{ color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: 12, border: '1px solid #3b82f6' }}>
            <Statistic
              title="Mensalidades"
              value={stats.quantidade}
              prefix={<WalletOutlined style={{ color: '#3b82f6' }} />}
              valueStyle={{ color: '#3b82f6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Carregando mensalidades...</Text>
        </div>
      ) : mensalidades.length === 0 ? (
        <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0', textAlign: 'center', padding: '60px 20px' }}>
          <DollarOutlined style={{ fontSize: 64, color: '#d1d5db' }} />
          <Title level={4} type="secondary">Nenhuma mensalidade encontrada</Title>
          <Button type="link" onClick={handleGerarMensalidades}>
            Gerar mensalidades do mês atual
          </Button>
        </Card>
      ) : (
        <Card style={{ borderRadius: 16, border: '1px solid #f0f0f0' }}>
          <Table
            columns={columns}
            dataSource={mensalidades}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Total de ${total} mensalidades`
            }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {/* Modal de Pagamento */}
      <Modal
        title="Registrar Pagamento"
        open={showPaymentModal}
        onOk={handleRegisterPayment}
        onCancel={() => setShowPaymentModal(false)}
        okText="Confirmar Pagamento"
        cancelText="Cancelar"
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          {selectedMensalidade && (
            <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
              <div><Text strong>Aluno:</Text> {selectedMensalidade.matricula?.aluno?.nome_completo}</div>
              <div><Text strong>Curso:</Text> {selectedMensalidade.matricula?.curso?.nome}</div>
              <div><Text strong>Referência:</Text> {getMesLabel(selectedMensalidade.mes_referencia)}/{selectedMensalidade.ano_referencia}</div>
              <div><Text strong>Valor:</Text> {formatCurrency(selectedMensalidade.valor)}</div>
            </div>
          )}

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Valor Pago *</Text>
              </div>
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                placeholder="0.00"
                min={0}
                step={0.01}
                value={paymentData.valor_pago}
                onChange={(value) => setPaymentData({ ...paymentData, valor_pago: value })}
                prefix="R$"
              />
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Data do Pagamento *</Text>
              </div>
              <DatePicker
                style={{ width: '100%' }}
                size="large"
                value={paymentData.data_pagamento}
                onChange={(date) => setPaymentData({ ...paymentData, data_pagamento: date })}
                format="DD/MM/YYYY"
              />
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Forma de Pagamento *</Text>
              </div>
              <Select
                style={{ width: '100%' }}
                size="large"
                value={paymentData.forma_pagamento}
                onChange={(value) => setPaymentData({ ...paymentData, forma_pagamento: value })}
              >
                <Select.Option value="dinheiro">Dinheiro</Select.Option>
                <Select.Option value="pix">PIX</Select.Option>
                <Select.Option value="cartao_debito">Cartão de Débito</Select.Option>
                <Select.Option value="cartao_credito">Cartão de Crédito</Select.Option>
                <Select.Option value="transferencia">Transferência Bancária</Select.Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Observações</Text>
              </div>
              <TextArea
                rows={3}
                placeholder="Observações sobre o pagamento (opcional)"
                value={paymentData.observacoes}
                onChange={(e) => setPaymentData({ ...paymentData, observacoes: e.target.value })}
              />
            </div>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default MensalidadeManager;
