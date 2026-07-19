import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal,
  Row, Space, Statistic, Switch, Table, Tabs, Tag, Typography, message,
} from 'antd';
import { EditOutlined, PlusOutlined, PrinterOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiFetch } from '../../supabaseClient';

const { Title, Text } = Typography;
const money = (value = 0) => (Number(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const apiData = result => {
  if (result?.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
  return result.data;
};

function Report({ data }) {
  if (!data?.caixa) return <Empty description="Não houve caixa nesta data" />;
  return <div className="lanchonete-print">
    <Row gutter={[16, 16]}>
      {data.produtos.map(item => <Col xs={12} md={6} key={item.produto_id}><Statistic title={item.nome} value={item.quantidade} suffix="un." /></Col>)}
      <Col xs={12} md={6}><Statistic title="Doações" value={money(data.resumo.doacao_centavos)} /></Col>
      <Col xs={12} md={6}><Statistic title="PIX" value={money(data.resumo.pix_centavos)} /></Col>
      <Col xs={12} md={6}><Statistic title="Dinheiro" value={money(data.resumo.dinheiro_centavos)} /></Col>
      <Col xs={12} md={6}><Statistic title="Consolidado" value={money(data.resumo.total_centavos)} /></Col>
    </Row>
  </div>;
}

export default function LanchoneteManager() {
  const [products, setProducts] = useState([]);
  const [context, setContext] = useState(null);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState(null);
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
    const [salesResult, reportResult] = await Promise.all([
      apiFetch(`/pdv/vendas?data=${formatted}`),
      apiFetch(`/pdv/relatorios/diario?data=${formatted}`),
    ]);
    setSales(apiData(salesResult) || []);
    setReport(apiData(reportResult));
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

  const productColumns = [
    { title: 'Produto', dataIndex: 'nome' },
    { title: 'Preço', dataIndex: 'preco_centavos', render: value => value == null ? <Tag>Pendente</Tag> : money(value) },
    { title: 'Status', dataIndex: 'ativo', render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Ativo' : 'Inativo'}</Tag> },
    { title: 'Ordem', dataIndex: 'ordem', responsive: ['md'] },
    { title: '', render: (_, row) => <Button icon={<EditOutlined />} onClick={() => edit(row)}>Editar</Button> },
  ];
  const salesColumns = [
    { title: 'Hora', dataIndex: 'created_at', render: value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
    { title: 'Vendedor', dataIndex: 'vendedor_nome' },
    { title: 'Itens', dataIndex: 'itens', render: items => items.map(i => `${i.quantidade}x ${i.nome}`).join(', ') },
    { title: 'Pagamento', dataIndex: 'forma_pagamento', render: value => value.toUpperCase() },
    { title: 'Total', dataIndex: 'total_centavos', render: money },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={value === 'cancelada' ? 'red' : 'green'}>{value}</Tag> },
  ];

  return <div>
    <Space direction="vertical" size={4} style={{ marginBottom: 24 }}>
      <Title level={2} style={{ margin: 0 }}><ShopOutlined /> Lanchonete</Title>
      <Text type="secondary">Produtos, caixa, vendas e fechamento diário</Text>
    </Space>
    <Tabs items={[
      { key: 'caixa', label: 'Caixa atual', children: <Card loading={loading}>
        {!context?.caixa ? <Alert type="info" showIcon message="Caixa de hoje ainda não foi aberto" action={<Button href="https://pdv.cesca.digital" target="_blank">Abrir PDV</Button>} /> : <>
          <Space wrap><Tag color={context.caixa.status === 'aberto' ? 'green' : 'red'}>{context.caixa.status.toUpperCase()}</Tag><Text>{new Date(`${context.caixa.data}T12:00:00`).toLocaleDateString('pt-BR')}</Text></Space>
          <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
            <Col xs={12} md={6}><Statistic title="Vendas" value={context.resumo?.quantidade_vendas || 0} /></Col>
            <Col xs={12} md={6}><Statistic title="PIX" value={money(context.resumo?.pix_centavos)} /></Col>
            <Col xs={12} md={6}><Statistic title="Dinheiro" value={money(context.resumo?.dinheiro_centavos)} /></Col>
            <Col xs={12} md={6}><Statistic title="Total" value={money(context.resumo?.total_centavos)} /></Col>
          </Row>
          <Space style={{ marginTop: 20 }}><Button href="https://pdv.cesca.digital" target="_blank">Abrir frente de caixa</Button>{context.caixa.status === 'fechado' && <Button type="primary" onClick={reopen}>Reabrir</Button>}</Space>
        </>}
      </Card> },
      { key: 'produtos', label: 'Produtos', children: <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => edit(null)}>Novo produto</Button>}><Alert type="info" showIcon message="Preços alterados valem a partir da próxima abertura de caixa." style={{ marginBottom: 16 }} /><Table rowKey="id" dataSource={products} columns={productColumns} loading={loading} scroll={{ x: 650 }} /></Card> },
      { key: 'relatorio', label: 'Relatório e vendas', children: <Card>
        <Space wrap style={{ marginBottom: 20 }}><DatePicker value={date} allowClear={false} onChange={next => { setDate(next); loadDay(next).catch(err => message.error(err.message)); }} /><Button onClick={() => loadDay().catch(err => message.error(err.message))}>Atualizar</Button><Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir / PDF</Button></Space>
        <Report data={report} />
        <Title level={4} style={{ marginTop: 28 }}>Vendas</Title>
        <Table rowKey="id" dataSource={sales} columns={salesColumns} scroll={{ x: 850 }} />
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
