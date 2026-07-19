import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  Alert, Avatar, Button, Card, Col, Divider, Drawer, Empty, Form, Input,
  InputNumber, List, Modal, Row, Segmented, Space, Spin, Statistic, Tag,
  Typography, message,
} from 'antd';
import {
  CloseCircleOutlined, LogoutOutlined, MinusOutlined,
  PlusOutlined, PrinterOutlined, ReloadOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import { apiFetch, supabase } from '../supabaseClient';
import '../components/Login.css';
import './PdvApp.css';

const { Title, Text } = Typography;
const money = (centavos = 0) => (Number(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function throwApi(result) {
  if (result?.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
  return result?.data;
}

function PdvLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async (values) => {
    setLoading(true);
    setError('');
    try {
      const result = await supabase.auth.signInWithPassword(values);
      if (result.error) throw new Error(result.error);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };
  return (
    <div className="pdv-login">
      <Card className="pdv-login-card">
        <div className="pdv-login-brand">
          <img src="/logo-cesca.jpeg" alt="CESCA" />
          <Title level={2}>Lanchonete CESCA</Title>
          <Text type="secondary">Frente de caixa</Text>
        </div>
        {error && <Alert type="error" showIcon message="Não foi possível entrar" description={error} />}
        <Form layout="vertical" size="large" onFinish={submit}>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input autoComplete="username" inputMode="email" />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>Entrar no caixa</Button>
        </Form>
      </Card>
    </div>
  );
}

function DailyReport({ report }) {
  if (!report?.caixa) return <Empty description="Nenhum caixa encontrado para esta data" />;
  return (
    <div className="pdv-report">
      <Title level={4}>Resumo de {new Date(`${report.caixa.data}T12:00:00`).toLocaleDateString('pt-BR')}</Title>
      <Row gutter={[12, 12]}>
        {report.produtos.map(p => (
          <Col xs={12} sm={8} key={p.produto_id}>
            <Statistic title={p.nome} value={p.quantidade} suffix="un." />
          </Col>
        ))}
        <Col xs={12} sm={8}><Statistic title="Doações" value={money(report.resumo?.doacao_centavos)} /></Col>
        <Col xs={12} sm={8}><Statistic title="PIX" value={money(report.resumo?.pix_centavos)} /></Col>
        <Col xs={12} sm={8}><Statistic title="Dinheiro" value={money(report.resumo?.dinheiro_centavos)} /></Col>
        <Col xs={24} sm={8}><Statistic title="Total consolidado" value={money(report.resumo?.total_centavos)} /></Col>
      </Row>
      {report.caixa.status === 'fechado' && (
        <Alert
          type={Number(report.caixa.diferenca) === 0 ? 'success' : 'warning'}
          showIcon
          message={`Caixa contado: ${money(Math.round(Number(report.caixa.valor_final_real) * 100))}`}
          description={`Esperado em dinheiro: ${money(Math.round(Number(report.caixa.valor_final_esperado) * 100))} · Diferença: ${money(Math.round(Number(report.caixa.diferenca) * 100))}`}
        />
      )}
    </div>
  );
}

function PdvHome() {
  const [context, setContext] = useState(null);
  const [cart, setCart] = useState({});
  const [donation, setDonation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState(null);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [openForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  const loadContext = useCallback(async () => {
    setLoading(true);
    try {
      setContext(throwApi(await apiFetch('/pdv/contexto')));
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);

  const productsById = useMemo(() => new Map((context?.produtos || []).map(p => [p.id, p])), [context]);
  const subtotal = useMemo(() => Object.entries(cart).reduce((sum, [id, qty]) => {
    return sum + (productsById.get(id)?.preco_centavos || 0) * qty;
  }, 0), [cart, productsById]);
  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = subtotal + donation;

  const changeQty = (id, delta) => setCart(current => {
    const next = Math.max(0, Math.min(999, (current[id] || 0) + delta));
    const updated = { ...current };
    if (next) updated[id] = next; else delete updated[id];
    return updated;
  });

  const openCash = async ({ valorInicial }) => {
    setSaving(true);
    try {
      throwApi(await apiFetch('/pdv/caixas/abrir', {
        method: 'POST', body: JSON.stringify({ valorInicialCentavos: Math.round(Number(valorInicial || 0) * 100) }),
      }));
      message.success('Caixa aberto');
      await loadContext();
    } catch (err) { message.error(err.message); } finally { setSaving(false); }
  };

  const finishSale = async (formaPagamento) => {
    if (!itemCount) return;
    setSaving(true);
    const requestId = pendingRequestId || crypto.randomUUID();
    setPendingRequestId(requestId);
    try {
      throwApi(await apiFetch('/pdv/vendas', {
        method: 'POST',
        body: JSON.stringify({
          requestId,
          itens: Object.entries(cart).map(([produtoId, quantidade]) => ({ produtoId, quantidade })),
          doacaoCentavos: donation,
          formaPagamento,
        }),
      }));
      message.success('Venda finalizada');
      setCart({});
      setDonation(0);
      setPendingRequestId(null);
      setCheckoutOpen(false);
      await loadContext();
    } catch (err) { message.error(err.message); } finally { setSaving(false); }
  };

  const loadSales = async () => {
    try {
      setSales(throwApi(await apiFetch('/pdv/vendas')) || []);
      setSalesOpen(true);
    } catch (err) { message.error(err.message); }
  };

  const cancelSale = (sale) => {
    let motivo = '';
    Modal.confirm({
      title: 'Cancelar venda',
      content: <Input.TextArea autoFocus placeholder="Motivo obrigatório" onChange={e => { motivo = e.target.value; }} />,
      okText: 'Cancelar venda', okType: 'danger', cancelText: 'Voltar',
      onOk: async () => {
        try {
          throwApi(await apiFetch(`/pdv/vendas/${sale.id}/cancelar`, { method: 'POST', body: JSON.stringify({ motivo }) }));
          message.success('Venda cancelada');
          await loadSales();
          await loadContext();
        } catch (err) { message.error(err.message); throw err; }
      },
    });
  };

  const loadReport = async () => {
    try {
      setReport(throwApi(await apiFetch('/pdv/relatorios/diario')));
      setReportOpen(true);
    } catch (err) { message.error(err.message); }
  };

  const closeCash = async ({ valorContado }) => {
    setSaving(true);
    try {
      throwApi(await apiFetch(`/pdv/caixas/${context.caixa.id}/fechar`, {
        method: 'POST', body: JSON.stringify({ valorContadoCentavos: Math.round(Number(valorContado) * 100) }),
      }));
      message.success('Caixa fechado');
      closeForm.resetFields();
      setCloseOpen(false);
      await loadContext();
      await loadReport();
    } catch (err) { message.error(err.message); } finally { setSaving(false); }
  };

  const reopenCash = () => {
    let motivo = '';
    Modal.confirm({
      title: 'Reabrir caixa',
      content: <Input.TextArea placeholder="Motivo obrigatório" onChange={e => { motivo = e.target.value; }} />,
      onOk: async () => {
        const result = await apiFetch(`/pdv/caixas/${context.caixa.id}/reabrir`, { method: 'POST', body: JSON.stringify({ motivo }) });
        throwApi(result); await loadContext(); message.success('Caixa reaberto');
      },
    });
  };

  if (loading && !context) return <div className="pdv-center"><Spin size="large" /></div>;
  if (!context) return <div className="pdv-center"><Button onClick={loadContext}>Tentar novamente</Button></div>;

  const caixaAberto = context.caixa?.status === 'aberto';
  return (
    <div className="pdv-shell">
      <header className="pdv-header">
        <div className="pdv-brand"><Avatar src="/logo-cesca.jpeg" /><div><strong>Lanchonete CESCA</strong><small>{context.usuario.nome}</small></div></div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadContext} aria-label="Atualizar" />
          <Button icon={<LogoutOutlined />} onClick={() => supabase.auth.signOut()} aria-label="Sair" />
        </Space>
      </header>

      {!context.caixa && (
        <Card className="pdv-state-card">
          <Title level={3}>Abrir caixa de hoje</Title>
          <Text>Informe o dinheiro disponível no início do atendimento.</Text>
          <Form form={openForm} layout="vertical" onFinish={openCash} initialValues={{ valorInicial: 0 }}>
            <Form.Item name="valorInicial" label="Troco inicial" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }} size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} block size="large">Abrir caixa</Button>
          </Form>
          {!context.produtos.length && <Alert type="warning" showIcon message="Um administrador precisa cadastrar e ativar produtos com preço." />}
        </Card>
      )}

      {context.caixa?.status === 'fechado' && (
        <Card className="pdv-state-card">
          <Title level={3}>Caixa fechado</Title>
          <Text>As vendas deste dia estão encerradas.</Text>
          <Space wrap>
            <Button onClick={loadReport}>Ver relatório</Button>
            {context.usuario.role === 'admin' && <Button type="primary" onClick={reopenCash}>Reabrir caixa</Button>}
          </Space>
        </Card>
      )}

      {caixaAberto && (
        <>
          <main className="pdv-main">
            <section>
              <div className="pdv-section-title"><Title level={3}>Produtos</Title><Tag color="green">Caixa aberto</Tag></div>
              <div className="pdv-products">
                {context.produtos.map(product => (
                  <button className="pdv-product" key={product.id} onClick={() => changeQty(product.id, 1)}>
                    <span>{product.nome}</span><strong>{money(product.preco_centavos)}</strong>
                    {cart[product.id] > 0 && <b>{cart[product.id]}</b>}
                  </button>
                ))}
              </div>
            </section>

            <Card className="pdv-cart" title={<><ShoppingCartOutlined /> Pedido</>}>
              {!itemCount ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Toque em um produto" /> : (
                <List dataSource={Object.entries(cart)} renderItem={([id, qty]) => {
                  const product = productsById.get(id);
                  return <List.Item><div><strong>{product?.nome}</strong><small>{money((product?.preco_centavos || 0) * qty)}</small></div><Space><Button icon={<MinusOutlined />} onClick={() => changeQty(id, -1)} /><b>{qty}</b><Button icon={<PlusOutlined />} onClick={() => changeQty(id, 1)} /></Space></List.Item>;
                }} />
              )}
              <Divider />
              <Text strong>Doação</Text>
              <div className="pdv-donation">
                {[100, 200, 500].map(value => <Button key={value} onClick={() => setDonation(d => d + value)}>+ {money(value)}</Button>)}
                <InputNumber min={0} precision={2} decimalSeparator="," value={donation / 100} onChange={v => setDonation(Math.round(Number(v || 0) * 100))} prefix="R$" />
              </div>
              <div className="pdv-total"><span>Total</span><strong>{money(total)}</strong></div>
              <Button type="primary" size="large" block disabled={!itemCount} onClick={() => setCheckoutOpen(true)}>Receber {money(total)}</Button>
            </Card>
          </main>

          <div className="pdv-day-actions">
            <Button onClick={loadSales}>Vendas de hoje</Button>
            <Button onClick={loadReport}>Relatório</Button>
            <Button danger onClick={() => setCloseOpen(true)}>Fechar caixa</Button>
          </div>
        </>
      )}

      <Drawer title="Forma de pagamento" placement="bottom" height="auto" open={checkoutOpen} onClose={() => setCheckoutOpen(false)}>
        <Title level={2} className="pdv-checkout-total">{money(total)}</Title>
        <Segmented block size="large" options={[
          { label: 'Receber em PIX', value: 'pix' }, { label: 'Receber em dinheiro', value: 'dinheiro' },
        ]} onChange={finishSale} disabled={saving} />
        {saving && <Spin className="pdv-saving" />}
      </Drawer>

      <Drawer title="Vendas de hoje" width={560} open={salesOpen} onClose={() => setSalesOpen(false)}>
        <List dataSource={sales} locale={{ emptyText: 'Nenhuma venda' }} renderItem={sale => (
          <List.Item actions={sale.status === 'concluida' && caixaAberto && (context.usuario.role === 'admin' || sale.vendedor_id === context.usuario.id) ? [<Button danger type="link" icon={<CloseCircleOutlined />} onClick={() => cancelSale(sale)}>Cancelar</Button>] : []}>
            <List.Item.Meta title={<Space><span>{money(sale.total_centavos)}</span><Tag>{sale.forma_pagamento.toUpperCase()}</Tag>{sale.status === 'cancelada' && <Tag color="red">Cancelada</Tag>}</Space>} description={`${new Date(sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${sale.vendedor_nome} · ${sale.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}`} />
          </List.Item>
        )} />
      </Drawer>

      <Modal title="Relatório diário" open={reportOpen} onCancel={() => setReportOpen(false)} footer={<Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir / salvar PDF</Button>} width={720}>
        <DailyReport report={report} />
      </Modal>
      <Modal title="Fechar caixa" open={closeOpen} onCancel={() => setCloseOpen(false)} footer={null}>
        <Form form={closeForm} layout="vertical" onFinish={closeCash}>
          <Form.Item name="valorContado" label="Dinheiro contado" rules={[{ required: true, message: 'Informe o valor contado' }]}>
            <InputNumber min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }} size="large" />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={saving} block>Concluir fechamento</Button>
        </Form>
      </Modal>
    </div>
  );
}

export default function PdvApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => subscription.unsubscribe();
  }, []);
  if (loading) return <div className="pdv-center"><Spin size="large" /></div>;
  const role = session?.user?.app_metadata?.role;
  if (session && role && !['admin', 'vendedor'].includes(role)) {
    return <div className="pdv-center"><Card><Alert type="error" showIcon message="Acesso não autorizado" description="Este usuário não possui o perfil Administrador ou Vendedor." /><Button style={{ marginTop: 16 }} block onClick={() => supabase.auth.signOut()}>Sair</Button></Card></div>;
  }
  return <Routes><Route path="/login" element={session ? <Navigate to="/" /> : <PdvLogin />} /><Route path="/" element={session ? <PdvHome /> : <Navigate to="/login" />} /><Route path="*" element={<Navigate to="/" />} /></Routes>;
}
