import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
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
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

function AgendamentoManager({ userProfile }) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [filteredAgendamentos, setFilteredAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalLoading, setModalLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
  }, [searchTerm, filterStatus, agendamentos]);

  const loadAgendamentos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data_solicitacao', { ascending: false });

      if (error) throw error;
      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      message.error('Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const filterAgendamentos = () => {
    let filtered = [...agendamentos];

    if (searchTerm) {
      filtered = filtered.filter(ag =>
        ag.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ag.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ag.telefone?.includes(searchTerm)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(ag => ag.status === filterStatus);
    }

    setFilteredAgendamentos(filtered);
  };

  const handleConfirmarAgendamento = async (agendamento) => {
    const nomeAtendente = userProfile?.name || 'Admin';

    // Se não houver segunda opção, usa a primeira automaticamente
    if (!agendamento.segunda_opcao) {
      setModalLoading(true);
      try {
        await handleUpdateStatus(agendamento.id, 'Confirmado', nomeAtendente, 'primeira');
      } finally {
        setModalLoading(false);
      }
      return;
    }

    // Se houver segunda opção, perguntar qual foi escolhida
    Modal.confirm({
      title: 'Qual opção de atendimento foi aceita?',
      content: (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Selecione qual das opções de atendimento o assistido aceitou:
          </Text>
          <div id="opcao-select-container"></div>
        </div>
      ),
      okText: 'Continuar',
      cancelText: 'Cancelar',
      onOk: async () => {
        const selectElement = document.querySelector('#opcao-select-value');
        const opcao = selectElement ? selectElement.value : 'primeira';
        setModalLoading(true);
        try {
          await handleUpdateStatus(agendamento.id, 'Confirmado', nomeAtendente, opcao);
        } finally {
          setModalLoading(false);
        }
      },
      afterClose: () => {
        const container = document.querySelector('#opcao-select-container');
        if (container) container.innerHTML = '';
      }
    });

    // Adicionar select ao modal após renderização
    setTimeout(() => {
      const container = document.querySelector('#opcao-select-container');
      if (container) {
        container.innerHTML = `
          <select id="opcao-select-value" class="ant-select ant-select-single" style="width: 100%; padding: 8px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 14px;">
            <option value="primeira">${agendamento.primeira_opcao}</option>
            <option value="segunda">${agendamento.segunda_opcao}</option>
          </select>
        `;
      }
    }, 100);
  };

  const handleUpdateStatus = async (id, newStatus, atendente = null, opcaoEscolhida = null) => {
    try {
      const updateData = { status: newStatus };
      if (newStatus === 'Confirmado') {
        updateData.data_confirmacao = new Date().toISOString();
        if (atendente) updateData.atendente = atendente;
        if (opcaoEscolhida) updateData.opcao_escolhida = opcaoEscolhida;
      }

      const { error } = await supabase
        .from('agendamentos')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      message.success('Status atualizado com sucesso!');
      loadAgendamentos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      message.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDelete = (id) => {
    confirm({
      title: 'Excluir agendamento',
      icon: <ExclamationCircleOutlined />,
      content: 'Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.',
      okText: 'Excluir',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('agendamentos')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Agendamento excluído com sucesso!');
          loadAgendamentos();
        } catch (error) {
          console.error('Erro ao excluir:', error);
          message.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  const handleCancelarAgendamento = (id) => {
    confirm({
      title: 'Cancelar agendamento',
      icon: <ExclamationCircleOutlined />,
      content: 'Tem certeza que deseja cancelar este agendamento?',
      okText: 'Sim, cancelar',
      okType: 'danger',
      cancelText: 'Não',
      onOk: async () => {
        await handleUpdateStatus(id, 'Cancelado');
      }
    });
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
      'Atendente': ag.atendente || '-',
      'Observações': ag.observacoes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
    XLSX.writeFile(wb, `agendamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Excel exportado com sucesso!');
  };

  const printCallList = () => {
    // Filtrar apenas confirmados
    const confirmados = agendamentos.filter(a => a.status === 'Confirmado');

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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
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
                <th style="width: 5%">#</th>
                <th style="width: 40%">Nome</th>
                <th style="width: 25%">Telefone</th>
                <th style="width: 30%">Observações</th>
              </tr>
            </thead>
            <tbody>
              ${porTipo[tipo].map((ag, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${ag.nome_completo}</strong></td>
                  <td>${ag.telefone}</td>
                  <td>${ag.observacoes || '-'}</td>
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

    printWindow.document.write(html);
    printWindow.document.close();

    // Aguardar carregamento e imprimir
    printWindow.onload = () => {
      printWindow.print();
    };
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
      render: (nome, record) => (
        <Space>
          <Text strong>{nome}</Text>
          {record.observacoes && (
            <Tooltip title={record.observacoes}>
              <InfoCircleOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
            </Tooltip>
          )}
        </Space>
      ),
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
                onClick={() => handleCancelarAgendamento(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="Excluir">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
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
                value={agendamentos.length}
                valueStyle={{ color: '#1a1a1a', fontSize: 32, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #f59e0b' }}>
              <Statistic
                title="Pendentes"
                value={agendamentos.filter(a => a.status === 'Pendente de confirmação').length}
                valueStyle={{ color: '#f59e0b', fontSize: 32, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #10b981' }}>
              <Statistic
                title="Confirmados"
                value={agendamentos.filter(a => a.status === 'Confirmado').length}
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
    </div>
  );
}

export default AgendamentoManager;
