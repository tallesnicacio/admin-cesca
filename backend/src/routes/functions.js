const express = require('express');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Escapa caracteres HTML para evitar XSS em templates de email
function htmlEscape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Gera token HMAC-SHA256 para link de cancelamento seguro e stateless
function generateCancelToken(id, email) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
    .update(`${id}:${email.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
}

async function sendCancellationEmail(agendamento) {
  return resend.emails.send({
    from: 'Centro Espírita Santa Clara de Assis <agendamento@mail.cesca.digital>',
    to: agendamento.email,
    subject: 'Cancelamento de Agendamento - CESCA',
    html: `<p>Olá, <strong>${htmlEscape(agendamento.nome_completo)}</strong>.</p>
      <p>Seu agendamento no Centro Espírita Santa Clara de Assis foi cancelado pela equipe.</p>
      <p>Se precisar de esclarecimentos, entre em contato conosco.</p>`,
  });
}

// Página HTML de confirmação de cancelamento
function renderCancelConfirmPage(id, token, nome) {
  const nomeSafe = htmlEscape(nome);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cancelar Agendamento - CESCA</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:60px auto;padding:20px">
    <div style="background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden">
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 30px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Centro Espírita Santa Clara de Assis</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px">Cancelamento de Agendamento</p>
      </div>
      <div style="padding:32px 30px">
        <p style="font-size:17px;color:#333;margin:0 0 12px">Olá, <strong>${nomeSafe}</strong></p>
        <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px">
          Você está prestes a <strong>cancelar seu agendamento</strong>. Esta ação não pode ser desfeita.<br><br>
          Tem certeza que deseja cancelar?
        </p>
        <form method="POST" action="/api/functions/cancel">
          <input type="hidden" name="id" value="${htmlEscape(String(id))}">
          <input type="hidden" name="token" value="${htmlEscape(token)}">
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button
              type="submit"
              style="flex:1;min-width:140px;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:14px 20px;font-size:15px;font-weight:600;cursor:pointer"
            >
              Sim, cancelar meu agendamento
            </button>
            <a
              href="https://agendamento.cesca.digital"
              style="flex:1;min-width:140px;background:#f3f4f6;color:#374151;border-radius:8px;padding:14px 20px;font-size:15px;font-weight:600;text-align:center;text-decoration:none;display:inline-block;box-sizing:border-box"
            >
              Não, manter agendamento
            </a>
          </div>
        </form>
      </div>
      <div style="text-align:center;padding:16px 20px;border-top:1px solid #f0f0f0;color:#aaa;font-size:12px">
        Centro Espírita Santa Clara de Assis — Este é um link automático.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Página HTML de resultado de cancelamento (sucesso ou erro)
function renderCancelResultPage(success, message) {
  const messageSafe = htmlEscape(message);
  const color = success ? '#16a34a' : '#dc2626';
  const bgColor = success ? '#f0fdf4' : '#fef2f2';
  const borderColor = success ? '#86efac' : '#fca5a5';
  const icon = success ? '✅' : '❌';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${success ? 'Agendamento Cancelado' : 'Erro'} - CESCA</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:60px auto;padding:20px">
    <div style="background:#fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.08);overflow:hidden">
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 30px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Centro Espírita Santa Clara de Assis</h1>
      </div>
      <div style="padding:32px 30px;text-align:center">
        <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:10px;padding:24px 20px;margin-bottom:24px">
          <p style="font-size:36px;margin:0 0 12px">${icon}</p>
          <p style="color:${color};font-size:16px;font-weight:600;margin:0">${messageSafe}</p>
        </div>
        <a
          href="https://agendamento.cesca.digital"
          style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border-radius:8px;padding:12px 28px;font-size:15px;font-weight:600;text-decoration:none"
        >
          Voltar ao início
        </a>
      </div>
      <div style="text-align:center;padding:16px 20px;border-top:1px solid #f0f0f0;color:#aaa;font-size:12px">
        Centro Espírita Santa Clara de Assis — Este é um link automático.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// POST /api/functions/send-confirmation-email
// Disponível somente para usuários autenticados e agendamentos confirmados.
router.post('/send-confirmation-email', authMiddleware, async (req, res) => {
  const { agendamentoId, opcaoEscolhida = 'primeira' } = req.body || {};

  if (!agendamentoId) return res.status(400).json({ error: 'agendamentoId obrigatório' });

  try {
    const { rows } = await pool.query(
      `SELECT id, nome_completo, email, telefone, canal_preferencial,
              primeira_opcao, segunda_opcao, opcao_escolhida, status
       FROM agendamentos WHERE id = $1`,
      [agendamentoId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Agendamento não encontrado' });

    const ag = rows[0];
    if (ag.status !== 'Confirmado') {
      return res.status(409).json({
        data: null,
        error: { message: 'O e-mail de confirmação só pode ser enviado para agendamentos confirmados.' }
      });
    }

    const opcaoConfirmada = ag.opcao_escolhida === 'segunda'
      ? 'segunda'
      : ag.opcao_escolhida === 'primeira'
        ? 'primeira'
        : opcaoEscolhida;

    if (!['primeira', 'segunda'].includes(opcaoConfirmada)) {
      return res.status(400).json({
        data: null,
        error: { message: 'Opção de atendimento inválida.' }
      });
    }

    const opcaoRaw = opcaoConfirmada === 'segunda' ? ag.segunda_opcao : ag.primeira_opcao;
    if (!opcaoRaw || opcaoRaw === 'Nenhum') {
      return res.status(409).json({
        data: null,
        error: { message: 'O agendamento confirmado não possui uma opção de atendimento válida.' }
      });
    }
    const opcao = htmlEscape(opcaoRaw);

    const cancelToken = generateCancelToken(ag.id, ag.email);
    const cancelUrl = `https://admin.cesca.digital/api/functions/cancel?id=${encodeURIComponent(ag.id)}&token=${encodeURIComponent(cancelToken)}`;

    const dataEnvio = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    const salaTratamentoSection = opcaoRaw === 'Sala de Tratamento' ? `
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 20px">
        <p style="color:#14532d;font-weight:700;margin:0 0 8px;font-size:14px">🕊 Regras de Vestimenta — Sala de Tratamento</p>
        <p style="color:#166534;margin:0;font-size:13px;line-height:1.7">
          Para ser atendido(a) na Sala de Tratamento, é <strong>obrigatório</strong>:<br>
          • Roupa branca em <strong>duas peças</strong> (blusa e calça)<br>
          • <strong>Sem</strong> saias, vestidos, tops, roupas curtas, justas, decotadas ou transparentes<br>
          • <strong>Sem</strong> peças íntimas pretas ou cinzas<br><br>
          O não cumprimento da vestimenta pode impedir o atendimento no dia.
        </p>
      </div>` : '';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Centro Espírita Santa Clara de Assis <agendamento@mail.cesca.digital>',
      to: ag.email,
      subject: 'Confirmação de Agendamento - CESCA',
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:30px 20px">

    <div style="background:#ffffff;border-radius:12px 12px 0 0;padding:32px 30px 24px;text-align:center;border-bottom:3px solid #667eea">
      <img
        src="https://agendamento.cesca.digital/logo-cesca.jpeg"
        alt="Logo CESCA"
        style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto"
      />
      <h1 style="color:#667eea;margin:0 0 6px;font-size:20px;font-weight:700">Centro Espírita Santa Clara de Assis</h1>
      <p style="color:#888;margin:0;font-size:14px">Confirmação de Agendamento</p>
    </div>

    <div style="background:#ffffff;padding:32px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.07)">

      <p style="font-size:17px;color:#333;margin:0 0 18px">Olá, <strong>${htmlEscape(ag.nome_completo)}</strong></p>

      <p style="color:#555;font-size:15px;margin:0 0 26px;line-height:1.6">
        Seu agendamento foi confirmado para <strong>${opcao}</strong> na próxima gira.
      </p>

      <div style="background:#f8f9ff;border-left:4px solid #667eea;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px">
        <p style="color:#667eea;font-weight:700;margin:0 0 14px;font-size:15px">Detalhes do Agendamento</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="color:#666;padding:6px 0;width:170px;vertical-align:top">Tipo de atendimento:</td>
            <td style="color:#333;font-weight:600;padding:6px 0">${opcao}</td>
          </tr>
          <tr>
            <td style="color:#666;padding:6px 0;vertical-align:top">Nome:</td>
            <td style="color:#333;padding:6px 0">${htmlEscape(ag.nome_completo)}</td>
          </tr>
          ${ag.telefone ? `<tr>
            <td style="color:#666;padding:6px 0;vertical-align:top">Telefone:</td>
            <td style="color:#333;padding:6px 0">${htmlEscape(ag.telefone)}</td>
          </tr>` : ''}
          ${ag.canal_preferencial ? `<tr>
            <td style="color:#666;padding:6px 0;vertical-align:top">Canal de contato:</td>
            <td style="color:#333;padding:6px 0">${htmlEscape(ag.canal_preferencial)}</td>
          </tr>` : ''}
        </table>
      </div>

      ${salaTratamentoSection}

      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 26px">
        <p style="color:#92400e;margin:0 0 12px;font-size:14px;line-height:1.6">
          <strong>Atenção:</strong> Caso precise cancelar, avise por e-mail até as 12h do dia da gira.
          Faltas sem justificativa implicam em suspensão do agendamento por 2 semanas.
        </p>
        <a
          href="${cancelUrl}"
          style="display:inline-block;background:#dc2626;color:#ffffff;border-radius:6px;padding:10px 20px;font-size:13px;font-weight:600;text-decoration:none"
        >
          Cancelar meu agendamento
        </a>
      </div>

      <p style="color:#555;font-size:14px;margin:0;line-height:1.6">
        Em caso de dúvidas, entre em contato conosco.
      </p>
    </div>

    <div style="text-align:center;padding:20px 0;color:#aaa;font-size:12px">
      <p style="margin:0 0 4px"><strong style="color:#888">Centro Espírita Santa Clara de Assis</strong></p>
      <p style="margin:0 0 4px">Este é um e-mail automático, por favor não responda.</p>
      <p style="margin:0">Enviado em ${dataEnvio}</p>
    </div>

  </div>
</body>
</html>
      `,
    });

    if (emailError) throw emailError;

    res.json({ data: { message: 'Email enviado com sucesso', emailId: emailData?.id }, error: null });
  } catch (err) {
    console.error('Erro ao enviar email de confirmação:', err);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// GET /api/functions/cancel — exibe página de confirmação de cancelamento
router.get('/cancel', async (req, res) => {
  const { id, token } = req.query;

  if (!id || !token) {
    return res.send(renderCancelResultPage(false, 'Link de cancelamento inválido.'));
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nome_completo, email, status FROM agendamentos WHERE id = $1',
      [id]
    );

    if (!rows.length) {
      return res.send(renderCancelResultPage(false, 'Agendamento não encontrado.'));
    }

    const ag = rows[0];
    const expectedToken = generateCancelToken(ag.id, ag.email);

    if (token !== expectedToken) {
      return res.send(renderCancelResultPage(false, 'Link inválido ou expirado.'));
    }

    if (ag.status && ag.status.toLowerCase().includes('cancelado')) {
      return res.send(renderCancelResultPage(false, 'Este agendamento já foi cancelado anteriormente.'));
    }

    res.send(renderCancelConfirmPage(id, token, ag.nome_completo));
  } catch (err) {
    console.error('Erro ao processar cancelamento:', err);
    res.send(renderCancelResultPage(false, 'Erro interno. Por favor, tente novamente mais tarde.'));
  }
});

// POST /api/functions/cancel — efetua o cancelamento
router.post('/cancel', async (req, res) => {
  const { id, token } = req.body || {};

  if (!id || !token) {
    return res.send(renderCancelResultPage(false, 'Link de cancelamento inválido.'));
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, nome_completo, email, status FROM agendamentos WHERE id = $1',
      [id]
    );

    if (!rows.length) {
      return res.send(renderCancelResultPage(false, 'Agendamento não encontrado.'));
    }

    const ag = rows[0];
    const expectedToken = generateCancelToken(ag.id, ag.email);

    if (token !== expectedToken) {
      return res.send(renderCancelResultPage(false, 'Link inválido ou expirado.'));
    }

    if (ag.status && ag.status.toLowerCase().includes('cancelado')) {
      return res.send(renderCancelResultPage(false, 'Este agendamento já foi cancelado anteriormente.'));
    }

    await pool.query(
      "UPDATE agendamentos SET status = 'Cancelado pelo consulente' WHERE id = $1",
      [id]
    );

    res.send(renderCancelResultPage(true, 'Seu agendamento foi cancelado com sucesso. Esperamos te ver em breve!'));
  } catch (err) {
    console.error('Erro ao cancelar agendamento:', err);
    res.send(renderCancelResultPage(false, 'Erro interno. Por favor, tente novamente mais tarde.'));
  }
});

// POST /api/functions/verificar-suspensao
router.post('/verificar-suspensao', async (req, res) => {
  const { email, telefone } = req.body || {};

  if (!email && !telefone) return res.status(400).json({ error: 'Email ou telefone obrigatório' });

  try {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (email) {
      conditions.push(`email ILIKE $${idx++}`);
      values.push(email);
    }
    if (telefone) {
      conditions.push(`telefone = $${idx++}`);
      values.push(telefone);
    }

    const sql = `
      SELECT id, motivo, data_fim
      FROM suspensoes
      WHERE ativo = true
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
        AND (${conditions.join(' OR ')})
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, values);
    const suspensao = rows[0] || null;

    const data_fim_formatada = suspensao?.data_fim
      ? new Date(suspensao.data_fim).toLocaleDateString('pt-BR')
      : null;
    const dias_restantes = suspensao?.data_fim
      ? Math.ceil((new Date(suspensao.data_fim) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      data: {
        suspenso: !!suspensao,
        motivo: suspensao?.motivo || null,
        data_fim: suspensao?.data_fim || null,
        data_fim_formatada,
        dias_restantes,
      },
      error: null,
    });
  } catch (err) {
    console.error('Erro ao verificar suspensão:', err);
    res.status(500).json({ data: null, error: { message: err.message } });
  }
});

// POST /api/functions/manage-appointments
// Operações administrativas reversíveis. Não executa exclusão física.
router.post('/manage-appointments', authMiddleware, async (req, res) => {
  const { action, ids, actor = 'Admin', sendEmail = false } = req.body || {};
  const appointmentIds = Array.isArray(ids) ? [...new Set(ids)].slice(0, 200) : [];

  if (!['cancel', 'restore', 'archive', 'reset_presence'].includes(action)) {
    return res.status(400).json({ data: null, error: { message: 'Ação inválida' } });
  }
  if (!appointmentIds.length) {
    return res.status(400).json({ data: null, error: { message: 'Selecione ao menos um agendamento' } });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT id, nome_completo, email, status FROM agendamentos WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [appointmentIds]
    );
    if (current.rows.length !== appointmentIds.length) throw new Error('Um ou mais agendamentos não foram encontrados');

    let rows;
    if (action === 'cancel') {
      rows = (await client.query(
        `UPDATE agendamentos
         SET status_anterior = CASE WHEN status NOT ILIKE 'Cancelado%' THEN status ELSE status_anterior END,
             status = 'Cancelado', cancelado_at = NOW(), cancelado_por = $2
         WHERE id = ANY($1::uuid[]) AND status NOT ILIKE 'Cancelado%'
         RETURNING *`,
        [appointmentIds, actor]
      )).rows;
    } else if (action === 'restore') {
      rows = (await client.query(
        `UPDATE agendamentos
         SET status = COALESCE(status_anterior, 'Pendente de confirmação'),
             status_anterior = NULL, cancelado_at = NULL, cancelado_por = NULL
         WHERE id = ANY($1::uuid[]) AND status ILIKE 'Cancelado%'
         RETURNING *`,
        [appointmentIds]
      )).rows;
    } else if (action === 'archive') {
      rows = (await client.query(
        `UPDATE agendamentos SET arquivado_at = COALESCE(arquivado_at, NOW())
         WHERE id = ANY($1::uuid[]) RETURNING *`,
        [appointmentIds]
      )).rows;
    } else {
      rows = (await client.query(
        `UPDATE agendamentos
         SET compareceu = NULL, data_registro_presenca = NULL, responsavel_registro = NULL
         WHERE id = ANY($1::uuid[]) RETURNING *`,
        [appointmentIds]
      )).rows;
      await client.query(
        `UPDATE suspensoes
         SET ativo = false, ativa = false, desativada_at = NOW(), desativada_por = $2
         WHERE agendamento_id = ANY($1::uuid[]) AND (ativo = true OR ativa = true)`,
        [appointmentIds, actor]
      );
    }
    await client.query('COMMIT');

    const emailFailures = [];
    if (action === 'cancel' && sendEmail) {
      for (const appointment of rows) {
        try {
          const result = await sendCancellationEmail(appointment);
          if (result.error) throw result.error;
          await pool.query(
            'UPDATE agendamentos SET email_cancelamento_enviado_at = NOW() WHERE id = $1',
            [appointment.id]
          );
        } catch (emailError) {
          emailFailures.push({ id: appointment.id, message: emailError.message });
        }
      }
    }

    res.json({ data: { updated: rows.length, emailFailures }, error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na gestão de agendamentos:', err.message);
    res.status(500).json({ data: null, error: { message: err.message } });
  } finally {
    client.release();
  }
});

module.exports = router;
