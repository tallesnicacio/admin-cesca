import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import logger from '../utils/logger';
import {
  CalendarOutlined,
  PlusOutlined,
  SaveOutlined,
  PrinterOutlined,
  LeftOutlined,
  RightOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { Card, Button, Select, Input, Modal, message, Space, Typography, Row, Col, Statistic } from 'antd';

const { Title, Text } = Typography;

function PresencaManager({ userProfile }) {
  const [view, setView] = useState('list'); // 'list' ou 'registro'
  const [giras, setGiras] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [selectedGira, setSelectedGira] = useState(null);
  const [presencas, setPresencas] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showNovaGiraModal, setShowNovaGiraModal] = useState(false);
  const [novaGiraData, setNovaGiraData] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadGiras(),
        loadTrabalhadores()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadGiras = async () => {
    try {
      const { data, error } = await supabase
        .from('giras')
        .select('*')
        .order('data', { ascending: false });

      if (error) throw error;
      setGiras(data || []);
    } catch (error) {
      logger.error('Erro ao carregar giras:', error);
      message.error('Erro ao carregar giras');
    }
  };

  const loadTrabalhadores = async () => {
    try {
      const { data, error } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (error) throw error;
      setTrabalhadores(data || []);
    } catch (error) {
      logger.error('Erro ao carregar trabalhadores:', error);
      message.error('Erro ao carregar trabalhadores');
    }
  };

  const loadPresencas = async (giraId) => {
    try {
      const { data, error } = await supabase
        .from('presencas')
        .select('*')
        .eq('gira_id', giraId);

      if (error) throw error;

      // Converter array para objeto indexado por trabalhador_id
      const presencasMap = {};
      (data || []).forEach(p => {
        presencasMap[p.trabalhador_id] = p;
      });

      setPresencas(presencasMap);
    } catch (error) {
      logger.error('Erro ao carregar presenças:', error);
      message.error('Erro ao carregar presenças');
    }
  };

  const getDiaSemana = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const dia = date.getDay();
    return dia === 1 ? 'Segunda' : dia === 5 ? 'Sexta' : null;
  };

  const handleNovaGira = async () => {
    if (!novaGiraData) {
      message.error('Selecione uma data');
      return;
    }

    const diaSemana = getDiaSemana(novaGiraData);

    if (!diaSemana) {
      message.error('A data deve ser uma Segunda ou Sexta-feira');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('giras')
        .insert([{
          data: novaGiraData,
          dia_semana: diaSemana,
          horario_inicio: '19:30',
          horario_fim: '23:00',
          status: 'planejada',
          criado_por: userProfile?.id
        }])
        .select()
        .single();

      if (error) throw error;

      message.success('Gira criada com sucesso!');
      setShowNovaGiraModal(false);
      setNovaGiraData('');
      loadGiras();

      // Abrir automaticamente para registrar presença
      handleRegistrarPresenca(data);
    } catch (error) {
      logger.error('Erro ao criar gira:', error);
      if (error.code === '23505') {
        message.error('Já existe uma gira cadastrada para esta data');
      } else {
        message.error('Erro ao criar gira: ' + error.message);
      }
    }
  };

  const handleRegistrarPresenca = async (gira) => {
    setSelectedGira(gira);
    await loadPresencas(gira.id);
    setView('registro');
  };

  const handleChangeStatusPresenca = (trabalhadorId, status) => {
    setPresencas(prev => {
      const atual = prev[trabalhadorId] || {};
      return {
        ...prev,
        [trabalhadorId]: {
          ...atual,
          status_presenca: status,
          presente: status === 'P',
          justificativa_ausencia: ['J', 'F', 'A'].includes(status) ? atual.justificativa_ausencia : null
        }
      };
    });
  };

  const handleChangeJustificativa = (trabalhadorId, justificativa) => {
    setPresencas(prev => ({
      ...prev,
      [trabalhadorId]: {
        ...prev[trabalhadorId],
        justificativa_ausencia: justificativa
      }
    }));
  };

  const handleSalvarPresencas = async () => {
    try {
      setSaving(true);

      // Preparar dados para inserção/atualização
      const presencasParaSalvar = trabalhadores.map(t => {
        const presenca = presencas[t.id] || { status_presenca: 'F', presente: false };
        const status = presenca.status_presenca || (presenca.presente ? 'P' : 'F');

        return {
          gira_id: selectedGira.id,
          trabalhador_id: t.id,
          presente: status === 'P',
          status_presenca: status,
          justificativa_ausencia: ['J', 'F', 'A'].includes(status) ? presenca.justificativa_ausencia : null,
          registrado_por: userProfile?.id
        };
      });

      // Deletar presenças existentes
      const { error: deleteError } = await supabase
        .from('presencas')
        .delete()
        .eq('gira_id', selectedGira.id);

      if (deleteError) throw deleteError;

      // Inserir novas presenças
      const { error: insertError } = await supabase
        .from('presencas')
        .insert(presencasParaSalvar);

      if (insertError) throw insertError;

      // Atualizar status da gira para 'realizada'
      const { error: updateError } = await supabase
        .from('giras')
        .update({ status: 'realizada' })
        .eq('id', selectedGira.id);

      if (updateError) throw updateError;

      message.success('Presenças salvas com sucesso!');
      loadGiras();
      setView('list');
    } catch (error) {
      logger.error('Erro ao salvar presenças:', error);
      message.error('Erro ao salvar presenças: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImprimirLista = () => {
    const presentes = trabalhadores.filter(t => presencas[t.id]?.presente);
    const ausentes = trabalhadores.filter(t => !presencas[t.id]?.presente);

    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lista de Presença - ${new Date(selectedGira.data).toLocaleDateString('pt-BR')}</title>
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
          .info {
            text-align: center;
            margin-bottom: 30px;
            color: #666;
          }
          h2 {
            color: #333;
            background: #f0f0f0;
            padding: 10px;
            margin-top: 30px;
            border-left: 4px solid #667eea;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
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
          .ausentes {
            margin-top: 40px;
          }
          .count {
            font-size: 0.9em;
            color: #666;
          }
        </style>
      </head>
      <body>
        <h1>🌟 Centro Espírita Santa Clara de Assis 🌟</h1>
        <div class="info">
          <strong>Lista de Presença - ${selectedGira.dia_semana}-feira</strong><br>
          ${new Date(selectedGira.data).toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}<br>
          ${selectedGira.horario_inicio} às ${selectedGira.horario_fim}
        </div>

        <h2>✓ PRESENTES <span class="count">(${presentes.length} trabalhador${presentes.length !== 1 ? 'es' : ''})</span></h2>
        <table>
          <thead>
            <tr>
              <th style="width: 5%">#</th>
              <th style="width: 60%">Nome</th>
              <th style="width: 35%">Telefone</th>
            </tr>
          </thead>
          <tbody>
            ${presentes.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${t.nome_completo}</strong></td>
                <td>${t.telefone || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${ausentes.length > 0 ? `
          <div class="ausentes">
            <h2>✗ AUSENTES <span class="count">(${ausentes.length} trabalhador${ausentes.length !== 1 ? 'es' : ''})</span></h2>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%">#</th>
                  <th style="width: 40%">Nome</th>
                  <th style="width: 25%">Telefone</th>
                  <th style="width: 30%">Justificativa</th>
                </tr>
              </thead>
              <tbody>
                ${ausentes.map((t, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td><strong>${t.nome_completo}</strong></td>
                    <td>${t.telefone || '-'}</td>
                    <td>${presencas[t.id]?.justificativa_ausencia || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666;">
          <strong>Total de trabalhadores: ${trabalhadores.length}</strong> |
          Presentes: ${presentes.length} |
          Ausentes: ${ausentes.length}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        fontSize: isMobile ? '16px' : '18px'
      }}>
        Carregando...
      </div>
    );
  }

  // VIEW: Lista de Giras
  if (view === 'list') {
    const girasDoMes = giras.filter(g => {
      const giraDate = new Date(g.data);
      return giraDate.getMonth() === currentMonth.getMonth() &&
             giraDate.getFullYear() === currentMonth.getFullYear();
    });

    const getStatusColor = (status) => {
      if (status === 'planejada') return '#1890ff';
      if (status === 'realizada') return '#52c41a';
      return '#d9d9d9';
    };

    const getStatusBgColor = (status) => {
      if (status === 'planejada') return '#e6f7ff';
      if (status === 'realizada') return '#f6ffed';
      return '#fafafa';
    };

    return (
      <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isMobile ? '20px' : '32px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontSize: isMobile ? '20px' : '28px' }}>
            Controle de Presença
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowNovaGiraModal(true)}
            size={isMobile ? 'middle' : 'large'}
            style={{ borderRadius: '8px' }}
          >
            Nova Gira
          </Button>
        </div>

        <Card
          style={{
            marginBottom: '24px',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
          bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}>
            <Button
              icon={<LeftOutlined />}
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              size={isMobile ? 'middle' : 'large'}
              style={{ borderRadius: '8px' }}
            />
            <Title level={isMobile ? 4 : 3} style={{ margin: 0, textAlign: 'center', fontSize: isMobile ? '16px' : '20px' }}>
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
            </Title>
            <Button
              icon={<RightOutlined />}
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              size={isMobile ? 'middle' : 'large'}
              style={{ borderRadius: '8px' }}
            />
          </div>
        </Card>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {girasDoMes.length === 0 ? (
            <Card
              style={{
                borderRadius: '16px',
                textAlign: 'center',
                padding: isMobile ? '32px 16px' : '48px 24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              <CalendarOutlined style={{ fontSize: isMobile ? '40px' : '48px', color: '#d9d9d9', marginBottom: '16px' }} />
              <Title level={4} style={{ fontSize: isMobile ? '16px' : '18px' }}>Nenhuma gira cadastrada neste mês</Title>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => setShowNovaGiraModal(true)}
                size={isMobile ? 'middle' : 'large'}
                style={{ marginTop: '16px', borderRadius: '8px' }}
              >
                Criar primeira gira
              </Button>
            </Card>
          ) : (
            girasDoMes.map(gira => (
              <Card
                key={gira.id}
                style={{
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  borderLeft: `4px solid ${getStatusColor(gira.status)}`,
                  backgroundColor: getStatusBgColor(gira.status)
                }}
                bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
              >
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} sm={14} md={16}>
                    <div>
                      <Title level={isMobile ? 5 : 4} style={{ margin: 0, marginBottom: '8px', fontSize: isMobile ? '16px' : '18px' }}>
                        {new Date(gira.data).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long'
                        }).replace(/^\w/, c => c.toUpperCase())}
                      </Title>
                      <Text type="secondary" style={{ fontSize: isMobile ? '13px' : '14px' }}>
                        {gira.horario_inicio} às {gira.horario_fim}
                      </Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6} md={4} style={{ textAlign: isMobile ? 'left' : 'center' }}>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      backgroundColor: getStatusColor(gira.status),
                      color: 'white',
                      fontSize: isMobile ? '12px' : '13px',
                      fontWeight: '500'
                    }}>
                      {gira.status === 'planejada' ? 'Planejada' :
                       gira.status === 'realizada' ? 'Realizada' : 'Cancelada'}
                    </div>
                  </Col>
                  <Col xs={12} sm={4} md={4} style={{ textAlign: 'right' }}>
                    <Button
                      type="primary"
                      icon={<TeamOutlined />}
                      onClick={() => handleRegistrarPresenca(gira)}
                      size={isMobile ? 'middle' : 'large'}
                      style={{ borderRadius: '8px' }}
                      block={isMobile}
                    >
                      {isMobile ? (gira.status === 'realizada' ? 'Ver' : 'Registrar') : (gira.status === 'realizada' ? 'Ver Presença' : 'Registrar Presença')}
                    </Button>
                  </Col>
                </Row>
              </Card>
            ))
          )}
        </Space>

        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusOutlined />
              <span>Nova Gira</span>
            </div>
          }
          open={showNovaGiraModal}
          onCancel={() => setShowNovaGiraModal(false)}
          onOk={handleNovaGira}
          okText="Criar Gira"
          cancelText="Cancelar"
          width={isMobile ? '90%' : 500}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>Data da Gira *</Text>
              <Input
                type="date"
                value={novaGiraData}
                onChange={(e) => setNovaGiraData(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{ marginTop: '8px', borderRadius: '8px' }}
                size="large"
              />
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                Selecione uma Segunda ou Sexta-feira
              </Text>
            </div>
          </Space>
        </Modal>
      </div>
    );
  }

  // VIEW: Registro de Presença
  const getStatusColor = (status) => {
    if (status === 'P') return '#52c41a';
    if (status === 'F') return '#ff4d4f';
    if (status === 'J') return '#faad14';
    if (status === 'A') return '#d9d9d9';
    return '#d9d9d9';
  };

  const getStatusBgColor = (status) => {
    if (status === 'P') return '#f6ffed';
    if (status === 'F') return '#fff1f0';
    if (status === 'J') return '#fffbe6';
    if (status === 'A') return '#fafafa';
    return '#ffffff';
  };

  const totalPresentes = trabalhadores.filter(t => {
    const status = presencas[t.id]?.status_presenca || (presencas[t.id]?.presente ? 'P' : 'F');
    return status === 'P';
  }).length;

  const totalJustificadas = trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'J').length;
  const totalFaltas = trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'F').length;
  // const totalAfastados = trabalhadores.filter(t => presencas[t.id]?.status_presenca === 'A').length; // Não utilizado

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Card
        style={{
          marginBottom: '24px',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
        bodyStyle={{ padding: isMobile ? '16px' : '24px' }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Button
              icon={<LeftOutlined />}
              onClick={() => setView('list')}
              size={isMobile ? 'middle' : 'large'}
              style={{ borderRadius: '8px' }}
              block={isMobile}
            >
              Voltar
            </Button>
          </Col>
          <Col xs={24} sm={16} md={12} style={{ textAlign: isMobile ? 'left' : 'center' }}>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0, marginBottom: '4px', fontSize: isMobile ? '18px' : '22px' }}>
              {new Date(selectedGira.data).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              }).replace(/^\w/, c => c.toUpperCase())}
            </Title>
            <Text type="secondary" style={{ fontSize: isMobile ? '13px' : '14px' }}>
              {selectedGira.horario_inicio} às {selectedGira.horario_fim}
            </Text>
          </Col>
          <Col xs={24} sm={24} md={6} style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <Space size="middle" wrap>
              <Button
                icon={<PrinterOutlined />}
                onClick={handleImprimirLista}
                size={isMobile ? 'middle' : 'large'}
                style={{ borderRadius: '8px' }}
              >
                {!isMobile && 'Imprimir'}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSalvarPresencas}
                loading={saving}
                size={isMobile ? 'middle' : 'large'}
                style={{ borderRadius: '8px' }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: '16px', textAlign: 'center' }}>
            <Statistic
              title="Total"
              value={trabalhadores.length}
              valueStyle={{ fontSize: isMobile ? '24px' : '32px', color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: '16px', textAlign: 'center' }}>
            <Statistic
              title="Presentes"
              value={totalPresentes}
              valueStyle={{ fontSize: isMobile ? '24px' : '32px', color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: '16px', textAlign: 'center' }}>
            <Statistic
              title="Justificadas"
              value={totalJustificadas}
              valueStyle={{ fontSize: isMobile ? '24px' : '32px', color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderRadius: '16px', textAlign: 'center' }}>
            <Statistic
              title="Faltas"
              value={totalFaltas}
              valueStyle={{ fontSize: isMobile ? '24px' : '32px', color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {trabalhadores.map(trabalhador => {
          const presenca = presencas[trabalhador.id] || { status_presenca: 'F', presente: false };
          const status = presenca.status_presenca || (presenca.presente ? 'P' : 'F');
          const isPresente = status === 'P';

          return (
            <Card
              key={trabalhador.id}
              style={{
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: `4px solid ${getStatusColor(status)}`,
                backgroundColor: getStatusBgColor(status)
              }}
              bodyStyle={{ padding: isMobile ? '12px 16px' : '16px 24px' }}
            >
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={8} md={6}>
                  <Select
                    value={status}
                    onChange={(value) => handleChangeStatusPresenca(trabalhador.id, value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px'
                    }}
                    size={isMobile ? 'middle' : 'large'}
                    options={[
                      { value: 'P', label: '✓ Presente' },
                      { value: 'F', label: '✗ Falta' },
                      { value: 'J', label: '⚠ Justificada' },
                      { value: 'A', label: '⊗ Afastado' }
                    ]}
                  />
                </Col>
                <Col xs={24} sm={16} md={!isPresente ? 8 : 18}>
                  <div>
                    <Text strong style={{ fontSize: isMobile ? '15px' : '16px', display: 'block' }}>
                      {trabalhador.numero && (
                        <span style={{
                          display: 'inline-block',
                          backgroundColor: '#1890ff',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: isMobile ? '11px' : '12px',
                          marginRight: '8px'
                        }}>
                          #{trabalhador.numero}
                        </span>
                      )}
                      {trabalhador.nome_completo}
                    </Text>
                    <Space size="small" wrap style={{ marginTop: '4px' }}>
                      {trabalhador.funcao_permanente && (
                        <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '13px' }}>
                          {trabalhador.funcao_permanente}
                        </Text>
                      )}
                      {trabalhador.telefone && (
                        <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '13px' }}>
                          {trabalhador.telefone}
                        </Text>
                      )}
                    </Space>
                  </div>
                </Col>
                {!isPresente && (
                  <Col xs={24} sm={24} md={10}>
                    <Input
                      placeholder="Justificativa (opcional)"
                      value={presenca.justificativa_ausencia || ''}
                      onChange={(e) => handleChangeJustificativa(trabalhador.id, e.target.value)}
                      style={{ borderRadius: '8px' }}
                      size={isMobile ? 'middle' : 'large'}
                    />
                  </Col>
                )}
              </Row>
            </Card>
          );
        })}
      </Space>
    </div>
  );
}

export default PresencaManager;
