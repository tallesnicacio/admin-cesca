import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  Select,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Empty,
  Spin,
  Row,
  Col,
  Typography,
  Divider,
  message,
} from 'antd';
import {
  RetweetOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

import { validarAlocacao } from './utils/detectorConflitos';
import { formatarData } from './utils/algoritmoEscalas';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function SubstituicoesManager({ userProfile }) {
  const [loading, setLoading] = useState(false);
  const [substituicoes, setSubstituicoes] = useState([]);
  const [filtradas, setFiltradas] = useState([]);

  // Dados auxiliares
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [restricoes, setRestricoes] = useState([]);
  const [escalasDetalhes, setEscalasDetalhes] = useState([]);

  // Filtro
  const [statusFiltro, setStatusFiltro] = useState('pendente');

  // Modal
  const [modalNovo, setModalNovo] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [substituicaoSelecionada, setSubstituicaoSelecionada] = useState(null);

  // Form nova substituição
  const [escalaId, setEscalaId] = useState('');
  const [substitutoId, setSubstitutoId] = useState('');
  const [motivo, setMotivo] = useState('');

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadDados();
  }, []);

  useEffect(() => {
    filterSubstituicoes();
  }, [substituicoes, statusFiltro]);

  const loadDados = async () => {
    setLoading(true);
    try {
      // Buscar substituições
      // NOTA: Tabela substituicoes pode não existir ainda no banco
      // Comentando temporariamente até criar o schema completo
      const subs = [];
      const erroSubs = null;

      // const { data: subs, error: erroSubs } = await supabase
      //   .from('substituicoes')
      //   .select(
      //     `
      //     *,
      //     escala:escalas_detalhes(
      //       *,
      //       trabalhador:trabalhadores(nome_completo),
      //       tipo_atendimento:tipos_atendimento(nome, horario_inicio, horario_fim)
      //     ),
      //     substituto:trabalhadores!substituto_id(nome_completo),
      //     solicitante:profiles!solicitado_por(name)
      //   `
      //   )
      //   .order('created_at', { ascending: false });

      if (erroSubs) throw erroSubs;

      // Buscar trabalhadores
      const { data: trabs } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      // Buscar tipos
      const { data: tipos } = await supabase
        .from('tipos_atendimento')
        .select('*');

      // Buscar capacitações
      const { data: caps } = await supabase
        .from('trabalhadores_capacitacoes')
        .select('*');

      // Buscar restrições
      const { data: rests } = await supabase
        .from('restricoes_datas')
        .select('*');

      // Buscar escalas detalhes (para seleção)
      const { data: escalas } = await supabase
        .from('escalas_detalhes')
        .select(
          `
          *,
          trabalhador:trabalhadores(nome_completo),
          tipo_atendimento:tipos_atendimento(nome, horario_inicio, horario_fim),
          escala_mensal:escalas_mensais(mes, ano, status)
        `
        )
        .gte('data_atendimento', new Date().toISOString().split('T')[0])
        .order('data_atendimento');

      setSubstituicoes(subs || []);
      setTrabalhadores(trabs || []);
      setTiposAtendimento(tipos || []);
      setCapacitacoes(caps || []);
      setRestricoes(rests || []);
      setEscalasDetalhes(escalas || []);

      message.success('Dados carregados!');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterSubstituicoes = () => {
    let filtered = [...substituicoes];

    if (statusFiltro && statusFiltro !== 'todos') {
      filtered = filtered.filter((s) => s.status === statusFiltro);
    }

    setFiltradas(filtered);
  };

  const handleSolicitarSubstituicao = async () => {
    if (!escalaId) {
      message.error('Selecione o turno que deseja substituir!');
      return;
    }

    if (!motivo.trim()) {
      message.error('Informe o motivo da substituição!');
      return;
    }

    // Buscar escala selecionada
    const escala = escalasDetalhes.find((e) => e.id === escalaId);
    if (!escala) {
      message.error('Escala não encontrada!');
      return;
    }

    // Se substituto indicado, validar
    if (substitutoId) {
      const tipoAtendimento = tiposAtendimento.find(
        (t) => t.id === escala.tipo_atendimento_id
      );

      const escalasParaValidacao = escalasDetalhes
        .filter((e) => e.id !== escalaId)
        .map((e) => ({
          trabalhador_id: e.trabalhador_id,
          data_atendimento: e.data_atendimento,
          horario_inicio: e.tipo_atendimento.horario_inicio,
          horario_fim: e.tipo_atendimento.horario_fim,
        }));

      const validacao = validarAlocacao(
        substitutoId,
        tipoAtendimento,
        escala.data_atendimento,
        escalasParaValidacao,
        capacitacoes,
        restricoes
      );

      if (!validacao.valido) {
        message.error(`Substituto inválido: ${validacao.erros.join('. ')}`);
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('substituicoes').insert({
        escala_detalhe_id: escalaId,
        substituto_id: substitutoId || null,
        motivo: motivo,
        status: 'pendente',
        solicitado_por: userProfile.id,
      });

      if (error) throw error;

      message.success('Solicitação de substituição enviada!');
      setModalNovo(false);
      resetForm();
      loadDados();
    } catch (error) {
      console.error('Erro ao solicitar:', error);
      message.error('Erro ao solicitar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (substituicaoId) => {
    Modal.confirm({
      title: 'Aprovar Substituição',
      content: 'Deseja aprovar esta substituição?',
      okText: 'Aprovar',
      cancelText: 'Cancelar',
      onOk: async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('substituicoes')
            .update({
              status: 'aprovada',
              aprovado_por: userProfile.id,
              data_aprovacao: new Date().toISOString(),
            })
            .eq('id', substituicaoId);

          if (error) throw error;

          // Atualizar escala detalhe com novo trabalhador
          const substituicao = substituicoes.find((s) => s.id === substituicaoId);
          if (substituicao && substituicao.substituto_id) {
            const { error: erroUpdate } = await supabase
              .from('escalas_detalhes')
              .update({ trabalhador_id: substituicao.substituto_id })
              .eq('id', substituicao.escala_detalhe_id);

            if (erroUpdate) throw erroUpdate;
          }

          message.success('Substituição aprovada!');
          loadDados();
        } catch (error) {
          console.error('Erro ao aprovar:', error);
          message.error('Erro ao aprovar: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleRejeitar = async (substituicaoId) => {
    Modal.confirm({
      title: 'Rejeitar Substituição',
      content: 'Deseja rejeitar esta substituição?',
      okText: 'Rejeitar',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('substituicoes')
            .update({
              status: 'rejeitada',
              aprovado_por: userProfile.id,
              data_aprovacao: new Date().toISOString(),
            })
            .eq('id', substituicaoId);

          if (error) throw error;

          message.success('Substituição rejeitada!');
          loadDados();
        } catch (error) {
          console.error('Erro ao rejeitar:', error);
          message.error('Erro ao rejeitar: ' + error.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const resetForm = () => {
    setEscalaId('');
    setSubstitutoId('');
    setMotivo('');
  };

  const getStatusIcon = (status) => {
    const icons = {
      pendente: <ClockCircleOutlined />,
      aprovada: <CheckCircleOutlined />,
      rejeitada: <CloseCircleOutlined />,
    };
    return icons[status] || null;
  };

  const getStatusColor = (status) => {
    const colors = {
      pendente: 'warning',
      aprovada: 'success',
      rejeitada: 'error',
    };
    return colors[status] || 'default';
  };

  return (
    <div style={{ padding: isMobile ? '16px' : '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Card
        bordered={false}
        style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={16}>
            <Space direction={isMobile ? 'vertical' : 'horizontal'} size={16}>
              <RetweetOutlined style={{ fontSize: 32, color: '#06b6d4' }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Substituições de Turnos
                </Title>
                <Text type="secondary">Solicite e gerencie trocas de turnos escalados</Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalNovo(true)}
              size="large"
              style={{ width: isMobile ? '100%' : 'auto' }}
            >
              Nova Solicitação
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Filtros */}
      <Card
        bordered={false}
        style={{ marginBottom: 24, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>Status:</Text>
              <Select
                value={statusFiltro}
                onChange={setStatusFiltro}
                style={{ width: '100%' }}
                size="large"
              >
                <Select.Option value="pendente">Pendentes</Select.Option>
                <Select.Option value="aprovada">Aprovadas</Select.Option>
                <Select.Option value="rejeitada">Rejeitadas</Select.Option>
                <Select.Option value="todos">Todas</Select.Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={16}>
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
              {filtradas.length} registros
            </Tag>
          </Col>
        </Row>
      </Card>

      {/* Lista */}
      {loading && !substituicoes.length ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip="Carregando..."
          />
        </Card>
      ) : (
        <>
          {filtradas.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <Empty
                image={<RetweetOutlined style={{ fontSize: 48, color: '#cbd5e1' }} />}
                description="Nenhuma substituição encontrada"
              />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {filtradas.map((sub) => (
                <Col xs={24} sm={24} md={12} lg={8} key={sub.id}>
                  <Card
                    bordered={false}
                    style={{
                      borderRadius: 8,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      height: '100%',
                    }}
                  >
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      {/* Header do Card */}
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Tag
                            icon={getStatusIcon(sub.status)}
                            color={getStatusColor(sub.status)}
                            style={{ fontSize: 13, padding: '4px 12px' }}
                          >
                            {sub.status}
                          </Tag>
                        </Col>
                        <Col>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatarData(sub.created_at.split('T')[0])}
                          </Text>
                        </Col>
                      </Row>

                      <Divider style={{ margin: 0 }} />

                      {/* Informações */}
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Turno:
                          </Text>
                          <Text>
                            {sub.escala?.tipo_atendimento?.nome} -{' '}
                            {formatarData(sub.escala?.data_atendimento)}
                          </Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Horário:
                          </Text>
                          <Text>
                            {sub.escala?.tipo_atendimento?.horario_inicio} -{' '}
                            {sub.escala?.tipo_atendimento?.horario_fim}
                          </Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Trabalhador Original:
                          </Text>
                          <Text>{sub.escala?.trabalhador?.nome_completo}</Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Substituto Sugerido:
                          </Text>
                          <Text>{sub.substituto?.nome_completo || 'Não indicado'}</Text>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Motivo:
                          </Text>
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true, symbol: 'ver mais' }}
                            style={{ margin: 0 }}
                          >
                            {sub.motivo}
                          </Paragraph>
                        </div>

                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>
                            Solicitante:
                          </Text>
                          <Text>{sub.solicitante?.name}</Text>
                        </div>
                      </Space>

                      {/* Ações */}
                      {sub.status === 'pendente' && (
                        <>
                          <Divider style={{ margin: 0 }} />
                          <Space style={{ width: '100%' }} size={8}>
                            <Button
                              type="primary"
                              icon={<CheckOutlined />}
                              onClick={() => handleAprovar(sub.id)}
                              disabled={loading}
                              style={{ flex: 1 }}
                            >
                              Aprovar
                            </Button>
                            <Button
                              danger
                              icon={<CloseOutlined />}
                              onClick={() => handleRejeitar(sub.id)}
                              disabled={loading}
                              style={{ flex: 1 }}
                            >
                              Rejeitar
                            </Button>
                          </Space>
                        </>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* Modal Nova Solicitação */}
      <Modal
        title="Nova Solicitação de Substituição"
        open={modalNovo}
        onCancel={() => setModalNovo(false)}
        width={isMobile ? '100%' : 600}
        footer={[
          <Button key="cancel" onClick={() => setModalNovo(false)}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={loading ? <LoadingOutlined /> : <CheckOutlined />}
            onClick={handleSolicitarSubstituicao}
            loading={loading}
          >
            Solicitar
          </Button>,
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="Turno a ser substituído" required>
            <Select
              value={escalaId}
              onChange={setEscalaId}
              placeholder="Selecione..."
              size="large"
              showSearch
              optionFilterProp="children"
            >
              {escalasDetalhes.map((escala) => (
                <Select.Option key={escala.id} value={escala.id}>
                  {formatarData(escala.data_atendimento)} - {escala.tipo_atendimento?.nome} (
                  {escala.tipo_atendimento?.horario_inicio} -{' '}
                  {escala.tipo_atendimento?.horario_fim})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Substituto Sugerido (opcional)"
            help="Se deixar em branco, a coordenação escolherá um substituto."
          >
            <Select
              value={substitutoId}
              onChange={setSubstitutoId}
              placeholder="Não indicar"
              size="large"
              showSearch
              optionFilterProp="children"
              allowClear
            >
              {trabalhadores.map((trab) => (
                <Select.Option key={trab.id} value={trab.id}>
                  {trab.nome_completo}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Motivo" required>
            <TextArea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              placeholder="Explique o motivo da solicitação..."
              size="large"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SubstituicoesManager;
