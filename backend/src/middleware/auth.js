const jwt = require('jsonwebtoken');
const pool = require('../db');
const { readSecret } = require('../config');

const JWT_SECRET = readSecret('JWT_SECRET');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (_err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, role, is_admin, is_active
       FROM profiles
       WHERE id = $1`,
      [payload.sub]
    );
    const profile = rows[0];
    if (!profile || profile.is_active === false) {
      return res.status(403).json({ error: 'Conta desativada ou sem perfil' });
    }
    req.user = {
      ...payload,
      sub: profile.id,
      email: profile.email || payload.email,
      name: profile.name || payload.name,
      role: profile.role || (profile.is_admin ? 'admin' : 'user'),
      is_admin: Boolean(profile.is_admin),
    };
    next();
  } catch (err) {
    return next(err);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil' });
    }
    next();
  };
}

const requireAdmin = requireRoles('admin');
const requirePdvAccess = requireRoles('admin', 'vendedor', 'coordenador_lanches');
const requirePdvSupervisor = requireRoles('admin', 'coordenador_lanches');
const requireUserManager = requireRoles('admin', 'coordenador_lanches');

module.exports = { authMiddleware, requireRoles, requireAdmin, requirePdvAccess, requirePdvSupervisor, requireUserManager };
