const { Pool } = require('pg');
const { readSecret } = require('./config');

const pool = new Pool({
  connectionString: readSecret('DATABASE_URL'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,    // 30s — previne queries penduradas
  query_timeout: 30000,
});

pool.on('error', (err) => {
  console.error('Erro no pool PostgreSQL:', err);
});

module.exports = pool;
