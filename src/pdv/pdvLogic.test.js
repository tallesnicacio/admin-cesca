import {
  buildOpenCashPayload,
  buildSalePayload,
  normalizeDonationCentavos,
  reconcileCartWithStock,
  updateCartQuantity,
} from './pdvLogic';

const products = [
  { id: 'salgado', estoque_disponivel: 3 },
  { id: 'refri', estoque_disponivel: 1 },
];

test('monta o estoque de todos os produtos ao abrir o caixa', () => {
  expect(buildOpenCashPayload({
    valorInicial: 50,
    estoques: { salgado: 60, refri: 19 },
  }, products)).toEqual({
    valorInicialCentavos: 5000,
    estoques: [
      { produtoId: 'salgado', quantidade: 60 },
      { produtoId: 'refri', quantidade: 19 },
    ],
  });
});

test('impede o carrinho de ultrapassar o estoque disponível', () => {
  let cart = {};
  cart = updateCartQuantity(cart, products[1], 1);
  cart = updateCartQuantity(cart, products[1], 1);
  expect(cart).toEqual({ refri: 1 });
  expect(reconcileCartWithStock({ salgado: 5, refri: 1 }, products)).toEqual({ salgado: 3, refri: 1 });
});

test('seleção de doação define valor exato e aceita zero', () => {
  expect(normalizeDonationCentavos(2)).toBe(200);
  expect(normalizeDonationCentavos(0)).toBe(0);
  expect(normalizeDonationCentavos(-10)).toBe(0);
});

test('a mesma forma de pagamento pode ser usada em vendas consecutivas', () => {
  const input = { requestId: '1', cart: { salgado: 1 }, donation: 0, formaPagamento: 'pix' };
  expect(buildSalePayload(input).formaPagamento).toBe('pix');
  expect(buildSalePayload({ ...input, requestId: '2' }).formaPagamento).toBe('pix');
});
