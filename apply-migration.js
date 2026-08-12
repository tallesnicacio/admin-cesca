const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.production.local' });

async function applyMigration() {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas');
    console.log('SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.log('SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
    process.exit(1);
  }

  console.log('🔌 Conectando ao Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Ler o arquivo SQL
  const migrationPath = path.join(__dirname, 'migrations', '004_controle_presenca_suspensoes.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Arquivo SQL carregado:', migrationPath);
  console.log('📊 Tamanho:', sqlContent.length, 'caracteres');

  // Executar o SQL
  console.log('\n🚀 Aplicando migration...\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('❌ Erro ao executar migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration aplicada com sucesso!');
    console.log('\n📋 Tabelas/Funções criadas:');
    console.log('  - Campos adicionados em agendamentos (compareceu, data_registro_presenca, responsavel_registro)');
    console.log('  - Tabela suspensoes');
    console.log('  - Função verificar_suspensao()');
    console.log('  - Função desativar_suspensoes_expiradas()');
    console.log('  - Função criar_suspensao_por_falta()');
    console.log('  - Trigger trigger_suspensao_por_falta');
    console.log('  - Índices para performance');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

applyMigration();
