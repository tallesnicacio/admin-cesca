const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Tabelas que podem ser lidas sem autenticação (quiz-cesca público)
const PUBLIC_READ_TABLES = new Set([
  'formularios', 'etapas_formulario', 'opcoes_atendimento', 'regras_formulario', 'configuracoes',
]);

// Tabelas que podem receber INSERT sem autenticação (formulário público)
const PUBLIC_INSERT_TABLES = new Set(['agendamentos']);

// Tabelas permitidas para consulta (whitelist de segurança)
const ALLOWED_TABLES = new Set([
  'profiles', 'users',
  'agendamentos', 'configuracoes', 'formularios', 'etapas_formulario',
  'opcoes_atendimento', 'regras_formulario', 'suspensoes',
  'trabalhadores', 'giras', 'presencas',
  'alunos', 'cursos', 'matriculas', 'mensalidades',
  'caixas', 'movimentacoes_caixa', 'despesas',
  'conciliacoes_bancarias', 'transacoes_bancarias',
  'tipos_atendimento', 'trabalhadores_capacitacoes', 'funcoes_fixas',
  'restricoes_datas', 'escalas_mensais', 'escalas_detalhes',
  'presencas_escalas', 'substituicoes', 'advertencias',
  'quizzes', 'questions', 'quiz_results',
]);

function parseFilters(query) {
  const filters = [];
  const values = [];
  let idx = 1;

  for (const [key, val] of Object.entries(query)) {
    if (key.startsWith('eq.')) {
      const col = key.slice(3);
      filters.push(`"${col}" = $${idx++}`);
      values.push(val);
    } else if (key.startsWith('neq.')) {
      const col = key.slice(4);
      filters.push(`"${col}" != $${idx++}`);
      values.push(val);
    } else if (key.startsWith('gte.')) {
      const col = key.slice(4);
      filters.push(`"${col}" >= $${idx++}`);
      values.push(val);
    } else if (key.startsWith('lte.')) {
      const col = key.slice(4);
      filters.push(`"${col}" <= $${idx++}`);
      values.push(val);
    } else if (key.startsWith('gt.')) {
      const col = key.slice(3);
      filters.push(`"${col}" > $${idx++}`);
      values.push(val);
    } else if (key.startsWith('lt.')) {
      const col = key.slice(3);
      filters.push(`"${col}" < $${idx++}`);
      values.push(val);
    } else if (key.startsWith('like.')) {
      const col = key.slice(5);
      filters.push(`"${col}" LIKE $${idx++}`);
      values.push(val);
    } else if (key.startsWith('ilike.')) {
      const col = key.slice(6);
      filters.push(`"${col}" ILIKE $${idx++}`);
      values.push(val);
    } else if (key.startsWith('is.')) {
      const col = key.slice(3);
      if (val === 'null') filters.push(`"${col}" IS NULL`);
      else if (val === 'true') filters.push(`"${col}" IS TRUE`);
      else if (val === 'false') filters.push(`"${col}" IS FALSE`);
    } else if (key.startsWith('in.')) {
      const col = key.slice(3);
      const inVals = val.replace(/^\(|\)$/g, '').split(',').map(v => v.trim());
      const placeholders = inVals.map(() => `$${idx++}`).join(',');
      filters.push(`"${col}" IN (${placeholders})`);
      values.push(...inVals);
    }
  }

  return { filters, values };
}

function parseSelect(selectParam) {
  if (!selectParam || selectParam === '*') return '*';
  // Sanitize: only allow alphanumeric, underscore, comma, space
  return selectParam
    .split(',')
    .map(col => col.trim())
    .filter(col => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col))
    .map(col => `"${col}"`)
    .join(', ') || '*';
}

// Colunas permitidas para ordenação por tabela (whitelist explícita)
const ORDERABLE_COLUMNS = {
  agendamentos: new Set(['id', 'data_solicitacao', 'nome_completo', 'email', 'status', 'created_at', 'updated_at', 'primeira_opcao', 'segunda_opcao']),
  profiles: new Set(['id', 'name', 'email', 'role', 'created_at', 'updated_at', 'is_active', 'is_admin']),
  suspensoes: new Set(['id', 'email', 'data_inicio', 'data_fim', 'created_at', 'motivo']),
  trabalhadores: new Set(['id', 'nome', 'email', 'ativo', 'created_at']),
  giras: new Set(['id', 'data', 'tipo', 'created_at']),
  presencas: new Set(['id', 'data', 'trabalhador_id', 'created_at']),
  alunos: new Set(['id', 'nome', 'email', 'created_at', 'updated_at']),
  cursos: new Set(['id', 'nome', 'created_at', 'updated_at']),
  matriculas: new Set(['id', 'aluno_id', 'curso_id', 'data_matricula', 'status', 'created_at']),
  mensalidades: new Set(['id', 'aluno_id', 'mes', 'ano', 'status', 'data_pagamento', 'created_at']),
  caixas: new Set(['id', 'data', 'status', 'created_at']),
  movimentacoes_caixa: new Set(['id', 'caixa_id', 'tipo', 'valor', 'created_at']),
  despesas: new Set(['id', 'descricao', 'valor', 'data', 'created_at']),
  escalas_mensais: new Set(['id', 'ano', 'mes', 'created_at']),
  escalas_detalhes: new Set(['id', 'escala_id', 'data', 'created_at']),
  formularios: new Set(['id', 'nome', 'created_at', 'updated_at']),
  quizzes: new Set(['id', 'title', 'created_at', 'updated_at']),
  quiz_results: new Set(['id', 'score', 'created_at']),
};

// Fallback: aceita qualquer coluna com nome válido (alfanumérico) para tabelas não listadas
function isColumnOrderable(table, col) {
  const whitelist = ORDERABLE_COLUMNS[table];
  if (whitelist) return whitelist.has(col);
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
}

function parseOrder(query, table) {
  const orders = [];
  for (const [key, val] of Object.entries(query)) {
    if (key.startsWith('order.')) {
      const col = key.slice(6);
      if (!isColumnOrderable(table, col)) continue;
      const dir = val === 'desc' ? 'DESC' : 'ASC';
      orders.push(`"${col}" ${dir}`);
    }
  }
  // Support nullsFirst param
  if (query.nullsFirst === 'true' && orders.length > 0) {
    orders[orders.length - 1] += ' NULLS FIRST';
  }
  return orders.length ? `ORDER BY ${orders.join(', ')}` : '';
}

// Middleware condicional de auth para dados
function conditionalAuth(req, res, next) {
  const table = req.params.table;
  const method = req.method;

  const isPublicRead = method === 'GET' && PUBLIC_READ_TABLES.has(table);
  const isPublicInsert = method === 'POST' && PUBLIC_INSERT_TABLES.has(table);

  if (isPublicRead || isPublicInsert) return next();
  return authMiddleware(req, res, next);
}

// GET /api/data/:table
router.get('/:table', conditionalAuth, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Tabela não permitida' });

  const { select, single, maybeSingle, limit, ...rest } = req.query;
  const selectClause = parseSelect(select);
  const { filters, values } = parseFilters(rest);
  const orderClause = parseOrder(rest, table);

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const limitClause = single === 'true' || maybeSingle === 'true'
    ? 'LIMIT 1'
    : limit ? `LIMIT ${parseInt(limit, 10)}` : '';

  const sql = `SELECT ${selectClause} FROM "${table}" ${whereClause} ${orderClause} ${limitClause}`.trim();

  try {
    const { rows } = await pool.query(sql, values);

    if (single === 'true') {
      if (!rows.length) return res.status(406).json({ data: null, error: { message: 'Nenhum resultado' } });
      return res.json({ data: rows[0], error: null });
    }
    if (maybeSingle === 'true') {
      return res.json({ data: rows[0] || null, error: null });
    }
    res.json({ data: rows, error: null });
  } catch (err) {
    console.error(`Erro GET ${table}:`, err.message);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// Tamanho máximo do payload por tabela (em número de linhas)
const MAX_BATCH_ROWS = { agendamentos: 1, default: 100 };

// Tamanho máximo de valores string por coluna
const MAX_STRING_LENGTH = 10000;

function validateBody(table, rows) {
  const maxRows = MAX_BATCH_ROWS[table] ?? MAX_BATCH_ROWS.default;
  if (rows.length > maxRows) {
    return `Máximo de ${maxRows} registro(s) por vez para a tabela ${table}`;
  }
  for (const row of rows) {
    if (typeof row !== 'object' || Array.isArray(row)) return 'Linha inválida no corpo da requisição';
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'string' && val.length > MAX_STRING_LENGTH) {
        return `Campo "${key}" excede o tamanho máximo permitido`;
      }
    }
  }
  return null;
}

// POST /api/data/:table — INSERT (retorna a linha inserida)
router.post('/:table', conditionalAuth, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Tabela não permitida' });

  const { upsert, onConflict, select, ..._ } = req.query;
  const body = req.body;
  const rows = Array.isArray(body) ? body : [body];

  if (!rows.length || !rows[0]) return res.status(400).json({ error: 'Corpo vazio' });

  const validationError = validateBody(table, rows);
  if (validationError) return res.status(400).json({ error: validationError });

  const cols = Object.keys(rows[0]).filter(k => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
  if (!cols.length) return res.status(400).json({ error: 'Nenhuma coluna válida' });

  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const vals = cols.map(c => row[c]);
      const colSql = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');

      let sql;
      if (upsert === 'true' && onConflict) {
        const conflictCols = onConflict.split(',').map(c => `"${c.trim()}"`).join(', ');
        const updateSql = cols.map((c, i) => `"${c}" = EXCLUDED."${c}"`).join(', ');
        sql = `INSERT INTO "${table}" (${colSql}) VALUES (${placeholders})
               ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateSql}
               RETURNING *`;
      } else {
        sql = `INSERT INTO "${table}" (${colSql}) VALUES (${placeholders}) RETURNING *`;
      }

      const result = await client.query(sql, vals);
      inserted.push(result.rows[0]);
    }
    await client.query('COMMIT');

    const returnData = Array.isArray(body) ? inserted : inserted[0];
    // If .select() was chained, return data; otherwise return minimal
    res.status(201).json({ data: returnData, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Erro POST ${table}:`, err.message);
    res.status(500).json({ data: null, error: { message: err.message } });
  } finally {
    client.release();
  }
});

// PATCH /api/data/:table — UPDATE
router.patch('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Tabela não permitida' });

  const { select, ...filterQuery } = req.query;
  const body = req.body;

  const updateCols = Object.keys(body).filter(k => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
  if (!updateCols.length) return res.status(400).json({ error: 'Nenhuma coluna para atualizar' });

  let idx = 1;
  const setSql = updateCols.map(c => `"${c}" = $${idx++}`).join(', ');
  const setVals = updateCols.map(c => body[c]);

  // Add updated_at
  const hasUpdatedAt = updateCols.includes('updated_at');
  const fullSetSql = hasUpdatedAt ? setSql : `${setSql}, "updated_at" = NOW()`;

  const { filters, values: filterVals } = parseFilters(filterQuery);
  const adjustedFilters = filters.map(f => f.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + setVals.length}`));
  const whereClause = adjustedFilters.length ? `WHERE ${adjustedFilters.join(' AND ')}` : '';

  const sql = `UPDATE "${table}" SET ${fullSetSql} ${whereClause} RETURNING *`;

  try {
    const { rows } = await pool.query(sql, [...setVals, ...filterVals]);
    res.json({ data: rows, error: null });
  } catch (err) {
    console.error(`Erro PATCH ${table}:`, err.message);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// DELETE /api/data/:table
router.delete('/:table', authMiddleware, async (req, res) => {
  const { table } = req.params;
  if (!ALLOWED_TABLES.has(table)) return res.status(403).json({ error: 'Tabela não permitida' });

  const { filters, values } = parseFilters(req.query);
  if (!filters.length) return res.status(400).json({ error: 'Filtros obrigatórios para DELETE' });

  const whereClause = `WHERE ${filters.join(' AND ')}`;
  const sql = `DELETE FROM "${table}" ${whereClause} RETURNING id`;

  try {
    const { rows } = await pool.query(sql, values);
    res.json({ data: rows, error: null });
  } catch (err) {
    console.error(`Erro DELETE ${table}:`, err.message);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

module.exports = router;
