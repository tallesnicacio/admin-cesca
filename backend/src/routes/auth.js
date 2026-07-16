const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../db');
const { authMiddleware } = require('../middleware/auth');

function htmlEscape(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';
const resend = new Resend(process.env.RESEND_API_KEY);

function makeSession(user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
  return {
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: { name: user.name },
    },
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, p.name, p.is_admin, p.is_active
       FROM users u LEFT JOIN profiles p ON p.id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    if (user.is_active === false) return res.status(403).json({ error: 'Conta desativada' });

    res.json({ data: { session: makeSession(user) }, error: null });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ error: null });
});

// GET /api/auth/session  — valida JWT e retorna sessão
router.get('/session', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ data: { session: null }, error: null });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({
      data: {
        session: {
          access_token: authHeader.slice(7),
          user: { id: payload.sub, email: payload.email, user_metadata: { name: payload.name } },
        },
      },
      error: null,
    });
  } catch {
    res.json({ data: { session: null }, error: null });
  }
});

// GET /api/auth/user
router.get('/user', authMiddleware, (req, res) => {
  res.json({
    data: {
      user: { id: req.user.sub, email: req.user.email, user_metadata: { name: req.user.name } },
    },
    error: null,
  });
});

// POST /api/auth/signup — cria usuário e envia convite por email
router.post('/signup', authMiddleware, async (req, res) => {
  const { email, password, options } = req.body;
  const name = options?.data?.name || '';
  const role = options?.data?.role || 'user';
  const emailRedirectTo = options?.emailRedirectTo || `${process.env.APP_URL}/set-password`;

  if (!email) return res.status(400).json({ error: 'Email obrigatório' });

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Email já cadastrado' });

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    let passwordHash = null;
    if (password) passwordHash = await bcrypt.hash(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, invite_token, invite_expires_at)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [email.toLowerCase(), passwordHash, inviteToken, inviteExpires]
      );
      const userId = rows[0].id;
      await client.query(
        `INSERT INTO profiles (id, email, name, role, is_admin, is_active, active)
         VALUES ($1, $2, $3, $4, $5, true, true)`,
        [userId, email.toLowerCase(), name, role, role === 'admin']
      );
      await client.query('COMMIT');

      // Enviar email de convite
      const inviteUrl = `${emailRedirectTo}?token=${inviteToken}`;
      try {
        await resend.emails.send({
          from: 'Admin CESCA <noreply@cesca.digital>',
          to: email,
          subject: 'Bem-vindo ao Admin CESCA - Defina sua senha',
          html: `
            <h2>Olá, ${htmlEscape(name || email)}!</h2>
            <p>Sua conta no Admin CESCA foi criada. Clique no link abaixo para definir sua senha:</p>
            <p><a href="${htmlEscape(inviteUrl)}" style="background:#667eea;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Definir minha senha</a></p>
            <p>Este link expira em 7 dias.</p>
            <p>Se você não solicitou este acesso, ignore este email.</p>
          `,
        });
      } catch (emailErr) {
        console.error('Erro ao enviar email de convite:', emailErr);
      }

      res.json({
        data: { user: { id: userId, email, user_metadata: { name } } },
        error: null,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Erro no signup:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/auth/user — atualiza senha do usuário autenticado
router.patch('/user', authMiddleware, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Nova senha obrigatória' });

  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, invite_token = NULL, invite_expires_at = NULL, updated_at = NOW() WHERE id = $2',
      [hash, req.user.sub]
    );
    res.json({ data: { user: { id: req.user.sub } }, error: null });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/verify-invite — valida token de convite e retorna sessão
router.post('/verify-invite', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token obrigatório' });

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, p.name, p.is_admin
       FROM users u LEFT JOIN profiles p ON p.id = u.id
       WHERE u.invite_token = $1 AND u.invite_expires_at > NOW()`,
      [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Token inválido ou expirado' });

    const user = rows[0];

    // Invalida o token imediatamente após o primeiro uso
    await pool.query(
      'UPDATE users SET invite_token = NULL, invite_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ data: { session: makeSession(user) }, error: null });
  } catch (err) {
    console.error('Erro ao verificar convite:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
