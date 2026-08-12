const express = require('express');
const pool = require('../db');
const { authMiddleware, requireRoles } = require('../middleware/auth');

const router = express.Router();
const canView = requireRoles('admin', 'coordinator');
const adminOnly = requireRoles('admin');
const RESULTS = new Set(['apto', 'inapto', 'melhorar']);
const LEVELS = new Set(['MT1', 'MT2', 'MT3']);
const MODES = new Set(['por_nivel', 'personalizado', 'dispensado']);

router.use(authMiddleware);

function cleanText(value, max = 3000) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function validateMediumFields(body) {
  const nomeCompleto = cleanText(body.nome_completo, 200);
  const nivel = body.nivel_treinamento;
  const modo = body.modo_avaliacao || 'por_nivel';
  const funcaoIds = Array.isArray(body.funcao_ids) ? [...new Set(body.funcao_ids)] : [];
  if (!nomeCompleto || nomeCompleto.length < 3) throw httpError('Informe o nome completo do médium');
  if (!LEVELS.has(nivel)) throw httpError('Selecione um nível MT válido');
  if (!MODES.has(modo)) throw httpError('Regra de avaliação inválida');
  if (modo === 'personalizado' && !funcaoIds.length) throw httpError('Selecione ao menos uma função personalizada');
  return {
    nomeCompleto,
    nivel,
    modo,
    motivo: cleanText(body.motivo_regra_avaliacao, 1000),
    ativo: body.ativo !== false,
    funcaoIds,
  };
}

async function validateFunctionIds(client, ids) {
  if (!ids.length) return;
  const { rows } = await client.query(
    'SELECT id FROM funcoes_avaliacao WHERE ativo=true AND id = ANY($1::uuid[])', [ids]
  );
  if (rows.length !== ids.length) throw httpError('Uma ou mais funções são inválidas ou estão inativas');
}

async function replaceMediumFunctions(client, mediumId, mode, functionIds) {
  await client.query('DELETE FROM mediuns_treinamento_funcoes WHERE medium_id=$1', [mediumId]);
  if (mode !== 'personalizado') return;
  await validateFunctionIds(client, functionIds);
  for (const functionId of functionIds) {
    await client.query(
      'INSERT INTO mediuns_treinamento_funcoes (medium_id, funcao_id) VALUES ($1,$2)',
      [mediumId, functionId]
    );
  }
}

async function getEligibleFunction(client, medium, functionId) {
  const { rows } = await client.query(
    `SELECT f.*,
            CASE WHEN $2 = 'personalizado' THEN EXISTS (
              SELECT 1 FROM mediuns_treinamento_funcoes mf
              WHERE mf.medium_id = $1 AND mf.funcao_id = f.id
            ) ELSE $3 = ANY(f.niveis_permitidos) END AS permitida
       FROM funcoes_avaliacao f
      WHERE f.id = $4 AND f.ativo = true`,
    [medium.id, medium.modo_avaliacao, medium.nivel_treinamento, functionId]
  );
  return rows[0]?.permitida ? rows[0] : null;
}

async function validateEvaluationPayload(client, body) {
  const mediumId = body.medium_id || body.trabalhador_id;
  const functionId = body.funcao_id;
  const result = body.resultado;
  const date = body.data_avaliacao;
  const criterionIds = Array.isArray(body.criterio_ids) ? [...new Set(body.criterio_ids)] : [];

  if (!mediumId || !functionId || !date || !RESULTS.has(result)) {
    throw httpError('Médium, função, data e resultado são obrigatórios');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) {
    throw httpError('A data deve ser válida e não pode estar no futuro');
  }
  const { rows } = await client.query(
    `SELECT id, nome_completo, ativo, nivel_treinamento, modo_avaliacao
       FROM mediuns_treinamento WHERE id = $1`, [mediumId]
  );
  const medium = rows[0];
  if (!medium || !medium.ativo) throw httpError('Médium em treinamento não está ativo');
  if (medium.modo_avaliacao === 'dispensado') throw httpError('Médium dispensado da avaliação');

  const fn = await getEligibleFunction(client, medium, functionId);
  if (!fn) throw httpError('Função não permitida para este médium');
  if (result === 'melhorar' && criterionIds.length === 0) {
    throw httpError('Selecione ao menos um ponto a melhorar');
  }
  const notes = cleanText(body.observacoes);
  if (result === 'inapto' && !notes) throw httpError('Explique o motivo do resultado Inapto');

  let criteria = [];
  if (criterionIds.length) {
    const criteriaResult = await client.query(
      'SELECT id, nome FROM criterios_avaliacao WHERE ativo=true AND id = ANY($1::uuid[])',
      [criterionIds]
    );
    if (criteriaResult.rows.length !== criterionIds.length) throw httpError('Critério inválido ou inativo');
    criteria = criteriaResult.rows;
  }
  return { medium, fn, criteria, result, date, notes };
}

router.get('/catalogos', canView, async (_req, res) => {
  try {
    const [functions, criteria, mediums] = await Promise.all([
      pool.query('SELECT * FROM funcoes_avaliacao ORDER BY ordem, nome'),
      pool.query('SELECT * FROM criterios_avaliacao ORDER BY ordem, nome'),
      pool.query(
        `SELECT m.*,
                COALESCE(array_agg(mf.funcao_id) FILTER (WHERE mf.funcao_id IS NOT NULL), ARRAY[]::uuid[]) AS funcoes_personalizadas
           FROM mediuns_treinamento m
           LEFT JOIN mediuns_treinamento_funcoes mf ON mf.medium_id = m.id
          GROUP BY m.id ORDER BY m.nome_completo`
      ),
    ]);
    res.json({ data: { funcoes: functions.rows, criterios: criteria.rows, mediuns: mediums.rows }, error: null });
  } catch (error) {
    console.error('Erro ao carregar catálogos de avaliação:', error);
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

router.post('/mediuns', adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const value = validateMediumFields(req.body);
    await client.query('BEGIN');
    await validateFunctionIds(client, value.modo === 'personalizado' ? value.funcaoIds : []);
    const { rows } = await client.query(
      `INSERT INTO mediuns_treinamento
       (nome_completo,nivel_treinamento,modo_avaliacao,motivo_regra_avaliacao,ativo,criado_por,atualizado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
      [value.nomeCompleto, value.nivel, value.modo, value.motivo, value.ativo, req.user.sub]
    );
    await replaceMediumFunctions(client, rows[0].id, value.modo, value.funcaoIds);
    await client.query('COMMIT');
    res.status(201).json({ data: rows[0], error: null });
  } catch (error) {
    await client.query('ROLLBACK');
    const duplicate = error.code === '23505';
    res.status(duplicate ? 409 : (error.status || 500)).json({
      data: null, error: { message: duplicate ? 'Já existe um médium com este nome' : error.message },
    });
  } finally { client.release(); }
});

router.patch('/mediuns/:id', adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const value = validateMediumFields(req.body);
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE mediuns_treinamento
          SET nome_completo=$1,nivel_treinamento=$2,modo_avaliacao=$3,
              motivo_regra_avaliacao=$4,ativo=$5::boolean,atualizado_por=$6::uuid,
              inativado_em=CASE WHEN $5::boolean THEN NULL ELSE COALESCE(inativado_em,NOW()) END,
              inativado_por=CASE WHEN $5::boolean THEN NULL::uuid ELSE $6::uuid END,updated_at=NOW()
        WHERE id=$7 RETURNING *`,
      [value.nomeCompleto, value.nivel, value.modo, value.motivo, value.ativo, req.user.sub, req.params.id]
    );
    if (!rows.length) throw httpError('Médium em treinamento não encontrado', 404);
    await replaceMediumFunctions(client, req.params.id, value.modo, value.funcaoIds);
    await client.query('COMMIT');
    res.json({ data: rows[0], error: null });
  } catch (error) {
    await client.query('ROLLBACK');
    const duplicate = error.code === '23505';
    res.status(duplicate ? 409 : (error.status || 500)).json({
      data: null, error: { message: duplicate ? 'Já existe um médium com este nome' : error.message },
    });
  } finally { client.release(); }
});

router.delete('/mediuns/:id', adminOnly, async (req, res) => {
  const reason = cleanText(req.body?.motivo, 1000);
  if (!reason) return res.status(400).json({ data: null, error: { message: 'Informe o motivo da inativação' } });
  try {
    const { rows } = await pool.query(
      `UPDATE mediuns_treinamento
          SET ativo=false,motivo_regra_avaliacao=$1,inativado_em=NOW(),inativado_por=$2,
              atualizado_por=$2,updated_at=NOW()
        WHERE id=$3 AND ativo=true RETURNING *`, [reason, req.user.sub, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: { message: 'Médium ativo não encontrado' } });
    res.json({ data: rows[0], error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

router.get('/resumo', canView, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `WITH elegiveis AS (
         SELECT m.id medium_id, m.nome_completo, m.nivel_treinamento, m.modo_avaliacao,
                m.motivo_regra_avaliacao, f.id funcao_id, f.nome funcao_nome, f.ordem
           FROM mediuns_treinamento m
           JOIN funcoes_avaliacao f ON f.ativo=true
          WHERE m.ativo=true AND m.modo_avaliacao <> 'dispensado'
            AND ((m.modo_avaliacao='por_nivel' AND m.nivel_treinamento=ANY(f.niveis_permitidos))
              OR (m.modo_avaliacao='personalizado' AND EXISTS (
                SELECT 1 FROM mediuns_treinamento_funcoes mf
                 WHERE mf.medium_id=m.id AND mf.funcao_id=f.id)))
       ), latest AS (
         SELECT DISTINCT ON (a.medium_id,a.nivel_treinamento,a.funcao_id) a.*
           FROM avaliacoes_mediuns a WHERE a.excluido_em IS NULL
          ORDER BY a.medium_id,a.nivel_treinamento,a.funcao_id,a.data_avaliacao DESC,a.created_at DESC
       )
       SELECT e.*,l.resultado,l.data_avaliacao,l.avaliador_nome_snapshot,
              (SELECT COUNT(*)::int FROM avaliacoes_mediuns a
                WHERE a.medium_id=e.medium_id AND a.funcao_id=e.funcao_id
                  AND a.nivel_treinamento=e.nivel_treinamento AND a.excluido_em IS NULL) total_avaliacoes
         FROM elegiveis e
         LEFT JOIN latest l ON l.medium_id=e.medium_id
          AND l.nivel_treinamento=e.nivel_treinamento AND l.funcao_id=e.funcao_id
        ORDER BY e.nome_completo,e.ordem,e.funcao_nome`
    );
    res.json({ data: rows, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

router.get('/', canView, async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size || '50', 10), 1), 100);
  const values = [];
  const filters = ['a.excluido_em IS NULL'];
  const allowed = { medium_id: 'a.medium_id', funcao_id: 'a.funcao_id', nivel: 'a.nivel_treinamento', resultado: 'a.resultado', avaliador_id: 'a.avaliador_id' };
  for (const [key, column] of Object.entries(allowed)) {
    if (req.query[key]) { values.push(req.query[key]); filters.push(`${column} = $${values.length}`); }
  }
  if (req.query.data_inicio) { values.push(req.query.data_inicio); filters.push(`a.data_avaliacao >= $${values.length}`); }
  if (req.query.data_fim) { values.push(req.query.data_fim); filters.push(`a.data_avaliacao <= $${values.length}`); }
  if (req.query.busca) { values.push(`%${req.query.busca}%`); filters.push(`a.medium_nome_snapshot ILIKE $${values.length}`); }
  try {
    const count = await pool.query(`SELECT COUNT(*)::int total FROM avaliacoes_mediuns a WHERE ${filters.join(' AND ')}`, values);
    values.push(pageSize, (page - 1) * pageSize);
    const { rows } = await pool.query(
      `SELECT a.*,COALESCE(json_agg(json_build_object('id',c.criterio_id,'nome',c.criterio_nome_snapshot))
               FILTER (WHERE c.criterio_id IS NOT NULL),'[]') AS criterios
         FROM avaliacoes_mediuns a
         LEFT JOIN avaliacoes_mediuns_criterios c ON c.avaliacao_id=a.id
        WHERE ${filters.join(' AND ')} GROUP BY a.id
        ORDER BY a.data_avaliacao DESC,a.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    res.json({ data: rows, count: count.rows[0].total, page, page_size: pageSize, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

router.post('/', canView, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const value = await validateEvaluationPayload(client, req.body);
    const { rows } = await client.query(
      `INSERT INTO avaliacoes_mediuns
       (medium_id,medium_nome_snapshot,funcao_id,funcao_nome_snapshot,data_avaliacao,
        nivel_treinamento,resultado,observacoes,avaliador_id,avaliador_nome_snapshot,atualizado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9) RETURNING *`,
      [value.medium.id,value.medium.nome_completo,value.fn.id,value.fn.nome,value.date,
       value.medium.nivel_treinamento,value.result,value.notes,req.user.sub,req.user.name || req.user.email]
    );
    for (const criterion of value.criteria) await client.query(
      `INSERT INTO avaliacoes_mediuns_criterios (avaliacao_id,criterio_id,criterio_nome_snapshot)
       VALUES ($1,$2,$3)`, [rows[0].id, criterion.id, criterion.nome]
    );
    await client.query('COMMIT');
    res.status(201).json({ data: rows[0], error: null });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.status || 500).json({ data: null, error: { message: error.message } });
  } finally { client.release(); }
});

router.patch('/:id', canView, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      'SELECT * FROM avaliacoes_mediuns WHERE id=$1 AND excluido_em IS NULL FOR UPDATE', [req.params.id]
    );
    if (!current.rows[0]) throw httpError('Avaliação não encontrada', 404);
    if (req.user.role !== 'admin' && current.rows[0].avaliador_id !== req.user.sub) {
      throw httpError('Você só pode editar suas avaliações', 403);
    }
    const payload = { ...current.rows[0], ...req.body };
    const value = await validateEvaluationPayload(client, payload);
    const { rows } = await client.query(
      `UPDATE avaliacoes_mediuns SET medium_id=$1,medium_nome_snapshot=$2,funcao_id=$3,
       funcao_nome_snapshot=$4,data_avaliacao=$5,nivel_treinamento=$6,resultado=$7,
       observacoes=$8,atualizado_por=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [value.medium.id,value.medium.nome_completo,value.fn.id,value.fn.nome,value.date,
       value.medium.nivel_treinamento,value.result,value.notes,req.user.sub,req.params.id]
    );
    await client.query('DELETE FROM avaliacoes_mediuns_criterios WHERE avaliacao_id=$1', [req.params.id]);
    for (const criterion of value.criteria) await client.query(
      `INSERT INTO avaliacoes_mediuns_criterios (avaliacao_id,criterio_id,criterio_nome_snapshot)
       VALUES ($1,$2,$3)`, [req.params.id, criterion.id, criterion.nome]
    );
    await client.query('COMMIT');
    res.json({ data: rows[0], error: null });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.status || 500).json({ data: null, error: { message: error.message } });
  } finally { client.release(); }
});

router.delete('/:id', adminOnly, async (req, res) => {
  const reason = cleanText(req.body?.motivo, 1000);
  if (!reason) return res.status(400).json({ data: null, error: { message: 'Informe o motivo da exclusão' } });
  try {
    const { rows } = await pool.query(
      `UPDATE avaliacoes_mediuns SET excluido_em=NOW(),excluido_por=$1,motivo_exclusao=$2,updated_at=NOW()
       WHERE id=$3 AND excluido_em IS NULL RETURNING id`, [req.user.sub, reason, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: { message: 'Avaliação não encontrada' } });
    res.json({ data: rows[0], error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: { message: error.message } });
  }
});

router.patch('/funcoes/:id', adminOnly, async (req, res) => {
  const levels = Array.isArray(req.body.niveis_permitidos)
    ? req.body.niveis_permitidos.filter(level => LEVELS.has(level)) : [];
  try {
    const { rows } = await pool.query(
      `UPDATE funcoes_avaliacao SET nome=$1,niveis_permitidos=$2,ordem=$3,ativo=$4,updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [cleanText(req.body.nome, 150),levels,Number(req.body.ordem) || 0,req.body.ativo !== false,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: { message: 'Função não encontrada' } });
    res.json({ data: rows[0], error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

router.patch('/criterios/:id', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE criterios_avaliacao SET nome=$1,ordem=$2,ativo=$3,updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [cleanText(req.body.nome, 150),Number(req.body.ordem) || 0,req.body.ativo !== false,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ data: null, error: { message: 'Critério não encontrado' } });
    res.json({ data: rows[0], error: null });
  } catch (error) {
    res.status(400).json({ data: null, error: { message: error.message } });
  }
});

module.exports = router;
