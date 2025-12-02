import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import logger from '../utils/logger';
import {
  Tabs,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Typography,
  Divider,
  Spin,
  Empty,
  Tooltip,
  Alert
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  SaveOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CopyOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

function FormularioEditor() {
  // Estados principais
  const [loading, setLoading] = useState(true);
  const [formulario, setFormulario] = useState(null);
  const [etapas, setEtapas] = useState([]);
  const [opcoes, setOpcoes] = useState([]);
  const [regras, setRegras] = useState([]);

  // Estados dos modals
  const [modalEtapaVisible, setModalEtapaVisible] = useState(false);
  const [modalOpcaoVisible, setModalOpcaoVisible] = useState(false);
  const [modalRegraVisible, setModalRegraVisible] = useState(false);
  const [modalPreviewVisible, setModalPreviewVisible] = useState(false);

  // Estados de edição
  const [editandoEtapa, setEditandoEtapa] = useState(null);
  const [editandoOpcao, setEditandoOpcao] = useState(null);
  const [editandoRegra, setEditandoRegra] = useState(null);

  // Form instances
  const [formEtapa] = Form.useForm();
  const [formOpcao] = Form.useForm();
  const [formRegra] = Form.useForm();

  // Estados de UI
  const [salvando, setSalvando] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  // ==================== FUNÇÕES DE CARREGAMENTO ====================

  const carregarDados = async () => {
    try {
      setLoading(true);

      // 1. Carregar formulário
      const { data: formData, error: formError } = await supabase
        .from('formularios')
        .select('*')
        .eq('slug', 'agendamento-cesca')
        .single();

      if (formError) throw formError;
      setFormulario(formData);

      // 2. Carregar etapas
      const { data: etapasData, error: etapasError } = await supabase
        .from('etapas_formulario')
        .select('*')
        .eq('formulario_id', formData.id)
        .order('ordem', { ascending: true });

      if (etapasError) throw etapasError;
      setEtapas(etapasData || []);

      // 3. Carregar opções
      const { data: opcoesData, error: opcoesError } = await supabase
        .from('opcoes_atendimento')
        .select('*')
        .order('ordem', { ascending: true });

      if (opcoesError) throw opcoesError;
      setOpcoes(opcoesData || []);

      // 4. Carregar regras
      const { data: regrasData, error: regrasError } = await supabase
        .from('regras_formulario')
        .select('*')
        .eq('formulario_id', formData.id)
        .order('ordem', { ascending: true });

      if (regrasError) throw regrasError;
      setRegras(regrasData || []);

      message.success('Dados carregados com sucesso!');
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      message.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FUNÇÕES DE ETAPAS ====================

  const abrirModalEtapa = (etapa = null) => {
    setEditandoEtapa(etapa);
    if (etapa) {
      formEtapa.setFieldsValue({
        ...etapa,
        configuracoes: JSON.stringify(etapa.configuracoes, null, 2),
        opcoes: JSON.stringify(etapa.opcoes, null, 2)
      });
    } else {
      formEtapa.resetFields();
      formEtapa.setFieldsValue({
        ordem: etapas.length,
        ativo: true,
        obrigatorio: true,
        mostrar_progresso: true
      });
    }
    setModalEtapaVisible(true);
  };

  const salvarEtapa = async (values) => {
    try {
      setSalvando(true);

      // Parse JSON fields
      const configuracoes = values.configuracoes
        ? JSON.parse(values.configuracoes)
        : null;
      const opcoes = values.opcoes ? JSON.parse(values.opcoes) : null;

      const dadosEtapa = {
        ...values,
        formulario_id: formulario.id,
        configuracoes,
        opcoes
      };

      if (editandoEtapa) {
        // Update
        const { error } = await supabase
          .from('etapas_formulario')
          .update(dadosEtapa)
          .eq('id', editandoEtapa.id);

        if (error) throw error;
        message.success('Etapa atualizada com sucesso!');
      } else {
        // Insert
        const { error } = await supabase
          .from('etapas_formulario')
          .insert([dadosEtapa]);

        if (error) throw error;
        message.success('Etapa criada com sucesso!');
      }

      setModalEtapaVisible(false);
      formEtapa.resetFields();
      carregarDados();
    } catch (error) {
      logger.error('Erro ao salvar etapa:', error);
      message.error('Erro ao salvar etapa: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirEtapa = async (id) => {
    Modal.confirm({
      title: 'Confirmar exclusão',
      content: 'Tem certeza que deseja excluir esta etapa?',
      okText: 'Sim, excluir',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('etapas_formulario')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Etapa excluída com sucesso!');
          carregarDados();
        } catch (error) {
          logger.error('Erro ao excluir etapa:', error);
          message.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  const reordenarEtapa = async (etapa, direcao) => {
    const novaOrdem = direcao === 'cima' ? etapa.ordem - 1 : etapa.ordem + 1;

    // Encontrar etapa com a ordem de destino
    const etapaDestino = etapas.find((e) => e.ordem === novaOrdem);

    if (!etapaDestino) {
      message.warning('Não é possível mover nesta direção');
      return;
    }

    try {
      // Trocar ordens
      await supabase
        .from('etapas_formulario')
        .update({ ordem: novaOrdem })
        .eq('id', etapa.id);

      await supabase
        .from('etapas_formulario')
        .update({ ordem: etapa.ordem })
        .eq('id', etapaDestino.id);

      message.success('Ordem atualizada!');
      carregarDados();
    } catch (error) {
      logger.error('Erro ao reordenar:', error);
      message.error('Erro ao reordenar: ' + error.message);
    }
  };

  const duplicarEtapa = async (etapa) => {
    try {
      const novaEtapa = {
        ...etapa,
        id: undefined,
        ordem: etapas.length,
        titulo: `${etapa.titulo} (Cópia)`
      };

      const { error } = await supabase
        .from('etapas_formulario')
        .insert([novaEtapa]);

      if (error) throw error;
      message.success('Etapa duplicada com sucesso!');
      carregarDados();
    } catch (error) {
      logger.error('Erro ao duplicar:', error);
      message.error('Erro ao duplicar: ' + error.message);
    }
  };

  // ==================== FUNÇÕES DE OPÇÕES ====================

  const abrirModalOpcao = (opcao = null) => {
    setEditandoOpcao(opcao);
    if (opcao) {
      formOpcao.setFieldsValue(opcao);
    } else {
      formOpcao.resetFields();
      formOpcao.setFieldsValue({
        ordem: opcoes.length,
        ativo: true
      });
    }
    setModalOpcaoVisible(true);
  };

  const salvarOpcao = async (values) => {
    try {
      setSalvando(true);

      if (editandoOpcao) {
        const { error } = await supabase
          .from('opcoes_atendimento')
          .update(values)
          .eq('id', editandoOpcao.id);

        if (error) throw error;
        message.success('Opção atualizada!');
      } else {
        const { error } = await supabase
          .from('opcoes_atendimento')
          .insert([values]);

        if (error) throw error;
        message.success('Opção criada!');
      }

      setModalOpcaoVisible(false);
      formOpcao.resetFields();
      carregarDados();
    } catch (error) {
      logger.error('Erro ao salvar opção:', error);
      message.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirOpcao = async (id) => {
    Modal.confirm({
      title: 'Confirmar exclusão',
      content: 'Tem certeza que deseja excluir esta opção?',
      okText: 'Sim, excluir',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('opcoes_atendimento')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Opção excluída!');
          carregarDados();
        } catch (error) {
          logger.error('Erro ao excluir:', error);
          message.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  // ==================== FUNÇÕES DE REGRAS ====================

  const abrirModalRegra = (regra = null) => {
    setEditandoRegra(regra);
    if (regra) {
      formRegra.setFieldsValue(regra);
    } else {
      formRegra.resetFields();
      formRegra.setFieldsValue({
        ordem: regras.length,
        ativo: true,
        destaque: false
      });
    }
    setModalRegraVisible(true);
  };

  const salvarRegra = async (values) => {
    try {
      setSalvando(true);

      const dadosRegra = {
        ...values,
        formulario_id: formulario.id
      };

      if (editandoRegra) {
        const { error } = await supabase
          .from('regras_formulario')
          .update(dadosRegra)
          .eq('id', editandoRegra.id);

        if (error) throw error;
        message.success('Regra atualizada!');
      } else {
        const { error } = await supabase
          .from('regras_formulario')
          .insert([dadosRegra]);

        if (error) throw error;
        message.success('Regra criada!');
      }

      setModalRegraVisible(false);
      formRegra.resetFields();
      carregarDados();
    } catch (error) {
      logger.error('Erro ao salvar regra:', error);
      message.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirRegra = async (id) => {
    Modal.confirm({
      title: 'Confirmar exclusão',
      content: 'Tem certeza que deseja excluir esta regra?',
      okText: 'Sim, excluir',
      cancelText: 'Cancelar',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('regras_formulario')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Regra excluída!');
          carregarDados();
        } catch (error) {
          logger.error('Erro ao excluir:', error);
          message.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  // ==================== TIPOS DE ETAPAS ====================

  const tiposEtapa = [
    { value: 'boas-vindas', label: 'Boas-vindas' },
    { value: 'regras', label: 'Exibição de Regras' },
    { value: 'checkbox', label: 'Checkbox (Aceite)' },
    { value: 'input', label: 'Input de Texto' },
    { value: 'email', label: 'Email' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'select-atendimento', label: 'Seleção de Atendimento' },
    { value: 'info', label: 'Informação' },
    { value: 'resumo', label: 'Resumo dos Dados' },
    { value: 'sucesso', label: 'Tela de Sucesso' },
    { value: 'recusa', label: 'Tela de Recusa' }
  ];

  const tiposValidacao = [
    { value: 'email', label: 'Email' },
    { value: 'telefone', label: 'Telefone' },
    { value: 'nome_completo', label: 'Nome Completo' },
    { value: 'confirmacao_email', label: 'Confirmação de Email' }
  ];

  // ==================== COLUNAS DAS TABELAS ====================

  const colunasEtapas = [
    {
      title: '#',
      dataIndex: 'ordem',
      key: 'ordem',
      width: 60,
      render: (ordem) => <Tag color="blue">{ordem}</Tag>
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 150,
      render: (tipo) => <Tag color="purple">{tipo}</Tag>
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      render: (titulo, record) => (
        <div>
          <Text strong>{titulo}</Text>
          {record.subtitulo && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.subtitulo}
              </Text>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Campo',
      dataIndex: 'campo',
      key: 'campo',
      width: 150,
      render: (campo) => campo ? <Tag>{campo}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'Status',
      dataIndex: 'ativo',
      key: 'ativo',
      width: 80,
      render: (ativo) => (
        <Tag color={ativo ? 'green' : 'red'}>
          {ativo ? 'Ativo' : 'Inativo'}
        </Tag>
      )
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Mover para cima">
            <Button
              type="text"
              icon={<ArrowUpOutlined />}
              onClick={() => reordenarEtapa(record, 'cima')}
              disabled={record.ordem === 0}
            />
          </Tooltip>
          <Tooltip title="Mover para baixo">
            <Button
              type="text"
              icon={<ArrowDownOutlined />}
              onClick={() => reordenarEtapa(record, 'baixo')}
              disabled={record.ordem === etapas.length - 1}
            />
          </Tooltip>
          <Tooltip title="Duplicar">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => duplicarEtapa(record)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => abrirModalEtapa(record)}
            />
          </Tooltip>
          <Tooltip title="Excluir">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => excluirEtapa(record.id)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  const colunasOpcoes = [
    {
      title: '#',
      dataIndex: 'ordem',
      key: 'ordem',
      width: 60,
      render: (ordem) => <Tag color="blue">{ordem}</Tag>
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (label) => <Text strong>{label}</Text>
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value) => <Tag>{value}</Tag>
    },
    {
      title: 'Restrição',
      dataIndex: 'restricao',
      key: 'restricao',
      width: 100,
      render: (restricao) =>
        restricao ? (
          <Tag color="orange">{restricao}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
    },
    {
      title: 'Status',
      dataIndex: 'ativo',
      key: 'ativo',
      width: 80,
      render: (ativo) => (
        <Tag color={ativo ? 'green' : 'red'}>
          {ativo ? 'Ativo' : 'Inativo'}
        </Tag>
      )
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => abrirModalOpcao(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => excluirOpcao(record.id)}
          />
        </Space>
      )
    }
  ];

  const colunasRegras = [
    {
      title: '#',
      dataIndex: 'ordem',
      key: 'ordem',
      width: 60,
      render: (ordem) => <Tag color="blue">{ordem}</Tag>
    },
    {
      title: 'Texto',
      dataIndex: 'texto',
      key: 'texto',
      render: (texto, record) => (
        <div>
          {record.icone && <span style={{ marginRight: 8 }}>{record.icone}</span>}
          <Text>{texto}</Text>
          {record.destaque && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              Destaque
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'ativo',
      key: 'ativo',
      width: 80,
      render: (ativo) => (
        <Tag color={ativo ? 'green' : 'red'}>
          {ativo ? 'Ativo' : 'Inativo'}
        </Tag>
      )
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => abrirModalRegra(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => excluirRegra(record.id)}
          />
        </Space>
      )
    }
  ];

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Carregando formulário...</Text>
        </div>
      </div>
    );
  }

  if (!formulario) {
    return (
      <Empty
        description="Formulário não encontrado"
        style={{ marginTop: 100 }}
      >
        <Button type="primary" onClick={carregarDados}>
          Recarregar
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 20 : 32 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            marginBottom: 16,
            gap: isMobile ? 12 : 0
          }}
        >
          <div>
            <Title
              level={2}
              style={{
                margin: 0,
                fontSize: isMobile ? 24 : 32,
                fontWeight: 600,
                letterSpacing: '-0.5px'
              }}
            >
              Editor de Formulários
            </Title>
            <Text type="secondary" style={{ fontSize: isMobile ? 13 : 15 }}>
              {formulario.nome}
            </Text>
          </div>
          <Space
            direction={isMobile ? 'horizontal' : 'horizontal'}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            <Button
              icon={<EyeOutlined />}
              onClick={() => setModalPreviewVisible(true)}
              size={isMobile ? 'middle' : 'large'}
            >
              Preview
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={carregarDados}
              size={isMobile ? 'middle' : 'large'}
            >
              Recarregar
            </Button>
          </Space>
        </div>

        <Divider style={{ margin: isMobile ? '16px 0' : '24px 0' }} />

        {/* Alert informativo */}
        <Alert
          message="Edite as etapas, opções e regras do quiz-cesca"
          description="As alterações feitas aqui serão refletidas imediatamente no formulário de agendamento do quiz-cesca.digital"
          type="info"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultActiveKey="etapas" size={isMobile ? 'small' : 'large'}>
          {/* Tab: Etapas */}
          <TabPane tab="Etapas do Formulário" key="etapas">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => abrirModalEtapa()}
              >
                Nova Etapa
              </Button>
            </div>
            <Table
              columns={colunasEtapas}
              dataSource={etapas}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              scroll={{ x: 1000 }}
              size={isMobile ? 'small' : 'default'}
            />
          </TabPane>

          {/* Tab: Opções de Atendimento */}
          <TabPane tab="Opções de Atendimento" key="opcoes">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => abrirModalOpcao()}
              >
                Nova Opção
              </Button>
            </div>
            <Table
              columns={colunasOpcoes}
              dataSource={opcoes}
              rowKey="id"
              pagination={false}
              size={isMobile ? 'small' : 'default'}
            />
          </TabPane>

          {/* Tab: Regras */}
          <TabPane tab="Regras do Formulário" key="regras">
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => abrirModalRegra()}
              >
                Nova Regra
              </Button>
            </div>
            <Table
              columns={colunasRegras}
              dataSource={regras}
              rowKey="id"
              pagination={false}
              size={isMobile ? 'small' : 'default'}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Modal: Editar Etapa */}
      <Modal
        title={editandoEtapa ? 'Editar Etapa' : 'Nova Etapa'}
        open={modalEtapaVisible}
        onCancel={() => {
          setModalEtapaVisible(false);
          formEtapa.resetFields();
        }}
        onOk={() => formEtapa.submit()}
        confirmLoading={salvando}
        width={800}
      >
        <Form
          form={formEtapa}
          layout="vertical"
          onFinish={salvarEtapa}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="ordem"
                label="Ordem"
                rules={[{ required: true, message: 'Campo obrigatório' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tipo"
                label="Tipo"
                rules={[{ required: true, message: 'Campo obrigatório' }]}
              >
                <Select placeholder="Selecione o tipo">
                  {tiposEtapa.map((t) => (
                    <Option key={t.value} value={t.value}>
                      {t.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="titulo"
            label="Título"
            rules={[{ required: true, message: 'Campo obrigatório' }]}
          >
            <Input placeholder="Título da etapa" />
          </Form.Item>

          <Form.Item name="subtitulo" label="Subtítulo">
            <Input placeholder="Subtítulo (opcional)" />
          </Form.Item>

          <Form.Item name="descricao" label="Descrição">
            <TextArea rows={3} placeholder="Descrição completa (opcional)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="campo" label="Campo (nome do campo no formData)">
                <Input placeholder="ex: nome_completo, email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="icone" label="Ícone (emoji)">
                <Input placeholder="ex: 📋, 👤, ✉️" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="validacao_tipo" label="Tipo de Validação">
                <Select placeholder="Selecione (opcional)" allowClear>
                  {tiposValidacao.map((t) => (
                    <Option key={t.value} value={t.value}>
                      {t.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="placeholder" label="Placeholder">
                <Input placeholder="Placeholder do input" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="validacao_mensagem" label="Mensagem de Erro">
            <Input placeholder="Mensagem exibida quando validação falhar" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="botao_texto" label="Texto do Botão">
                <Input placeholder="ex: Próximo, Continuar" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="botao_secundario_texto" label="Botão Secundário">
                <Input placeholder="ex: Recusar, Voltar" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="opcoes"
            label="Opções (JSON)"
            help="Para campos select: JSON com array de opções"
          >
            <TextArea
              rows={4}
              placeholder='[{"value": "opcao1", "label": "Opção 1"}]'
            />
          </Form.Item>

          <Form.Item
            name="configuracoes"
            label="Configurações (JSON)"
            help="Configurações extras específicas do tipo de etapa"
          >
            <TextArea
              rows={4}
              placeholder='{"chave": "valor"}'
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="obrigatorio" label="Obrigatório" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mostrar_progresso" label="Mostrar Progresso" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ativo" label="Ativo" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal: Editar Opção */}
      <Modal
        title={editandoOpcao ? 'Editar Opção' : 'Nova Opção'}
        open={modalOpcaoVisible}
        onCancel={() => {
          setModalOpcaoVisible(false);
          formOpcao.resetFields();
        }}
        onOk={() => formOpcao.submit()}
        confirmLoading={salvando}
        width={600}
      >
        <Form form={formOpcao} layout="vertical" onFinish={salvarOpcao}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="value"
                label="Value (ID único)"
                rules={[{ required: true, message: 'Campo obrigatório' }]}
              >
                <Input placeholder="ex: Psicografia" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="emoji"
                label="Emoji"
              >
                <Input placeholder="📜" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="label"
            label="Label (exibido no formulário)"
            rules={[{ required: true, message: 'Campo obrigatório' }]}
          >
            <Input placeholder="ex: 📜 Psicografia" />
          </Form.Item>

          <Form.Item
            name="descricao"
            label="Descrição"
            rules={[{ required: true, message: 'Campo obrigatório' }]}
          >
            <TextArea rows={3} placeholder="Descrição da opção de atendimento" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="restricao"
                label="Restrição"
                help="Ex: 'menor' para menores de idade"
              >
                <Input placeholder="menor" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ordem" label="Ordem" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ativo" label="Ativo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Editar Regra */}
      <Modal
        title={editandoRegra ? 'Editar Regra' : 'Nova Regra'}
        open={modalRegraVisible}
        onCancel={() => {
          setModalRegraVisible(false);
          formRegra.resetFields();
        }}
        onOk={() => formRegra.submit()}
        confirmLoading={salvando}
        width={600}
      >
        <Form form={formRegra} layout="vertical" onFinish={salvarRegra}>
          <Form.Item
            name="texto"
            label="Texto da Regra"
            rules={[{ required: true, message: 'Campo obrigatório' }]}
          >
            <TextArea rows={3} placeholder="Texto completo da regra" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="icone" label="Ícone">
                <Input placeholder="📧" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ordem" label="Ordem" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="destaque" label="Destacar" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ativo" label="Ativo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Preview (placeholder) */}
      <Modal
        title="Preview do Quiz"
        open={modalPreviewVisible}
        onCancel={() => setModalPreviewVisible(false)}
        footer={null}
        width={900}
      >
        <Alert
          message="Preview em desenvolvimento"
          description="O preview ao vivo do quiz será implementado em breve. Por enquanto, você pode acessar agendamento.cesca.digital diretamente para visualizar as alterações."
          type="info"
          showIcon
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button
            type="primary"
            href="https://agendamento.cesca.digital"
            target="_blank"
          >
            Abrir Quiz em Nova Aba
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default FormularioEditor;
