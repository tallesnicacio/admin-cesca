import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDebounce } from '../hooks/useDebounce';
import logger from '../utils/logger';
import * as XLSX from 'xlsx';
import ConfirmacaoEmailModal from './ConfirmacaoEmailModal';
import {
  Table,
  Button,
  Input,
  Select,
  Modal,
  Space,
  Tag,
  Row,
  Col,
  Card,
  Statistic,
  Spin,
  Empty,
  message,
  Typography,
  Divider,
  Tooltip
} from 'antd';
import {
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
// const { confirm } = Modal; // Não utilizado - removido

function AgendamentoManager({ userProfile }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [filteredAgendamentos, setFilteredAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalLoading, setModalLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [modalOpcaoVisible, setModalOpcaoVisible] = useState(false);
  const [modalCancelarVisible, setModalCancelarVisible] = useState(false);
  const [modalExcluirVisible, setModalExcluirVisible] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState(null);
  const [opcaoSelecionada, setOpcaoSelecionada] = useState('primeira');
  const [modalEmailVisible, setModalEmailVisible] = useState(false);
  const [agendamentoParaEmail, setAgendamentoParaEmail] = useState(null);
  const [opcaoEscolhidaEmail, setOpcaoEscolhidaEmail] = useState('primeira');

  // Debounce search term para melhorar performance (500ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadAgendamentos();
  }, []);

  useEffect(() => {
    filterAgendamentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filterStatus, agendamentos]);

  const loadAgendamentos = async () => {
    try {
      logger.log('📥 ========== CARREGANDO AGENDAMENTOS ==========');
      setLoading(true);

      // Verificar sessão antes de carregar
      const { data: sessionData } = await supabase.auth.getSession();
      logger.log('🔐 Sessão ao carregar:', {
        temSessao: !!sessionData?.session,
        usuario: sessionData?.session?.user?.email || 'SEM USUÁRIO'
      });

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_solicitacao', { ascending: false });

      logger.log('📬 Resposta do Supabase:', {
        quantidadeAgendamentos: data?.length || 0,
        error: error ? error.message : 'SEM ERRO'
      });

      if (error) throw error;
      setAgendamentos(data || []);
      logger.log('✅ Agendamentos carregados:', data?.length || 0);
    } catch (error) {
      logger.error('❌ Erro ao carregar agendamentos:', error);
      message.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const filterAgendamentos = () => {
    let filtered = [...agendamentos];

    if (debouncedSearchTerm) {
      filtered = filtered.filter(ag =>
        ag.nome_completo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        ag.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        ag.telefone?.includes(debouncedSearchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(ag => ag?.status === filterStatus);
    }

    setFilteredAgendamentos(filtered);
  };

  const handleConfirmarAgendamento = async (agendamento) => {
    logger.log('🔔 ========== BOTÃO CONFIRMAR CLICADO ==========');
    logger.log('📋 Agendamento:', agendamento);
    logger.log('👤 UserProfile:', userProfile);
    logger.log('📝 Nome do atendente:', userProfile?.name || 'Admin');
    logger.log('🔢 ID do agendamento:', agendamento?.id);
    logger.log('1️⃣ Primeira opção:', agendamento?.primeira_opcao);
    logger.log('2️⃣ Segunda opção:', agendamento?.segunda_opcao);

    const nomeAtendente = userProfile?.name || 'Admin';

    // Se não houver segunda opção, usa a primeira automaticamente
    if (!agendamento.segunda_opcao) {
      logger.log('➡️ NÃO há segunda opção - confirmando automaticamente com primeira opção');
      setModalLoading(true);
      try {
        logger.log('🔄 Chamando handleUpdateStatus...');
        await handleUpdateStatus(agendamento.id, 'Confirmado', nomeAtendente, 'primeira');
        logger.log('✅ handleUpdateStatus completou sem erros');

        // Após confirmar, mostrar modal de envio de email
        setAgendamentoParaEmail(agendamento);
        setOpcaoEscolhidaEmail('primeira');

        // Aguardar um pouco antes de mostrar o modal de email
        setTimeout(() => {
          setModalEmailVisible(true);
        }, 300);
      } catch (error) {
        logger.error('❌ ERRO ao confirmar agendamento:', error);
        message.error('Erro ao confirmar agendamento: ' + error.message);
      } finally {
        setModalLoading(false);
        logger.log('🏁 setModalLoading(false)');
      }
      return;
    }

    // Se houver segunda opção, mostrar modal para escolher
    logger.log('➡️ HÁ segunda opção - abrindo modal para escolher');
    setAgendamentoSelecionado(agendamento);
    setOpcaoSelecionada('primeira'); // Reseta para primeira opção
    setModalOpcaoVisible(true);
    logger.log('✅ Modal deve estar aberto agora');
  };

  const handleConfirmarComOpcao = async () => {
    const nomeAtendente = userProfile?.name || 'Admin';
    setModalLoading(true);
    try {
      await handleUpdateStatus(
        agendamentoSelecionado.id,
        'Confirmado',
        nomeAtendente,
        opcaoSelecionada
      );

      // Após confirmar, mostrar modal de envio de email
      setAgendamentoParaEmail(agendamentoSelecionado);
      setOpcaoEscolhidaEmail(opcaoSelecionada);

      setModalOpcaoVisible(false);
      setAgendamentoSelecionado(null);

      // Aguardar um pouco antes de mostrar o próximo modal
      setTimeout(() => {
        setModalEmailVisible(true);
      }, 300);
    } catch (error) {
      logger.error('Erro ao confirmar:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, atendente = null, opcaoEscolhida = null) => {
    try {
      logger.log('🚀 ========== INÍCIO handleUpdateStatus ==========');
      logger.log('📥 Parâmetros recebidos:', {
        id,
        newStatus,
        atendente,
        opcaoEscolhida,
        userProfile
      });

      const updateData = { status: newStatus };
      if (newStatus === 'Confirmado') {
        updateData.data_confirmacao = new Date().toISOString();
        if (atendente) updateData.atendente = atendente;
        if (opcaoEscolhida) updateData.opcao_escolhida = opcaoEscolhida;
      }

      logger.log('📝 updateData preparado:', updateData);
      logger.log('🔑 ID do agendamento:', id);
      logger.log('👤 Usuário logado:', userProfile);

      // Verificar sessão do Supabase
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      logger.log('🔐 Sessão atual:', {
        session: sessionData?.session ? 'EXISTE' : 'NÃO EXISTE',
        user: sessionData?.session?.user?.email || 'SEM USUÁRIO',
        error: sessionError
      });

      if (!sessionData?.session) {
        logger.error('❌ ERRO: Não há sessão ativa!');
        message.error('Você não está autenticado. Faça login novamente.');
        return;
      }

      logger.log('📤 Enviando UPDATE para Supabase...');
      const { data, error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', id)
        .select();

      logger.log('📬 Resposta do Supabase:', {
        data,
        error,
        hasData: !!data,
        dataLength: data?.length
      });

      if (error) {
        logger.error('❌ ERRO DO SUPABASE:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          errorCompleto: error
        });
        throw error;
      }

      if (!data || data.length === 0) {
        logger.error('❌ AVISO: UPDATE não retornou dados!');
        logger.error('Isso pode significar que o registro não existe ou foi bloqueado por RLS');
        throw new Error('Nenhum registro foi atualizado. Verifique as permissões.');
      }

      logger.log('✅ Agendamento atualizado com sucesso:', data);
      message.success('Status atualizado com sucesso!');
      loadAgendamentos();
      logger.log('🏁 ========== FIM handleUpdateStatus ==========');
    } catch (error) {
      logger.error('❌ ========== ERRO em handleUpdateStatus ==========');
      logger.error('Tipo do erro:', error.constructor.name);
      logger.error('Mensagem:', error.message);
      logger.error('Stack:', error.stack);
      logger.error('Erro completo:', error);
      message.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDelete = (agendamento) => {
    logger.log('🗑️ ========== BOTÃO EXCLUIR CLICADO ==========');
    logger.log('🔢 ID do agendamento:', agendamento?.id);
    setAgendamentoSelecionado(agendamento);
    setModalExcluirVisible(true);
  };

  const confirmarExclusao = async () => {
    if (!agendamentoSelecionado) return;

    try {
      setModalLoading(true);
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', agendamentoSelecionado.id);

      if (error) throw error;
      message.success('Agendamento excluído com sucesso!');
      setModalExcluirVisible(false);
      setAgendamentoSelecionado(null);
      loadAgendamentos();
    } catch (error) {
      logger.error('Erro ao excluir:', error);
      message.error('Erro ao excluir: ' + error.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelarAgendamento = (agendamento) => {
    logger.log('🔴 ========== BOTÃO CANCELAR CLICADO ==========');
    logger.log('🔢 ID do agendamento:', agendamento?.id);
    logger.log('📋 Agendamento completo:', agendamento);
    setAgendamentoSelecionado(agendamento);
    setModalCancelarVisible(true);
    logger.log('✅ Estado atualizado, modal deve abrir');
  };

  const confirmarCancelamento = async () => {
    if (!agendamentoSelecionado) return;

    logger.log('✅ Usuário confirmou o cancelamento no modal');
    logger.log('🔄 Chamando handleUpdateStatus para cancelar...');

    try {
      setModalLoading(true);
      await handleUpdateStatus(agendamentoSelecionado.id, 'Cancelado');
      setModalCancelarVisible(false);
      setAgendamentoSelecionado(null);
    } catch (error) {
      logger.error('❌ Erro ao cancelar:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredAgendamentos.map(ag => ({
      'Data Solicitação': new Date(ag.data_solicitacao).toLocaleString('pt-BR'),
      'Nome': ag.nome_completo,
      'Email': ag.email,
      'Telefone': ag.telefone,
      'Primeira Opção': ag.primeira_opcao,
      'Segunda Opção': ag.segunda_opcao || '-',
      'Opção Escolhida': ag.opcao_escolhida === 'primeira' ? '1ª Opção' : ag.opcao_escolhida === 'segunda' ? '2ª Opção' : '-',
      'Canal': ag.canal_preferencial,
      'Status': ag.status,
      'Atendente': ag.atendente || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Excel exportado com sucesso!');
  };

  const printCallList = () => {
    // Filtrar apenas confirmados
    const confirmados = (agendamentos || []).filter(a => a?.status === 'Confirmado');

    if (confirmados.length === 0) {
      message.warning('Nenhum agendamento confirmado para imprimir');
      return;
    }

    // Agrupar por tipo de atendimento (baseado na opção escolhida)
    const porTipo = {};
    confirmados.forEach(ag => {
      // Usar a opção escolhida se disponível, senão usa a primeira opção
      const tipo = ag.opcao_escolhida === 'segunda' ? ag.segunda_opcao : ag.primeira_opcao;
      if (!porTipo[tipo]) {
        porTipo[tipo] = [];
      }
      porTipo[tipo].push(ag);
    });

    // Gerar HTML para impressão
    const printWindow = window.open('', '_blank');

    // Verificar se a janela foi aberta com sucesso
    if (!printWindow) {
      message.error('Pop-up bloqueado! Por favor, permita pop-ups para este site.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Lista de Chamada - CESCA</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
          }
          h1 {
            text-align: center;
            color: #667eea;
            margin-bottom: 10px;
          }
          h2 {
            color: #333;
            background: #f0f0f0;
            padding: 10px;
            margin-top: 30px;
            border-left: 4px solid #667eea;
          }
          .date {
            text-align: center;
            margin-bottom: 30px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .count {
            font-size: 0.9em;
            color: #666;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>🌟 Centro Espírita Santa Clara de Assis 🌟</h1>
        <div class="date">Lista de Chamada - ${new Date().toLocaleDateString('pt-BR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</div>

        ${Object.keys(porTipo).sort().map(tipo => `
          <h2>${tipo} <span class="count">(${porTipo[tipo].length} pessoa${porTipo[tipo].length !== 1 ? 's' : ''})</span></h2>
          <table>
            <thead>
              <tr>
                <th style="width: 10%">#</th>
                <th style="width: 60%">Nome</th>
                <th style="width: 30%">Telefone</th>
              </tr>
            </thead>
            <tbody>
              ${porTipo[tipo].map((ag, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${ag.nome_completo}</strong></td>
                  <td>${ag.telefone}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}

        <div class="footer">
          Total de agendamentos confirmados: <strong>${confirmados.length}</strong>
        </div>
      </body>
      </html>
    `;

    try {
      printWindow.document.write(html);
      printWindow.document.close();

      // Usar setTimeout em vez de onload para garantir renderização
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);

      message.success('Lista de chamada gerada com sucesso!');
    } catch (error) {
      logger.error('Erro ao gerar lista de impressão:', error);
      message.error('Erro ao gerar lista de impressão');
      printWindow.close();
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      'Pendente de confirmação': { color: 'orange', text: 'Pendente' },
      'Confirmado': { color: 'green', text: 'Confirmado' },
      'Cancelado': { color: 'red', text: 'Cancelado' }
    };
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: 'Data',
      dataIndex: 'data_solicitacao',
      key: 'data_solicitacao',
      width: 180,
      render: (date) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {new Date(date).toLocaleString('pt-BR')}
        </Text>
      ),
      sorter: (a, b) => new Date(a.data_solicitacao) - new Date(b.data_solicitacao),
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      render: (nome) => <Text strong>{nome}</Text>,
      sorter: (a, b) => (a.nome_completo || '').localeCompare(b.nome_completo || ''),
    },
    {
      title: 'Contato',
      key: 'contato',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 13 }}>{record.email}</Text>
          <Text style={{ fontSize: 13 }}>{record.telefone}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.canal_preferencial}</Text>
        </Space>
      ),
    },
    {
      title: 'Atendimento',
      key: 'atendimento',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 13 }}>
            <strong>1ª:</strong> {record.primeira_opcao}
            {record.opcao_escolhida === 'primeira' &&
              <CheckOutlined style={{ color: '#10b981', marginLeft: 4 }} />
            }
          </Text>
          {record.segunda_opcao && (
            <Text style={{ fontSize: 13 }}>
              <strong>2ª:</strong> {record.segunda_opcao}
              {record.opcao_escolhida === 'segunda' &&
                <CheckOutlined style={{ color: '#10b981', marginLeft: 4 }} />
              }
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <Space direction="vertical" size={4}>
          {getStatusTag(status)}
          {record.atendente && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Por: {record.atendente}
            </Text>
          )}
        </Space>
      ),
      filters: [
        { text: 'Pendente', value: 'Pendente de confirmação' },
        { text: 'Confirmado', value: 'Confirmado' },
        { text: 'Cancelado', value: 'Cancelado' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'Pendente de confirmação' && (
            <Tooltip title="Confirmar">
              <Button
                type="text"
                icon={<CheckOutlined />}
                style={{ color: '#10b981' }}
                onClick={() => handleConfirmarAgendamento(record)}
              />
            </Tooltip>
          )}
          {record.status !== 'Cancelado' && (
            <Tooltip title="Cancelar">
              <Button
                type="text"
                icon={<CloseOutlined />}
                style={{ color: '#f59e0b' }}
                onClick={() => handleCancelarAgendamento(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Excluir">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: 16,
          gap: isMobile ? 12 : 0
        }}>
          <div>
            <Title level={2} style={{ margin: 0, fontSize: isMobile ? 24 : 32, fontWeight: 600, letterSpacing: '-0.5px' }}>
              Agendamentos
            </Title>
            <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15 }}>
              Gerencie as solicitações de agendamento
            </Text>
          </div>
          <Space direction={isMobile ? 'horizontal' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
            <Button
              icon={<PrinterOutlined />}
              onClick={printCallList}
              size={isMobile ? 'middle' : 'large'}
              style={{ flex: isMobile ? 1 : 'none' }}
            >
              {isMobile ? 'Lista' : 'Lista de Chamada'}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportToExcel}
              size={isMobile ? 'middle' : 'large'}
              style={{ flex: isMobile ? 1 : 'none' }}
            >
              {isMobile ? 'Excel' : 'Exportar Excel'}
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: isMobile ? '16px 0' : '24px 0', borderColor: '#f0f0f0' }} />

        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
              <Statistic
                title="Total de Agendamentos"
                value={(agendamentos || []).length}
                valueStyle={{ color: '#1a1a1a', fontSize: 32, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #f59e0b' }}>
              <Statistic
                title="Pendentes"
                value={(agendamentos || []).filter(a => a?.status === 'Pendente de confirmação').length}
                valueStyle={{ color: '#f59e0b', fontSize: 32, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #10b981' }}>
              <Statistic
                title="Confirmados"
                value={(agendamentos || []).filter(a => a?.status === 'Confirmado').length}
                valueStyle={{ color: '#10b981', fontSize: 32, fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Space
          direction={isMobile ? 'vertical' : 'horizontal'}
          size="middle"
          style={{ width: '100%', marginBottom: isMobile ? 16 : 24 }}
        >
          <Input
            placeholder={isMobile ? "Buscar..." : "Buscar por nome, email ou telefone..."}
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: isMobile ? '100%' : 400, borderRadius: 10 }}
            allowClear
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            size={isMobile ? 'middle' : 'large'}
            style={{ width: isMobile ? '100%' : 200, borderRadius: 10 }}
          >
            <Option value="all">Todos os Status</Option>
            <Option value="Pendente de confirmação">Pendentes</Option>
            <Option value="Confirmado">Confirmados</Option>
            <Option value="Cancelado">Cancelados</Option>
          </Select>
        </Space>
      </div>

      {/* Table */}
      <div
        style={{
          background: '#fff',
          borderRadius: isMobile ? 12 : 16,
          border: '1px solid #f0f0f0',
          padding: isMobile ? 12 : 24,
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredAgendamentos}
          rowKey="id"
          pagination={{
            pageSize: isMobile ? 10 : 20,
            showSizeChanger: !isMobile,
            showTotal: (total) => `${total} agendamentos`,
            size: isMobile ? 'small' : 'default'
          }}
          locale={{
            emptyText: <Empty description="Nenhum agendamento encontrado" />
          }}
          loading={modalLoading}
          scroll={{ x: isMobile ? 800 : undefined }}
          size={isMobile ? 'small' : 'default'}
        />
      </div>

      {/* Modal para selecionar opção de agendamento */}
      <Modal
        title="Confirmar Agendamento"
        open={modalOpcaoVisible}
        onOk={handleConfirmarComOpcao}
        onCancel={() => {
          setModalOpcaoVisible(false);
          setAgendamentoSelecionado(null);
        }}
        okText="Confirmar"
        cancelText="Cancelar"
        confirmLoading={modalLoading}
        width={500}
      >
        {agendamentoSelecionado && (
          <div style={{ padding: '16px 0' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Qual opção de atendimento o assistido <strong>{agendamentoSelecionado.nome_completo}</strong> aceitou?
            </Text>
            <Select
              value={opcaoSelecionada}
              onChange={setOpcaoSelecionada}
              style={{ width: '100%' }}
              size="large"
            >
              <Option value="primeira">
                <strong>1ª Opção:</strong> {agendamentoSelecionado.primeira_opcao}
              </Option>
              <Option value="segunda">
                <strong>2ª Opção:</strong> {agendamentoSelecionado.segunda_opcao}
              </Option>
            </Select>
          </div>
        )}
      </Modal>

      {/* Modal de Cancelar Agendamento */}
      <Modal
        title="Cancelar Agendamento"
        open={modalCancelarVisible}
        onOk={confirmarCancelamento}
        onCancel={() => {
          setModalCancelarVisible(false);
          setAgendamentoSelecionado(null);
        }}
        okText="Sim, cancelar"
        okType="danger"
        cancelText="Não"
        confirmLoading={modalLoading}
        width={500}
      >
        {agendamentoSelecionado && (
          <div style={{ padding: '16px 0' }}>
            <ExclamationCircleOutlined style={{ color: '#f59e0b', fontSize: 24, marginBottom: 16 }} />
            <Text style={{ display: 'block', marginBottom: 16 }}>
              Tem certeza que deseja cancelar o agendamento de <strong>{agendamentoSelecionado.nome_completo}</strong>?
            </Text>
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div><Text type="secondary">Email:</Text> <Text>{agendamentoSelecionado.email}</Text></div>
              <div><Text type="secondary">Telefone:</Text> <Text>{agendamentoSelecionado.telefone}</Text></div>
              <div><Text type="secondary">Atendimento:</Text> <Text>{agendamentoSelecionado.primeira_opcao}</Text></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Excluir Agendamento */}
      <Modal
        title="Excluir Agendamento"
        open={modalExcluirVisible}
        onOk={confirmarExclusao}
        onCancel={() => {
          setModalExcluirVisible(false);
          setAgendamentoSelecionado(null);
        }}
        okText="Excluir"
        okType="danger"
        cancelText="Cancelar"
        confirmLoading={modalLoading}
        width={500}
      >
        {agendamentoSelecionado && (
          <div style={{ padding: '16px 0' }}>
            <ExclamationCircleOutlined style={{ color: '#ef4444', fontSize: 24, marginBottom: 16 }} />
            <Text style={{ display: 'block', marginBottom: 16 }}>
              Tem certeza que deseja <strong style={{ color: '#ef4444' }}>EXCLUIR PERMANENTEMENTE</strong> o agendamento de <strong>{agendamentoSelecionado.nome_completo}</strong>?
            </Text>
            <Text type="danger" style={{ display: 'block', marginBottom: 16 }}>
              ⚠️ Esta ação não pode ser desfeita!
            </Text>
            <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <div><Text type="secondary">Email:</Text> <Text>{agendamentoSelecionado.email}</Text></div>
              <div><Text type="secondary">Telefone:</Text> <Text>{agendamentoSelecionado.telefone}</Text></div>
              <div><Text type="secondary">Status:</Text> <Text>{agendamentoSelecionado.status}</Text></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Confirmação de Envio de Email */}
      <ConfirmacaoEmailModal
        visible={modalEmailVisible}
        onClose={() => {
          setModalEmailVisible(false);
          setAgendamentoParaEmail(null);
        }}
        agendamento={agendamentoParaEmail}
        opcaoEscolhida={opcaoEscolhidaEmail}
      />
    </div>
  );
}

export default AgendamentoManager;
