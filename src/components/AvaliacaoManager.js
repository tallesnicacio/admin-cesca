import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert, Button, Card, Col, DatePicker, Empty, Form, Input, List, Modal,
  Row, Select, Space, Spin, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, DeleteOutlined, EditOutlined,
  FormOutlined, HistoryOutlined, PlusOutlined, SettingOutlined, TeamOutlined,
} from '@ant-design/icons';
import { supabase } from '../supabaseClient';

const { Title, Text } = Typography;
const { TextArea } = Input;

const RESULT_META = {
  apto: { label: 'Apto', color: 'success' },
  inapto: { label: 'Inapto', color: 'error' },
  melhorar: { label: 'Melhorar', color: 'warning' },
};

const ResultTag = ({ value }) => value
  ? <Tag color={RESULT_META[value]?.color}>{RESULT_META[value]?.label || value}</Tag>
  : <Tag>Pendente</Tag>;

function AvaliacaoManager({ userProfile }) {
  const [form] = Form.useForm();
  const [mediumForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalogs, setCatalogs] = useState({ funcoes: [], criterios: [], mediuns: [] });
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState([]);
  const [editing, setEditing] = useState(null);
  const [mediumModalOpen, setMediumModalOpen] = useState(false);
  const [editingMedium, setEditingMedium] = useState(null);
  const [search, setSearch] = useState('');
  const [filterResult, setFilterResult] = useState();

  const isAdmin = userProfile?.role === 'admin' || userProfile?.is_admin;

  const request = useCallback(async (path, options) => {
    const response = await supabase.request(path, options);
    if (response?.error) throw new Error(response.error.message || response.error);
    return response;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catalogResponse, historyResponse, summaryResponse] = await Promise.all([
        request('/avaliacoes/catalogos'),
        request('/avaliacoes?page_size=100'),
        request('/avaliacoes/resumo'),
      ]);
      setCatalogs(catalogResponse.data);
      setHistory(historyResponse.data || []);
      setSummary(summaryResponse.data || []);
    } catch (error) {
      message.error(`Erro ao carregar avaliações: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedMediumId = Form.useWatch('medium_id', form);
  const selectedResult = Form.useWatch('resultado', form);
  const selectedMedium = catalogs.mediuns.find(medium => medium.id === selectedMediumId);
  const eligibleMediums = catalogs.mediuns.filter(medium =>
    medium.ativo && medium.modo_avaliacao !== 'dispensado'
  );
  const eligibleFunctions = catalogs.funcoes.filter(fn => {
    if (!fn.ativo || !selectedMedium) return false;
    if (selectedMedium.modo_avaliacao === 'personalizado') {
      return selectedMedium.funcoes_personalizadas?.includes(fn.id);
    }
    return fn.niveis_permitidos?.includes(selectedMedium.nivel_treinamento);
  });

  const resetForm = () => {
    form.resetFields();
    form.setFieldsValue({ data_avaliacao: dayjs() });
    setEditing(null);
  };

  const saveEvaluation = async values => {
    const payload = {
      medium_id: values.medium_id,
      funcao_id: values.funcao_id,
      data_avaliacao: values.data_avaliacao.format('YYYY-MM-DD'),
      resultado: values.resultado,
      criterio_ids: values.resultado === 'melhorar' ? (values.criterio_ids || []) : [],
      observacoes: values.observacoes || null,
    };
    try {
      setSaving(true);
      await request(editing ? `/avaliacoes/${editing.id}` : '/avaliacoes', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      message.success(editing ? 'Avaliação atualizada' : 'Avaliação registrada');
      resetForm();
      await loadData();
    } catch (error) {
      message.error(error.message);
    } finally { setSaving(false); }
  };

  const editEvaluation = evaluation => {
    setEditing(evaluation);
    form.setFieldsValue({
      medium_id: evaluation.medium_id,
      funcao_id: evaluation.funcao_id,
      data_avaliacao: dayjs(evaluation.data_avaliacao),
      resultado: evaluation.resultado,
      criterio_ids: evaluation.criterios?.map(c => c.id),
      observacoes: evaluation.observacoes,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteEvaluation = async evaluation => {
    let reason = '';
    Modal.confirm({
      title: 'Excluir avaliação',
      content: <Input.TextArea placeholder="Motivo obrigatório" onChange={event => { reason = event.target.value; }} />,
      okText: 'Excluir', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        if (!reason.trim()) throw new Error('Informe o motivo da exclusão');
        await request(`/avaliacoes/${evaluation.id}`, { method: 'DELETE', body: JSON.stringify({ motivo: reason }) });
        message.success('Avaliação excluída do acompanhamento');
        loadData();
      },
    });
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = !search || item.medium_nome_snapshot.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!filterResult || item.resultado === filterResult);
  });

  const groupedSummary = useMemo(() => Object.values(summary.reduce((acc, row) => {
    if (!acc[row.medium_id]) acc[row.medium_id] = {
      id: row.medium_id, nome: row.nome_completo, nivel: row.nivel_treinamento,
      modo: row.modo_avaliacao, funcoes: [],
    };
    acc[row.medium_id].funcoes.push(row);
    return acc;
  }, {})), [summary]);

  const openMediumModal = medium => {
    setEditingMedium(medium || null);
    mediumForm.resetFields();
    mediumForm.setFieldsValue(medium ? {
      nome_completo: medium.nome_completo,
      nivel_treinamento: medium.nivel_treinamento,
      modo_avaliacao: medium.modo_avaliacao,
      motivo_regra_avaliacao: medium.motivo_regra_avaliacao,
      funcao_ids: medium.funcoes_personalizadas || [],
      ativo: medium.ativo,
    } : {
      modo_avaliacao: 'por_nivel',
      ativo: true,
    });
    setMediumModalOpen(true);
  };

  const saveMedium = async values => {
    try {
      await request(editingMedium ? `/avaliacoes/mediuns/${editingMedium.id}` : '/avaliacoes/mediuns', {
        method: editingMedium ? 'PATCH' : 'POST', body: JSON.stringify(values),
      });
      message.success(editingMedium ? 'Médium atualizado' : 'Médium em treinamento criado');
      setMediumModalOpen(false);
      await loadData();
    } catch (error) { message.error(error.message); }
  };

  const deactivateMedium = medium => {
    let reason = '';
    Modal.confirm({
      title: `Inativar ${medium.nome_completo}?`,
      content: <Input.TextArea placeholder="Motivo obrigatório" onChange={event => { reason = event.target.value; }} />,
      okText: 'Inativar', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        if (!reason.trim()) throw new Error('Informe o motivo da inativação');
        await request(`/avaliacoes/mediuns/${medium.id}`, {
          method: 'DELETE', body: JSON.stringify({ motivo: reason }),
        });
        message.success('Médium inativado; o histórico foi preservado');
        await loadData();
      },
    });
  };

  const saveCatalogItem = async (type, item, changes) => {
    try {
      await request(`/avaliacoes/${type}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, ...changes }) });
      message.success('Configuração atualizada');
      loadData();
    } catch (error) { message.error(error.message); }
  };

  const historyColumns = [
    { title: 'Data', dataIndex: 'data_avaliacao', width: 110, render: value => dayjs(value).format('DD/MM/YYYY') },
    { title: 'Médium', dataIndex: 'medium_nome_snapshot', sorter: (a, b) => a.medium_nome_snapshot.localeCompare(b.medium_nome_snapshot) },
    { title: 'Nível', dataIndex: 'nivel_treinamento', width: 80, render: value => <Tag color="blue">{value}</Tag> },
    { title: 'Função', dataIndex: 'funcao_nome_snapshot' },
    { title: 'Resultado', dataIndex: 'resultado', width: 110, render: value => <ResultTag value={value} /> },
    { title: 'Avaliador', dataIndex: 'avaliador_nome_snapshot' },
    {
      title: 'Ações', width: 100, render: (_, item) => {
        const canEdit = isAdmin || item.avaliador_id === userProfile?.id;
        return <Space>
          {canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => editEvaluation(item)} />}
          {isAdmin && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteEvaluation(item)} />}
        </Space>;
      },
    },
  ];

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>;

  const registration = <>
    <Card style={{ marginBottom: 20 }}>
      <Title level={3}><FormOutlined /> {editing ? 'Corrigir avaliação' : 'Registrar avaliação'}</Title>
      {editing && <Alert type="info" showIcon message="Você está corrigindo uma avaliação existente." style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" initialValues={{ data_avaliacao: dayjs() }} onFinish={saveEvaluation}>
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="medium_id" label="Médium em treinamento" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Selecione" options={eligibleMediums.map(m => ({ value: m.id, label: `${m.nome_completo} — ${m.nivel_treinamento}` }))} onChange={() => form.setFieldValue('funcao_id', undefined)} />
          </Form.Item></Col>
          <Col xs={24} md={6}><Form.Item name="data_avaliacao" label="Data" rules={[{ required: true }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={date => date?.isAfter(dayjs(), 'day')} />
          </Form.Item></Col>
          <Col xs={24} md={6}><Form.Item label="Nível"><Input value={selectedMedium?.nivel_treinamento || ''} disabled /></Form.Item></Col>
        </Row>
        {selectedMedium?.modo_avaliacao === 'personalizado' && <Alert type="warning" showIcon message="Este médium possui funções personalizadas." style={{ marginBottom: 16 }} />}
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="funcao_id" label="Função" rules={[{ required: true }]}>
            <Select placeholder="Selecione" options={eligibleFunctions.map(fn => ({ value: fn.id, label: fn.nome }))} />
          </Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="resultado" label="Resultado" rules={[{ required: true }]}>
            <Select options={Object.entries(RESULT_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item></Col>
        </Row>
        {selectedResult === 'melhorar' && <Form.Item name="criterio_ids" label="Pontos a melhorar" rules={[{ required: true, type: 'array', min: 1 }]}>
          <Select mode="multiple" options={catalogs.criterios.filter(c => c.ativo).map(c => ({ value: c.id, label: c.nome }))} />
        </Form.Item>}
        <Form.Item name="observacoes" label={selectedResult === 'inapto' ? 'Observações (obrigatórias)' : 'Observações'} rules={selectedResult === 'inapto' ? [{ required: true }] : []}>
          <TextArea rows={3} maxLength={3000} showCount />
        </Form.Item>
        <Space><Button type="primary" htmlType="submit" loading={saving}>{editing ? 'Salvar correção' : 'Registrar avaliação'}</Button>{editing && <Button onClick={resetForm}>Cancelar</Button>}</Space>
      </Form>
    </Card>
    <Card title={<><HistoryOutlined /> Histórico recente</>}>
      <Space wrap style={{ marginBottom: 16 }}><Input.Search placeholder="Buscar médium" allowClear onSearch={setSearch} onChange={e => !e.target.value && setSearch('')} /><Select allowClear placeholder="Resultado" style={{ width: 160 }} onChange={setFilterResult} options={Object.entries(RESULT_META).map(([value, m]) => ({ value, label: m.label }))} /></Space>
      <Table rowKey="id" columns={historyColumns} dataSource={filteredHistory} scroll={{ x: 900 }} pagination={{ pageSize: 10 }} expandable={{ expandedRowRender: item => <Space direction="vertical"><Text>{item.observacoes || 'Sem observações'}</Text>{item.criterios?.length > 0 && <Space wrap>{item.criterios.map(c => <Tag key={c.id}>{c.nome}</Tag>)}</Space>}</Space> }} />
    </Card>
  </>;

  const monitoring = groupedSummary.length ? <Row gutter={[16, 16]}>{groupedSummary.map(worker => <Col xs={24} lg={12} key={worker.id}><Card title={<Space><TeamOutlined />{worker.nome}<Tag color="blue">{worker.nivel}</Tag>{worker.modo === 'personalizado' && <Tag color="gold">Funções personalizadas</Tag>}</Space>}><List dataSource={worker.funcoes} renderItem={fn => <List.Item extra={<ResultTag value={fn.resultado} />}><List.Item.Meta title={fn.funcao_nome} description={fn.data_avaliacao ? `${fn.total_avaliacoes} avaliação(ões) · última em ${dayjs(fn.data_avaliacao).format('DD/MM/YYYY')}` : 'Ainda não avaliado'} /></List.Item>} /></Card></Col>)}</Row> : <Empty description="Nenhum médium com nível de treinamento configurado" />;

  const mediumCrud = <Card title={<Space><TeamOutlined /> Médiuns em treinamento</Space>} extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openMediumModal()}>Novo médium</Button>}>
    <Alert type="info" showIcon message="Cadastro exclusivo do Controle Avaliativo" description="Estes registros não são adicionados automaticamente a escalas ou capacitações." style={{ marginBottom: 16 }} />
    <Table rowKey="id" size="small" dataSource={catalogs.mediuns} pagination={{ pageSize: 10 }} scroll={{ x: 760 }} columns={[
      { title: 'Nome', dataIndex: 'nome_completo', sorter: (a, b) => a.nome_completo.localeCompare(b.nome_completo) },
      { title: 'Nível', dataIndex: 'nivel_treinamento', width: 90, render: value => <Tag color="blue">{value}</Tag> },
      { title: 'Regra', dataIndex: 'modo_avaliacao', width: 170, render: value => <Tag color={value === 'dispensado' ? 'red' : value === 'personalizado' ? 'gold' : 'default'}>{value === 'por_nivel' ? 'Funções do nível' : value === 'personalizado' ? 'Personalizada' : 'Dispensado'}</Tag> },
      { title: 'Situação', dataIndex: 'ativo', width: 100, render: value => <Tag color={value ? 'success' : 'default'}>{value ? 'Ativo' : 'Inativo'}</Tag> },
      { title: 'Ações', width: 120, render: (_, medium) => <Space><Button type="text" aria-label="Editar médium" icon={<EditOutlined />} onClick={() => openMediumModal(medium)} />{medium.ativo && <Button type="text" danger aria-label="Inativar médium" icon={<DeleteOutlined />} onClick={() => deactivateMedium(medium)} />}</Space> },
    ]} />
  </Card>;

  const settings = <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Row gutter={16}>
      <Col xs={24} lg={14}><Card title="Funções"><List dataSource={catalogs.funcoes} renderItem={item => <List.Item actions={[<Button key="toggle" onClick={() => saveCatalogItem('funcoes', item, { ativo: !item.ativo })}>{item.ativo ? 'Desativar' : 'Ativar'}</Button>]}><List.Item.Meta title={item.nome} description={`Níveis: ${item.niveis_permitidos.join(', ')}`} /></List.Item>} /></Card></Col>
      <Col xs={24} lg={10}><Card title="Critérios"><List dataSource={catalogs.criterios} renderItem={item => <List.Item actions={[<Button key="toggle" onClick={() => saveCatalogItem('criterios', item, { ativo: !item.ativo })}>{item.ativo ? 'Desativar' : 'Ativar'}</Button>]}><Text>{item.nome}</Text></List.Item>} /></Card></Col>
    </Row>
  </Space>;

  return <div>
    <div style={{ marginBottom: 24 }}><Title level={2} style={{ margin: 0 }}>Avaliações de Médiuns</Title><Text type="secondary">Registro contínuo do desenvolvimento por nível e função</Text></div>
    <Tabs items={[
      { key: 'registro', label: <><FormOutlined /> Registrar e histórico</>, children: registration },
      { key: 'acompanhamento', label: <><CheckCircleOutlined /> Acompanhamento</>, children: monitoring },
      ...(isAdmin ? [{ key: 'mediuns', label: <><TeamOutlined /> Médiuns em treinamento</>, children: mediumCrud }] : []),
      ...(isAdmin ? [{ key: 'configuracoes', label: <><SettingOutlined /> Configurações</>, children: settings }] : []),
    ]} />
    <Modal title={editingMedium ? `Editar ${editingMedium.nome_completo}` : 'Novo médium em treinamento'} open={mediumModalOpen} onCancel={() => setMediumModalOpen(false)} footer={null} destroyOnClose>
      <Form form={mediumForm} layout="vertical" onFinish={saveMedium}>
        <Form.Item name="nome_completo" label="Nome completo" rules={[{ required: true, min: 3 }]}><Input maxLength={200} autoFocus /></Form.Item>
        <Form.Item name="nivel_treinamento" label="Nível atual" rules={[{ required: true }]}><Select options={['MT1','MT2','MT3'].map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="modo_avaliacao" label="Regra" rules={[{ required: true }]}><Select options={[{ value: 'por_nivel', label: 'Funções do nível' }, { value: 'personalizado', label: 'Funções personalizadas' }, { value: 'dispensado', label: 'Dispensado da avaliação' }]} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.modo_avaliacao !== b.modo_avaliacao}>{({ getFieldValue }) => getFieldValue('modo_avaliacao') === 'personalizado' && <Form.Item name="funcao_ids" label="Funções permitidas" rules={[{ required: true, type: 'array', min: 1 }]}><Select mode="multiple" options={catalogs.funcoes.filter(f => f.ativo).map(f => ({ value: f.id, label: f.nome }))} /></Form.Item>}</Form.Item>
        <Form.Item name="motivo_regra_avaliacao" label="Motivo"><TextArea rows={2} /></Form.Item>
        {editingMedium && <Form.Item name="ativo" label="Ativo" valuePropName="checked"><Switch /></Form.Item>}
        <Space><Button type="primary" htmlType="submit">{editingMedium ? 'Salvar alterações' : 'Criar médium'}</Button><Button onClick={() => setMediumModalOpen(false)}>Cancelar</Button></Space>
      </Form>
    </Modal>
  </div>;
}

export default AvaliacaoManager;
