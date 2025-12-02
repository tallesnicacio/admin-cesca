# 🗄️ Migrations do Admin-Cesca

Este diretório contém os scripts SQL para criar as tabelas do editor de formulários do quiz-cesca.

## 📋 Arquivos de Migração

1. **001_quiz_editor_schema.sql** - Cria as tabelas base
   - `formularios` - Formulários disponíveis
   - `etapas_formulario` - Etapas/perguntas de cada formulário
   - `opcoes_atendimento` - Opções de atendimento (Psicografia, Portal, etc)
   - `regras_formulario` - Regras exibidas no início do quiz

2. **002_migrate_quiz_data.sql** - Insere os dados atuais do quiz-cesca
   - Migra dados hardcoded para o banco de dados
   - Cria formulário "Quiz de Agendamento CESCA"
   - Popula opções de atendimento
   - Popula regras e etapas

## 🚀 Como Aplicar as Migrations

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   ```
   https://app.supabase.com/project/mmfsesanudlzgfbjlpzk
   ```

2. **Vá para SQL Editor:**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New Query"

3. **Execute cada migration na ordem:**

   **a) Primeiro: 001_quiz_editor_schema.sql**
   - Copie todo o conteúdo do arquivo
   - Cole no SQL Editor
   - Clique em "Run" ou pressione `Ctrl+Enter`
   - Aguarde a confirmação de sucesso

   **b) Segundo: 002_migrate_quiz_data.sql**
   - Copie todo o conteúdo do arquivo
   - Cole no SQL Editor
   - Clique em "Run" ou pressione `Ctrl+Enter`
   - Aguarde a confirmação de sucesso

4. **Verifique se as tabelas foram criadas:**
   - Vá em "Table Editor" no menu lateral
   - Confirme que as seguintes tabelas existem:
     - ✅ `formularios`
     - ✅ `etapas_formulario`
     - ✅ `opcoes_atendimento`
     - ✅ `regras_formulario`

### Opção 2: Via Script Node.js

```bash
# Execute o script de validação
node migrations/apply-migrations.js
```

Este script valida os arquivos e exibe instruções detalhadas.

## 📊 Estrutura das Tabelas

### formularios
- Armazena os formulários disponíveis
- Permite criar múltiplos quizzes no futuro
- Campo `slug` identifica único do formulário

### etapas_formulario
- Cada linha é uma etapa/step do quiz
- `ordem` define a sequência de exibição
- `tipo` define o comportamento (input, select, info, etc)
- `configuracoes` (JSONB) permite configs específicas por tipo

### opcoes_atendimento
- Opções como Psicografia, Portal de Obaluaiê, etc
- `restricao` define se há restrição (ex: 'menor' para menores de idade)
- `ordem` controla a exibição no formulário

### regras_formulario
- Regras e avisos do formulário
- Vinculadas a um formulário específico
- `destaque` permite destacar regras importantes

## 🔐 Segurança (RLS)

As migrations já configuram Row Level Security (RLS):

- **Leitura pública:** Quiz-cesca pode ler dados sem autenticação
- **Escrita restrita:** Apenas usuários autenticados (admin-cesca) podem modificar

## ⚠️ Importante

- Execute as migrations **na ordem** (001 antes de 002)
- Não execute a mesma migration duas vezes (use `ON CONFLICT` se necessário)
- Faça backup antes de aplicar em produção
- Teste primeiro em ambiente de desenvolvimento

## 🔄 Rollback

Para reverter as migrations:

```sql
-- CUIDADO: Isto vai APAGAR TODOS OS DADOS!
DROP TABLE IF EXISTS regras_formulario CASCADE;
DROP TABLE IF EXISTS etapas_formulario CASCADE;
DROP TABLE IF EXISTS opcoes_atendimento CASCADE;
DROP TABLE IF EXISTS formularios CASCADE;
```

## 📞 Suporte

Se encontrar problemas:
1. Verifique logs do Supabase
2. Confirme permissões de RLS
3. Verifique se a função `update_updated_at_column()` existe
