export const DONATION_PRESETS = [0, 100, 200, 500, 1000];

export const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX', description: 'Pagamento recebido por PIX' },
  { value: 'dinheiro', label: 'Dinheiro', description: 'Pagamento recebido em espécie' },
];

const quantityLimit = product => {
  if (product?.estoque_disponivel == null) return 999;
  return Math.min(999, Math.max(0, Number(product.estoque_disponivel)));
};

export function getEffectivePriceCentavos(product) {
  const normal = Number(product?.preco_centavos || 0);
  const promotional = Number(product?.preco_promocional_centavos || 0);
  if (product?.promocao_ativa && promotional > 0 && promotional < normal) return promotional;
  return normal;
}

export function updateCartQuantity(cart, product, delta) {
  if (!product?.id) return cart;
  const next = Math.max(0, Math.min(quantityLimit(product), (cart[product.id] || 0) + delta));
  const updated = { ...cart };
  if (next > 0) updated[product.id] = next;
  else delete updated[product.id];
  return updated;
}

export function reconcileCartWithStock(cart, products) {
  const byId = new Map((products || []).map(product => [product.id, product]));
  return Object.entries(cart || {}).reduce((updated, [id, quantity]) => {
    const product = byId.get(id);
    if (!product) return updated;
    const next = Math.min(quantityLimit(product), Math.max(0, Number(quantity) || 0));
    if (next > 0) updated[id] = next;
    return updated;
  }, {});
}

export function normalizeDonationCentavos(valueInReais) {
  const centavos = Math.round(Number(valueInReais || 0) * 100);
  return Math.max(0, Math.min(100000000, centavos));
}

export function buildOpenCashPayload(values, products) {
  return {
    valorInicialCentavos: normalizeDonationCentavos(values?.valorInicial),
    estoques: (products || []).map(product => ({
      produtoId: product.id,
      quantidade: Math.max(0, Math.trunc(Number(values?.estoques?.[product.id] || 0))),
    })),
  };
}

export function buildSalePayload({
  requestId, cart, donation, formaPagamento, formaPagamentoDoacao, products,
}) {
  const byId = new Map((products || []).map(product => [product.id, product]));
  return {
    requestId,
    itens: Object.entries(cart).map(([produtoId, quantidade]) => ({
      produtoId,
      quantidade,
      precoUnitarioEsperadoCentavos: getEffectivePriceCentavos(byId.get(produtoId)),
    })),
    doacaoCentavos: donation,
    formaPagamento,
    formaPagamentoDoacao: donation > 0 ? formaPagamentoDoacao : null,
  };
}
