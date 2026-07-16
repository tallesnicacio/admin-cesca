#!/usr/bin/env node
/**
 * Script para executar migration usando token de acesso do Supabase
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=seu_token node execute-migration.js
 *
 * Ou:
 *   node execute-migration.js seu_token
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Obter token do ambiente ou argumento
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || process.argv[2];

if (!accessToken) {
  console.error(`
❌ Token de acesso não fornecido!

Como usar:

1. Via variável de ambiente:
   SUPABASE_ACCESS_TOKEN=seu_token node execute-migration.js

2. Via argumento:
   node execute-migration.js seu_token

Como obter o token:
1. Acesse: https://supabase.com/dashboard/account/tokens
2. Gere um novo Access Token
3. Use o token gerado no comando acima
  `);
  process.exit(1);
}

const PROJECT_REF = 'mmfsesanudlzgfbjlpzk';
const MIGRATION_FILE = path.join(__dirname, 'migrations', '004_controle_presenca_suspensoes.sql');

async function executeMigration() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     EXECUTANDO MIGRATION - CONTROLE DE PRESENÇA        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Ler arquivo SQL
  console.log('📄 Lendo arquivo de migration...');
  const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`✓ Arquivo lido: ${sqlContent.length} caracteres\n`);

  console.log('🔌 Conectando ao Supabase...');
  console.log(`📍 Projeto: ${PROJECT_REF}`);
  console.log(`🔑 Token: ${accessToken.substring(0, 20)}...\n`);

  // Preparar requisição para API Management do Supabase
  const postData = JSON.stringify({
    query: sqlContent
  });

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
    console.log('🚀 Executando migration...\n');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Migration executada com sucesso!\n');
          console.log('📋 O que foi criado:');
          console.log('   ✓ Campos em agendamentos: compareceu, data_registro_presenca, responsavel_registro');
          console.log('   ✓ Tabela: suspensoes');
          console.log('   ✓ Função: verificar_suspensao()');
          console.log('   ✓ Função: desativar_suspensoes_expiradas()');
          console.log('   ✓ Função: criar_suspensao_por_falta()');
          console.log('   ✓ Trigger: trigger_suspensao_por_falta');
          console.log('   ✓ Índices de performance\n');
          resolve(data);
        } else {
          console.error(`❌ Erro HTTP ${res.statusCode}`);
          console.error('Resposta:', data);

          if (res.statusCode === 401) {
            console.error('\n⚠️  Token inválido ou expirado. Gere um novo em:');
            console.error('   https://supabase.com/dashboard/account/tokens\n');
          }

          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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

// Executar
executeMigration()
  .then(() => {
    console.log('✨ Processo concluído com sucesso!\n');
    console.log('Próximos passos:');
    console.log('1. Deploy da Edge Function: supabase functions deploy verificar-suspensao --no-verify-jwt');
    console.log('2. Deploy do build da aplicação\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Falha ao executar migration:', error.message);
    console.error('\nAlternativa: Execute manualmente via Dashboard');
    console.error(`https://supabase.com/dashboard/project/${PROJECT_REF}/sql\n`);
    process.exit(1);
  });
