const express = require('express');
const pool = require('../db');
const { authMiddleware, requireAdmin, requirePdvAccess, requirePdvSupervisor } = require('../middleware/auth');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHODS = new Set(['pix', 'dinheiro']);
const PDV_SUPERVISOR_ROLES = new Set(['admin', 'coordenador_lanches']);

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
              'totalCentavos', i.total_centavos,
              'promocional', i.promocional
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
       COALESCE(SUM(subtotal_centavos) FILTER (WHERE status = 'concluida'), 0)::int AS produtos_centavos,
       COALESCE(SUM(subtotal_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'pix'), 0)::int AS produtos_pix_centavos,
       COALESCE(SUM(subtotal_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'dinheiro'), 0)::int AS produtos_dinheiro_centavos,
       COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida'), 0)::int AS doacao_centavos,
       COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento_doacao = 'pix'), 0)::int AS doacao_pix_centavos,
       COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento_doacao = 'dinheiro'), 0)::int AS doacao_dinheiro_centavos,
       (
         COALESCE(SUM(subtotal_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'pix'), 0)
         + COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento_doacao = 'pix'), 0)
       )::int AS pix_centavos,
       (
         COALESCE(SUM(subtotal_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento = 'dinheiro'), 0)
         + COALESCE(SUM(doacao_centavos) FILTER (WHERE status = 'concluida' AND forma_pagamento_doacao = 'dinheiro'), 0)
       )::int AS dinheiro_centavos,
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

function validateOfflineSale(sale) {
  if (!UUID_RE.test(sale?.requestId || '') || !Array.isArray(sale?.itens) || !sale.itens.length) {
    throw Object.assign(new Error('Venda offline inválida'), { statusCode: 400 });
  }
  if (!PAYMENT_METHODS.has(sale.formaPagamento)) {
    throw Object.assign(new Error('Forma de pagamento dos produtos inválida'), { statusCode: 400 });
  }
  const doacaoCentavos = Number(sale.doacaoCentavos ?? 0);
  const formaPagamentoDoacao = doacaoCentavos > 0
    ? (sale.formaPagamentoDoacao ?? sale.formaPagamento)
    : null;
  if (!intInRange(doacaoCentavos, 0, 100000000)) {
    throw Object.assign(new Error('Valor de doação inválido'), { statusCode: 400 });
  }
  if (doacaoCentavos > 0 && !PAYMENT_METHODS.has(formaPagamentoDoacao)) {
    throw Object.assign(new Error('Forma de pagamento da doação inválida'), { statusCode: 400 });
  }
  const registradaEm = new Date(sale.registradaEm);
  if (!sale.registradaEm || Number.isNaN(registradaEm.getTime())) {
    throw Object.assign(new Error('Horário da venda offline inválido'), { statusCode: 400 });
  }
  const quantities = new Map();
  const snapshots = new Map();
  for (const item of sale.itens) {
    const quantidade = Number(item?.quantidade);
    const preco = Number(item?.precoUnitarioCentavos);
    if (
      !UUID_RE.test(item?.produtoId || '')
      || !intInRange(quantidade, 1, 999)
      || !intInRange(preco, 1, 100000000)
      || typeof item.promocional !== 'boolean'
    ) {
      throw Object.assign(new Error('Item da venda offline inválido'), { statusCode: 400 });
    }
    const previous = snapshots.get(item.produtoId);
    if (previous && (previous.preco !== preco || previous.promocional !== item.promocional)) {
      throw Object.assign(new Error('O mesmo produto foi enviado com preços diferentes'), { statusCode: 400 });
    }
    quantities.set(item.produtoId, (quantities.get(item.produtoId) || 0) + quantidade);
    snapshots.set(item.produtoId, { preco, promocional: item.promocional });
  }
  if ([...quantities.values()].some(quantity => quantity > 999)) {
    throw Object.assign(new Error('Quantidade máxima por produto excedida'), { statusCode: 400 });
  }
  return { doacaoCentavos, formaPagamentoDoacao, registradaEm, quantities, snapshots };
}

async function syncOfflineSale({ sale, caixaId, deviceId, syncId, user }) {
  const parsed = validateOfflineSale(sale);
  const vendedorId = sale.vendedorId || user.sub;
  if (!UUID_RE.test(vendedorId) || (vendedorId !== user.sub && !PDV_SUPERVISOR_ROLES.has(user.role))) {
    throw Object.assign(new Error('Vendedor da venda offline não autorizado'), { statusCode: 403 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const { rows: cashRows } = await client.query(
      `SELECT * FROM caixas WHERE id = $1 AND setor = 'lanche' FOR UPDATE`,
      [caixaId]
    );
    const caixa = cashRows[0];
    if (!caixa) throw Object.assign(new Error('Caixa da venda offline não encontrado'), { statusCode: 404 });

    const { rows: existingRows } = await client.query(
      'SELECT id FROM pdv_vendas WHERE caixa_id = $1 AND request_id = $2',
      [caixa.id, sale.requestId]
    );
    if (existingRows.length) {
      await client.query('COMMIT');
      return { requestId: sale.requestId, status: 'duplicada', vendaId: existingRows[0].id, alertas: [] };
    }

    const { rows: sellerRows } = await client.query(
      `SELECT id FROM profiles WHERE id = $1 AND is_active IS NOT FALSE AND role IN ('admin', 'vendedor', 'coordenador_lanches')`,
      [vendedorId]
    );
    if (!sellerRows.length) throw Object.assign(new Error('Vendedor original não está ativo'), { statusCode: 403 });

    const ids = [...parsed.quantities.keys()];
    const { rows: products } = await client.query(
      `SELECT produto_id, nome, preco_centavos, preco_promocional_centavos,
              estoque_inicial, estoque_disponivel
         FROM pdv_caixa_produtos
        WHERE caixa_id = $1 AND produto_id = ANY($2::uuid[])
        FOR UPDATE`,
      [caixa.id, ids]
    );
    if (products.length !== ids.length) {
      throw Object.assign(new Error('Um produto não pertence ao caixa informado'), { statusCode: 409 });
    }

    const pricedProducts = products.map(product => {
      const snapshot = parsed.snapshots.get(product.produto_id);
      const allowedPrice = snapshot.promocional
        ? Number(product.preco_promocional_centavos)
        : Number(product.preco_centavos);
      if (!allowedPrice || snapshot.preco !== allowedPrice) {
        throw Object.assign(new Error(`Preço offline inválido para ${product.nome}`), { statusCode: 409 });
      }
      return {
        ...product,
        quantidade: parsed.quantities.get(product.produto_id),
        precoEfetivoCentavos: snapshot.preco,
        promocional: snapshot.promocional,
      };
    });
    const subtotal = pricedProducts.reduce(
      (sum, product) => sum + product.precoEfetivoCentavos * product.quantidade,
      0
    );
    const total = subtotal + parsed.doacaoCentavos;
    if (!intInRange(total, 1, 100000000)) {
      throw Object.assign(new Error('Total da venda offline inválido'), { statusCode: 400 });
    }

    const { rows: saleRows } = await client.query(
      `INSERT INTO pdv_vendas
       (caixa_id, request_id, vendedor_id, subtotal_centavos, doacao_centavos,
        total_centavos, forma_pagamento, forma_pagamento_doacao, origem,
        dispositivo_id, registrada_em_dispositivo, sincronizada_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING id`,
      [caixa.id, sale.requestId, vendedorId, subtotal, parsed.doacaoCentavos, total,
        sale.formaPagamento, parsed.formaPagamentoDoacao,
        sale.offline === false ? 'online' : 'offline', deviceId, parsed.registradaEm]
    );
    const saleId = saleRows[0].id;
    const alerts = [];
    for (const product of pricedProducts) {
      if (product.estoque_disponivel !== null) {
        const nextStock = Number(product.estoque_disponivel) - product.quantidade;
        await client.query(
          `UPDATE pdv_caixa_produtos SET estoque_disponivel = $1
            WHERE caixa_id = $2 AND produto_id = $3`,
          [nextStock, caixa.id, product.produto_id]
        );
        if (nextStock < 0) {
          const mensagem = `${product.nome} ficou com estoque ${nextStock} após sincronização offline.`;
          alerts.push({ tipo: 'estoque_negativo', mensagem });
          await client.query(
            `INSERT INTO pdv_sincronizacao_alertas
             (sincronizacao_id, caixa_id, venda_id, tipo, mensagem, detalhes)
             VALUES ($1, $2, $3, 'estoque_negativo', $4, $5::jsonb)`,
            [syncId, caixa.id, saleId, mensagem, JSON.stringify({
              produtoId: product.produto_id,
              estoqueAntes: Number(product.estoque_disponivel),
              estoqueDepois: nextStock,
            })]
          );
        }
      }
      await client.query(
        `INSERT INTO pdv_venda_itens
         (venda_id, produto_id, produto_nome, quantidade, preco_unitario_centavos,
          total_centavos, promocional)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [saleId, product.produto_id, product.nome, product.quantidade,
          product.precoEfetivoCentavos,
          product.quantidade * product.precoEfetivoCentavos,
          product.promocional]
      );
    }

    await client.query(
      `INSERT INTO movimentacoes_caixa
       (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
       VALUES ($1, 'entrada', 'lanche', $2, $3, $4, $5, $6, 'venda_produtos')`,
      [caixa.id, subtotal / 100, `Produtos da venda offline PDV ${saleId}`,
        sale.formaPagamento, vendedorId, saleId]
    );
    if (parsed.doacaoCentavos > 0) {
      await client.query(
        `INSERT INTO movimentacoes_caixa
         (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
         VALUES ($1, 'entrada', 'lanche', $2, $3, $4, $5, $6, 'venda_doacao')`,
        [caixa.id, parsed.doacaoCentavos / 100, `Doação da venda offline PDV ${saleId}`,
          parsed.formaPagamentoDoacao, vendedorId, saleId]
      );
    }

    let recalculouFechamento = false;
    if (caixa.status === 'fechado') {
      const esperadoAntes = Math.round(Number(caixa.valor_final_esperado || 0) * 100);
      const esperadoDepois = await calculateExpectedCash(client, caixa.id, caixa.valor_inicial);
      const contado = Math.round(Number(caixa.valor_final_real || 0) * 100);
      const diferencaDepois = contado - esperadoDepois;
      await client.query(
        `UPDATE caixas SET valor_final_esperado = $1, diferenca = $2, updated_at = NOW()
          WHERE id = $3`,
        [esperadoDepois / 100, diferencaDepois / 100, caixa.id]
      );
      await client.query(
        `UPDATE pdv_fechamentos
            SET valor_esperado_centavos = $1, diferenca_centavos = $2
          WHERE id = (
            SELECT id FROM pdv_fechamentos
             WHERE caixa_id = $3 AND tipo = 'fechamento'
             ORDER BY created_at DESC LIMIT 1
          )`,
        [esperadoDepois, diferencaDepois, caixa.id]
      );
      const mensagem = 'Venda offline recebida após o fechamento; valores do caixa foram recalculados.';
      alerts.push({ tipo: 'venda_pos_fechamento', mensagem });
      await client.query(
        `INSERT INTO pdv_sincronizacao_alertas
         (sincronizacao_id, caixa_id, venda_id, tipo, mensagem, detalhes)
         VALUES ($1, $2, $3, 'venda_pos_fechamento', $4, $5::jsonb)`,
        [syncId, caixa.id, saleId, mensagem, JSON.stringify({
          esperadoAntesCentavos: esperadoAntes,
          esperadoDepoisCentavos: esperadoDepois,
          diferencaDepoisCentavos: diferencaDepois,
        })]
      );
      recalculouFechamento = true;
    }

    if (Math.abs(Date.now() - parsed.registradaEm.getTime()) > 24 * 60 * 60 * 1000) {
      const mensagem = 'Horário do aparelho difere do servidor em mais de 24 horas.';
      alerts.push({ tipo: 'relogio_dispositivo', mensagem });
      await client.query(
        `INSERT INTO pdv_sincronizacao_alertas
         (sincronizacao_id, caixa_id, venda_id, tipo, mensagem, detalhes)
         VALUES ($1, $2, $3, 'relogio_dispositivo', $4, $5::jsonb)`,
        [syncId, caixa.id, saleId, mensagem, JSON.stringify({ registradaEm: sale.registradaEm })]
      );
    }

    await client.query('COMMIT');
    return {
      requestId: sale.requestId,
      status: 'sincronizada',
      vendaId: saleId,
      alertas: alerts,
      recalculouFechamento,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
        `SELECT produto_id AS id, nome, preco_centavos, preco_promocional_centavos,
                promocao_ativa, promocao_atualizada_por, promocao_atualizada_em,
                ordem, estoque_inicial, estoque_disponivel
           FROM pdv_caixa_produtos WHERE caixa_id = $1 ORDER BY ordem, nome`,
        [caixa.id]
      ));
      resumo = await getCashSummary(pool, caixa.id);
    } else {
      ({ rows: produtos } = await pool.query(
        `SELECT id, nome, preco_centavos, preco_promocional_centavos, ordem FROM pdv_produtos
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
  const estoques = req.body.estoques;
  if (!intInRange(valorInicialCentavos, 0, 100000000)) {
    return res.status(400).json({ error: 'Valor inicial inválido' });
  }
  if (!Array.isArray(estoques) || !estoques.length) {
    return res.status(400).json({ error: 'Informe o estoque inicial de todos os produtos' });
  }
  const estoquePorProduto = new Map();
  for (const item of estoques) {
    const quantidade = Number(item?.quantidade);
    if (!UUID_RE.test(item?.produtoId || '') || !intInRange(quantidade, 0, 1000000)) {
      return res.status(400).json({ error: 'Estoque inicial inválido' });
    }
    if (estoquePorProduto.has(item.produtoId)) {
      return res.status(400).json({ error: 'Produto repetido na configuração do estoque' });
    }
    estoquePorProduto.set(item.produtoId, quantidade);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: catalog } = await client.query(
      `SELECT id, nome, preco_centavos, preco_promocional_centavos, ordem FROM pdv_produtos
        WHERE ativo AND preco_centavos IS NOT NULL ORDER BY ordem, nome FOR SHARE`
    );
    if (!catalog.length) throw Object.assign(new Error('Cadastre e ative ao menos um produto com preço antes de abrir o caixa'), { statusCode: 409 });
    if (
      estoquePorProduto.size !== catalog.length
      || catalog.some(produto => !estoquePorProduto.has(produto.id))
    ) {
      throw Object.assign(new Error('O catálogo mudou. Atualize a tela e informe o estoque de todos os produtos'), { statusCode: 409 });
    }
    if (![...estoquePorProduto.values()].some(quantidade => quantidade > 0)) {
      throw Object.assign(new Error('Informe estoque maior que zero para ao menos um produto'), { statusCode: 400 });
    }

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
      const estoqueInicial = estoquePorProduto.get(produto.id);
      await client.query(
        `INSERT INTO pdv_caixa_produtos
         (caixa_id, produto_id, nome, preco_centavos, preco_promocional_centavos,
          promocao_ativa, ordem, estoque_inicial, estoque_disponivel)
         VALUES ($1, $2, $3, $4, $5, false, $6, $7, $7)`,
        [caixa.id, produto.id, produto.nome, produto.preco_centavos,
          produto.preco_promocional_centavos, produto.ordem, estoqueInicial]
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
    // O esquema legado possui um gatilho que recalcula o valor esperado com
    // todas as formas de pagamento quando o status muda para fechado. Primeiro
    // fechamos o caixa para preservar esse comportamento global; em seguida,
    // ainda na mesma transação e com a linha bloqueada, persistimos o cálculo
    // específico do PDV (somente dinheiro físico).
    await client.query(
      `UPDATE caixas SET status = 'fechado', valor_final_real = $1,
              fechado_por = $2, hora_fechamento = NOW(), updated_at = NOW()
        WHERE id = $3`,
      [valorContadoCentavos / 100, req.user.sub, caixa.id]
    );
    const { rows: updated } = await client.query(
      `UPDATE caixas SET valor_final_esperado = $1, valor_final_real = $2,
              diferenca = $3, updated_at = NOW()
        WHERE id = $4 RETURNING *`,
      [esperado / 100, valorContadoCentavos / 100, diferenca / 100, caixa.id]
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

router.post('/caixas/:id/reabrir', requirePdvSupervisor, async (req, res) => {
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

router.patch('/caixas/:id/produtos/:produtoId/promocao', requirePdvAccess, async (req, res) => {
  const ativa = req.body.ativa;
  if (!UUID_RE.test(req.params.id) || !UUID_RE.test(req.params.produtoId) || typeof ativa !== 'boolean') {
    return res.status(400).json({ error: 'Dados da promoção inválidos' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: cashRows } = await client.query(
      `SELECT id, status FROM caixas
        WHERE id = $1 AND setor = 'lanche'
          AND data = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        FOR UPDATE`,
      [req.params.id]
    );
    const caixa = cashRows[0];
    if (!caixa) throw Object.assign(new Error('Caixa atual não encontrado'), { statusCode: 404 });
    if (caixa.status !== 'aberto') throw Object.assign(new Error('O caixa está fechado'), { statusCode: 409 });

    const { rows: productRows } = await client.query(
      `SELECT * FROM pdv_caixa_produtos
        WHERE caixa_id = $1 AND produto_id = $2 FOR UPDATE`,
      [caixa.id, req.params.produtoId]
    );
    const produto = productRows[0];
    if (!produto) throw Object.assign(new Error('Produto não encontrado neste caixa'), { statusCode: 404 });
    if (
      ativa
      && (
        produto.preco_promocional_centavos == null
        || Number(produto.preco_promocional_centavos) >= Number(produto.preco_centavos)
      )
    ) {
      throw Object.assign(new Error('Este produto não possui uma promoção válida'), { statusCode: 409 });
    }

    const { rows } = await client.query(
      `UPDATE pdv_caixa_produtos
          SET promocao_ativa = $1, promocao_atualizada_por = $2, promocao_atualizada_em = NOW()
        WHERE caixa_id = $3 AND produto_id = $4
        RETURNING produto_id AS id, nome, preco_centavos, preco_promocional_centavos,
                  promocao_ativa, promocao_atualizada_por, promocao_atualizada_em,
                  ordem, estoque_inicial, estoque_disponivel`,
      [ativa, req.user.sub, caixa.id, produto.produto_id]
    );
    await client.query('COMMIT');
    res.json({ data: rows[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, err, 'alterar promoção');
  } finally {
    client.release();
  }
});

router.post('/sincronizacoes/vendas', requirePdvAccess, async (req, res) => {
  const { deviceId, caixaId } = req.body;
  const vendas = req.body.vendas;
  const eventosPromocao = Array.isArray(req.body.eventosPromocao) ? req.body.eventosPromocao : [];
  if (
    !UUID_RE.test(deviceId || '')
    || !UUID_RE.test(caixaId || '')
    || !Array.isArray(vendas)
    || (vendas.length < 1 && eventosPromocao.length < 1)
    || vendas.length > 100
    || eventosPromocao.length > 100
  ) {
    return res.status(400).json({ error: 'Lote de sincronização inválido' });
  }
  try {
    const { rows: cashRows } = await pool.query(
      `SELECT id FROM caixas WHERE id = $1 AND setor = 'lanche'`,
      [caixaId]
    );
    if (!cashRows.length) return res.status(404).json({ error: 'Caixa da sincronização não encontrado' });
    const deviceName = cleanText(req.body.deviceName, 80) || `PDV-${deviceId.slice(0, 8)}`;
    await pool.query(
      `INSERT INTO pdv_dispositivos
       (id, nome, primeiro_usuario_id, ultimo_usuario_id)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (id) DO UPDATE
         SET nome = EXCLUDED.nome,
             ultimo_usuario_id = EXCLUDED.ultimo_usuario_id,
             ultimo_acesso_em = NOW()`,
      [deviceId, deviceName, req.user.sub]
    );
    const { rows: syncRows } = await pool.query(
      `INSERT INTO pdv_sincronizacoes
       (dispositivo_id, caixa_id, usuario_id, quantidade_recebida)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [deviceId, caixaId, req.user.sub, vendas.length]
    );
    const syncId = syncRows[0].id;
    const resultados = [];
    for (const sale of vendas) {
      try {
        resultados.push(await syncOfflineSale({
          sale, caixaId, deviceId, syncId, user: req.user,
        }));
      } catch (err) {
        resultados.push({
          requestId: sale?.requestId || null,
          status: 'erro',
          erro: err.message || 'Erro ao sincronizar venda',
        });
      }
    }

    const eventosResultados = [];
    for (const event of eventosPromocao) {
      try {
        const registradaEm = new Date(event?.registradaEm);
        if (
          !UUID_RE.test(event?.eventId || '')
          || !UUID_RE.test(event?.produtoId || '')
          || typeof event?.ativa !== 'boolean'
          || Number.isNaN(registradaEm.getTime())
        ) throw new Error('Evento de promoção inválido');
        const vendedorId = event.vendedorId || req.user.sub;
        if (vendedorId !== req.user.sub && !PDV_SUPERVISOR_ROLES.has(req.user.role)) {
          throw new Error('Usuário do evento de promoção não autorizado');
        }
        const { rows } = await pool.query(
          `INSERT INTO pdv_promocao_eventos
           (id, caixa_id, produto_id, dispositivo_id, usuario_id, ativa,
            origem, registrada_em_dispositivo)
           SELECT $1, $2, $3, $4, $5, $6, 'offline', $7
            WHERE EXISTS (
              SELECT 1 FROM pdv_caixa_produtos
               WHERE caixa_id = $2 AND produto_id = $3
            )
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [event.eventId, caixaId, event.produtoId, deviceId, vendedorId,
            event.ativa, registradaEm]
        );
        eventosResultados.push({
          eventId: event.eventId,
          status: rows.length ? 'sincronizado' : 'duplicado',
        });
      } catch (err) {
        eventosResultados.push({ eventId: event?.eventId || null, status: 'erro', erro: err.message });
      }
    }

    const quantidadeSincronizada = resultados.filter(item => item.status === 'sincronizada').length;
    const quantidadeDuplicada = resultados.filter(item => item.status === 'duplicada').length;
    const quantidadeComErro = resultados.filter(item => item.status === 'erro').length;
    const conflitoEstoque = resultados.some(item => item.alertas?.some(alert => alert.tipo === 'estoque_negativo'));
    const recalculouFechamento = resultados.some(item => item.recalculouFechamento);
    await pool.query(
      `UPDATE pdv_sincronizacoes
          SET quantidade_sincronizada = $1,
              quantidade_duplicada = $2,
              quantidade_com_erro = $3,
              conflito_estoque = $4,
              recalculou_fechamento = $5,
              detalhes = $6::jsonb
        WHERE id = $7`,
      [quantidadeSincronizada, quantidadeDuplicada, quantidadeComErro,
        conflitoEstoque, recalculouFechamento,
        JSON.stringify({ resultados, eventosPromocao: eventosResultados }), syncId]
    );
    res.json({
      data: {
        sincronizacaoId: syncId,
        resultados,
        eventosPromocao: eventosResultados,
        conflitoEstoque,
        recalculouFechamento,
      },
      error: null,
    });
  } catch (err) {
    handleError(res, err, 'sincronizar vendas offline');
  }
});

router.get('/admin/sincronizacoes', requirePdvSupervisor, async (req, res) => {
  const requestedDate = cleanText(req.query.data, 10);
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return res.status(400).json({ error: 'Data inválida' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT s.*, d.nome AS dispositivo_nome, p.name AS usuario_nome, c.data AS caixa_data,
              COALESCE(alertas.quantidade, 0)::int AS quantidade_alertas,
              COALESCE(alertas.itens, '[]'::json) AS alertas
         FROM pdv_sincronizacoes s
         JOIN pdv_dispositivos d ON d.id = s.dispositivo_id
         JOIN profiles p ON p.id = s.usuario_id
         JOIN caixas c ON c.id = s.caixa_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS quantidade,
                  json_agg(json_build_object(
                    'tipo', a.tipo,
                    'mensagem', a.mensagem,
                    'detalhes', a.detalhes,
                    'created_at', a.created_at
                  ) ORDER BY a.created_at) AS itens
             FROM pdv_sincronizacao_alertas a
            WHERE a.sincronizacao_id = s.id
         ) alertas ON true
        WHERE c.setor = 'lanche'
          AND c.data = COALESCE($1::date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date)
        ORDER BY s.created_at DESC`,
      [requestedDate || null]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    handleError(res, err, 'listar sincronizações offline');
  }
});

router.get('/vendas', requirePdvAccess, async (req, res) => {
  try {
    const data = cleanText(req.query.data, 10);
    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
    if (selectedDate && !PDV_SUPERVISOR_ROLES.has(req.user.role)) return res.status(403).json({ error: 'Vendedores consultam somente o dia atual' });
    const { rows } = await pool.query(
      `SELECT v.*, p.name AS vendedor_nome,
              COALESCE(json_agg(json_build_object(
                'produtoId', i.produto_id, 'nome', i.produto_nome,
                'quantidade', i.quantidade, 'precoUnitarioCentavos', i.preco_unitario_centavos,
                'totalCentavos', i.total_centavos, 'promocional', i.promocional
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
  // Compatibilidade durante o rolling deploy: clientes antigos enviavam uma
  // única forma para produtos e doação.
  const formaPagamentoDoacao = doacaoCentavos > 0
    ? (req.body.formaPagamentoDoacao ?? formaPagamento)
    : null;
  if (!UUID_RE.test(requestId || '') || !Array.isArray(itens) || !itens.length || !PAYMENT_METHODS.has(formaPagamento)) {
    return res.status(400).json({ error: 'Venda inválida' });
  }
  if (!intInRange(doacaoCentavos, 0, 100000000)) return res.status(400).json({ error: 'Valor de doação inválido' });
  if (doacaoCentavos > 0 && !PAYMENT_METHODS.has(formaPagamentoDoacao)) {
    return res.status(400).json({ error: 'Informe a forma de pagamento da doação' });
  }
  const quantities = new Map();
  const expectedPrices = new Map();
  for (const item of itens) {
    const quantidade = Number(item.quantidade);
    if (!UUID_RE.test(item.produtoId || '') || !intInRange(quantidade, 1, 999)) return res.status(400).json({ error: 'Item ou quantidade inválida' });
    if (
      item.precoUnitarioEsperadoCentavos != null
      && !intInRange(Number(item.precoUnitarioEsperadoCentavos), 1, 100000000)
    ) {
      return res.status(400).json({ error: 'Preço esperado inválido' });
    }
    if (
      expectedPrices.has(item.produtoId)
      && expectedPrices.get(item.produtoId) !== Number(item.precoUnitarioEsperadoCentavos)
    ) {
      return res.status(400).json({ error: 'O mesmo produto foi enviado com preços diferentes' });
    }
    quantities.set(item.produtoId, (quantities.get(item.produtoId) || 0) + quantidade);
    if (item.precoUnitarioEsperadoCentavos != null) {
      expectedPrices.set(item.produtoId, Number(item.precoUnitarioEsperadoCentavos));
    }
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
      `SELECT produto_id, nome, preco_centavos, preco_promocional_centavos,
              promocao_ativa, estoque_inicial, estoque_disponivel
         FROM pdv_caixa_produtos
        WHERE caixa_id = $1 AND produto_id = ANY($2::uuid[])
        FOR UPDATE`,
      [caixa.id, ids]
    );
    if (products.length !== ids.length) throw Object.assign(new Error('Um dos produtos não pertence ao catálogo deste caixa'), { statusCode: 409 });
    const pricedProducts = products.map(product => {
      const promocional = Boolean(
        product.promocao_ativa
        && product.preco_promocional_centavos != null
        && Number(product.preco_promocional_centavos) < Number(product.preco_centavos)
      );
      const precoEfetivoCentavos = promocional
        ? Number(product.preco_promocional_centavos)
        : Number(product.preco_centavos);
      const precoEsperado = expectedPrices.get(product.produto_id);
      if (precoEsperado != null && precoEsperado !== precoEfetivoCentavos) {
        throw Object.assign(
          new Error(`O preço de ${product.nome} mudou. Atualize e revise o pedido.`),
          { statusCode: 409 }
        );
      }
      return { ...product, promocional, precoEfetivoCentavos };
    });
    for (const product of pricedProducts) {
      const quantidade = quantities.get(product.produto_id);
      if (product.estoque_disponivel !== null && Number(product.estoque_disponivel) < quantidade) {
        throw Object.assign(
          new Error(`Estoque insuficiente para ${product.nome}. Disponível: ${product.estoque_disponivel}`),
          { statusCode: 409 }
        );
      }
    }
    const subtotal = pricedProducts.reduce(
      (sum, product) => sum + product.precoEfetivoCentavos * quantities.get(product.produto_id),
      0
    );
    const total = subtotal + doacaoCentavos;
    if (!intInRange(total, 1, 100000000)) throw Object.assign(new Error('Total da venda inválido'), { statusCode: 400 });
    const { rows: saleRows } = await client.query(
      `INSERT INTO pdv_vendas
       (caixa_id, request_id, vendedor_id, subtotal_centavos, doacao_centavos,
        total_centavos, forma_pagamento, forma_pagamento_doacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [caixa.id, requestId, req.user.sub, subtotal, doacaoCentavos, total,
        formaPagamento, formaPagamentoDoacao]
    );
    const saleId = saleRows[0].id;
    for (const product of pricedProducts) {
      const quantidade = quantities.get(product.produto_id);
      if (product.estoque_disponivel !== null) {
        await client.query(
          `UPDATE pdv_caixa_produtos
              SET estoque_disponivel = estoque_disponivel - $1
            WHERE caixa_id = $2 AND produto_id = $3`,
          [quantidade, caixa.id, product.produto_id]
        );
      }
      await client.query(
        `INSERT INTO pdv_venda_itens
         (venda_id, produto_id, produto_nome, quantidade, preco_unitario_centavos,
          total_centavos, promocional)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [saleId, product.produto_id, product.nome, quantidade,
          product.precoEfetivoCentavos, quantidade * product.precoEfetivoCentavos,
          product.promocional]
      );
    }
    await client.query(
      `INSERT INTO movimentacoes_caixa
       (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
       VALUES ($1, 'entrada', 'lanche', $2, $3, $4, $5, $6, 'venda_produtos')`,
      [caixa.id, subtotal / 100, `Produtos da venda PDV ${saleId}`,
        formaPagamento, req.user.sub, saleId]
    );
    if (doacaoCentavos > 0) {
      await client.query(
        `INSERT INTO movimentacoes_caixa
         (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
         VALUES ($1, 'entrada', 'lanche', $2, $3, $4, $5, $6, 'venda_doacao')`,
        [caixa.id, doacaoCentavos / 100, `Doação da venda PDV ${saleId}`,
          formaPagamentoDoacao, req.user.sub, saleId]
      );
    }
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
    if (!PDV_SUPERVISOR_ROLES.has(req.user.role) && venda.vendedor_id !== req.user.sub) {
      throw Object.assign(new Error('Você só pode cancelar suas próprias vendas'), { statusCode: 403 });
    }
    await client.query(
      `UPDATE pdv_vendas SET status = 'cancelada', cancelada_por = $1,
              cancelada_em = NOW(), motivo_cancelamento = $2, updated_at = NOW()
        WHERE id = $3`,
      [req.user.sub, motivo, venda.id]
    );
    await client.query(
      `UPDATE pdv_caixa_produtos cp
          SET estoque_disponivel = LEAST(cp.estoque_inicial, cp.estoque_disponivel + i.quantidade)
         FROM pdv_venda_itens i
        WHERE i.venda_id = $1
          AND cp.caixa_id = $2
          AND cp.produto_id = i.produto_id
          AND cp.estoque_disponivel IS NOT NULL`,
      [venda.id, venda.caixa_id]
    );
    await client.query(
      `INSERT INTO movimentacoes_caixa
       (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
       VALUES ($1, 'saida', 'lanche', $2, $3, $4, $5, $6, 'cancelamento_produtos')`,
      [venda.caixa_id, venda.subtotal_centavos / 100,
        `Cancelamento dos produtos da venda PDV ${venda.id}`,
        venda.forma_pagamento, req.user.sub, venda.id]
    );
    if (venda.doacao_centavos > 0) {
      await client.query(
        `INSERT INTO movimentacoes_caixa
         (caixa_id, tipo, setor, valor, descricao, forma_pagamento, registrado_por, pdv_venda_id, pdv_evento)
         VALUES ($1, 'saida', 'lanche', $2, $3, $4, $5, $6, 'cancelamento_doacao')`,
        [venda.caixa_id, venda.doacao_centavos / 100,
          `Cancelamento da doação da venda PDV ${venda.id}`,
          venda.forma_pagamento_doacao || venda.forma_pagamento, req.user.sub, venda.id]
      );
    }
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
  if (requestedDate && !PDV_SUPERVISOR_ROLES.has(req.user.role)) return res.status(403).json({ error: 'Vendedores consultam somente o dia atual' });
  try {
    const { rows: cashRows } = await pool.query(
      `SELECT * FROM caixas WHERE setor = 'lanche'
        AND data = COALESCE($1::date, (NOW() AT TIME ZONE 'America/Sao_Paulo')::date)`,
      [requestedDate || null]
    );
    const caixa = cashRows[0] || null;
    if (!caixa) return res.json({ data: { caixa: null, produtos: [], resumo: null }, error: null });
    const resumo = await getCashSummary(pool, caixa.id);
    const { rows: productRows } = await pool.query(
      `SELECT cp.produto_id, cp.nome, cp.preco_centavos, cp.preco_promocional_centavos,
              COALESCE(vendidos.quantidade, 0)::int AS quantidade,
              COALESCE(vendidos.total_centavos, 0)::int AS total_centavos,
              COALESCE(vendidos.normal_quantidade, 0)::int AS normal_quantidade,
              COALESCE(vendidos.normal_total_centavos, 0)::int AS normal_total_centavos,
              COALESCE(vendidos.normal_pix_quantidade, 0)::int AS normal_pix_quantidade,
              COALESCE(vendidos.normal_pix_centavos, 0)::int AS normal_pix_centavos,
              COALESCE(vendidos.normal_dinheiro_quantidade, 0)::int AS normal_dinheiro_quantidade,
              COALESCE(vendidos.normal_dinheiro_centavos, 0)::int AS normal_dinheiro_centavos,
              COALESCE(vendidos.promocional_quantidade, 0)::int AS promocional_quantidade,
              COALESCE(vendidos.promocional_total_centavos, 0)::int AS promocional_total_centavos,
              COALESCE(vendidos.promocional_pix_quantidade, 0)::int AS promocional_pix_quantidade,
              COALESCE(vendidos.promocional_pix_centavos, 0)::int AS promocional_pix_centavos,
              COALESCE(vendidos.promocional_dinheiro_quantidade, 0)::int AS promocional_dinheiro_quantidade,
              COALESCE(vendidos.promocional_dinheiro_centavos, 0)::int AS promocional_dinheiro_centavos,
              cp.estoque_inicial, cp.estoque_disponivel
         FROM pdv_caixa_produtos cp
         LEFT JOIN (
           SELECT i.produto_id,
                  SUM(i.quantidade)::int AS quantidade,
                  SUM(i.total_centavos)::int AS total_centavos,
                  SUM(i.quantidade) FILTER (WHERE NOT i.promocional)::int AS normal_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE NOT i.promocional)::int AS normal_total_centavos,
                  SUM(i.quantidade) FILTER (WHERE NOT i.promocional AND v.forma_pagamento = 'pix')::int AS normal_pix_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE NOT i.promocional AND v.forma_pagamento = 'pix')::int AS normal_pix_centavos,
                  SUM(i.quantidade) FILTER (WHERE NOT i.promocional AND v.forma_pagamento = 'dinheiro')::int AS normal_dinheiro_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE NOT i.promocional AND v.forma_pagamento = 'dinheiro')::int AS normal_dinheiro_centavos,
                  SUM(i.quantidade) FILTER (WHERE i.promocional)::int AS promocional_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE i.promocional)::int AS promocional_total_centavos,
                  SUM(i.quantidade) FILTER (WHERE i.promocional AND v.forma_pagamento = 'pix')::int AS promocional_pix_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE i.promocional AND v.forma_pagamento = 'pix')::int AS promocional_pix_centavos,
                  SUM(i.quantidade) FILTER (WHERE i.promocional AND v.forma_pagamento = 'dinheiro')::int AS promocional_dinheiro_quantidade,
                  SUM(i.total_centavos) FILTER (WHERE i.promocional AND v.forma_pagamento = 'dinheiro')::int AS promocional_dinheiro_centavos
             FROM pdv_venda_itens i
             JOIN pdv_vendas v ON v.id = i.venda_id
            WHERE v.caixa_id = $1 AND v.status = 'concluida'
            GROUP BY i.produto_id
         ) vendidos ON vendidos.produto_id = cp.produto_id
        WHERE cp.caixa_id = $1
        ORDER BY cp.ordem, cp.nome`,
      [caixa.id]
    );
    const produtos = productRows.map(product => {
      const modalidades = [{
        tipo: 'normal',
        preco_unitario_centavos: product.preco_centavos,
        quantidade: product.normal_quantidade,
        total_centavos: product.normal_total_centavos,
        pix: { quantidade: product.normal_pix_quantidade, total_centavos: product.normal_pix_centavos },
        dinheiro: { quantidade: product.normal_dinheiro_quantidade, total_centavos: product.normal_dinheiro_centavos },
      }];
      if (product.preco_promocional_centavos != null) {
        modalidades.push({
          tipo: 'promocional',
          preco_unitario_centavos: product.preco_promocional_centavos,
          quantidade: product.promocional_quantidade,
          total_centavos: product.promocional_total_centavos,
          pix: { quantidade: product.promocional_pix_quantidade, total_centavos: product.promocional_pix_centavos },
          dinheiro: { quantidade: product.promocional_dinheiro_quantidade, total_centavos: product.promocional_dinheiro_centavos },
        });
      }
      return {
        produto_id: product.produto_id,
        nome: product.nome,
        quantidade: product.quantidade,
        total_centavos: product.total_centavos,
        estoque_inicial: product.estoque_inicial,
        estoque_disponivel: product.estoque_disponivel,
        modalidades,
      };
    });
    res.json({ data: { caixa, produtos, resumo }, error: null });
  } catch (err) {
    handleError(res, err, 'gerar relatório');
  }
});

router.get('/admin/produtos', requirePdvSupervisor, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pdv_produtos ORDER BY ordem, nome');
    res.json({ data: rows, error: null });
  } catch (err) {
    handleError(res, err, 'listar produtos');
  }
});

router.post('/admin/produtos', requirePdvSupervisor, async (req, res) => {
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

router.patch('/admin/produtos/:id', requirePdvSupervisor, async (req, res) => {
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
