import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Modal,
  message,
  Empty,
  Spin,
  Tag,
  List,
  Row,
  Col,
} from 'antd';
import {
  TrophyOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CapacitacoesManager = () => {
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [tiposAtendimento, setTiposAtendimento] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [capacitacoesEdit, setCapacitacoesEdit] = useState([]);

  // Carregar dados
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar trabalhadores ativos
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (trabError) throw trabError;

      // Carregar tipos de atendimento ativos
      const { data: tiposData, error: tiposError } = await supabase
        .from('tipos_atendimento')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tiposError) throw tiposError;

      // Carregar capacitações
      const { data: capData, error: capError } = await supabase
        .from('trabalhadores_capacitacoes')
        .select('*');

      if (capError) throw capError;

      setTrabalhadores(trabData || []);
      setTiposAtendimento(tiposData || []);
      setCapacitacoes(capData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Constantes
  const NIVEIS_EXPERIENCIA = [
    { value: 'iniciante', label: 'Iniciante', color: '#fbbf24' },
    { value: 'intermediario', label: 'Intermediário', color: '#60a5fa' },
    { value: 'experiente', label: 'Experiente', color: '#34d399' }
  ];

  const PRIORIDADES = [
    { value: 1, label: 'Alta', color: '#10b981' },
    { value: 2, label: 'Média', color: '#f59e0b' },
    { value: 3, label: 'Baixa', color: '#ef4444' }
  ];

  // Obter capacitações completas de um trabalhador
  const getCapacitacoesTrabalhador = (trabalhadorId) => {
    return capacitacoes.filter(c => c.trabalhador_id === trabalhadorId);
  };

  // Obter tipo de atendimento
  const getTipoAtendimento = (tipoId) => {
    return tiposAtendimento.find(t => t.id === tipoId);
  };

  // Obter label do nível
  const getNivelLabel = (nivel) => {
    const nivelObj = NIVEIS_EXPERIENCIA.find(n => n.value === nivel);
    return nivelObj ? nivelObj : { label: nivel, color: '#gray' };
  };

  // Obter label da prioridade
  const getPrioridadeLabel = (prioridade) => {
    const prioridadeObj = PRIORIDADES.find(p => p.value === prioridade);
    return prioridadeObj ? prioridadeObj : { label: `Prioridade ${prioridade}`, color: '#gray' };
  };

  // Abrir modal de edição
  const handleEditCapacitacoes = (trabalhador) => {
    setSelectedTrabalhador(trabalhador);
    const caps = getCapacitacoesTrabalhador(trabalhador.id);
    setCapacitacoesEdit(caps.map(c => ({ ...c })));
    setShowModal(true);
  };

  // Adicionar nova capacitação
  const handleAddCapacitacao = () => {
    setCapacitacoesEdit(prev => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        trabalhador_id: selectedTrabalhador.id,
        tipo_atendimento_id: '',
        nivel_experiencia: 'intermediario',
        preferencia_prioridade: 2,
        observacoes: '',
        _isNew: true
      }
    ]);
  };

  // Remover capacitação
  const handleRemoveCapacitacao = (index) => {
    setCapacitacoesEdit(prev => prev.filter((_, i) => i !== index));
  };

  // Atualizar campo da capacitação
  const handleUpdateCapacitacao = (index, field, value) => {
    setCapacitacoesEdit(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Salvar capacitações
  const handleSave = async () => {
    if (!selectedTrabalhador) return;

    // Validar que todas as capacitações têm tipo selecionado
    const hasEmptyTipo = capacitacoesEdit.some(c => !c.tipo_atendimento_id);
    if (hasEmptyTipo) {
      message.error('Selecione o tipo de atendimento para todas as capacitações');
      return;
    }

    // Validar duplicatas
    const tiposIds = capacitacoesEdit.map(c => c.tipo_atendimento_id);
    const hasDuplicates = new Set(tiposIds).size !== tiposIds.length;
    if (hasDuplicates) {
      message.error('Não pode haver capacitações duplicadas para o mesmo tipo');
      return;
    }

    try {
      const trabalhadorId = selectedTrabalhador.id;
      const capacitacoesAtuais = getCapacitacoesTrabalhador(trabalhadorId);

      // Separar capacitações novas, para atualizar e para remover
      const novas = capacitacoesEdit.filter(c => c._isNew);
      const existentes = capacitacoesEdit.filter(c => !c._isNew);
      const idsExistentes = existentes.map(c => c.id);
      const paraRemover = capacitacoesAtuais.filter(c => !idsExistentes.includes(c.id));

      // 1. Inserir novas capacitações
      if (novas.length > 0) {
        const { error: insertError } = await supabase
          .from('trabalhadores_capacitacoes')
          .insert(
            novas.map(c => ({
              trabalhador_id: trabalhadorId,
              tipo_atendimento_id: c.tipo_atendimento_id,
              nivel_experiencia: c.nivel_experiencia,
              preferencia_prioridade: c.preferencia_prioridade,
              observacoes: c.observacoes || null
            }))
          );

        if (insertError) throw insertError;
      }

      // 2. Atualizar capacitações existentes
      for (const cap of existentes) {
        const { error: updateError } = await supabase
          .from('trabalhadores_capacitacoes')
          .update({
            tipo_atendimento_id: cap.tipo_atendimento_id,
            nivel_experiencia: cap.nivel_experiencia,
            preferencia_prioridade: cap.preferencia_prioridade,
            observacoes: cap.observacoes || null
          })
          .eq('id', cap.id);

        if (updateError) throw updateError;
      }

      // 3. Remover capacitações
      if (paraRemover.length > 0) {
        const { error: deleteError } = await supabase
          .from('trabalhadores_capacitacoes')
          .delete()
          .in('id', paraRemover.map(c => c.id));

        if (deleteError) throw deleteError;
      }

      message.success('Capacitações atualizadas com sucesso!');
      setShowModal(false);
      setSelectedTrabalhador(null);
      setCapacitacoesEdit([]);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar capacitações:', error);
      message.error('Erro ao salvar capacitações: ' + error.message);
    }
  };

  // Filtrar trabalhadores
  const trabalhadoresFiltrados = trabalhadores.filter(t =>
    t.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <TrophyOutlined style={{ fontSize: 28, color: '#f59e0b' }} />
          <div>
            <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              Capacitações
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Gerencie em quais tipos de atendimento cada trabalhador pode atuar
            </Text>
          </div>
        </Space>
      </div>

      {/* Busca */}
      <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar trabalhador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          allowClear
          size="large"
        />
      </Card>

      {/* Lista de Trabalhadores */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            Carregando trabalhadores...
          </Text>
        </div>
      ) : trabalhadoresFiltrados.length === 0 ? (
        <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Nenhum trabalhador encontrado"
          />
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {trabalhadoresFiltrados.map((trabalhador) => {
            const caps = getCapacitacoesTrabalhador(trabalhador.id);

            return (
              <Card
                key={trabalhador.id}
                style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
                title={
                  <Space>
                    <UserOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
                    <Text strong style={{ fontSize: 16 }}>
                      {trabalhador.nome_completo}
                    </Text>
                    {trabalhador.funcao && (
                      <Tag color="blue">{trabalhador.funcao}</Tag>
                    )}
                    <Tag color="purple">
                      <TrophyOutlined style={{ marginRight: 4 }} />
                      {caps.length} {caps.length === 1 ? 'capacitação' : 'capacitações'}
                    </Tag>
                  </Space>
                }
                extra={
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => handleEditCapacitacoes(trabalhador)}
                  >
                    Editar
                  </Button>
                }
              >
                {caps.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Nenhuma capacitação cadastrada"
                  />
                ) : (
                  <List
                    dataSource={caps}
                    renderItem={(cap) => {
                      const tipo = getTipoAtendimento(cap.tipo_atendimento_id);
                      const nivel = getNivelLabel(cap.nivel_experiencia);
                      const prioridade = getPrioridadeLabel(cap.preferencia_prioridade);

                      return (
                        <List.Item>
                          <List.Item.Meta
                            title={
                              <Space>
                                <Text strong>{tipo?.nome || 'Tipo desconhecido'}</Text>
                                <Tag color={nivel.color}>{nivel.label}</Tag>
                                <Tag color={prioridade.color}>Prioridade: {prioridade.label}</Tag>
                              </Space>
                            }
                            description={cap.observacoes || null}
                          />
                        </List.Item>
                      );
                    }}
                  />
                )}
              </Card>
            );
          })}
        </Space>
      )}

      {/* Modal de Edição */}
      <Modal
        title={`Editar Capacitações - ${selectedTrabalhador?.nome_completo}`}
        open={showModal && selectedTrabalhador !== null}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        okText={<><CheckCircleOutlined /> Salvar Alterações</>}
        cancelText="Cancelar"
        width={800}
      >
        {selectedTrabalhador && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {tiposAtendimento.length === 0 ? (
              <Card>
                <Empty description="Não há tipos de atendimento cadastrados. Configure os tipos antes de gerenciar capacitações." />
              </Card>
            ) : (
              <>
                {capacitacoesEdit.length === 0 ? (
                  <Card>
                    <Empty
                      image={<TrophyOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
                      description={
                        <Space direction="vertical" size="small">
                          <Text type="secondary">Nenhuma capacitação cadastrada</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Clique em "Adicionar Capacitação" para começar
                          </Text>
                        </Space>
                      }
                    />
                  </Card>
                ) : (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {capacitacoesEdit.map((cap, index) => (
                      <Card
                        key={cap.id || index}
                        type="inner"
                        title={`Capacitação #${index + 1}`}
                        extra={
                          <Button
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveCapacitacao(index)}
                          >
                            Remover
                          </Button>
                        }
                        style={{ borderRadius: 8 }}
                      >
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                          <Row gutter={16}>
                            <Col span={12}>
                              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                Tipo de Atendimento: *
                              </Text>
                              <Select
                                value={cap.tipo_atendimento_id || undefined}
                                onChange={(value) => handleUpdateCapacitacao(index, 'tipo_atendimento_id', value)}
                                placeholder="Selecione..."
                                style={{ width: '100%' }}
                                size="large"
                                showSearch
                                optionFilterProp="children"
                              >
                                {tiposAtendimento.map(tipo => (
                                  <Option key={tipo.id} value={tipo.id}>
                                    {tipo.nome} ({tipo.qtd_pessoas_necessarias} pessoas)
                                  </Option>
                                ))}
                              </Select>
                            </Col>
                            <Col span={6}>
                              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                Nível: *
                              </Text>
                              <Select
                                value={cap.nivel_experiencia}
                                onChange={(value) => handleUpdateCapacitacao(index, 'nivel_experiencia', value)}
                                style={{ width: '100%' }}
                                size="large"
                              >
                                {NIVEIS_EXPERIENCIA.map(nivel => (
                                  <Option key={nivel.value} value={nivel.value}>
                                    {nivel.label}
                                  </Option>
                                ))}
                              </Select>
                            </Col>
                            <Col span={6}>
                              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                Prioridade: *
                              </Text>
                              <Select
                                value={cap.preferencia_prioridade}
                                onChange={(value) => handleUpdateCapacitacao(index, 'preferencia_prioridade', value)}
                                style={{ width: '100%' }}
                                size="large"
                              >
                                {PRIORIDADES.map(prioridade => (
                                  <Option key={prioridade.value} value={prioridade.value}>
                                    {prioridade.label}
                                  </Option>
                                ))}
                              </Select>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Alta = preferência forte
                              </Text>
                            </Col>
                          </Row>
                          <div>
                            <Text strong style={{ display: 'block', marginBottom: 8 }}>
                              Observações:
                            </Text>
                            <TextArea
                              value={cap.observacoes || ''}
                              onChange={(e) => handleUpdateCapacitacao(index, 'observacoes', e.target.value)}
                              placeholder="Ex: Disponível apenas às sextas, Precisa de mais treinamento, etc."
                              rows={2}
                            />
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddCapacitacao}
                  block
                  size="large"
                >
                  Adicionar Capacitação
                </Button>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default CapacitacoesManager;
