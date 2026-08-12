#!/usr/bin/env node
/**
 * Script para atualizar "Caboclos" para "Acolhimento Espiritual" no banco
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || process.argv[2];
const PROJECT_REF = 'mmfsesanudlzgfbjlpzk';
const SQL_FILE = path.join(__dirname, 'update-acolhimento.sql');

if (!accessToken) {
  console.error('❌ Token não fornecido!');
  console.error('Uso: SUPABASE_ACCESS_TOKEN=token node execute-update-acolhimento.js');
  process.exit(1);
}

async function executeUpdate() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   ATUALIZANDO ACOLHIMENTO ESPIRITUAL NO BANCO          ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const sqlContent = fs.readFileSync(SQL_FILE, 'utf8');
  console.log('📄 SQL lido:', sqlContent.length, 'caracteres\n');

  const postData = JSON.stringify({ query: sqlContent });

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

  return new Promise((resolve, reject) => {
    console.log('🚀 Executando atualização...\n');

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Atualização executada com sucesso!\n');
          console.log('📋 Mudanças aplicadas:');
          console.log('   ✓ Label: "Caboclos" → "Acolhimento Espiritual"');
          console.log('   ✓ Descrição atualizada');
          console.log('   ✓ Regra atualizada\n');
          resolve(data);
        } else {
          console.error(`❌ Erro HTTP ${res.statusCode}`);
          console.error('Resposta:', data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

executeUpdate()
  .then(() => {
    console.log('✨ Atualização concluída!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha:', error.message);
    process.exit(1);
  });
