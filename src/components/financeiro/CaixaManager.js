// CaixaManager.js
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
  Divider
} from 'antd';
import {
  WalletOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  LockOutlined,
  UnlockOutlined,
  PlusOutlined,
  CoffeeOutlined,
  ShoppingOutlined,
  CreditCardOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const CaixaManager = () => {
  const [caixas, setCaixas] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovimentacaoModal, setShowMovimentacaoModal] = useState(false);
  const [selectedSetor, setSelectedSetor] = useState(null);
  const [selectedCaixa, setSelectedCaixa] = useState(null);
  const [dateFilter, setDateFilter] = useState(dayjs());
  const [openFormData, setOpenFormData] = useState({
    valor_inicial: ''
  });
  const [closeFormData, setCloseFormData] = useState({
    valor_final: ''
  });
  const [movimentacaoFormData, setMovimentacaoFormData] = useState({
    tipo: 'entrada',
    valor: '',
    categoria: '',
    descricao: ''
  });

  const setoresInfo = {
    lanche: { nome: 'Lanche', icon: CoffeeOutlined, color: '#f59e0b' },
    lojinha: { nome: 'Lojinha', icon: ShoppingOutlined, color: '#8b5cf6' },
    mensalidades_cursos: { nome: 'Mensalidades', icon: CreditCardOutlined, color: '#059669' }
  };

  // Detectar resize para mobile
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar caixas do dia
  const fetchCaixas = useCallback(async () => {
    try {
      setLoading(true);

      const dataInicio = dateFilter.startOf('day').toISOString();
      const dataFim = dateFilter.endOf('day').toISOString();

      const { data, error } = await supabase
        .from('caixas')
        .select('*')
        .gte('hora_abertura', dataInicio)
        .lte('hora_abertura', dataFim)
        .order('hora_abertura', { ascending: false });

      if (error) throw error;

      setCaixas(data || []);
    } catch (error) {
      console.error('Erro ao carregar caixas:', error);
      message.error('Erro ao carregar caixas');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  // Carregar movimentações
  const fetchMovimentacoes = useCallback(async () => {
    if (!selectedCaixa) {
      setMovimentacoes([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('movimentacoes_caixa')
        .select('*')
        .eq('caixa_id', selectedCaixa.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMovimentacoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar movimentações:', error);
      message.error('Erro ao carregar movimentações');
    }
  }, [selectedCaixa]);

  useEffect(() => {
    fetchCaixas();
  }, [fetchCaixas]);

  useEffect(() => {
    fetchMovimentacoes();
  }, [fetchMovimentacoes]);

  // Abrir caixa
  const handleOpenCaixa = async () => {
    if (!selectedSetor) return;

    try {
      const valorInicial = parseFloat(openFormData.valor_inicial);

      if (isNaN(valorInicial) || valorInicial < 0) {
        message.error('Valor inicial deve ser um número válido');
        return;
      }

      const dataHoje = new Date().toISOString().split('T')[0];

      // Verificar se já existe caixa para este setor nesta data
      const { data: caixaExistente, error: checkError } = await supabase
        .from('caixas')
        .select('id, status')
        .eq('setor', selectedSetor)
        .eq('data', dataHoje)
        .maybeSingle();

      if (checkError) throw checkError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Se já existe um caixa ABERTO, bloquear
      if (caixaExistente && caixaExistente.status === 'aberto') {
        message.error(`Já existe um caixa aberto para ${setoresInfo[selectedSetor].nome} na data ${new Date().toLocaleDateString('pt-BR')}`);
        setShowOpenModal(false);
        return;
      }

      // Se existe um caixa FECHADO, reabrir (UPDATE)
      if (caixaExistente && caixaExistente.status === 'fechado') {
        const { error } = await supabase
          .from('caixas')
          .update({
            status: 'aberto',
            hora_abertura: new Date().toISOString(),
            valor_inicial: valorInicial,
            aberto_por: user?.id || null,
            // Limpar campos de fechamento ao reabrir
            hora_fechamento: null,
            valor_final_real: null,
            fechado_por: null
          })
          .eq('id', caixaExistente.id);

        if (error) throw error;

        message.success(`Caixa ${setoresInfo[selectedSetor].nome} reaberto com sucesso!`);
        setShowOpenModal(false);
        setSelectedSetor(null);
        setOpenFormData({ valor_inicial: '' });
        fetchCaixas();
        return;
      }

      // Se não existe nenhum caixa, criar um novo (INSERT)
      const { error } = await supabase
        .from('caixas')
        .insert({
          setor: selectedSetor,
          data: dataHoje,
          status: 'aberto',
          hora_abertura: new Date().toISOString(),
          valor_inicial: valorInicial,
          aberto_por: user?.id || null
        });

      if (error) throw error;

      message.success(`Caixa ${setoresInfo[selectedSetor].nome} aberto com sucesso!`);
      setShowOpenModal(false);
      setSelectedSetor(null);
      setOpenFormData({ valor_inicial: '' });
      fetchCaixas();
    } catch (error) {
      console.error('Erro ao abrir caixa:', error);
      message.error('Erro ao abrir caixa: ' + error.message);
    }
  };

  // Fechar caixa
  const handleCloseCaixa = async () => {
    if (!selectedCaixa) return;

    try {
      const valorFinal = parseFloat(closeFormData.valor_final);

      if (isNaN(valorFinal) || valorFinal < 0) {
        message.error('Valor final deve ser um número válido');
        return;
      }

      // Calcular diferença
      const totalEntradas = movimentacoes
        .filter(m => m.tipo === 'entrada')
        .reduce((sum, m) => sum + parseFloat(m.valor), 0);

      const totalSaidas = movimentacoes
        .filter(m => m.tipo === 'saida')
        .reduce((sum, m) => sum + parseFloat(m.valor), 0);

      const valorEsperado = parseFloat(selectedCaixa.valor_inicial) + totalEntradas - totalSaidas;
      const diferenca = valorFinal - valorEsperado;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('caixas')
        .update({
          status: 'fechado',
          hora_fechamento: new Date().toISOString(),
          valor_final_real: valorFinal,
          fechado_por: user?.id || null
        })
        .eq('id', selectedCaixa.id);

      if (error) throw error;

      message.success(
        `Caixa fechado com sucesso! ${diferenca !== 0 ? `Diferença: R$ ${diferenca.toFixed(2)}` : 'Caixa conferido!'}`
      );
      setShowCloseModal(false);
      setSelectedCaixa(null);
      setCloseFormData({ valor_final: '' });
      fetchCaixas();
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      message.error('Erro ao fechar caixa: ' + error.message);
    }
  };

  // Adicionar movimentação
  const handleAddMovimentacao = async () => {
    if (!selectedCaixa) return;

    try {
      const valor = parseFloat(movimentacaoFormData.valor);

      if (isNaN(valor) || valor <= 0) {
        message.error('Valor deve ser maior que zero');
        return;
      }

      if (!movimentacaoFormData.categoria?.trim()) {
        message.error('Categoria é obrigatória');
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          caixa_id: selectedCaixa.id,
          tipo: movimentacaoFormData.tipo,
          setor: selectedCaixa.setor,
          valor: valor,
          descricao: movimentacaoFormData.categoria.trim() + (movimentacaoFormData.descricao ? ': ' + movimentacaoFormData.descricao.trim() : ''),
          forma_pagamento: movimentacaoFormData.forma_pagamento || 'dinheiro',
          registrado_por: user?.id || null
        });

      if (error) throw error;

      message.success('Movimentação registrada com sucesso!');
      setShowMovimentacaoModal(false);
      setMovimentacaoFormData({
        tipo: 'entrada',
        valor: '',
        categoria: '',
        descricao: ''
      });
      fetchMovimentacoes();
    } catch (error) {
      console.error('Erro ao adicionar movimentação:', error);
      message.error('Erro ao adicionar movimentação: ' + error.message);
    }
  };

  // Formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  // Formatar data/hora
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  // Verificar se caixa está aberto
  const isCaixaAberto = (setor) => {
    return caixas.some(c => c.setor === setor && c.status === 'aberto');
  };

  // Obter caixa aberto
  const getCaixaAberto = (setor) => {
    return caixas.find(c => c.setor === setor && c.status === 'aberto');
  };

  // Calcular totais do caixa
  const calcularTotaisCaixa = (caixa) => {
    const movs = movimentacoes.filter(m => m.caixa_id === caixa.id);

    const totalEntradas = movs
      .filter(m => m.tipo === 'entrada')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const totalSaidas = movs
      .filter(m => m.tipo === 'saida')
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const saldoAtual = parseFloat(caixa.valor_inicial) + totalEntradas - totalSaidas;

    return { totalEntradas, totalSaidas, saldoAtual };
  };

  // Colunas da tabela
  const columns = [
    {
      title: 'Data/Hora',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => formatDateTime(text)
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      render: (tipo) => (
        <Tag color={tipo === 'entrada' ? 'green' : 'red'} icon={tipo === 'entrada' ? <RiseOutlined /> : <FallOutlined />}>
          {tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </Tag>
      )
    },
    {
      title: 'Descrição',
      dataIndex: 'descricao',
      key: 'descricao',
      render: (text) => text || '-'
    },
    {
      title: 'Valor',
      dataIndex: 'valor',
      key: 'valor',
      render: (valor, record) => (
        <Text strong style={{ color: record.tipo === 'entrada' ? '#10b981' : '#ef4444' }}>
          {formatCurrency(valor)}
        </Text>
      )
    }
  ];

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space>
            <WalletOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
            <div>
              <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                Gestão de Caixas
              </Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Controle de caixas diários: Lanche, Lojinha e Mensalidades
              </Text>
            </div>
          </Space>
        </Space>
      </div>

      <Divider />

      {/* Filtro de data */}
      <Card style={{ marginBottom: 24, borderRadius: 16, border: '1px solid #f0f0f0' }}>
        <Space align="center">
          <CalendarOutlined style={{ fontSize: 20 }} />
          <Text>Data:</Text>
          <DatePicker
            value={dateFilter}
            onChange={(date) => setDateFilter(date)}
            format="DD/MM/YYYY"
            size="large"
            style={{ width: isMobile ? '100%' : 'auto' }}
          />
        </Space>
      </Card>

      {/* Cards dos Caixas */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Carregando caixas...</Text>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Object.entries(setoresInfo).map(([setor, info]) => {
            const caixaAberto = getCaixaAberto(setor);
            const isAberto = isCaixaAberto(setor);
            const IconComponent = info.icon;

            return (
              <Card
                key={setor}
                style={{
                  borderRadius: 16,
                  border: `2px solid ${isAberto ? info.color : '#f0f0f0'}`,
                }}
              >
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <IconComponent style={{ fontSize: 24, color: info.color }} />
                    <Title level={4} style={{ margin: 0 }}>{info.nome}</Title>
                  </Space>
                  <Tag color={isAberto ? 'green' : 'default'} icon={isAberto ? <UnlockOutlined /> : <LockOutlined />}>
                    {isAberto ? 'Aberto' : 'Fechado'}
                  </Tag>
                </div>

                {isAberto && caixaAberto ? (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary">Abertura:</Text>
                        <Text strong style={{ marginLeft: 8 }}>{formatDateTime(caixaAberto.hora_abertura)}</Text>
                      </div>
                      <div>
                        <Text type="secondary">Valor Inicial:</Text>
                        <Text strong style={{ marginLeft: 8 }}>{formatCurrency(caixaAberto.valor_inicial)}</Text>
                      </div>
                    </div>

                    {selectedCaixa?.id === caixaAberto.id && movimentacoes.length > 0 && (
                      <div style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                        {(() => {
                          const { totalEntradas, totalSaidas, saldoAtual } = calcularTotaisCaixa(caixaAberto);
                          return (
                            <>
                              <div style={{ marginBottom: 4 }}>
                                <RiseOutlined style={{ color: '#10b981', marginRight: 4 }} />
                                <Text>Entradas: {formatCurrency(totalEntradas)}</Text>
                              </div>
                              <div style={{ marginBottom: 4 }}>
                                <FallOutlined style={{ color: '#ef4444', marginRight: 4 }} />
                                <Text>Saídas: {formatCurrency(totalSaidas)}</Text>
                              </div>
                              <div>
                                <DollarOutlined style={{ color: '#3b82f6', marginRight: 4 }} />
                                <Text strong>Saldo: {formatCurrency(saldoAtual)}</Text>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <Space style={{ width: '100%' }} direction="vertical" size="small">
                      <Button
                        block
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setSelectedCaixa(caixaAberto);
                          setShowMovimentacaoModal(true);
                        }}
                      >
                        Movimentação
                      </Button>
                      <Button
                        block
                        danger
                        icon={<LockOutlined />}
                        onClick={() => {
                          setSelectedCaixa(caixaAberto);
                          setShowCloseModal(true);
                        }}
                      >
                        Fechar Caixa
                      </Button>
                    </Space>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Caixa está fechado</Text>
                    <Button
                      type="primary"
                      icon={<UnlockOutlined />}
                      onClick={() => {
                        setSelectedSetor(setor);
                        setShowOpenModal(true);
                      }}
                    >
                      Abrir Caixa
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Lista de Movimentações */}
      {selectedCaixa && movimentacoes.length > 0 && (
        <Card
          title={
            <Space>
              <Text strong>Movimentações - {setoresInfo[selectedCaixa.setor].nome}</Text>
              <Tag>{movimentacoes.length}</Tag>
            </Space>
          }
          style={{ borderRadius: 16, border: '1px solid #f0f0f0' }}
        >
          <Table
            columns={columns}
            dataSource={movimentacoes}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total de ${total} movimentações`
            }}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {/* Modal Abrir Caixa */}
      <Modal
        title={`Abrir Caixa - ${selectedSetor ? setoresInfo[selectedSetor].nome : ''}`}
        open={showOpenModal}
        onOk={handleOpenCaixa}
        onCancel={() => setShowOpenModal(false)}
        okText="Abrir Caixa"
        cancelText="Cancelar"
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8 }}>
            <Text>Valor Inicial *</Text>
          </div>
          <InputNumber
            style={{ width: '100%' }}
            size="large"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={openFormData.valor_inicial}
            onChange={(value) => setOpenFormData({ valor_inicial: value })}
            prefix="R$"
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            Informe o valor inicial em dinheiro no caixa
          </Text>
        </div>
      </Modal>

      {/* Modal Fechar Caixa */}
      <Modal
        title={`Fechar Caixa - ${selectedCaixa ? setoresInfo[selectedCaixa.setor].nome : ''}`}
        open={showCloseModal}
        onOk={handleCloseCaixa}
        onCancel={() => setShowCloseModal(false)}
        okText="Fechar Caixa"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
        width={500}
      >
        <div style={{ padding: '16px 0' }}>
          {selectedCaixa && (() => {
            const { totalEntradas, totalSaidas, saldoAtual } = calcularTotaisCaixa(selectedCaixa);
            return (
              <div style={{ padding: 16, background: '#f9fafb', borderRadius: 8, marginBottom: 16 }}>
                <div><Text strong>Valor Inicial:</Text> {formatCurrency(selectedCaixa.valor_inicial)}</div>
                <div><Text strong>Total Entradas:</Text> {formatCurrency(totalEntradas)}</div>
                <div><Text strong>Total Saídas:</Text> {formatCurrency(totalSaidas)}</div>
                <div><Text strong>Saldo Esperado:</Text> {formatCurrency(saldoAtual)}</div>
              </div>
            );
          })()}

          <div style={{ marginBottom: 8 }}>
            <Text>Valor Final (Contado) *</Text>
          </div>
          <InputNumber
            style={{ width: '100%' }}
            size="large"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={closeFormData.valor_final}
            onChange={(value) => setCloseFormData({ valor_final: value })}
            prefix="R$"
          />
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            Informe o valor real contado no caixa
          </Text>
        </div>
      </Modal>

      {/* Modal Adicionar Movimentação */}
      <Modal
        title={`Nova Movimentação - ${selectedCaixa ? setoresInfo[selectedCaixa.setor].nome : ''}`}
        open={showMovimentacaoModal}
        onOk={handleAddMovimentacao}
        onCancel={() => setShowMovimentacaoModal(false)}
        okText="Adicionar"
        cancelText="Cancelar"
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Tipo *</Text>
              </div>
              <Select
                style={{ width: '100%' }}
                size="large"
                value={movimentacaoFormData.tipo}
                onChange={(value) => setMovimentacaoFormData({ ...movimentacaoFormData, tipo: value })}
              >
                <Select.Option value="entrada">Entrada</Select.Option>
                <Select.Option value="saida">Saída</Select.Option>
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Valor *</Text>
              </div>
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                placeholder="0.00"
                min={0.01}
                step={0.01}
                value={movimentacaoFormData.valor}
                onChange={(value) => setMovimentacaoFormData({ ...movimentacaoFormData, valor: value })}
                prefix="R$"
              />
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Categoria *</Text>
              </div>
              <Input
                size="large"
                placeholder="Ex: Venda de lanche, Troco, Despesa..."
                value={movimentacaoFormData.categoria}
                onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, categoria: e.target.value })}
              />
            </div>

            <div>
              <div style={{ marginBottom: 8 }}>
                <Text>Descrição</Text>
              </div>
              <TextArea
                rows={3}
                placeholder="Detalhes adicionais (opcional)"
                value={movimentacaoFormData.descricao}
                onChange={(e) => setMovimentacaoFormData({ ...movimentacaoFormData, descricao: e.target.value })}
              />
            </div>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default CaixaManager;
