import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Card,
  Button,
  Input,
  DatePicker,
  Space,
  Typography,
  Modal,
  message,
  Empty,
  Spin,
  Tag,
  List,
  Select,
} from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
// import dayjs from 'dayjs'; // Não utilizado

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const RestricoesManager = () => {
  const [restricoes, setRestricoes] = useState([]);
  const [trabalhadores, setTrabalhadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTrabalhador, setSelectedTrabalhador] = useState(null);
  const [formData, setFormData] = useState({
    data_inicio: '',
    motivo: ''
  });

  // Carregar dados
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Carregar restrições com joins
      const { data: restData, error: restError } = await supabase
        .from('restricoes_datas')
        .select(`
          *,
          trabalhador:trabalhadores(id, nome_completo)
        `)
        .order('data_inicio', { ascending: true });

      if (restError) throw restError;

      // Carregar trabalhadores ativos
      const { data: trabData, error: trabError } = await supabase
        .from('trabalhadores')
        .select('*')
        .eq('status', 'ativo')
        .order('nome_completo');

      if (trabError) throw trabError;

      setRestricoes(restData || []);
      setTrabalhadores(trabData || []);
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

  // Validar formulário
  const validateForm = () => {
    const errors = {};

    if (!formData.data_inicio) {
      errors.data = 'Data é obrigatória';
    }

    // Verificar se a data não é passada
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataRestricao = new Date(formData.data_inicio);

    if (dataRestricao < hoje) {
      errors.data = 'Data não pode ser no passado';
    }

    // Verificar duplicidade
    const jaExiste = restricoes.some(
      r => r.trabalhador_id === selectedTrabalhador?.id &&
           r.data_inicio === formData.data_inicio
    );

    if (jaExiste) {
      errors.duplicado = 'Já existe uma restrição para esta data';
    }

    return errors;
  };

  // Adicionar restrição
  const handleSubmit = async () => {
    if (!selectedTrabalhador) return;

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(error => message.error(error));
      return;
    }

    try {
      const { error } = await supabase
        .from('restricoes_datas')
        .insert({
          trabalhador_id: selectedTrabalhador.id,
          data_inicio: formData.data_inicio,
          motivo: formData.motivo?.trim() || null
        });

      if (error) throw error;

      message.success('Restrição adicionada com sucesso!');
      setShowModal(false);
      setSelectedTrabalhador(null);
      setFormData({
        data_inicio: '',
        motivo: ''
      });
      fetchData();
    } catch (error) {
      console.error('Erro ao adicionar restrição:', error);
      message.error('Erro ao adicionar restrição');
    }
  };

  // Deletar restrição
  const handleDelete = async (restricao) => {
    Modal.confirm({
      title: 'Confirmar Remoção',
      content: `Remover restrição de ${formatDate(restricao.data_inicio)}?`,
      okText: 'Remover',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('restricoes_datas')
            .delete()
            .eq('id', restricao.id);

          if (error) throw error;

          message.success('Restrição removida com sucesso!');
          fetchData();
        } catch (error) {
          console.error('Erro ao remover restrição:', error);
          message.error('Erro ao remover restrição');
        }
      }
    });
  };

  // Abrir modal
  const handleOpenModal = (trabalhadorId) => {
    const trab = trabalhadores.find(t => t.id === trabalhadorId);
    if (!trab) return;

    setSelectedTrabalhador(trab);
    setFormData({
      data_inicio: '',
      motivo: ''
    });
    setShowModal(true);
  };

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Agrupar por trabalhador
  const restricoesPorTrabalhador = trabalhadores.map(trab => ({
    trabalhador: trab,
    restricoes: restricoes
      .filter(r => r.trabalhador_id === trab.id)
      .sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio))
  }));

  // Filtrar por busca
  const restricoesFiltradas = restricoesPorTrabalhador.filter(item =>
    item.trabalhador.nome_completo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar apenas trabalhadores com restrições (se não estiver buscando)
  const restricoesParaExibir = searchTerm
    ? restricoesFiltradas
    : restricoesFiltradas.filter(item => item.restricoes.length > 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <CalendarOutlined style={{ fontSize: 28, color: '#ef4444' }} />
          <div>
            <Title level={3} style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
              Restrições de Data
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Gerencie datas em que trabalhadores não podem atuar
            </Text>
          </div>
        </Space>
      </div>

      {/* Busca e Ações */}
      <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar trabalhador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
            size="large"
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Adicionar Restrição para:
            </Text>
            <Select
              placeholder="Selecione um trabalhador..."
              onChange={handleOpenModal}
              style={{ width: '100%' }}
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {trabalhadores.map(trab => (
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
      </Card>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin size="large" />
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
            Carregando restrições...
          </Text>
        </div>
      ) : restricoesParaExibir.length === 0 ? (
        <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              searchTerm
                ? 'Nenhum trabalhador encontrado'
                : 'Nenhuma restrição cadastrada'
            }
          />
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {restricoesParaExibir.map(({ trabalhador, restricoes: trabRestr }) => (
            <Card
              key={trabalhador.id}
              style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
              title={
                <Space>
                  <UserOutlined style={{ fontSize: 18, color: '#3b82f6' }} />
                  <Text strong style={{ fontSize: 16 }}>
                    {trabalhador.nome_completo}
                  </Text>
                  <Tag color="orange">
                    {trabRestr.length} {trabRestr.length === 1 ? 'restrição' : 'restrições'}
                  </Tag>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal(trabalhador.id)}
                >
                  Adicionar
                </Button>
              }
            >
              {trabRestr.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nenhuma restrição cadastrada"
                />
              ) : (
                <List
                  dataSource={trabRestr}
                  renderItem={(restricao) => (
                    <List.Item
                      actions={[
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(restricao)}
                          title="Remover"
                        >
                          Remover
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<CalendarOutlined style={{ fontSize: 18, color: '#ef4444' }} />}
                        title={<Text strong>{formatDate(restricao.data_inicio)}</Text>}
                        description={restricao.motivo || 'Sem motivo especificado'}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          ))}
        </Space>
      )}

      {/* Modal */}
      <Modal
        title="Nova Restrição"
        open={showModal && selectedTrabalhador !== null}
        onCancel={() => setShowModal(false)}
        onOk={handleSubmit}
        okText={<><PlusOutlined /> Adicionar</>}
        cancelText="Cancelar"
        width={600}
      >
        {selectedTrabalhador && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Trabalhador:</Text>
              <br />
              <Text strong style={{ fontSize: 16 }}>
                <UserOutlined style={{ marginRight: 8 }} />
                {selectedTrabalhador.nome_completo}
              </Text>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Data: *
              </Text>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                size="large"
                style={{ width: '100%' }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Data em que o trabalhador não pode atuar
              </Text>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Motivo (opcional):
              </Text>
              <TextArea
                rows={3}
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Férias, viagem, compromisso pessoal..."
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default RestricoesManager;
