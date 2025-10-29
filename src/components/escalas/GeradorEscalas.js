import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Button,
  Select,
  Spin,
  Row,
  Col,
  Card,
  Statistic,
  Alert,
  message,
  Typography,
  Space
} from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  SaveOutlined,
  EyeOutlined,
} from '@ant-design/icons';

import {
  gerarEscalasAutomaticas,
  agruparEscalasPorData,
  formatarData,
} from './utils/algoritmoEscalas';

const { Title, Text } = Typography;
const { Option } = Select;

function GeradorEscalas({ userProfile }) {
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Dados necessários
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [funcoesFixas, setFuncoesFixas] = useState([]);
  const [restricoes, setRestricoes] = useState([]);

  // Seleção de mês/ano
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);

  // Resultado da geração
  const [resultado, setResultado] = useState(null);
  const [visualizacao, setVisualizacao] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadDados();
  }, []);

  const loadDados = async () => {
    setLoading(true);
    try {
      // Buscar tipos de atendimento
      const { data: tipos, error: erroTipos } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .order('nome');

      if (erroTipos) throw erroTipos;

      // Buscar trabalhadores ativos
      const { data: trabs, error: erroTrabs } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (erroTrabs) throw erroTrabs;

      // Buscar capacitações
      const { data: caps, error: erroCaps } = await supabase
        .from('trabalhadores_capacitacoes')
        .select('*');

      if (erroCaps) throw erroCaps;

      // Buscar funções fixas
      const { data: funcoes, error: erroFuncoes } = await supabase
        .from('funcoes_fixas')
        .select('*');

      if (erroFuncoes) throw erroFuncoes;

      // Buscar restrições
      const { data: rests, error: erroRests } = await supabase
        .from('restricoes_datas')
        .select('*');

      if (erroRests) throw erroRests;

      setTiposAtendimento(tipos || []);
      setTrabalhadores(trabs || []);
      setCapacitacoes(caps || []);
      setFuncoesFixas(funcoes || []);
      setRestricoes(rests || []);

      message.success('Dados carregados com sucesso!');
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarEscalas = () => {
    if (tiposAtendimento.length === 0) {
      message.error('Nenhum tipo de atendimento cadastrado!');
      return;
    }

    if (trabalhadores.length === 0) {
      message.error('Nenhum trabalhador ativo cadastrado!');
      return;
    }

    setGerando(true);

    try {
      const resultado = gerarEscalasAutomaticas(
        anoSelecionado,
        mesSelecionado,
        tiposAtendimento,
        trabalhadores,
        capacitacoes,
        funcoesFixas,
        restricoes
      );

      setResultado(resultado);
      setVisualizacao(agruparEscalasPorData(resultado.escalas));

      // Mostrar resumo
      if (resultado.erros.length > 0) {
        message.error(`${resultado.erros.length} erro(s) encontrado(s)!`);
      } else if (resultado.avisos.length > 0) {
        message.warning(`${resultado.avisos.length} aviso(s) encontrado(s)!`);
      } else {
        message.success(`${resultado.escalas.length} escalas geradas com sucesso!`);
      }
    } catch (error) {
      console.error('Erro ao gerar escalas:', error);
      message.error('Erro ao gerar escalas: ' + error.message);
    } finally {
      setGerando(false);
    }
  };

  const handleSalvarEscalas = async () => {
    if (!resultado || resultado.escalas.length === 0) {
      message.error('Nenhuma escala para salvar!');
      return;
    }

    const hide = message.loading('Salvando escalas...', 0);
    setLoading(true);

    try {
      // 1. Criar escala mensal
      const { data: escalaMensal, error: erroEscala } = await supabase
        .from('escalas_mensais')
        .insert({
          mes: mesSelecionado,
          ano: anoSelecionado,
          status: 'rascunho',
          criado_por: userProfile.id,
        })
        .select()
        .single();

      if (erroEscala) throw erroEscala;

      // 2. Inserir detalhes
      const detalhes = resultado.escalas.map((escala) => ({
        escala_mensal_id: escalaMensal.id,
        trabalhador_id: escala.trabalhador_id,
        tipo_atendimento_id: escala.tipo_atendimento_id,
        data_atendimento: escala.data_atendimento,
        funcao: escala.funcao,
      }));

      const { error: erroDetalhes } = await supabase
        .from('escalas_detalhes')
        .insert(detalhes);

      if (erroDetalhes) throw erroDetalhes;

      hide();
      message.success('Escalas salvas com sucesso!');
      setResultado(null);
      setVisualizacao(null);
    } catch (error) {
      console.error('Erro ao salvar escalas:', error);
      hide();
      message.error('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !resultado) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Carregando dados...</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Space>
          <ThunderboltOutlined style={{ fontSize: isMobile ? 20 : 28, color: '#f59e0b' }} />
          <div>
            <Title level={3} style={{ margin: 0, fontSize: isMobile ? 18 : 24, fontWeight: 600 }}>
              Gerador Automático de Escalas
            </Title>
            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
              {isMobile ? 'Escalas para 2ª e 6ª feiras' : 'Gera escalas inteligentes para segundas e sextas-feiras do mês'}
            </Text>
          </div>
        </Space>
      </div>

      {/* Seleção de Mês/Ano */}
      <Card style={{ marginBottom: isMobile ? 16 : 24, borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} size={isMobile ? 'middle' : 'large'} style={{ width: '100%' }}>
          {!isMobile && <CalendarOutlined style={{ fontSize: 24, color: '#3b82f6' }} />}

          <div style={{ width: isMobile ? '100%' : 'auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Mês</Text>
            <Select
              value={mesSelecionado}
              onChange={setMesSelecionado}
              disabled={gerando || loading}
              style={{ width: isMobile ? '100%' : 160 }}
              size={isMobile ? 'middle' : 'large'}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                <Option key={mes} value={mes}>
                  {new Date(2025, mes - 1, 1).toLocaleDateString('pt-BR', {
                    month: 'long',
                  })}
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ width: isMobile ? '100%' : 'auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Ano</Text>
            <Select
              value={anoSelecionado}
              onChange={setAnoSelecionado}
              disabled={gerando || loading}
              style={{ width: isMobile ? '100%' : 120 }}
              size={isMobile ? 'middle' : 'large'}
            >
              {Array.from({ length: 5 }, (_, i) => anoAtual + i).map((ano) => (
                <Option key={ano} value={ano}>
                  {ano}
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ width: isMobile ? '100%' : 'auto', paddingTop: isMobile ? 0 : 20 }}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGerarEscalas}
              disabled={gerando || loading}
              loading={gerando}
              size={isMobile ? 'middle' : 'large'}
              style={{ fontWeight: 500, width: isMobile ? '100%' : 'auto' }}
            >
              {gerando ? 'Gerando...' : 'Gerar Escalas'}
            </Button>
          </div>
        </Space>
      </Card>

      {/* Resultado */}
      {resultado && (
        <div>
          {/* Estatísticas */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #10b981' }}>
                <Statistic
                  title="Escalas Geradas"
                  value={resultado.escalas.length}
                  prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                  valueStyle={{ color: '#10b981', fontSize: 32, fontWeight: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #f59e0b' }}>
                <Statistic
                  title="Avisos"
                  value={resultado.avisos.length}
                  prefix={<WarningOutlined style={{ color: '#f59e0b' }} />}
                  valueStyle={{ color: '#f59e0b', fontSize: 32, fontWeight: 600 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, border: '1px solid #ef4444' }}>
                <Statistic
                  title="Erros"
                  value={resultado.erros.length}
                  prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                  valueStyle={{ color: '#ef4444', fontSize: 32, fontWeight: 600 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Avisos */}
          {resultado.avisos.length > 0 && (
            <Alert
              message="Avisos"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {resultado.avisos.map((aviso, idx) => (
                    <li key={idx}>{aviso}</li>
                  ))}
                </ul>
              }
              type="warning"
              icon={<WarningOutlined />}
              style={{ marginBottom: 16, borderRadius: 12 }}
              showIcon
            />
          )}

          {/* Erros */}
          {resultado.erros.length > 0 && (
            <Alert
              message="Erros"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {resultado.erros.map((erro, idx) => (
                    <li key={idx}>{erro}</li>
                  ))}
                </ul>
              }
              type="error"
              icon={<CloseCircleOutlined />}
              style={{ marginBottom: 16, borderRadius: 12 }}
              showIcon
            />
          )}

          {/* Visualização */}
          {visualizacao && visualizacao.length > 0 && (
            <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
              <Title level={4} style={{ marginBottom: isMobile ? 16 : 24, fontSize: isMobile ? 16 : 18 }}>
                <EyeOutlined style={{ marginRight: 8 }} />
                Prévia das Escalas
              </Title>

              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {visualizacao.map((grupo) => (
                  <Card
                    key={grupo.data}
                    type="inner"
                    title={
                      <Space direction={isMobile ? 'vertical' : 'horizontal'} size={isMobile ? 2 : 'middle'}>
                        <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{formatarData(grupo.data)}</Text>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>{grupo.dia_semana}</Text>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                          ({grupo.escalas.length} escalas)
                        </Text>
                      </Space>
                    }
                    style={{ borderRadius: 8 }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {grupo.escalas.map((escala, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: isMobile ? 10 : 12,
                            background: escala.funcao_fixa ? '#f0f9ff' : '#fafafa',
                            borderRadius: 8,
                            border: `1px solid ${escala.funcao_fixa ? '#bfdbfe' : '#f0f0f0'}`,
                          }}
                        >
                          <Row gutter={16} align="middle">
                            <Col flex="auto">
                              <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>{escala.tipo_nome}</Text>
                                <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
                                  {escala.horario_inicio} - {escala.horario_fim}
                                </Text>
                                <Text style={{ fontSize: isMobile ? 13 : 14 }}>
                                  {escala.trabalhador_nome}
                                  {escala.funcao && (
                                    <Text type="secondary" style={{ marginLeft: 8, fontSize: isMobile ? 12 : 13 }}>
                                      ({escala.funcao})
                                    </Text>
                                  )}
                                </Text>
                              </Space>
                            </Col>
                            {escala.funcao_fixa && (
                              <Col>
                                <Text
                                  style={{
                                    background: '#3b82f6',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: isMobile ? 11 : 12,
                                    fontWeight: 500,
                                  }}
                                >
                                  Fixa
                                </Text>
                              </Col>
                            )}
                          </Row>
                        </div>
                      ))}
                    </Space>
                  </Card>
                ))}
              </Space>

              {/* Botões de Ação */}
              <div style={{
                marginTop: isMobile ? 16 : 24,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'flex-end',
                gap: 12
              }}>
                <Button
                  size={isMobile ? 'middle' : 'large'}
                  onClick={() => {
                    setResultado(null);
                    setVisualizacao(null);
                  }}
                  disabled={loading}
                  style={{ width: isMobile ? '100%' : 'auto' }}
                >
                  Descartar
                </Button>
                <Button
                  type="primary"
                  size={isMobile ? 'middle' : 'large'}
                  icon={<SaveOutlined />}
                  onClick={handleSalvarEscalas}
                  disabled={loading || resultado.erros.length > 0}
                  loading={loading}
                  style={{ width: isMobile ? '100%' : 'auto' }}
                >
                  Salvar Escalas
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default GeradorEscalas;
