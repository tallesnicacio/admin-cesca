const express = require('express');
const pool = require('../db');
const { authMiddleware, requireAdmin, requirePdvAccess } = require('../middleware/auth');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = new Set(['pix', 'dinheiro']);

router.use(authMiddleware);

function intInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function handleError(res, err, context) {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
  console.error(`[PDV] ${context}:`, err);
  if (err.code === '23505') return res.status(409).json({ error: 'Registro duplicado' });
  return res.status(500).json({ error: 'Erro interno ao processar o PDV' });
}

async function getSale(client, saleId) {
  const { rows } = await client.query(
    `SELECT v.*, p.name AS vendedor_nome,
            COALESCE(json_agg(json_build_object(
              'produtoId', i.produto_id,
              'nome', i.produto_nome,
              'quantidade', i.quantidade,
              'precoUnitarioCentavos', i.preco_unitario_centavos,
              'totalCentavos', i.total_centavos
            ) ORDER BY i.produto_nome) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
       FROM pdv_vendas v
       JOIN profiles p ON p.id = v.vendedor_id
       LEFT JOIN pdv_venda_itens i ON i.venda_id = v.id
      WHERE v.id = $1
      GROUP BY v.id, p.name`,
    [saleId]
  );
  return rows[0] || null;
}

async function getCashSummary(client, cashId) {
  const { rows } = await client.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'concluida')::int AS quantidade_vendas,
       COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida'), 0)::int AS doacao_centavos,
       COALESCE(SUM(total_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'pix'), 0)::int AS pix_centavos,
       COALESCE(SUM(total_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'dinheiro'), 0)::int AS dinheiro_centavos,
       COALESCE(SUM(total_centavos) FILTER (WHERE status = 'concluida'), 0)::int AS total_centavos
     FROM pdv_vendas WHERE caixa_id = $1`,
    [cashId]
  );
  return rows[0];
}

async function calculateExpectedCash(client, cashId, initialValue) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END), 0) AS movimento
       FROM movimentacoes_caixa
      WHERE caixa_id = $1 AND forma_pagamento = 'dinheiro'`,
    [cashId]
  );
  return Math.round((Number(initialValue) + Number(rows[0].movimento)) * 100);
}

// Contexto único para carregar ou atualizar a tela do caixa.
router.get('/contexto', requirePdvAccess, async (req, res) => {
  try {
    const { rows: cashRows } = await pool.query(
      `SELECT * FROM caixas
        WHERE data = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AND setor = 'lanche'
        LIMIT 1`
    );
    const caixa = cashRows[0] || null;
    let produtos = [];
    let resumo = null;
    if (caixa) {
      ({ rows: produtos } = await pool.query(
        `SELECT produto_id AS id, nome, preco_centavos, ordem
           FROM pdv_caixa_produtos WHERE caixa_id = $1 ORDER BY ordem, nome`,
        [caixa.id]
      ));
      resumo = await getCashSummary(pool, caixa.id);
    } else if (req.user.role === 'admin') {
      ({ rows: produtos } = await pool.query(
        `SELECT id, nome, preco_centavos, ordem FROM pdv_produtos
          WHERE ativo AND preco_centavos IS NOT NULL ORDER BY ordem, nome`
      ));
    }
    res.json({
      data: {
        usuario: { id: req.user.sub, nome: req.user.name, role: req.user.role },
        caixa,
        produtos,
        resumo,
      },
      error: null,
    });
  } catch (err) {
    handleError(res, err, 'carregar contexto');
  }
});

router.post('/caixas/abrir', requirePdvAccess, async (req, res) => {
  const valorInicialCentavos = Number(req.body.valorInicialCentavos ?? 0);
  if (!intInRange(valorInicialCentavos, 0, 100000000)) {
    return res.status(400).json({ error: 'Valor inicial inválido' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: catalog } = await client.query(
      `SELECT id, nome, preco_centavos, ordem FROM pdv_produtos
        WHERE ativo AND preco_centavos IS NOT NULL ORDER BY ordem, nome FOR SHARE`
    );
    if (!catalog.length) throw Object.assign(new Error('Cadastre e ative ao menos um produto com preço antes de abrir o caixa'), { statusCode: 409 });

    const { rows } = await client.query(
      `INSERT INTO caixas (data, setor, valor_inicial, status, aberto_por, hora_abertura)
       VALUES ((NOW() AT TIME ZONE 'America/Sao_Paulo')::date, 'lanche', $1, 'aberto', $2, NOW())
       ON CONFLICT (data, setor) DO NOTHING
       RETURNING *`,
      [valorInicialCentavos / 100, req.user.sub]
    );
    if (!rows.length) throw Object.assign(new Error('O caixa da lanchonete para hoje já existe'), { statusCode: 409 });
    const caixa = rows[0];
    for (const produto of catalog) {
      await client.query(
        `INSERT INTO pdv_caixa_produtos (caixa_id, produto_id, nome, preco_centavos, ordem)
         VALUES ($1, $2, $3, $4, $5)`,
        [caixa.id, produto.id, produto.nome, produto.preco_centavos, produto.ordem]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ data: caixa, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'abrir caixa');
  } finally {
    client.release();
  }
});

router.post('/caixas/:id/fechar', requirePdvAccess, async (req, res) => {
  const valorContadoCentavos = Number(req.body.valorContadoCentavos);
  if (!UUID_RE.test(req.params.id) || !intInRange(valorContadoCentavos, 0, 100000000)) {
    return res.status(400).json({ error: 'Caixa ou valor contado inválido' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM caixas WHERE id = $1 FOR UPDATE', [req.params.id]);
    const caixa = rows[0];
    if (!caixa || caixa.setor !== 'lanche') throw Object.assign(new Error('Caixa não encontrado'), { statusCode: 404 });
    if (caixa.status !== 'aberto') throw Object.assign(new Error('Este caixa já está fechado'), { statusCode: 409 });
    const esperado = await calculateExpectedCash(client, caixa.id, caixa.valor_inicial);
    const diferenca = valorContadoCentavos - esperado;
    const { rows: updated } = await client.query(
      `UPDATE caixas SET status = 'fechado', valor_final_esperado = $1,
              valor_final_real = $2, diferenca = $3, fechado_por = $4,
              hora_fechamento = NOW(), updated_at = NOW()
        WHERE id = $5 RETURNING *`,
      [esperado / 100, valorContadoCentavos / 100, diferenca / 100, req.user.sub, caixa.id]
    );
    await client.query(
      `INSERT INTO pdv_fechamentos
       (caixa_id, tipo, valor_esperado_centavos, valor_contado_centavos, diferenca_centavos, realizado_por)
       VALUES ($1, 'fechamento', $2, $3, $4, $5)`,
      [caixa.id, esperado, valorContadoCentavos, diferenca, req.user.sub]
    );
    await client.query('COMMIT');
    res.json({ data: updated[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'fechar caixa');
  } finally {
    client.release();
  }
});

router.post('/caixas/:id/reabrir', requireAdmin, async (req, res) => {
  const motivo = cleanText(req.body.motivo);
  if (!UUID_RE.test(req.params.id) || motivo.length < 3) return res.status(400).json({ error: 'Informe um motivo para reabrir o caixa' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM caixas WHERE id = $1 FOR UPDATE', [req.params.id]);
    const caixa = rows[0];
    if (!caixa || caixa.setor !== 'lanche') throw Object.assign(new Error('Caixa não encontrado'), { statusCode: 404 });
    if (caixa.status !== 'fechado') throw Object.assign(new Error('O caixa já está aberto'), { statusCode: 409 });
    const { rows: updated } = await client.query(
      `UPDATE caixas SET status = 'aberto', valor_final_esperado = NULL,
              valor_final_real = NULL, diferenca = NULL, fechado_por = NULL,
              hora_fechamento = NULL, updated_at = NOW(),
              observacoes = concat_ws(E'\n', NULLIF(observacoes, ''), $1::text)
        WHERE id = $2 RETURNING *`,
      [`Reaberto: ${motivo}`, caixa.id]
    );
    await client.query(
      `INSERT INTO pdv_fechamentos (caixa_id, tipo, motivo, realizado_por)
       VALUES ($1, 'reabertura', $2, $3)`,
      [caixa.id, motivo, req.user.sub]
    );
    await client.query('COMMIT');
    res.json({ data: updated[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'reabrir caixa');
  } finally {
    client.release();
  }
});

router.get('/vendas', requirePdvAccess, async (req, res) => {
  try {
    const data = cleanText(req.query.data, 10);
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
    if (selectedDate && req.user.role !== 'admin') return res.status(403).json({ error: 'Vendedores consultam somente o dia atual' });
    const { rows } = await pool.query(
      `SELECT v.*, p.name AS vendedor_nome,
              COALESCE(json_agg(json_build_object(
                'produtoId', i.produto_id, 'nome', i.produto_nome,
                'quantidade', i.quantidade, 'precoUnitarioCentavos', i.preco_unitario_centavos,
                'totalCentavos', i.total_centavos
              ) ORDER BY i.produto_nome) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
         FROM pdv_vendas v
         JOIN caixas c ON c.id = v.caixa_id
         JOIN profiles p ON p.id = v.vendedor_id
         LEFT JOIN pdv_venda_itens i ON i.venda_id = v.id
        WHERE c.setor = 'lanche'
          AND c.data = COALESCE($1::date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date)
        GROUP BY v.id, p.name ORDER BY v.created_at DESC`,
      [selectedDate]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    handleError(res, err, 'listar vendas');
  }
});

router.post('/vendas', requirePdvAccess, async (req, res) => {
  const { requestId, itens, formaPagamento } = req.body;
  const doacaoCentavos = Number(req.body.doacaoCentavos ?? 0);
  if (!UUID_RE.test(requestId || '') || !Array.isArray(itens) || !itens.length || !PAYMENT_METHODS.has(formaPagamento)) {
    return res.status(400).json({ error: 'Venda inválida' });
  }
  if (!intInRange(doacaoCentavos, 0, 100000000)) return res.status(400).json({ error: 'Valor de doação inválido' });
  const quantities = new Map();
  for (const item of itens) {
    const quantidade = Number(item.quantidade);
    if (!UUID_RE.test(item.produtoId || '') || !intInRange(quantidade, 1, 999)) return res.status(400).json({ error: 'Item ou quantidade inválida' });
    quantities.set(item.produtoId, (quantities.get(item.produtoId) || 0) + quantidade);
  }
  if ([...quantities.values()].some(q => q > 999)) return res.status(400).json({ error: 'Quantidade máxima por produto excedida' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const { rows: cashRows } = await client.query(
      `SELECT * FROM caixas
        WHERE data = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AND setor = 'lanche'
        FOR UPDATE`
    );
    const caixa = cashRows[0];
    if (!caixa) throw Object.assign(new Error('Abra o caixa antes de registrar vendas'), { statusCode: 409 });
    const { rows: existingRows } = await client.query(
      'SELECT id FROM pdv_vendas WHERE caixa_id = $1 AND request_id = $2',
      [caixa.id, requestId]
    );
    if (existingRows.length) {
      const existing = await getSale(client, existingRows[0].id);
      await client.query('COMMIT');
      return res.json({ data: existing, error: null, idempotent: true });
    }
    if (caixa.status !== 'aberto') throw Object.assign(new Error('O caixa está fechado'), { statusCode: 409 });

    const ids = [...quantities.keys()];
    const { rows: products } = await client.query(
      `SELECT produto_id, nome, preco_centavos FROM pdv_caixa_produtos
        WHERE caixa_id = $1 AND produto_id = ANY($2::uuid[])`,
      [caixa.id, ids]
    );
    if (products.length !== ids.length) throw Object.assign(new Error('Um dos produtos não pertence ao catálogo deste caixa'), { statusCode: 409 });
    const subtotal = products.reduce((sum, p) => sum + p.preco_centavos * quantities.get(p.produto_id), 0);
    const total = subtotal + doacaoCentavos;
    if (!intInRange(total, 1, 100000000)) throw Object.assign(new Error('Total da venda inválido'), { statusCode: 400 });
    const { rows: saleRows } = await client.query(
      `INSERT INTO pdv_vendas
       (caixa_id, request_id, vendedor_id, subtotal_centavos, doacao_centavos, total_centavos, forma_pagamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [caixa.id, requestId, req.user.sub, subtotal, doacaoCentavos, total, formaPagamento]
    );
    const saleId = saleRows[0].id;
    for (const product of products) {
      const quantidade = quantities.get(product.produto_id);
      await client.query(
        `INSERT INTO pdv_venda_itens
         (venda_id, produto_id, produto_nome, quantidade, preco_unitario_centavos, total_centavos)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [saleId, product.produto_id, product.nome, quantidade, product.preco_centavos, quantidade * product.preco_centavos]
      );
    }
    await client.query(
      `INSERT INTO movimentacoes_caixa
       (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
       VALUES ($1, 'entrada', 'lanche', $2, $3, $4, $5, $6, 'venda')`,
      [caixa.id, total / 100, `Venda PDV ${saleId}`, formaPagamento, req.user.sub, saleId]
    );
    const sale = await getSale(client, saleId);
    await client.query('COMMIT');
    res.status(201).json({ data: sale, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '40001') return res.status(409).json({ error: 'O caixa mudou durante a venda. Tente finalizar novamente.' });
    handleError(res, err, 'registrar venda');
  } finally {
    client.release();
  }
});

router.post('/vendas/:id/cancelar', requirePdvAccess, async (req, res) => {
  const motivo = cleanText(req.body.motivo);
  if (!UUID_RE.test(req.params.id) || motivo.length < 3) return res.status(400).json({ error: 'Informe um motivo para o cancelamento' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT v.*, c.status AS caixa_status FROM pdv_vendas v
       JOIN caixas c ON c.id = v.caixa_id WHERE v.id = $1 FOR UPDATE OF v, c`,
      [req.params.id]
    );
    const venda = rows[0];
    if (!venda) throw Object.assign(new Error('Venda não encontrada'), { statusCode: 404 });
    if (venda.status === 'cancelada') throw Object.assign(new Error('Venda já cancelada'), { statusCode: 409 });
    if (venda.caixa_status !== 'aberto') throw Object.assign(new Error('Reabra o caixa antes de cancelar uma venda'), { statusCode: 409 });
    if (req.user.role !== 'admin' && venda.vendedor_id !== req.user.sub) {
      throw Object.assign(new Error('Você só pode cancelar suas próprias vendas'), { statusCode: 403 });
    }
    await client.query(
      `UPDATE pdv_vendas SET status = 'cancelada', cancelada_por = $1,
              cancelada_em = NOW(), motivo_cancelamento = $2, updated_at = NOW()
        WHERE id = $3`,
      [req.user.sub, motivo, venda.id]
    );
    await client.query(
      `INSERT INTO movimentacoes_caixa
       (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
       VALUES ($1, 'saida', 'lanche', $2, $3, $4, $5, $6, 'cancelamento')`,
      [venda.caixa_id, venda.total_centavos / 100, `Cancelamento da venda PDV ${venda.id}`, venda.forma_pagamento, req.user.sub, venda.id]
    );
    const sale = await getSale(client, venda.id);
    await client.query('COMMIT');
    res.json({ data: sale, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'cancelar venda');
  } finally {
    client.release();
  }
});

router.get('/relatorios/diario', requirePdvAccess, async (req, res) => {
  const requestedDate = cleanText(req.query.data, 10);
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return res.status(400).json({ error: 'Data inválida' });
  if (requestedDate && req.user.role !== 'admin') return res.status(403).json({ error: 'Vendedores consultam somente o dia atual' });
  try {
    const { rows: cashRows } = await pool.query(
      `SELECT * FROM caixas WHERE setor = 'lanche'
        AND data = COALESCE($1::date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date)`,
      [requestedDate || null]
    );
    const caixa = cashRows[0] || null;
    if (!caixa) return res.json({ data: { caixa: null, produtos: [], resumo: null }, error: null });
    const resumo = await getCashSummary(pool, caixa.id);
    const { rows: produtos } = await pool.query(
      `SELECT i.produto_id, i.produto_nome AS nome, SUM(i.quantidade)::int AS quantidade,
              SUM(i.total_centavos)::int AS total_centavos
         FROM pdv_venda_itens i JOIN pdv_vendas v ON v.id = i.venda_id
        WHERE v.caixa_id = $1 AND v.status = 'concluida'
        GROUP BY i.produto_id, i.produto_nome ORDER BY i.produto_nome`,
      [caixa.id]
    );
    res.json({ data: { caixa, produtos, resumo }, error: null });
  } catch (err) {
    handleError(res, err, 'gerar relatório');
  }
});

router.get('/admin/produtos', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pdv_produtos ORDER BY ordem, nome');
    res.json({ data: rows, error: null });
  } catch (err) {
    handleError(res, err, 'listar produtos');
  }
});

router.post('/admin/produtos', requireAdmin, async (req, res) => {
  const nome = cleanText(req.body.nome, 80);
  const preco = req.body.precoCentavos == null ? null : Number(req.body.precoCentavos);
  const ativo = Boolean(req.body.ativo);
  const ordem = Number(req.body.ordem ?? 0);
  if (!nome || (preco !== null && !intInRange(preco, 1, 100000000)) || !intInRange(ordem, 0, 100000)) {
    return res.status(400).json({ error: 'Dados do produto inválidos' });
  }
  if (ativo && preco === null) return res.status(400).json({ error: 'Produto ativo precisa ter preço' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO pdv_produtos (nome, preco_centavos, ativo, ordem, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
      [nome, preco, ativo, ordem, req.user.sub]
    );
    res.status(201).json({ data: rows[0], error: null });
  } catch (err) {
    handleError(res, err, 'criar produto');
  }
});

router.patch('/admin/produtos/:id', requireAdmin, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Produto inválido' });
  const nome = cleanText(req.body.nome, 80);
  const preco = req.body.precoCentavos == null ? null : Number(req.body.precoCentavos);
  const ativo = Boolean(req.body.ativo);
  const ordem = Number(req.body.ordem ?? 0);
  if (!nome || (preco !== null && !intInRange(preco, 1, 100000000)) || !intInRange(ordem, 0, 100000)) {
    return res.status(400).json({ error: 'Dados do produto inválidos' });
  }
  if (ativo && preco === null) return res.status(400).json({ error: 'Produto ativo precisa ter preço' });
  try {
    const { rows } = await pool.query(
      `UPDATE pdv_produtos SET nome = $1, preco_centavos = $2, ativo = $3,
              ordem = $4, atualizado_por = $5, updated_at = NOW()
        WHERE id = $6 RETURNING *`,
      [nome, preco, ativo, ordem, req.user.sub, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ data: rows[0], error: null });
  } catch (err) {
    handleError(res, err, 'atualizar produto');
  }
});

module.exports = router;
