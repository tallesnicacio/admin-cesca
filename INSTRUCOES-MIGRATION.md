# 🚀 Instruções para Aplicar a Migration

## Método 1: Via Supabase Dashboard (RECOMENDADO)

### Passo a Passo:

1. **Acesse o SQL Editor do Supabase**
   - Vá para: https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk/sql

2. **Abra o arquivo da migration**
   - Abra o arquivo: `migrations/004_controle_presenca_suspensoes.sql`
   - Copie TODO o conteúdo do arquivo

3. **Execute no SQL Editor**
   - Cole o conteúdo no SQL Editor
   - Clique no botão **"Run"** (ou pressione Ctrl+Enter)

4. **Verifique o sucesso**
   - Você deve ver a mensagem "Success. No rows returned"
   - Isso é normal, pois são comandos DDL (CREATE TABLE, ALTER TABLE, etc.)

### O que será criado:

✅ **Campos na tabela `agendamentos`:**
- `compareceu` (BOOLEAN)
- `data_registro_presenca` (TIMESTAMP)
- `responsavel_registro` (TEXT)

✅ **Nova tabela `suspensoes`:**
- Para rastrear consulentes suspensos por 2 semanas

✅ **Funções do banco:**
- `verificar_suspensao()` - Verifica se email/telefone está suspenso
- `desativar_suspensoes_expiradas()` - Desativa suspensões vencidas
- `criar_suspensao_por_falta()` - Trigger que cria suspensão ao marcar falta

✅ **Índices:**
- Múltiplos índices para performance de consultas

---

## Método 2: Via Supabase CLI

Se preferir usar a linha de comando:

### 1. Fazer login no Supabase
```bash
supabase login
```

### 2. Aplicar a migration
```bash
cd /mnt/volume-hel1-1/projetos/admin-cesca
supabase db push --linked
```

---

## Método 3: Via psql (Avançado)

Se tiver acesso direto ao banco de dados:

```bash
# Obter a senha do banco no Supabase Dashboard > Settings > Database

psql "postgresql://postgres:[SUA_SENHA]@db.mmfsesanudlzgfbjlpzk.supabase.co:5432/postgres" \
  -f migrations/004_controle_presenca_suspensoes.sql
```

---

## ✅ Como Verificar se Funcionou

Após executar a migration, verifique se foi aplicada com sucesso:

### Via SQL Editor:

```sql
-- 1. Verificar se os novos campos existem
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'agendamentos'
  AND column_name IN ('compareceu', 'data_registro_presenca', 'responsavel_registro');

-- 2. Verificar se a tabela suspensoes existe
SELECT * FROM suspensoes LIMIT 1;

-- 3. Verificar se as funções existem
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('verificar_suspensao', 'desativar_suspensoes_expiradas', 'criar_suspensao_por_falta');
```

Você deve ver:
- 3 linhas para os campos de agendamentos
- Tabela suspensoes (vazia por enquanto)
- 3 funções listadas

---

## 🐛 Problemas Comuns

### "relation agendamentos does not exist"
- A tabela `agendamentos` não existe
- Verifique se está executando no banco correto

### "permission denied"
- Faça login como administrador no Supabase Dashboard
- Use o SQL Editor do Dashboard (tem permissões corretas)

### "duplicate column name"
- A migration já foi aplicada antes
- Verifique se os campos já existem:
  ```sql
  SELECT * FROM agendamentos LIMIT 1;
  ```

---

## 📞 Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs de erro no SQL Editor
2. Certifique-se de estar no projeto correto: **mmfsesanudlzgfbjlpzk**
3. Consulte a documentação completa em `CONTROLE-PRESENCA-IMPLEMENTACAO.md`
