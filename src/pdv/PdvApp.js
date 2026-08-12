import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  Alert, Avatar, Badge, Button, Card, Divider, Drawer, Empty, Form, Input,
  InputNumber, List, Modal, Space, Spin, Steps, Tag,
  Typography, message,
} from 'antd';
import {
  ArrowLeftOutlined, CloudSyncOutlined, CloseCircleOutlined, CloseOutlined,
  DownloadOutlined, LogoutOutlined, MinusOutlined, PlusOutlined,
  PrinterOutlined, ReloadOutlined, ShoppingCartOutlined, WifiOutlined,
} from '@ant-design/icons';
import { apiFetch, getAccessToken, supabase } from '../supabaseClient';
import {
  buildOpenCashPayload, buildSalePayload, getEffectivePriceCentavos,
  reconcileCartWithStock, updateCartQuantity,
} from './pdvLogic';
import PaymentButtons from './PaymentButtons';
import DonationSelector from './DonationSelector';
import DailyReport, { money } from './DailyReport';
import {
  countPendingSales, enqueueSale, getCachedContext,
  listPendingSales, replaceCachedContextPreservingPending, setLocalPromotion,
  setBackgroundSyncToken, subscribeOfflineChanges, undoPendingSale,
} from './offlineStore';
import { requestBackgroundSync, syncPendingSales } from './syncManager';
import { registerPdvServiceWorker } from './serviceWorkerRegistration';
import '../components/Login.css';
import './PdvApp.css';

const { Title, Text } = Typography;
const isPdvSupervisorRole = role => ['admin', 'coordenador_lanches'].includes(role);

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

function PdvHome() {
  const [context, setContext] = useState(null);
  const [cart, setCart] = useState({});
  const [donation, setDonation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [promotionSaving, setPromotionSaving] = useState(false);
  const [promotionConfirming, setPromotionConfirming] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(null);
  const [productPayment, setProductPayment] = useState(null);
  const [donationPayment, setDonationPayment] = useState(null);
  const [salesOpen, setSalesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [sales, setSales] = useState([]);
  const [report, setReport] = useState(null);
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSales, setPendingSales] = useState([]);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [activateUpdate, setActivateUpdate] = useState(null);
  const saleInFlight = useRef(false);
  const syncInFlight = useRef(false);
  const cartRef = useRef({});
  const [openForm] = Form.useForm();
  const [closeForm] = Form.useForm();

  useEffect(() => { cartRef.current = cart; }, [cart]);

  useEffect(() => {
    setBackgroundSyncToken(getAccessToken()).catch(() => {});
  }, []);

  const refreshPending = useCallback(async () => {
    const [count, records] = await Promise.all([countPendingSales(), listPendingSales()]);
    setPendingCount(count);
    setPendingSales(records);
  }, []);

  const loadContext = useCallback(async ({ warnCartAdjustment = false } = {}) => {
    setLoading(true);
    try {
      const nextContext = throwApi(await apiFetch('/pdv/contexto', { cache: 'no-store' }));
      const localContext = await replaceCachedContextPreservingPending(nextContext);
      const reconciledCart = reconcileCartWithStock(cartRef.current, localContext?.produtos);
      setContext(localContext);
      setCart(reconciledCart);
      setOnline(true);
      if (warnCartAdjustment && JSON.stringify(reconciledCart) !== JSON.stringify(cartRef.current)) {
        message.warning('O carrinho foi ajustado ao estoque disponível.');
      }
      return localContext;
    } catch (err) {
      setOnline(false);
      const cached = await getCachedContext().catch(() => null);
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      if (cached?.caixa?.status === 'aberto' && cached.caixa.data === today) {
        setContext(cached);
        return cached;
      }
      message.error('Conecte o aparelho à internet para preparar o caixa deste dia.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncNow = useCallback(async ({ silent = false } = {}) => {
    if (syncInFlight.current || !navigator.onLine) {
      setOnline(false);
      return null;
    }
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const result = await syncPendingSales();
      setOnline(result.online !== false);
      await refreshPending();
      if (result.synced > 0 || result.eventsSynced > 0) {
        setLastSyncAt(new Date());
        await loadContext();
        if (!silent && result.synced > 0) message.success(`${result.synced} venda(s) sincronizada(s)`);
      }
      if (result.conflict) message.warning('Sincronização concluída com divergência de estoque.');
      if (result.recalculatedClose) message.warning('Um fechamento anterior foi recalculado.');
      if (result.errors && !silent) message.error(`${result.errors} venda(s) precisam de atenção.`);
      return result;
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [loadContext, refreshPending]);

  useEffect(() => {
    loadContext().then(() => syncNow({ silent: true }));
    refreshPending();
  }, [loadContext, refreshPending, syncNow]);

  useEffect(() => subscribeOfflineChanges(refreshPending), [refreshPending]);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      await syncNow({ silent: true });
      await loadContext();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [loadContext, syncNow]);

  useEffect(() => registerPdvServiceWorker({
    onSyncRequest: () => syncNow({ silent: true }),
    onSyncComplete: async result => {
      await refreshPending();
      await loadContext();
      setLastSyncAt(new Date());
      if (result.conflict) message.warning('Sincronização em segundo plano encontrou divergência de estoque.');
      if (result.recalculatedClose) message.warning('Um fechamento anterior foi recalculado.');
    },
    onUpdate: activate => setActivateUpdate(() => activate),
  }), [loadContext, refreshPending, syncNow]);

  useEffect(() => {
    const capture = event => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  const productsById = useMemo(() => new Map((context?.produtos || []).map(p => [p.id, p])), [context]);
  const subtotal = useMemo(() => Object.entries(cart).reduce((sum, [id, qty]) => {
    return sum + getEffectivePriceCentavos(productsById.get(id)) * qty;
  }, 0), [cart, productsById]);
  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = subtotal + donation;

  const changeQty = (id, delta) => {
    setProductPayment(null);
    setDonationPayment(null);
    setCart(current => updateCartQuantity(current, productsById.get(id), delta));
  };

  const openCash = async (values) => {
    if (!online) return message.error('Conecte à internet para abrir o caixa.');
    setSaving(true);
    try {
      throwApi(await apiFetch('/pdv/caixas/abrir', {
        method: 'POST', body: JSON.stringify(buildOpenCashPayload(values, context.produtos)),
      }));
      message.success('Caixa aberto');
      await loadContext();
    } catch (err) { message.error(err.message); } finally { setSaving(false); }
  };

  const openCheckout = () => {
    setProductPayment(null);
    setDonationPayment(null);
    setCheckoutStep('review');
  };

  const closeCheckout = () => {
    if (saving) return;
    setCheckoutStep(null);
    setProductPayment(null);
    setDonationPayment(null);
  };

  const finishSale = async () => {
    if (
      !itemCount
      || !productPayment
      || (donation > 0 && !donationPayment)
      || saleInFlight.current
    ) return;
    saleInFlight.current = true;
    setSaving(true);
    const requestId = pendingRequestId || crypto.randomUUID();
    setPendingRequestId(requestId);
    try {
      const payload = buildSalePayload({
        requestId,
        cart,
        donation,
        formaPagamento: productPayment,
        formaPagamentoDoacao: donationPayment,
        products: context.produtos,
      });
      await enqueueSale({
        requestId,
        caixaId: context.caixa.id,
        vendedorId: context.usuario.id,
        registradaEm: new Date().toISOString(),
        offline: !online,
        itens: payload.itens.map(item => {
          const product = productsById.get(item.produtoId);
          return {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnitarioCentavos: item.precoUnitarioEsperadoCentavos,
            promocional: Boolean(product?.promocao_ativa),
          };
        }),
        doacaoCentavos: payload.doacaoCentavos,
        formaPagamento: payload.formaPagamento,
        formaPagamentoDoacao: payload.formaPagamentoDoacao,
      });
      setContext(await getCachedContext());
      message.success(online ? 'Venda salva. Sincronizando…' : 'Venda salva neste aparelho');
      setCart({});
      setDonation(0);
      setPendingRequestId(null);
      setCheckoutStep(null);
      setProductPayment(null);
      setDonationPayment(null);
      requestBackgroundSync();
      if (online) await syncNow({ silent: true });
    } catch (err) {
      message.error(err.message);
    } finally {
      saleInFlight.current = false;
      setSaving(false);
    }
  };

  const loadSales = async () => {
    try {
      setSales(throwApi(await apiFetch('/pdv/vendas', { cache: 'no-store' })) || []);
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
      setReport(throwApi(await apiFetch('/pdv/relatorios/diario', { cache: 'no-store' })));
      setReportOpen(true);
    } catch (err) { message.error(err.message); }
  };

  const refreshPdv = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (!navigator.onLine) {
        setOnline(false);
        const cached = await getCachedContext();
        if (cached) setContext(cached);
        message.info('Sem internet: exibindo os dados salvos neste aparelho.');
        return;
      }
      await syncNow({ silent: true });
      const tasks = [loadContext({ warnCartAdjustment: true })];
      if (salesOpen) {
        tasks.push(apiFetch('/pdv/vendas', { cache: 'no-store' }).then(result => {
          setSales(throwApi(result) || []);
        }));
      }
      if (reportOpen) {
        tasks.push(apiFetch('/pdv/relatorios/diario', { cache: 'no-store' }).then(result => {
          setReport(throwApi(result));
        }));
      }
      const [nextContext] = await Promise.all(tasks);
      if (nextContext) message.success('PDV atualizado');
    } catch (err) {
      message.error(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const changePromotion = async product => {
    const nextActive = !product.promocao_ativa;
    setPromotionSaving(true);
    try {
      if (!online) {
        const updated = await setLocalPromotion(product.id, nextActive, context.usuario.id);
        setContext(updated);
        message.success(nextActive
          ? 'Promoção ativada somente neste aparelho enquanto estiver offline.'
          : 'Promoção encerrada neste aparelho.');
      } else {
        throwApi(await apiFetch(`/pdv/caixas/${context.caixa.id}/produtos/${product.id}/promocao`, {
          method: 'PATCH', body: JSON.stringify({ ativa: nextActive }),
        }));
        await loadContext();
        message.success(nextActive ? 'Promoção ativada: salgado por R$ 7,00' : 'Promoção encerrada');
      }
      setPromotionConfirming(false);
    } catch (err) {
      message.error(`Não foi possível alterar a promoção: ${err.message}`);
    } finally {
      setPromotionSaving(false);
    }
  };

  const closeCash = async ({ valorContado }) => {
    if (!online) return message.error('Conecte à internet para fechar o caixa.');
    if (pendingCount > 0) return message.error('Sincronize todas as vendas antes de fechar o caixa.');
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

  const showPendingSales = async () => {
    await refreshPending();
    setPendingOpen(true);
  };

  const undoLocalSale = sale => {
    let motivo = '';
    Modal.confirm({
      title: 'Desfazer venda pendente?',
      content: <Input.TextArea autoFocus placeholder="Motivo obrigatório" onChange={event => { motivo = event.target.value; }} />,
      okText: 'Desfazer venda',
      okType: 'danger',
      cancelText: 'Voltar',
      onOk: async () => {
        if (motivo.trim().length < 3) throw new Error('Informe um motivo com pelo menos 3 caracteres.');
        await undoPendingSale(sale.requestId, motivo.trim());
        setContext(await getCachedContext());
        await refreshPending();
        message.success('Venda pendente desfeita e estoque local restaurado.');
      },
    });
  };

  const logout = async () => {
    const count = await countPendingSales();
    if (count > 0) {
      setPendingOpen(true);
      return message.warning('Sincronize ou desfaça as vendas pendentes antes de sair.');
    }
    return supabase.auth.signOut();
  };

  const installPdv = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const applyUpdate = async () => {
    if (!activateUpdate) return;
    const applied = await activateUpdate();
    if (!applied) return message.warning('Sincronize as vendas pendentes antes de atualizar o aplicativo.');
    window.location.reload();
  };

  if (loading && !context) return <div className="pdv-center"><Spin size="large" /></div>;
  if (!context) return <div className="pdv-center"><Button onClick={loadContext}>Tentar novamente</Button></div>;

  const caixaAberto = context.caixa?.status === 'aberto';
  const promotionProduct = context.produtos.find(product => (
    product.preco_promocional_centavos != null
    && Number(product.preco_promocional_centavos) < Number(product.preco_centavos)
  ));
  return (
    <div className="pdv-shell">
      <header className="pdv-header">
        <div className="pdv-brand"><Avatar src="/logo-cesca.jpeg" /><div><strong>Lanchonete CESCA</strong><small>{context.usuario.nome}</small></div></div>
        <div className="pdv-connectivity">
          <Tag icon={<WifiOutlined />} color={online ? 'green' : 'orange'}>{online ? 'Online' : 'Modo offline'}</Tag>
          {lastSyncAt && <small>Sincronizado {lastSyncAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}
        </div>
        <Space className="pdv-header-actions">
          {installPrompt && <Button icon={<DownloadOutlined />} onClick={installPdv}>Instalar</Button>}
          <Badge count={pendingCount} size="small">
            <Button icon={<CloudSyncOutlined />} loading={syncing} onClick={pendingCount ? showPendingSales : () => syncNow()}>
              {pendingCount ? 'Pendentes' : 'Sincronizar'}
            </Button>
          </Badge>
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={refreshPdv}>Atualizar</Button>
          <Button icon={<LogoutOutlined />} onClick={logout} aria-label="Sair" />
        </Space>
      </header>

      {activateUpdate && <Alert
        className="pdv-update-alert"
        type="info"
        showIcon
        message="Nova versão do PDV disponível"
        action={<Button onClick={applyUpdate}>Atualizar aplicativo</Button>}
      />}

      {!online && <Alert
        className="pdv-offline-alert"
        banner
        type="warning"
        message={`Modo offline ativo${pendingCount ? ` · ${pendingCount} venda(s) aguardando sincronização` : ''}`}
      />}

      {!context.caixa && (
        <Card className="pdv-state-card">
          <Title level={3}>Abrir caixa de hoje</Title>
          <Text>Informe o troco e a quantidade disponível de cada produto no início do atendimento.</Text>
          <Form form={openForm} layout="vertical" onFinish={openCash} initialValues={{ valorInicial: 0 }}>
            <Form.Item name="valorInicial" label="Troco inicial" rules={[{ required: true }]}>
              <InputNumber min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }} size="large" />
            </Form.Item>
            <Divider orientation="left">Estoque do dia</Divider>
            <div className="pdv-opening-stock">
              {context.produtos.map(product => (
                <Form.Item
                  key={product.id}
                  name={['estoques', product.id]}
                  label={product.nome}
                  initialValue={0}
                  rules={[{ required: true, message: 'Informe a quantidade disponível' }]}
                >
                  <InputNumber min={0} max={1000000} precision={0} addonAfter="un." style={{ width: '100%' }} size="large" />
                </Form.Item>
              ))}
            </div>
            <Button type="primary" htmlType="submit" loading={saving} disabled={!context.produtos.length} block size="large">Abrir caixa</Button>
          </Form>
          {!context.produtos.length && <Alert
            type="warning"
            showIcon
            message="Produtos ainda não configurados"
            description="Defina os preços e ative Salgado e Refrigerante no Admin CESCA antes de abrir o caixa."
            action={isPdvSupervisorRole(context.usuario.role) ? <Button href="https://admin.cesca.digital" target="_blank">Ir ao Admin</Button> : null}
          />}
        </Card>
      )}

      {context.caixa?.status === 'fechado' && (
        <Card className="pdv-state-card">
          <Title level={3}>Caixa fechado</Title>
          <Text>As vendas deste dia estão encerradas.</Text>
          <Space wrap>
            <Button onClick={loadReport}>Ver relatório</Button>
            {isPdvSupervisorRole(context.usuario.role) && <Button type="primary" onClick={reopenCash}>Reabrir caixa</Button>}
          </Space>
        </Card>
      )}

      {caixaAberto && (
        <>
          <main className="pdv-main">
            <section>
              <div className="pdv-section-title"><Title level={3}>Produtos</Title><Tag color="green">Caixa aberto</Tag></div>
              {promotionProduct && (
                <div
                  className={`pdv-promotion-control ${promotionProduct.promocao_ativa ? 'pdv-promotion-active' : ''}`}
                  role="status"
                >
                  <div className="pdv-promotion-copy">
                    <strong>
                      {promotionProduct.promocao_ativa && <span className="pdv-promotion-dot" aria-hidden="true" />}
                      {promotionProduct.promocao_ativa ? 'Promoção ativa' : 'Promoção do salgado'}
                    </strong>
                    <small>
                      {promotionProduct.promocao_ativa
                        ? `${promotionProduct.nome} por ${money(promotionProduct.preco_promocional_centavos)}${promotionProduct.promocao_local ? ' · somente neste aparelho' : ''}`
                        : `Desativada · preço normal ${money(promotionProduct.preco_centavos)}`}
                    </small>
                  </div>
                  {promotionConfirming ? (
                    <div className="pdv-promotion-confirm" role="group" aria-label="Confirmar alteração da promoção">
                      <small>{promotionProduct.promocao_ativa ? 'Voltar para R$ 10,00?' : 'Autorizado pela coordenação?'}</small>
                      <div>
                        <Button onClick={() => setPromotionConfirming(false)} disabled={promotionSaving}>Cancelar</Button>
                        <Button
                          danger={promotionProduct.promocao_ativa}
                          type="primary"
                          loading={promotionSaving}
                          onClick={() => changePromotion(promotionProduct)}
                        >Confirmar</Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      danger={promotionProduct.promocao_ativa}
                      type={promotionProduct.promocao_ativa ? 'default' : 'primary'}
                      onClick={() => setPromotionConfirming(true)}
                    >
                      {promotionProduct.promocao_ativa
                        ? 'Encerrar promoção'
                        : `Ativar por ${money(promotionProduct.preco_promocional_centavos)}`}
                    </Button>
                  )}
                </div>
              )}
              <div className="pdv-products">
                {context.produtos.map(product => {
                  const promotional = Boolean(product.promocao_ativa);
                  const effectivePrice = getEffectivePriceCentavos(product);
                  return <button
                    className={`pdv-product ${promotional ? 'pdv-product-promotional' : ''} ${product.estoque_disponivel != null && Number(product.estoque_disponivel) <= 0 ? 'pdv-product-sold-out' : ''}`}
                    key={product.id}
                    onClick={() => changeQty(product.id, 1)}
                    disabled={product.estoque_disponivel != null && Number(product.estoque_disponivel) <= 0}
                  >
                    <span>{product.nome} {promotional && <Tag color="orange">PROMOÇÃO</Tag>}</span>
                    <strong>{promotional && <del>{money(product.preco_centavos)}</del>} {money(effectivePrice)}</strong>
                    <small>{product.estoque_disponivel == null ? 'Estoque não controlado' : `${product.estoque_disponivel} disponíveis`}</small>
                    {cart[product.id] > 0 && <b>{cart[product.id]}</b>}
                  </button>;
                })}
              </div>
            </section>

            <Card className="pdv-cart" title={<><ShoppingCartOutlined /> Pedido</>}>
              {!itemCount ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Toque em um produto" /> : (
                <List dataSource={Object.entries(cart)} renderItem={([id, qty]) => {
                  const product = productsById.get(id);
                  const price = getEffectivePriceCentavos(product);
                  return <List.Item><div><strong>{product?.nome} {product?.promocao_ativa && <Tag color="orange">Promoção</Tag>}</strong><small>{qty} × {money(price)} = {money(price * qty)}</small></div><Space><Button icon={<MinusOutlined />} onClick={() => changeQty(id, -1)} /><b>{qty}</b><Button icon={<PlusOutlined />} onClick={() => changeQty(id, 1)} /></Space></List.Item>;
                }} />
              )}
              <Divider />
              <DonationSelector value={donation} onChange={value => {
                setDonation(value);
                setDonationPayment(null);
                setProductPayment(null);
              }} />
              <div className="pdv-total"><span>Total</span><strong>{money(total)}</strong></div>
              <Button type="primary" size="large" block disabled={!itemCount} onClick={openCheckout}>Revisar pedido</Button>
            </Card>
          </main>

          <button className="pdv-mobile-cart-bar" disabled={!itemCount} onClick={openCheckout}>
            <span><ShoppingCartOutlined /> {itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
            <strong>{money(total)}</strong>
            <b>Revisar pedido</b>
          </button>

          <div className="pdv-day-actions">
            <Button disabled={!online} onClick={loadSales}>Vendas de hoje</Button>
            <Button disabled={!online} onClick={loadReport}>Relatório</Button>
            <Button danger disabled={!online || pendingCount > 0} onClick={() => setCloseOpen(true)}>Fechar caixa</Button>
          </div>
        </>
      )}

      <Drawer
        className="pdv-checkout-drawer"
        placement="bottom"
        height="100%"
        open={checkoutStep !== null}
        onClose={closeCheckout}
        closable={false}
        title={<div className="pdv-checkout-header">
          <Button
            type="text"
            size="large"
            icon={<ArrowLeftOutlined />}
            disabled={saving}
            onClick={() => checkoutStep === 'payment' ? setCheckoutStep('review') : closeCheckout()}
          >
            {checkoutStep === 'payment' ? 'Voltar ao pedido' : 'Voltar aos produtos'}
          </Button>
          <Button
            className="pdv-checkout-close"
            type="text"
            icon={<CloseOutlined />}
            disabled={saving}
            aria-label="Fechar e voltar aos produtos"
            onClick={closeCheckout}
          />
        </div>}
      >
        <div className="pdv-checkout-content">
          <Steps
            className="pdv-checkout-steps"
            size="small"
            current={checkoutStep === 'payment' ? 2 : 1}
            items={[{ title: 'Produtos' }, { title: 'Revisão' }, { title: 'Pagamento' }]}
          />
          {checkoutStep === 'review' && <>
            <Title level={2}>Revise o pedido</Title>
            <List dataSource={Object.entries(cart)} renderItem={([id, qty]) => {
              const product = productsById.get(id);
              const price = getEffectivePriceCentavos(product);
              return <List.Item className="pdv-review-item">
                <div><strong>{product?.nome}</strong><small>{qty} × {money(price)} = {money(price * qty)}</small></div>
                <Space>
                  <Button size="large" icon={<MinusOutlined />} onClick={() => changeQty(id, -1)} />
                  <b>{qty}</b>
                  <Button size="large" icon={<PlusOutlined />} onClick={() => changeQty(id, 1)} />
                </Space>
              </List.Item>;
            }} />
            <Divider />
            <DonationSelector value={donation} onChange={value => {
              setDonation(value);
              setProductPayment(null);
              setDonationPayment(null);
            }} />
            <div className="pdv-total"><span>Total</span><strong>{money(total)}</strong></div>
            <div className="pdv-checkout-footer">
              <Button size="large" onClick={closeCheckout}>Adicionar mais itens</Button>
              <Button type="primary" size="large" disabled={!itemCount} onClick={() => setCheckoutStep('payment')}>
                Continuar para pagamento
              </Button>
            </div>
          </>}

          {checkoutStep === 'payment' && <>
            <div className="pdv-checkout-summary">
              <span>Produtos: <strong>{money(subtotal)}</strong></span>
              {donation > 0 && <span>Doação: <strong>{money(donation)}</strong></span>}
              <Title level={2} className="pdv-checkout-total">Total: {money(total)}</Title>
            </div>
            <Button className="pdv-add-items" icon={<ArrowLeftOutlined />} onClick={closeCheckout}>Adicionar outro item</Button>
            <Title level={5}>Pagamento dos produtos *</Title>
            <PaymentButtons disabled={saving} selected={productPayment} onSelect={setProductPayment} />
            {donation > 0 && <>
              <Divider />
              <Title level={5}>Pagamento da doação *</Title>
              <PaymentButtons disabled={saving} selected={donationPayment} onSelect={setDonationPayment} />
            </>}
            <div className="pdv-payment-footer">
              <Button
                className="pdv-confirm-payment"
                type="primary"
                size="large"
                block
                loading={saving}
                disabled={!productPayment || (donation > 0 && !donationPayment)}
                onClick={finishSale}
              >
                Confirmar recebimento de {money(total)}
              </Button>
              {!online && <Text type="warning">A venda será salva neste aparelho e enviada quando a internet voltar.</Text>}
            </div>
            {saving && <Spin className="pdv-saving" />}
          </>}
        </div>
      </Drawer>

      <Drawer title="Vendas aguardando sincronização" width={560} open={pendingOpen} onClose={() => setPendingOpen(false)}>
        <Alert
          type={online ? 'info' : 'warning'}
          showIcon
          message={online ? 'Conexão disponível' : 'O aparelho está offline'}
          description="As vendas permanecem salvas neste aparelho até o servidor confirmar o recebimento."
          action={<Button type="primary" icon={<CloudSyncOutlined />} loading={syncing} disabled={!online} onClick={() => syncNow()}>
            Sincronizar agora
          </Button>}
        />
        <List
          className="pdv-pending-list"
          dataSource={pendingSales}
          locale={{ emptyText: 'Nenhuma venda pendente' }}
          renderItem={sale => {
            const saleTotal = sale.itens.reduce((sum, item) => sum + item.quantidade * item.precoUnitarioCentavos, 0) + sale.doacaoCentavos;
            return <List.Item actions={[
              <Button danger type="link" onClick={() => undoLocalSale(sale)}>Desfazer</Button>,
            ]}>
              <List.Item.Meta
                title={<Space wrap><strong>{money(saleTotal)}</strong><Tag color="orange">Pendente</Tag></Space>}
                description={<>
                  <div>{new Date(sale.registradaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {sale.itens.map(item => `${item.quantidade}x ${productsById.get(item.produtoId)?.nome || 'Produto'}`).join(', ')}</div>
                  {sale.lastError && <Text type="danger">Última tentativa: {sale.lastError}</Text>}
                </>}
              />
            </List.Item>;
          }}
        />
      </Drawer>

      <Drawer title="Vendas de hoje" width={560} open={salesOpen} onClose={() => setSalesOpen(false)}>
        <List dataSource={sales} locale={{ emptyText: 'Nenhuma venda' }} renderItem={sale => (
          <List.Item actions={sale.status === 'concluida' && caixaAberto && (isPdvSupervisorRole(context.usuario.role) || sale.vendedor_id === context.usuario.id) ? [<Button danger type="link" icon={<CloseCircleOutlined />} onClick={() => cancelSale(sale)}>Cancelar</Button>] : []}>
            <List.Item.Meta
              title={<Space wrap>
                <span>{money(sale.total_centavos)}</span>
                <Tag>Produtos: {sale.forma_pagamento.toUpperCase()}</Tag>
                {sale.doacao_centavos > 0 && <Tag color="purple">Doação: {(sale.forma_pagamento_doacao || sale.forma_pagamento).toUpperCase()}</Tag>}
                {sale.origem === 'offline' && <Tag color="orange">Sincronizada offline</Tag>}
                {sale.status === 'cancelada' && <Tag color="red">Cancelada</Tag>}
              </Space>}
              description={`${new Date(sale.registrada_em_dispositivo || sale.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${sale.vendedor_nome} · ${sale.itens.map(i => `${i.quantidade}x ${i.nome}${i.promocional ? ' (promoção)' : ''} a ${money(i.precoUnitarioCentavos)}`).join(', ')}${sale.doacao_centavos > 0 ? ` · Doação ${money(sale.doacao_centavos)}` : ''}`}
            />
          </List.Item>
        )} />
      </Drawer>

      <Modal title="Relatório diário" open={reportOpen} onCancel={() => setReportOpen(false)} footer={<Button icon={<PrinterOutlined />} onClick={() => window.print()}>Imprimir / salvar PDF</Button>} width={1080}>
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
  if (session && role && !['admin', 'vendedor', 'coordenador_lanches'].includes(role)) {
    return <div className="pdv-center"><Card><Alert type="error" showIcon message="Acesso não autorizado" description="Este usuário não possui o perfil Administrador ou Vendedor." /><Button style={{ marginTop: 16 }} block onClick={() => supabase.auth.signOut()}>Sair</Button></Card></div>;
  }
  return <Routes><Route path="/login" element={session ? <Navigate to="/" /> : <PdvLogin />} /><Route path="/" element={session ? <PdvHome /> : <Navigate to="/login" />} /><Route path="*" element={<Navigate to="/" />} /></Routes>;
}
