require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const functionsRoutes = require('./routes/functions');
const pdvRoutes = require('./routes/pdv');

const app = express();
const PORT = process.env.PORT || 3010;

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['https://agendamento.cesca.digital', 'https://admin.cesca.digital', 'https://pdv.cesca.digital'];

if (!process.env.CORS_ORIGINS) {
  console.warn('[WARN] CORS_ORIGINS não configurado — usando domínios padrão do CESCA.');
}

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, health checks internos)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado para origem: ${origin}`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── RATE LIMITING (in-memory) ───────────────────────────────────────────────
const rateLimitStore = new Map();

// Limpa entradas expiradas a cada 5 minutos
const rateLimitCleanup = setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, filtered);
  }
}, 5 * 60 * 1000);
rateLimitCleanup.unref();

function createRateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = (rateLimitStore.get(ip) || []).filter(t => t > windowStart);
    if (timestamps.length >= maxRequests) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    }
    timestamps.push(now);
    rateLimitStore.set(ip, timestamps);
    next();
  };
}

// 50 tentativas de login por 15 min (IP compartilhado no Swarm ingress: limite ~global)
const authRateLimit = createRateLimit(50, 15 * 60 * 1000);
// 300 req/min para endpoints gerais (IP compartilhado no Swarm ingress: limite ~global)
const generalRateLimit = createRateLimit(300, 60 * 1000);

// ─── BODY PARSER ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// ─── ROTAS ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/data', generalRateLimit, dataRoutes);
app.use('/api/functions', generalRateLimit, functionsRoutes);
app.use('/api/pdv', generalRateLimit, pdvRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`admin-cesca-api rodando na porta ${PORT}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL || process.env.DATABASE_URL_FILE ? 'configurado' : 'NÃO configurado'}`);
    console.log(`JWT_SECRET: ${process.env.JWT_SECRET || process.env.JWT_SECRET_FILE ? 'configurado' : 'NÃO configurado'}`);
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_FILE ? 'configurado' : 'NÃO configurado'}`);
  });
}

module.exports = app;
