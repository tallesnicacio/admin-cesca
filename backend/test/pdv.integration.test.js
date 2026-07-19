const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:pdv_test_only@127.0.0.1:55432/admin_cesca';
process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.RESEND_API_KEY = 're_test';
process.env.CORS_ORIGINS = 'http://localhost';

const app = require('../src/server');
const pool = require('../src/db');

const IDS = {
  admin: '10000000-0000-4000-8000-000000000001',
  seller: '10000000-0000-4000-8000-000000000002',
  other: '10000000-0000-4000-8000-000000000003',
};
const token = (id, role) => jwt.sign({ sub: id, email: `${role}@test.local`, role }, process.env.JWT_SECRET);
const auth = {
  admin: `Bearer ${token(IDS.admin, 'admin')}`,
  seller: `Bearer ${token(IDS.seller, 'vendedor')}`,
  other: `Bearer ${token(IDS.other, 'vendedor')}`,
};

test.before(async () => {
  await pool.query('TRUNCATE pdv_fechamentos, movimentacoes_caixa, pdv_venda_itens, pdv_vendas, pdv_caixa_produtos, caixas, pdv_produtos, profiles CASCADE');
  await pool.query(
    `INSERT INTO profiles (id, email, name, role, is_admin, is_active, active) VALUES
     ($1, 'admin@test.local', 'Admin', 'admin', true, true, true),
     ($2, 'seller@test.local', 'Vendedor Um', 'vendedor', false, true, true),
     ($3, 'other@test.local', 'Vendedor Dois', 'vendedor', false, true, true)`,
    [IDS.admin, IDS.seller, IDS.other]
  );
  await pool.query(`INSERT INTO pdv_produtos (nome, preco_centavos, ativo, ordem) VALUES ('Salgado', 500, true, 10), ('Refrigerante', 400, true, 20)`);
});

test.after(async () => { await pool.end(); });

test('fluxo diário completo, RBAC, idempotência e fechamento', async () => {
  const sellerData = await request(app).get('/api/data/profiles').set('Authorization', auth.seller);
  assert.equal(sellerData.status, 403);
  const unsafePatch = await request(app).patch('/api/data/profiles').set('Authorization', auth.admin).send({ name: 'Todos' });
  assert.equal(unsafePatch.status, 400);

  const opened = await request(app).post('/api/pdv/caixas/abrir').set('Authorization', auth.seller).send({ valorInicialCentavos: 5000 });
  assert.equal(opened.status, 201, opened.text);

  const context = await request(app).get('/api/pdv/contexto').set('Authorization', auth.seller);
  assert.equal(context.status, 200);
  const salgado = context.body.data.produtos.find(p => p.nome === 'Salgado');
  const refri = context.body.data.produtos.find(p => p.nome === 'Refrigerante');

  const cashPayload = {
    requestId: '20000000-0000-4000-8000-000000000001',
    itens: [{ produtoId: salgado.id, quantidade: 2 }, { produtoId: refri.id, quantidade: 1 }],
    doacaoCentavos: 200,
    formaPagamento: 'dinheiro',
  };
  const cashSale = await request(app).post('/api/pdv/vendas').set('Authorization', auth.seller).send(cashPayload);
  assert.equal(cashSale.status, 201, cashSale.text);
  assert.equal(cashSale.body.data.total_centavos, 1600);

  const duplicate = await request(app).post('/api/pdv/vendas').set('Authorization', auth.seller).send(cashPayload);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.data.id, cashSale.body.data.id);
  assert.equal(duplicate.body.idempotent, true);

  const pixSale = await request(app).post('/api/pdv/vendas').set('Authorization', auth.seller).send({
    requestId: '20000000-0000-4000-8000-000000000002', itens: [{ produtoId: refri.id, quantidade: 1 }], doacaoCentavos: 100, formaPagamento: 'pix',
  });
  assert.equal(pixSale.status, 201, pixSale.text);
  assert.equal(pixSale.body.data.total_centavos, 500);

  const forbiddenCancel = await request(app).post(`/api/pdv/vendas/${cashSale.body.data.id}/cancelar`).set('Authorization', auth.other).send({ motivo: 'Venda incorreta' });
  assert.equal(forbiddenCancel.status, 403);

  const report = await request(app).get('/api/pdv/relatorios/diario').set('Authorization', auth.seller);
  assert.equal(report.status, 200);
  assert.equal(report.body.data.resumo.dinheiro_centavos, 1600);
  assert.equal(report.body.data.resumo.pix_centavos, 500);
  assert.equal(report.body.data.resumo.doacao_centavos, 300);
  assert.equal(report.body.data.resumo.total_centavos, 2100);
  assert.equal(report.body.data.produtos.find(p => p.nome === 'Salgado').quantidade, 2);
  assert.equal(report.body.data.produtos.find(p => p.nome === 'Refrigerante').quantidade, 2);

  const closed = await request(app).post(`/api/pdv/caixas/${opened.body.data.id}/fechar`).set('Authorization', auth.seller).send({ valorContadoCentavos: 6600 });
  assert.equal(closed.status, 200, closed.text);
  assert.equal(Number(closed.body.data.valor_final_esperado), 66);
  assert.equal(Number(closed.body.data.diferenca), 0);

  const sellerReopen = await request(app).post(`/api/pdv/caixas/${opened.body.data.id}/reabrir`).set('Authorization', auth.seller).send({ motivo: 'Correção necessária' });
  assert.equal(sellerReopen.status, 403);
  const adminReopen = await request(app).post(`/api/pdv/caixas/${opened.body.data.id}/reabrir`).set('Authorization', auth.admin).send({ motivo: 'Correção necessária' });
  assert.equal(adminReopen.status, 200, adminReopen.text);

  const cancelled = await request(app).post(`/api/pdv/vendas/${cashSale.body.data.id}/cancelar`).set('Authorization', auth.seller).send({ motivo: 'Pedido lançado em duplicidade' });
  assert.equal(cancelled.status, 200, cancelled.text);
  assert.equal(cancelled.body.data.status, 'cancelada');
});
