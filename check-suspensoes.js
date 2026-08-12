#!/usr/bin/env node
const https = require('https');

const accessToken = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'mmfsesanudlzgfbjlpzk';

if (!accessToken) {
  console.error('❌ Token não fornecido!');
  process.exit(1);
}

const sql = `
SELECT
  s.id,
  s.email,
  s.telefone,
  s.motivo,
  s.data_inicio,
  s.data_fim,
  s.ativa,
  EXTRACT(DAY FROM (s.data_fim - CURRENT_TIMESTAMP))::INTEGER as dias_restantes,
  a.nome_completo
FROM suspensoes s
LEFT JOIN agendamentos a ON s.agendamento_id = a.id
WHERE s.ativa = true
  AND s.data_fim > CURRENT_TIMESTAMP
ORDER BY s.data_fim DESC;
`;

const postData = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(data);
      console.log('\n📋 SUSPENSÕES ATIVAS NO BANCO:\n');
      if (result && result.length > 0) {
        result.forEach((s, i) => {
          console.log(`${i + 1}. ${s.nome_completo || 'N/A'}`);
          console.log(`   Email: ${s.email}`);
          console.log(`   Telefone: ${s.telefone}`);
          console.log(`   Motivo: ${s.motivo}`);
          console.log(`   Válida até: ${s.data_fim}`);
          console.log(`   Dias restantes: ${s.dias_restantes}`);
          console.log(`   Ativa: ${s.ativa ? 'SIM' : 'NÃO'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  Nenhuma suspensão ativa encontrada!\n');
      }
    } else {
      console.error('Erro:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro:', error.message);
});

req.write(postData);
req.end();
