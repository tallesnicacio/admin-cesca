import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import logger from '../utils/logger';
import {
  DownloadOutlined,
  RiseOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import {
  Card,
  Button,
  Table,
  Select,
  Statistic,
  Row,
  Col,
  Spin,
  Space,
  Typography,
  Progress,
  Tag,
  message
} from 'antd';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;

function Reports() {
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    confirmados: 0,
    cancelados: 0,
    porServico: {},
    ultimos7Dias: 0
  });
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [availableServices, setAvailableServices] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, serviceFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      let query = supabase.from('agendamentos').select('*');

      // Filtro por data
      if (dateFilter === '7days') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.gte('data_solicitacao', date.toISOString());
      } else if (dateFilter === '30days') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.gte('data_solicitacao', date.toISOString());
      }

      // Filtro por serviço
      if (serviceFilter !== 'all') {
        query = query.eq('primeira_opcao', serviceFilter);
      }

      const { data, error } = await query.order('data_solicitacao', { ascending: false });

      if (error) throw error;

      const agendamentosData = data || [];
      setAgendamentos(agendamentosData);

      // Extrair serviços únicos de todos os agendamentos (sem filtro)
      const { data: allData } = await supabase.from('agendamentos').select('primeira_opcao');
      const services = [...new Set((allData || []).map(a => a?.primeira_opcao).filter(Boolean))];
      setAvailableServices(services.sort());

      // Calcular estatísticas
      const porServico = {};
      agendamentosData.forEach(ag => {
        porServico[ag.primeira_opcao] = (porServico[ag.primeira_opcao] || 0) + 1;
      });

      const date7DaysAgo = new Date();
      date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);

      setStats({
        total: agendamentosData.length,
        pendentes: agendamentosData.filter(a => a.status === 'Pendente de confirmação').length,
        confirmados: agendamentosData.filter(a => a.status === 'Confirmado').length,
        cancelados: agendamentosData.filter(a => a.status === 'Cancelado').length,
        porServico,
        ultimos7Dias: agendamentosData.filter(a =>
          new Date(a.data_solicitacao) >= date7DaysAgo
        ).length
      });
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados dos relatórios');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF('landscape');

      doc.setFontSize(18);
      doc.text('Relatório de Agendamentos - CESCA', 14, 22);

      doc.setFontSize(11);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

      doc.autoTable({
        startY: 40,
        head: [['Estatística', 'Valor']],
        body: [
          ['Total de Agendamentos', stats.total],
          ['Pendentes', stats.pendentes],
          ['Confirmados', stats.confirmados],
          ['Cancelados', stats.cancelados],
          ['Últimos 7 Dias', stats.ultimos7Dias]
        ]
      });

      const serviceData = Object.entries(stats.porServico).map(([service, count]) => [service, count]);
      if (serviceData.length > 0) {
        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 10,
          head: [['Serviço', 'Quantidade']],
          body: serviceData
        });
      }

      // Adicionar tabela completa de agendamentos
      if (agendamentos.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Lista Completa de Agendamentos', 14, 20);

        const agendamentosData = (agendamentos || []).map(ag => [
          new Date(ag.data_solicitacao).toLocaleDateString('pt-BR'),
          ag.nome_completo,
          ag.email,
          ag.telefone,
          ag.primeira_opcao,
          ag.segunda_opcao || '-',
          ag.status,
          ag.atendente || '-',
          ag.canal_preferencial,
          ag.observacoes || '-'
        ]);

        doc.autoTable({
          startY: 30,
          head: [['Data', 'Nome', 'Email', 'Telefone', '1ª Opção', '2ª Opção', 'Status', 'Atendente', 'Canal', 'Observações']],
          body: agendamentosData,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [102, 126, 234] }
        });
      }

      doc.save(`relatorio_agendamentos_${new Date().toISOString().split('T')[0]}.pdf`);
      message.success('PDF exportado com sucesso!');
    } catch (error) {
      logger.error('Erro ao exportar PDF:', error);
      message.error('Erro ao exportar PDF');
    }
  };

  const exportExcel = () => {
    try {
      const dataToExport = (agendamentos || []).map(ag => ({
        'Data': new Date(ag.data_solicitacao).toLocaleString('pt-BR'),
        'Nome': ag.nome_completo,
        'Email': ag.email,
        'Telefone': ag.telefone,
        'Primeira Opção': ag.primeira_opcao,
        'Segunda Opção': ag.segunda_opcao || '-',
        'Status': ag.status,
        'Atendente': ag.atendente || '-',
        'Canal': ag.canal_preferencial
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos');
      XLSX.writeFile(wb, `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`);
      message.success('Excel exportado com sucesso!');
    } catch (error) {
      logger.error('Erro ao exportar Excel:', error);
      message.error('Erro ao exportar Excel');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Confirmado':
        return 'success';
      case 'Pendente de confirmação':
        return 'warning';
      case 'Cancelado':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'Data',
      dataIndex: 'data_solicitacao',
      key: 'data_solicitacao',
      render: (date) => new Date(date).toLocaleString('pt-BR'),
      responsive: ['md'],
      width: isMobile ? undefined : 160
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      render: (text) => <strong>{text}</strong>,
      width: isMobile ? undefined : 200
    },
    {
      title: 'Contato',
      key: 'contato',
      render: (_, record) => (
        <div>
          <div>{record.email}</div>
          <div>{record.telefone}</div>
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
            {record.canal_preferencial}
          </Text>
        </div>
      ),
      responsive: ['lg'],
      width: isMobile ? undefined : 220
    },
    {
      title: 'Atendimento',
      key: 'atendimento',
      render: (_, record) => (
        <div>
          <div><strong>1ª:</strong> {record.primeira_opcao}</div>
          {record.segunda_opcao && <div><strong>2ª:</strong> {record.segunda_opcao}</div>}
        </div>
      ),
      width: isMobile ? undefined : 200
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <div>
          <Tag color={getStatusColor(record.status)}>{record.status}</Tag>
          {record.data_confirmacao && (
            <div>
              <Text type="secondary" style={{ fontSize: isMobile ? 10 : 11 }}>
                {new Date(record.data_confirmacao).toLocaleDateString('pt-BR')}
              </Text>
            </div>
          )}
        </div>
      ),
      width: isMobile ? undefined : 180
    },
    {
      title: 'Atendente',
      dataIndex: 'atendente',
      key: 'atendente',
      render: (text) => text || '-',
      responsive: ['md'],
      width: isMobile ? undefined : 150
    },
    {
      title: 'Observações',
      dataIndex: 'observacoes',
      key: 'observacoes',
      render: (text) => text || '-',
      responsive: ['xl'],
      ellipsis: true
    }
  ];

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? '12px' : '24px' }}>
      <Card
        style={{
          borderRadius: 16,
          marginBottom: isMobile ? 12 : 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>
              Relatórios e Estatísticas
            </Title>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                onClick={exportPDF}
                size={isMobile ? 'middle' : 'large'}
              >
                PDF
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={exportExcel}
                size={isMobile ? 'middle' : 'large'}
              >
                Excel
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card
        style={{
          borderRadius: 16,
          marginBottom: isMobile ? 12 : 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Select
              value={dateFilter}
              onChange={setDateFilter}
              style={{ width: '100%' }}
              size={isMobile ? 'middle' : 'large'}
            >
              <Option value="all">Todos os períodos</Option>
              <Option value="7days">Últimos 7 dias</Option>
              <Option value="30days">Últimos 30 dias</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12}>
            <Select
              value={serviceFilter}
              onChange={setServiceFilter}
              style={{ width: '100%' }}
              size={isMobile ? 'middle' : 'large'}
            >
              <Option value="all">Todos os atendimentos</Option>
              {availableServices.map(service => (
                <Option key={service} value={service}>{service}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Row gutter={[isMobile ? 12 : 16, isMobile ? 12 : 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="Total de Agendamentos"
              value={stats.total}
              prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ fontSize: isMobile ? 24 : 32 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="Pendentes"
              value={stats.pendentes}
              prefix={<RiseOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: isMobile ? 24 : 32 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="Confirmados"
              value={stats.confirmados}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: isMobile ? 24 : 32 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Statistic
              title="Cancelados"
              value={stats.cancelados}
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ fontSize: isMobile ? 24 : 32 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
            Agendamentos por Serviço
          </Title>
        }
        style={{
          borderRadius: 16,
          marginTop: isMobile ? 12 : 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {Object.entries(stats.porServico)
            .sort((a, b) => b[1] - a[1])
            .map(([service, count]) => (
              <div key={service}>
                <Row justify="space-between" style={{ marginBottom: 8 }}>
                  <Col>
                    <Text strong style={{ fontSize: isMobile ? 12 : 14 }}>{service}</Text>
                  </Col>
                  <Col>
                    <Text style={{ fontSize: isMobile ? 12 : 14 }}>{count}</Text>
                  </Col>
                </Row>
                <Progress
                  percent={Math.round((count / stats.total) * 100)}
                  strokeColor="#1890ff"
                  showInfo={!isMobile}
                />
              </div>
            ))}
        </Space>
      </Card>

      <Card
        title={
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                Lista Completa de Agendamentos
              </Title>
            </Col>
            <Col>
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                {agendamentos.length} registro(s)
              </Text>
            </Col>
          </Row>
        }
        style={{
          borderRadius: 16,
          marginTop: isMobile ? 12 : 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Table
          columns={columns}
          dataSource={agendamentos}
          rowKey="id"
          pagination={{
            pageSize: isMobile ? 5 : 10,
            showSizeChanger: !isMobile,
            showTotal: (total) => `Total: ${total} registros`,
            responsive: true
          }}
          scroll={{ x: isMobile ? 800 : undefined }}
          locale={{
            emptyText: 'Nenhum agendamento encontrado'
          }}
          size={isMobile ? 'small' : 'middle'}
        />
      </Card>
    </div>
  );
}

export default Reports;
