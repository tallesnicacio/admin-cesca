import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Button,
  Space,
  Tag,
  Progress,
  Modal,
  Descriptions,
  Timeline,
  Empty,
  Spin,
  Typography,
  message
} from 'antd';
import {
  DownloadOutlined,
  CalendarOutlined,
  TrophyOutlined,
  UserOutlined,
  BarChartOutlined,
  RiseOutlined,
  CloseOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

function PresencaReports() {
  const [loading, setLoading] = useState(true);
  const [estatisticas, setEstatisticas] = useState([]);
  const [giras, setGiras] = useState([]);
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [detalhes, setDetalhes] = useState(null);
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [filtroDataInicio, filtroDataFim]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadEstatisticas(),
        loadGiras()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadEstatisticas = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_presenca_trabalhadores')
        .select('*');

      if (error) throw error;
      setEstatisticas(data || []);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      message.error('Erro ao carregar estatísticas');
    }
  };

  const loadGiras = async () => {
    try {
      let query = supabase
        .from('vw_presenca_giras')
        .select('*');

      if (filtroDataInicio) {
        query = query.gte('data', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('data', filtroDataFim);
      }

      const { data, error } = await query;

      if (error) throw error;
      setGiras(data || []);
    } catch (error) {
      console.error('Erro ao carregar giras:', error);
      message.error('Erro ao carregar giras');
    }
  };

  const loadDetalhes = async (trabalhadorId) => {
    try {
      // Buscar informações do trabalhador
      const { data: trabalhador, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('id', trabalhadorId)
        .single();

      if (trabError) throw trabError;

      // Buscar todas as presenças do trabalhador
      let query = supabase
        .from('presencas')
        .select(`
          *,
          giras:gira_id (
            data,
            dia_semana,
            status
          )
        `)
        .eq('trabalhador_id', trabalhadorId)
        .order('created_at', { ascending: false });

      if (filtroDataInicio) {
        query = query.gte('giras.data', filtroDataInicio);
      }
      if (filtroDataFim) {
        query = query.lte('giras.data', filtroDataFim);
      }

      const { data: presencas, error: presError } = await query;

      if (presError) throw presError;

      setDetalhes({
        trabalhador,
        presencas: presencas || []
      });
      setModalVisible(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      message.error('Erro ao carregar detalhes');
    }
  };

  const handleVerDetalhes = (trabalhador) => {
    setSelectedTrabalhador(trabalhador);
    loadDetalhes(trabalhador.trabalhador_id || trabalhador.id);
  };

  const handleFecharDetalhes = () => {
    setSelectedTrabalhador(null);
    setDetalhes(null);
    setModalVisible(false);
  };

  const exportarExcel = () => {
    const dataToExport = estatisticas.map(e => ({
      'Nome': e.nome_completo,
      'Telefone': e.telefone || '-',
      'Email': e.email || '-',
      'Status': e.status,
      'Total de Giras': e.total_giras,
      'Presenças': e.total_presencas,
      'Ausências': e.total_ausencias,
      '% Presença': e.percentual_presenca + '%'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estatísticas');

    // Segunda aba com giras
    const girasToExport = giras.map(g => ({
      'Data': new Date(g.data).toLocaleDateString('pt-BR'),
      'Dia': g.dia_semana,
      'Status': g.status,
      'Presentes': g.total_presentes,
      'Ausentes': g.total_ausentes,
      'Total': g.total_registros
    }));

    const ws2 = XLSX.utils.json_to_sheet(girasToExport);
    XLSX.utils.book_append_sheet(wb, ws2, 'Giras');

    XLSX.writeFile(wb, `relatorio_presenca_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Relatório exportado com sucesso!');
  };

  const handleDateChange = (dates) => {
    if (dates && dates.length === 2) {
      setFiltroDataInicio(dates[0].format('YYYY-MM-DD'));
      setFiltroDataFim(dates[1].format('YYYY-MM-DD'));
    } else {
      setFiltroDataInicio('');
      setFiltroDataFim('');
    }
  };

  const totalTrabalhadores = estatisticas.length;
  const totalGiras = giras.length;
  const mediaPresenca = estatisticas.length > 0
    ? (estatisticas.reduce((acc, e) => acc + parseFloat(e.percentual_presenca), 0) / estatisticas.length).toFixed(2)
    : 0;

  const columns = [
    {
      title: '#',
      key: 'rank',
      width: 80,
      fixed: 'left',
      render: (_, __, index) => (
        <Space>
          <Text strong>{index + 1}</Text>
          {index === 0 && <TrophyOutlined style={{ color: '#FFD700', fontSize: 18 }} />}
          {index === 1 && <TrophyOutlined style={{ color: '#C0C0C0', fontSize: 18 }} />}
          {index === 2 && <TrophyOutlined style={{ color: '#CD7F32', fontSize: 18 }} />}
        </Space>
      )
    },
    {
      title: 'Nº',
      dataIndex: 'numero',
      key: 'numero',
      width: 60,
      render: (numero) => <Text strong>{numero || '-'}</Text>
    },
    {
      title: 'Nome',
      dataIndex: 'nome_completo',
      key: 'nome_completo',
      width: 200,
      fixed: 'left',
      render: (nome, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{nome}</Text>
          <Tag color={record.status === 'ativo' ? 'success' : record.status === 'afastado' ? 'warning' : 'default'}>
            {record.status === 'ativo' ? 'Ativo' : record.status === 'afastado' ? 'Afastado' : 'Inativo'}
          </Tag>
        </Space>
      )
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
      title: 'Função',
      dataIndex: 'funcao_permanente',
      key: 'funcao_permanente',
      width: 150,
      render: (funcao) => funcao || '-'
    },
    {
      title: 'Presentes (AP)',
      dataIndex: 'presencas',
      key: 'presencas',
      width: 120,
      align: 'center',
      render: (value) => <Tag color="success">{value || 0}</Tag>
    },
    {
      title: 'Justificadas (J)',
      dataIndex: 'justificadas',
      key: 'justificadas',
      width: 130,
      align: 'center',
      render: (value) => <Tag color="warning">{value || 0}</Tag>
    },
    {
      title: 'Faltas (F)',
      dataIndex: 'faltas',
      key: 'faltas',
      width: 100,
      align: 'center',
      render: (value) => <Tag color="error">{value || 0}</Tag>
    },
    {
      title: 'Ausências (A)',
      dataIndex: 'ausencias_afastamento',
      key: 'ausencias_afastamento',
      width: 120,
      align: 'center',
      render: (value) => <Tag color="default">{value || 0}</Tag>
    },
    {
      title: '% Presença',
      dataIndex: 'percentual_presenca',
      key: 'percentual_presenca',
      width: 150,
      align: 'center',
      sorter: (a, b) => parseFloat(a.percentual_presenca) - parseFloat(b.percentual_presenca),
      render: (percent) => {
        const value = parseFloat(percent);
        let status = 'exception';
        if (value >= 80) status = 'success';
        else if (value >= 50) status = 'normal';

        return (
          <div style={{ width: '100%' }}>
            <Progress
              percent={value}
              status={status}
              strokeColor={
                value >= 80 ? '#52c41a' : value >= 50 ? '#faad14' : '#ff4d4f'
              }
            />
          </div>
        );
      }
    },
    {
      title: 'Advertências',
      dataIndex: 'total_advertencias',
      key: 'total_advertencias',
      width: 120,
      align: 'center',
      render: (value) =>
        value > 0 ? (
          <Tag color="error">{value}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleVerDetalhes(record)}
        >
          Detalhes
        </Button>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="Carregando relatórios..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <BarChartOutlined /> Relatórios de Presença
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={exportarExcel}
            size="large"
          >
            Exportar Excel
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={24} md={18} lg={18}>
              <Space wrap>
                <CalendarOutlined />
                <Text strong>Período:</Text>
                <RangePicker
                  value={filtroDataInicio && filtroDataFim ? [dayjs(filtroDataInicio), dayjs(filtroDataFim)] : null}
                  onChange={handleDateChange}
                  format="DD/MM/YYYY"
                  placeholder={['Data Início', 'Data Fim']}
                />
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8} md={8} lg={8}>
          <Card>
            <Statistic
              title="Trabalhadores"
              value={totalTrabalhadores}
              prefix={<UserOutlined />}
              valueStyle={{
                color: '#667eea',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8} lg={8}>
          <Card>
            <Statistic
              title="Giras Realizadas"
              value={totalGiras}
              prefix={<CalendarOutlined />}
              valueStyle={{
                color: '#f093fb',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8} md={8} lg={8}>
          <Card>
            <Statistic
              title="Média de Presença"
              value={mediaPresenca}
              prefix={<RiseOutlined />}
              suffix="%"
              valueStyle={{
                color: '#4facfe',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <BarChartOutlined />
            <Text strong>Ranking de Presença</Text>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={estatisticas}
          rowKey="trabalhador_id"
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total de ${total} trabalhadores`
          }}
          locale={{
            emptyText: <Empty description="Nenhum dado disponível no período selecionado" />
          }}
          rowClassName={(record) =>
            parseFloat(record.percentual_presenca) >= 80 ? 'highlight-row' : ''
          }
        />
      </Card>

      <Modal
        title={
          <Space>
            <UserOutlined />
            Detalhes - {detalhes?.trabalhador?.nome_completo}
          </Space>
        }
        open={modalVisible}
        onCancel={handleFecharDetalhes}
        footer={[
          <Button key="close" type="primary" onClick={handleFecharDetalhes} icon={<CloseOutlined />}>
            Fechar
          </Button>
        ]}
        width={800}
        closeIcon={<CloseOutlined />}
      >
        {detalhes && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions bordered column={{ xs: 1, sm: 2, md: 2 }}>
              <Descriptions.Item label="Telefone">
                {detalhes.trabalhador.telefone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {detalhes.trabalhador.email || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={
                  detalhes.trabalhador.status === 'ativo' ? 'success' :
                  detalhes.trabalhador.status === 'afastado' ? 'warning' : 'default'
                }>
                  {detalhes.trabalhador.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={4}>Histórico de Presenças</Title>
              {detalhes.presencas.length === 0 ? (
                <Empty description="Nenhum registro de presença" />
              ) : (
                <Timeline
                  items={detalhes.presencas.map(p => ({
                    color: p.presente ? 'green' : 'red',
                    children: (
                      <div>
                        <Space direction="vertical" size="small">
                          <Space>
                            <Text strong>
                              {new Date(p.giras.data).toLocaleDateString('pt-BR', {
                                weekday: 'long',
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </Text>
                            <Tag color={p.presente ? 'success' : 'error'}>
                              {p.presente ? 'Presente' : 'Ausente'}
                            </Tag>
                          </Space>
                          {!p.presente && p.justificativa_ausencia && (
                            <Text type="secondary" italic>
                              Justificativa: {p.justificativa_ausencia}
                            </Text>
                          )}
                          {p.observacoes && (
                            <Text type="secondary">
                              Obs: {p.observacoes}
                            </Text>
                          )}
                        </Space>
                      </div>
                    )
                  }))}
                />
              )}
            </div>
          </Space>
        )}
      </Modal>

      <style>{`
        .highlight-row {
          background-color: #f6ffed;
        }
        .highlight-row:hover td {
          background-color: #f6ffed !important;
        }
      `}</style>
    </div>
  );
}

export default PresencaReports;
