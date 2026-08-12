import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Modal,
  Row, Space, Statistic, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd';
import { CloseCircleOutlined, EditOutlined, PlusOutlined, PrinterOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch } from '../../supabaseClient';
import DailyReport, { formatReportDate, money } from '../../pdv/DailyReport';

const { Title, Text } = Typography;
const apiData = result => {
  if (result?.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
  return result.data;
};

export default function LanchoneteManager() {
  const [products, setProducts] = useState([]);
  const [context, setContext] = useState(null);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState(null);
  const [synchronizations, setSynchronizations] = useState([]);
  const [date, setDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const loadProducts = useCallback(async () => {
    setProducts(apiData(await apiFetch('/pdv/admin/produtos')) || []);
  }, []);
  const loadContext = useCallback(async () => setContext(apiData(await apiFetch('/pdv/contexto'))), []);
  const loadDay = useCallback(async (selectedDate = date) => {
    const formatted = selectedDate.format('YYYY-MM-DD');
    const [salesResult, reportResult, syncResult] = await Promise.all([
      apiFetch(`/pdv/vendas?data=${formatted}`),
      apiFetch(`/pdv/relatorios/diario?data=${formatted}`),
      apiFetch(`/pdv/admin/sincronizacoes?data=${formatted}`),
    ]);
    setSales(apiData(salesResult) || []);
    setReport(apiData(reportResult));
    setSynchronizations(apiData(syncResult) || []);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadProducts(), loadContext(), loadDay()]).catch(err => message.error(err.message)).finally(() => setLoading(false));
  }, [loadProducts, loadContext, loadDay]);

  const edit = product => {
    setSelected(product || null);
    form.setFieldsValue(product ? {
      nome: product.nome, preco: product.preco_centavos == null ? null : product.preco_centavos / 100,
      ativo: product.ativo, ordem: product.ordem,
    } : { nome: '', preco: null, ativo: false, ordem: products.length * 10 + 10 });
    setModalOpen(true);
  };

  const save = async values => {
    setLoading(true);
    try {
      const payload = {
        nome: values.nome,
        precoCentavos: values.preco == null ? null : Math.round(Number(values.preco) * 100),
        ativo: Boolean(values.ativo),
        ordem: Number(values.ordem || 0),
      };
      const path = selected ? `/pdv/admin/produtos/${selected.id}` : '/pdv/admin/produtos';
      apiData(await apiFetch(path, { method: selected ? 'PATCH' : 'POST', body: JSON.stringify(payload) }));
      message.success('Produto salvo. Alterações de preço entram no próximo caixa.');
      setModalOpen(false);
      await loadProducts();
    } catch (err) { message.error(err.message); } finally { setLoading(false); }
  };

  const reopen = () => {
    let motivo = '';
    Modal.confirm({ title: 'Reabrir caixa', content: <Input.TextArea placeholder="Motivo" onChange={e => { motivo = e.target.value; }} />, onOk: async () => {
      apiData(await apiFetch(`/pdv/caixas/${context.caixa.id}/reabrir`, { method: 'POST', body: JSON.stringify({ motivo }) }));
      await loadContext(); message.success('Caixa reaberto');
    }});
  };

  const cancelSale = sale => {
    let motivo = '';
    Modal.confirm({
      title: 'Cancelar venda',
      content: <Input.TextArea autoFocus placeholder="Informe o motivo do cancelamento" onChange={event => { motivo = event.target.value; }} />,
      okText: 'Cancelar venda',
      okType: 'danger',
      cancelText: 'Voltar',
      onOk: async () => {
        apiData(await apiFetch(`/pdv/vendas/${sale.id}/cancelar`, {
          method: 'POST', body: JSON.stringify({ motivo }),
        }));
        message.success('Venda cancelada e estoque devolvido');
        await Promise.all([loadContext(), loadDay()]);
      },
    });
  };

  const canManageProducts = ['admin', 'coordenador_lanches'].includes(context?.usuario?.role);

  const productColumns = [
    { title: 'Produto', dataIndex: 'nome' },
    { title: 'Preço', dataIndex: 'preco_centavos', render: value => value == null ? <Tag>Pendente</Tag> : money(value) },
    { title: 'Status', dataIndex: 'ativo', render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Ativo' : 'Inativo'}</Tag> },
    { title: 'Ordem', dataIndex: 'ordem', responsive: ['md'] },
    { title: '', render: (_, row) => canManageProducts ? <Button icon={<EditOutlined />} onClick={() => edit(row)}>Editar</Button> : null },
  ];
  const salesColumns = [
    { title: 'Hora', render: (_, row) => new Date(row.registrada_em_dispositivo || row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    { title: 'Vendedor', dataIndex: 'vendedor_nome' },
    { title: 'Itens', dataIndex: 'itens', render: items => items.map(i => `${i.quantidade}x ${i.nome}${i.promocional ? ' (promoção)' : ''} a ${money(i.precoUnitarioCentavos)}`).join(', ') },
    { title: 'Pagamento dos produtos', dataIndex: 'forma_pagamento', render: value => value.toUpperCase() },
    { title: 'Doação', render: (_, row) => row.doacao_centavos > 0 ? `${money(row.doacao_centavos)} · ${(row.forma_pagamento_doacao || row.forma_pagamento).toUpperCase()}` : '—' },
    { title: 'Total', dataIndex: 'total_centavos', render: money },
    { title: 'Origem', dataIndex: 'origem', render: value => <Tag color={value === 'offline' ? 'orange' : 'blue'}>{value === 'offline' ? 'OFFLINE' : 'ONLINE'}</Tag> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={value === 'cancelada' ? 'red' : 'green'}>{value}</Tag> },
    {
      title: 'Ação',
      fixed: 'right',
      render: (_, row) => row.status === 'concluida' ? (
        <Button
          danger
          type="link"
          icon={<CloseCircleOutlined />}
          disabled={report?.caixa?.status !== 'aberto'}
          title={report?.caixa?.status !== 'aberto' ? 'Reabra o caixa deste dia antes de cancelar' : 'Cancelar venda'}
          onClick={() => cancelSale(row)}
        >Cancelar</Button>
      ) : null,
    },
  ];
  const syncColumns = [
    { title: 'Recebida', dataIndex: 'created_at', render: value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    { title: 'Aparelho', dataIndex: 'dispositivo_nome' },
    { title: 'Usuário', dataIndex: 'usuario_nome' },
    { title: 'Vendas', render: (_, row) => `${row.quantidade_sincronizada} novas · ${row.quantidade_duplicada} repetidas` },
    { title: 'Erros', dataIndex: 'quantidade_com_erro', render: value => value ? <Tag color="red">{value}</Tag> : '0' },
    { title: 'Alertas', render: (_, row) => <Space wrap>
      {row.conflito_estoque && <Tag color="red">Estoque divergente</Tag>}
      {row.recalculou_fechamento && <Tag color="orange">Fechamento recalculado</Tag>}
      {!row.quantidade_alertas && <Tag color="green">Sem alertas</Tag>}
    </Space> },
  ];

  return <div>
    <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
      <Title level={2} style={{ margin: 0 }}><ShopOutlined /> Lanchonete</Title>
      <Text type="secondary">Produtos, caixa, vendas e fechamento diário</Text>
    </Space>
    <Tabs items={[
      { key: 'caixa', label: 'Caixa atual', children: <Card loading={loading}>
        {!context?.caixa ? <Alert type="info" showIcon message="Caixa de hoje ainda não foi aberto" action={<Button href="https://pdv.cesca.digital" target="_blank">Abrir PDV</Button>} /> : <>
          <Space wrap><Tag color={context.caixa.status === 'aberto' ? 'green' : 'red'}>{context.caixa.status.toUpperCase()}</Tag><Text>{formatReportDate(context.caixa.data)}</Text></Space>
          <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
            <Col xs={12} md={6}><Statistic title="Vendas" value={context.resumo?.quantidade_vendas || 0} /></Col>
            <Col xs={12} md={6}><Statistic title="PIX" value={money(context.resumo?.pix_centavos)} /></Col>
            <Col xs={12} md={6}><Statistic title="Dinheiro" value={money(context.resumo?.dinheiro_centavos)} /></Col>
            <Col xs={12} md={6}><Statistic title="Total" value={money(context.resumo?.total_centavos)} /></Col>
          </Row>
          <Divider orientation="left">Estoque do dia</Divider>
          <Row gutter={[16, 16]}>
            {context.produtos.map(produto => <Col xs={12} md={6} key={produto.id}>
              <Statistic
                title={produto.nome}
                value={produto.estoque_disponivel ?? '—'}
                valueStyle={Number(produto.estoque_disponivel) < 0 ? { color: '#cf1322' } : undefined}
                suffix={produto.estoque_disponivel == null ? null : 'restantes'}
              />
              {produto.estoque_inicial != null && <Text type="secondary">Inicial: {produto.estoque_inicial}</Text>}
              {Number(produto.estoque_disponivel) < 0 && <Alert type="error" showIcon message="Divergência offline" />}
            </Col>)}
          </Row>
          <Space style={{ marginTop: 20 }}><Button href="https://pdv.cesca.digital" target="_blank">Abrir frente de caixa</Button>{context.caixa.status === 'fechado' && <Button type="primary" onClick={reopen}>Reabrir</Button>}</Space>
        </>}
      </Card> },
      { key: 'produtos', label: 'Produtos', children: <Card extra={canManageProducts ? <Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>Novo produto</Button> : null}><Alert type="info" showIcon message={canManageProducts ? 'Preços alterados valem a partir da próxima abertura de caixa.' : 'A configuração de produtos é exclusiva dos administradores.'} style={{ marginBottom: 16 }} /><Table rowKey="id" dataSource={products} columns={productColumns} loading={loading} scroll={{ x: 650 }} /></Card> },
      { key: 'relatorio', label: 'Relatório e vendas', children: <Card>
        <Space wrap style={{ marginBottom: 20 }}><DatePicker value={date} allowClear={false} onChange={next => { setDate(next); loadDay(next).catch(err => message.error(err.message)); }} /><Button onClick={() => loadDay().catch(err => message.error(err.message))}>Atualizar</Button><Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir / PDF</Button></Space>
        <DailyReport report={report} />
        <Title level={4} style={{ marginTop: 28 }}>Vendas</Title>
        <Table rowKey="id" dataSource={sales} columns={salesColumns} scroll={{ x: 1080 }} />
        <Title level={4} style={{ marginTop: 28 }}>Sincronizações offline</Title>
        <Alert
          type="info"
          showIcon
          message="Aparelhos desconectados só aparecem após voltarem à internet."
          style={{ marginBottom: 16 }}
        />
        <Table rowKey="id" dataSource={synchronizations} columns={syncColumns} scroll={{ x: 850 }} locale={{ emptyText: 'Nenhuma sincronização offline neste dia' }} />
      </Card> },
    ]} />
    <Modal title={selected ? 'Editar produto' : 'Novo produto'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null}>
      <Form form={form} layout="vertical" onFinish={save}>
        <Form.Item name="nome" label="Nome" rules={[{ required: true }]}><Input maxLength={80} /></Form.Item>
        <Form.Item name="preco" label="Preço"><InputNumber min={0.01} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="ordem" label="Ordem"><InputNumber min={0} precision={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="ativo" label="Disponível no próximo caixa" valuePropName="checked"><Switch /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>Salvar</Button>
      </Form>
    </Modal>
  </div>;
}
