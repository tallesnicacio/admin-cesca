import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  Select,
  Spin,
  Space,
  Typography,
  Modal,
  message,
  Row,
  Col,
  Descriptions,
  Badge,
  Input,
  Alert,
} from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { detectarConflito, validarAlocacao } from './utils/detectorConflitos';
import { agruparEscalasPorData, formatarData } from './utils/algoritmoEscalas';

const { Title, Text } = Typography;
const { Option } = Select;

function PainelRevisao({ userProfile }) {
  const [loading, setLoading] = useState(false);
  const [escalas, setEscalas] = useState([]);
  const [escalasFiltradas, setEscalasFiltradas] = useState([]);
  const [escalaMensal, setEscalaMensal] = useState(null);

  // Dados auxiliares
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [restricoes, setRestricoes] = useState([]);

  // Filtros
  const [mesAno, setMesAno] = useState('');
  const [escalaMensalId, setEscalaMensalId] = useState(null);

  // Modal de edição
  const [modalEdit, setModalEdit] = useState(false);
  const [escalaEdit, setEscalaEdit] = useState(null);
  const [trabalhadorSelecionado, setTrabalhadorSelecionado] = useState('');

  useEffect(() => {
    loadDadosAuxiliares();
  }, []);

  useEffect(() => {
    if (escalaMensalId) {
      loadEscalasMes(escalaMensalId);
    }
  }, [escalaMensalId]);

  const loadDadosAuxiliares = async () => {
    try {
      const { data: trabs } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      const { data: tipos } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .order('nome');

      const { data: caps } = await supabase
        .from('trabalhadores_capacitacoes')
        .select('*');

      const { data: rests } = await supabase
        .from('restricoes_datas')
        .select('*');

      setTrabalhadores(trabs || []);
      setTiposAtendimento(tipos || []);
      setCapacitacoes(caps || []);
      setRestricoes(rests || []);
    } catch (error) {
      console.error('Erro ao carregar dados auxiliares:', error);
    }
  };

  const loadEscalasMes = async (escalaMensalId) => {
    setLoading(true);
    try {
      // Buscar escala mensal
      const { data: mensal, error: erroMensal } = await supabase
        .from('escalas_mensais')
        .select('*')
        .eq('id', escalaMensalId)
        .single();

      if (erroMensal) throw erroMensal;

      // Buscar detalhes com joins
      const { data: detalhes, error: erroDetalhes } = await supabase
        .from('escalas_detalhes')
        .select(
          `
          *,
          trabalhador:trabalhadores(id, nome_completo),
          tipo_atendimento:tipos_atendimento(id, nome, horario_inicio, horario_fim, dia_semana)
        `
        )
        .eq('escala_mensal_id', escalaMensalId)
        .order('data_atendimento');

      if (erroDetalhes) throw erroDetalhes;

      // Formatar dados
      const escalasFormatadas = detalhes.map((det) => ({
        ...det,
        trabalhador_nome: det.trabalhador?.nome_completo,
        tipo_nome: det.tipo_atendimento?.nome,
        horario_inicio: det.tipo_atendimento?.horario_inicio,
        horario_fim: det.tipo_atendimento?.horario_fim,
      }));

      setEscalaMensal(mensal);
      setEscalas(escalasFormatadas);
      setEscalasFiltradas(escalasFormatadas);
      message.success('Escalas carregadas!');
    } catch (error) {
      console.error('Erro ao carregar escalas:', error);
      message.error('Erro ao carregar escalas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarEscalas = async () => {
    if (!mesAno) {
      message.error('Selecione o mês/ano!');
      return;
    }

    const [ano, mes] = mesAno.split('-').map(Number);

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('escalas_mensais')
        .select('*')
        .eq('mes', mes)
        .eq('ano', ano)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          message.error('Nenhuma escala encontrada para este mês!');
        } else {
          throw error;
        }
        return;
      }

      setEscalaMensalId(data.id);
    } catch (error) {
      console.error('Erro ao buscar escalas:', error);
      message.error('Erro ao buscar escalas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarEscala = (escala) => {
    setEscalaEdit(escala);
    setTrabalhadorSelecionado(escala.trabalhador_id);
    setModalEdit(true);
  };

  const handleSalvarEdicao = async () => {
    if (!trabalhadorSelecionado) {
      message.error('Selecione um trabalhador!');
      return;
    }

    // Validar alocação
    const tipoAtendimento = tiposAtendimento.find(
      (t) => t.id === escalaEdit.tipo_atendimento_id
    );

    const escalasParaValidacao = escalas
      .filter((e) => e.id !== escalaEdit.id)
      .map((e) => ({
        ...e,
        trabalhador_id: e.trabalhador_id,
        data_atendimento: e.data_atendimento,
        horario_inicio: e.horario_inicio,
        horario_fim: e.horario_fim,
      }));

    const validacao = validarAlocacao(
      trabalhadorSelecionado,
      tipoAtendimento,
      escalaEdit.data_atendimento,
      escalasParaValidacao,
      capacitacoes,
      restricoes
    );

    if (!validacao.valido) {
      message.error(validacao.erros.join('. '));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('escalas_detalhes')
        .update({ trabalhador_id: trabalhadorSelecionado })
        .eq('id', escalaEdit.id);

      if (error) throw error;

      message.success('Escala atualizada com sucesso!');
      setModalEdit(false);
      loadEscalasMes(escalaMensalId);
    } catch (error) {
      console.error('Erro ao atualizar escala:', error);
      message.error('Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletarEscala = async (escalaId) => {
    if (!window.confirm('Deseja realmente remover esta alocação?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('escalas_detalhes')
        .delete()
        .eq('id', escalaId);

      if (error) throw error;

      message.success('Alocação removida!');
      loadEscalasMes(escalaMensalId);
    } catch (error) {
      console.error('Erro ao deletar:', error);
      message.error('Erro ao deletar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublicarEscala = async () => {
    if (!window.confirm('Deseja publicar esta escala? Ela ficará visível para todos.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('escalas_mensais')
        .update({ status: 'publicada' })
        .eq('id', escalaMensalId);

      if (error) throw error;

      message.success('Escala publicada com sucesso!');
      loadEscalasMes(escalaMensalId);
    } catch (error) {
      console.error('Erro ao publicar:', error);
      message.error('Erro ao publicar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const visualizacao = escalas.length > 0 ? agruparEscalasPorData(escalas) : [];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <EyeOutlined style={{ fontSize: 28, color: '#3b82f6' }} />
          <div>
            <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              Painel de Revisão de Escalas
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Visualize, edite e publique escalas geradas
            </Text>
          </div>
        </Space>
      </div>

      {/* Busca */}
      <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Row gutter={16} align="middle">
          <Col>
            <CalendarOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
          </Col>
          <Col flex="auto">
            <Space size="large">
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
                  Selecione o Mês/Ano
                </Text>
                <Input
                  type="month"
                  value={mesAno}
                  onChange={(e) => setMesAno(e.target.value)}
                  disabled={loading}
                  style={{ width: 200 }}
                  size="large"
                />
              </div>
              <div style={{ paddingTop: 20 }}>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={handleBuscarEscalas}
                  disabled={loading}
                  loading={loading}
                  size="large"
                  style={{ fontWeight: 500 }}
                >
                  Buscar Escalas
                </Button>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Status */}
      {escalaMensal && (
        <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 13 }}>Mês/Ano</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {new Date(escalaMensal.ano, escalaMensal.mes - 1, 1).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </Space>
            </Col>
            <Col xs={24} sm={6}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 13 }}>Status</Text>
                <Badge
                  status={escalaMensal.status === 'publicada' ? 'success' : 'processing'}
                  text={
                    <Text strong>
                      {escalaMensal.status === 'rascunho' && 'Rascunho'}
                      {escalaMensal.status === 'publicada' && 'Publicada'}
                    </Text>
                  }
                />
              </Space>
            </Col>
            <Col xs={24} sm={6}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 13 }}>Total de Escalas</Text>
                <Text strong style={{ fontSize: 16 }}>{escalas.length}</Text>
              </Space>
            </Col>
            {escalaMensal.status === 'rascunho' && (
              <Col xs={24} sm={4}>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handlePublicarEscala}
                  disabled={loading}
                  loading={loading}
                  size="large"
                  style={{ width: '100%' }}
                >
                  Publicar
                </Button>
              </Col>
            )}
          </Row>
        </Card>
      )}

      {/* Visualização */}
      {visualizacao.length > 0 && (
        <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Title level={4} style={{ marginBottom: 24, fontSize: 18 }}>
            <EyeOutlined style={{ marginRight: 8 }} />
            Escalas do Mês
          </Title>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {visualizacao.map((grupo) => (
              <Card
                key={grupo.data}
                type="inner"
                title={
                  <Space>
                    <Text strong style={{ fontSize: 16 }}>{formatarData(grupo.data)}</Text>
                    <Text type="secondary">{grupo.dia_semana}</Text>
                    <Badge count={grupo.escalas.length} style={{ backgroundColor: '#3b82f6' }} />
                  </Space>
                }
                style={{ borderRadius: 8 }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  {grupo.escalas.map((escala) => (
                    <div
                      key={escala.id}
                      style={{
                        padding: 12,
                        background: '#fafafa',
                        borderRadius: 8,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <Row gutter={16} align="middle">
                        <Col flex="auto">
                          <Space direction="vertical" size={2}>
                            <Text strong style={{ fontSize: 14 }}>{escala.tipo_nome}</Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {escala.horario_inicio} - {escala.horario_fim}
                            </Text>
                            <Text>
                              <UserOutlined style={{ marginRight: 4 }} />
                              {escala.trabalhador_nome}
                            </Text>
                          </Space>
                        </Col>
                        <Col>
                          <Space>
                            <Button
                              type="default"
                              icon={<EditOutlined />}
                              onClick={() => handleEditarEscala(escala)}
                              disabled={escalaMensal?.status === 'publicada'}
                              title="Editar"
                            />
                            <Button
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeletarEscala(escala.id)}
                              disabled={escalaMensal?.status === 'publicada'}
                              title="Remover"
                            />
                          </Space>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {/* Modal de Edição */}
      <Modal
        title="Editar Alocação"
        open={modalEdit && escalaEdit !== null}
        onCancel={() => setModalEdit(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalEdit(false)} disabled={loading}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleSalvarEdicao}
            loading={loading}
            disabled={!trabalhadorSelecionado}
          >
            Salvar
          </Button>,
        ]}
        width={600}
      >
        {escalaEdit && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Tipo de Atendimento">
                <Text strong>{escalaEdit.tipo_nome}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Data">
                <Text strong>{formatarData(escalaEdit.data_atendimento)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Horário">
                <Text strong>
                  {escalaEdit.horario_inicio} - {escalaEdit.horario_fim}
                </Text>
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Selecionar Trabalhador: *
              </Text>
              <Select
                value={trabalhadorSelecionado || undefined}
                onChange={setTrabalhadorSelecionado}
                placeholder="Selecione um trabalhador..."
                disabled={loading}
                style={{ width: '100%' }}
                size="large"
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {trabalhadores.map((trab) => (
                  <Option key={trab.id} value={trab.id}>
                    <Space>
                      <UserOutlined />
                      {trab.nome_completo}
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default PainelRevisao;
