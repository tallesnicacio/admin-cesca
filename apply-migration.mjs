import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.production.local' });

async function applyMigration() {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas');
    process.exit(1);
  }

  console.log('🔌 Conectando ao Supabase...');
  console.log('📍 URL:', supabaseUrl);

  // Ler o arquivo SQL
  const migrationPath = path.join(__dirname, 'migrations', '004_controle_presenca_suspensoes.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Arquivo SQL carregado');
  console.log('📊 Tamanho:', sqlContent.length, 'caracteres\n');

  // Executar via fetch direto (REST API do Supabase)
  console.log('🚀 Executando migration via REST API...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sqlContent })
    });

    if (!response.ok) {
      // Se não funcionar via RPC, tentar executar via SQL direto
      console.log('⚠️  RPC não disponível, tentando método alternativo...\n');

      // Executar usando curl e a API do Supabase
      const { execSync } = await import('child_process');

      // Salvar SQL em arquivo temporário
      const tempFile = '/tmp/migration.sql';
      fs.writeFileSync(tempFile, sqlContent);

      console.log('📝 Executando via psql...');

      // Extrair project ref da URL
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
      const dbHost = `db.${projectRef}.supabase.co`;

      console.log(`
⚠️  Para executar a migration, você precisa das credenciais do banco de dados.

Opções:

1. Via Supabase Dashboard (RECOMENDADO):
   - Acesse: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql
   - Cole o conteúdo de: migrations/004_controle_presenca_suspensoes.sql
   - Clique em "Run"

2. Via psql (se tiver as credenciais):
   psql "postgresql://postgres:[PASSWORD]@${dbHost}:5432/postgres" -f migrations/004_controle_presenca_suspensoes.sql

3. Via Supabase CLI (requer login):
   supabase login
   supabase db push --linked
      `);

      return;
    }

    console.log('✅ Migration aplicada com sucesso!');

  } catch (err) {
    console.error('\n❌ Erro ao executar:', err.message);
    console.log(`
⚠️  Não foi possível executar automaticamente.

Por favor, execute manualmente via Supabase Dashboard:
1. Acesse: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql
2. Cole o conteúdo de: migrations/004_controle_presenca_suspensoes.sql
3. Clique em "Run"

Ou via CLI (após fazer login):
   supabase login
   supabase db push --linked
    `);
  }
}

applyMigration();
