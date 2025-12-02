#!/usr/bin/env node
/**
 * Script para aplicar migrations no Supabase
 * Uso: node apply-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas');
  console.error('Configure REACT_APP_SUPABASE_URL e REACT_APP_SUPABASE_ANON_KEY no arquivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para executar SQL via Supabase (usando RPC ou query direto)
async function executeSQLFile(filePath) {
  console.log(`\n📄 Executando: ${path.basename(filePath)}`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Como a API anon não permite executar DDL diretamente,
    // vamos usar o psql via bash se disponível
    console.log('⚠️  ATENÇÃO: Para executar DDL (CREATE TABLE, ALTER, etc), é necessário:');
    console.log('   1. Acesso ao Supabase Dashboard → SQL Editor');
    console.log('   2. Ou usar a service_role key (não recomendado para produção)');
    console.log('   3. Ou executar via psql com credenciais de superusuário\n');

    console.log('📋 Conteúdo do arquivo de migração:');
    console.log('─'.repeat(60));
    console.log(sql.substring(0, 500) + '...\n');

    console.log('✅ Arquivo lido com sucesso');
    console.log(`📊 Tamanho: ${sql.length} caracteres`);

    return { success: true, file: filePath };
  } catch (error) {
    console.error(`❌ Erro ao ler arquivo ${filePath}:`, error.message);
    return { success: false, file: filePath, error: error.message };
  }
}

// Função principal
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     ADMIN CESCA - APLICADOR DE MIGRATIONS             ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
  console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);

  const migrationsDir = __dirname;
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('⚠️  Nenhum arquivo .sql encontrado na pasta migrations/');
    return;
  }

  console.log(`\n📂 Encontrados ${migrationFiles.length} arquivo(s) de migração:\n`);
  migrationFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log('🚀 INSTRUÇÕES PARA APLICAR AS MIGRATIONS:');
  console.log('─'.repeat(60));
  console.log('\n1️⃣  Acesse o Supabase Dashboard:');
  console.log(`   ${supabaseUrl.replace('https://', 'https://app.supabase.com/project/')}`);
  console.log('\n2️⃣  Vá em: SQL Editor → New Query');
  console.log('\n3️⃣  Copie e cole o conteúdo de cada arquivo na ordem:');

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    await executeSQLFile(filePath);
  }

  console.log('\n4️⃣  Execute cada query no SQL Editor');
  console.log('\n5️⃣  Verifique se as tabelas foram criadas:');
  console.log('   - formularios');
  console.log('   - etapas_formulario');
  console.log('   - opcoes_atendimento');
  console.log('   - regras_formulario');

  console.log('\n' + '─'.repeat(60));
  console.log('📌 ALTERNATIVA: Usar a service_role key (apenas dev)');
  console.log('─'.repeat(60));
  console.log('\nSe você tiver a service_role key, pode executar diretamente:');
  console.log('   REACT_APP_SUPABASE_SERVICE_KEY=sua_key node apply-migrations-service.js');

  console.log('\n✅ Processamento concluído!\n');
}

// Executar
main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
