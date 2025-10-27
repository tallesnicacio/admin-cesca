# Migração de Status de Presença: AP → P

## 📋 Resumo da Mudança

Esta migração altera os códigos de status de presença de **2 letras para 1 letra**:

| Antes | Depois | Descrição |
|-------|--------|-----------|
| **AP** | **P** | Presente (Aplicou-se) |
| **F** | **F** | Falta (sem mudança) |
| **J** | **J** | Justificado (sem mudança) |
| **A** | **A** | Afastado (sem mudança) |

## 🎯 Arquivos Modificados

### Frontend (JavaScript/React)
- ✅ `src/components/PresencaManager.js`

### Backend (SQL)
- ✅ `supabase-melhorias-presenca.sql`

### Scripts de Migração (Novos)
- 🆕 `migracao-status-presenca-AP-para-P.sql` (migração)
- 🆕 `rollback-status-presenca-P-para-AP.sql` (reverter se necessário)
- 🆕 `MIGRACAO-STATUS-PRESENCA.md` (este arquivo)

## 📝 Instruções de Execução

### Passo 1: Fazer Backup do Banco de Dados

⚠️ **IMPORTANTE**: Sempre faça backup antes de executar migrações!

No Supabase Dashboard:
1. Vá em **Database** → **Backups**
2. Clique em **Create Backup** (ou verifique se tem backup automático recente)

### Passo 2: Executar a Migração

1. Acesse o **Supabase SQL Editor**:
   - Dashboard → SQL Editor → New Query

2. Copie todo o conteúdo do arquivo `migracao-status-presenca-AP-para-P.sql`

3. Cole no SQL Editor e clique em **Run**

4. Verifique os logs/mensagens:
   - Deve mostrar "SITUAÇÃO ANTES DA MIGRAÇÃO"
   - Deve mostrar "SITUAÇÃO APÓS A MIGRAÇÃO"
   - Deve mostrar "✅ Migração concluída com sucesso!"

### Passo 3: Verificar a Migração

Execute este SQL para confirmar que não há mais registros com 'AP':

```sql
SELECT
    status_presenca,
    COUNT(*) as total
FROM presencas
GROUP BY status_presenca
ORDER BY status_presenca;
```

Resultado esperado:
```
status_presenca | total
----------------|------
A               | X
F               | X
J               | X
P               | X
```

**Não deve aparecer "AP"!**

### Passo 4: Atualizar o Frontend

O código JavaScript já foi atualizado. Você precisa:

1. **Se estiver usando git**, faça commit das mudanças:
```bash
cd /root/admin-cesca
git add src/components/PresencaManager.js
git commit -m "Migrar status de presença de AP para P"
```

2. **Deploy/Redeploy** da aplicação:
   - Se estiver usando Vercel/Netlify: faça push para o repositório
   - Se estiver rodando localmente: reinicie o servidor React

### Passo 5: Testar a Aplicação

1. Acesse o sistema admin-cesca
2. Vá em **Presença** → **Registrar Presença**
3. Verifique que o dropdown mostra:
   - ✓ Presente
   - ✗ Falta
   - ⚠ Justificada
   - ⊗ Afastado
4. Marque algumas presenças e salve
5. Verifique no banco que salvou com 'P' (não 'AP'):

```sql
SELECT * FROM presencas ORDER BY created_at DESC LIMIT 5;
```

## 🔄 Rollback (Reverter a Migração)

Se precisar reverter para o sistema antigo (AP):

### No Banco de Dados:

1. Acesse Supabase SQL Editor
2. Execute o arquivo `rollback-status-presenca-P-para-AP.sql`
3. Verifique os logs de confirmação

### No Frontend:

Você precisará reverter manualmente as mudanças em `PresencaManager.js`:

```bash
git revert <commit-hash>
# ou
git checkout HEAD~1 src/components/PresencaManager.js
```

**Substitua**:
- Todas as ocorrências de `'P'` por `'AP'`
- `<option value="P">` por `<option value="AP">`

## ✅ Checklist de Verificação

- [ ] Backup do banco criado
- [ ] Script de migração executado com sucesso
- [ ] Não há mais registros com 'AP' no banco
- [ ] Frontend atualizado e deployado
- [ ] Teste de criar nova presença funcionando
- [ ] Dropdown mostra opções corretas (P, F, J, A)
- [ ] Relatórios continuam funcionando
- [ ] Views do banco retornam dados corretos

## 📊 Impacto nos Relatórios

A view `vw_presenca_trabalhadores` foi atualizada para contar corretamente com 'P':

```sql
-- Antes
COUNT(CASE WHEN p.status_presenca = 'AP' THEN 1 END) as presencas

-- Depois
COUNT(CASE WHEN p.status_presenca = 'P' THEN 1 END) as presencas
```

Os relatórios em `PresencaReports.js` **NÃO precisam de alteração** porque usam a view.

## 🐛 Troubleshooting

### Erro: "check constraint violated"

**Causa**: Existem valores na coluna que não estão em ('P', 'F', 'J', 'A')

**Solução**:
```sql
-- Ver quais valores existem
SELECT DISTINCT status_presenca FROM presencas;

-- Corrigir manualmente se necessário
UPDATE presencas SET status_presenca = 'P' WHERE status_presenca = 'AP';
UPDATE presencas SET status_presenca = 'F' WHERE status_presenca IS NULL;
```

### Erro: "column does not exist"

**Causa**: Tabela `presencas` não tem a coluna `status_presenca`

**Solução**: Execute primeiro o arquivo `supabase-melhorias-presenca.sql`

### Interface mostra valores errados

**Causa**: Frontend não foi atualizado/redeployado

**Solução**:
1. Limpe o cache do navegador (Ctrl+Shift+R)
2. Verifique se o deploy foi feito corretamente
3. Verifique os logs do servidor

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do Supabase (Database → Logs)
2. Verifique o console do navegador (F12 → Console)
3. Execute os SQLs de verificação acima
4. Se necessário, execute o rollback

## 📅 Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 2024-10-25 | 1.0 | Migração inicial de AP para P |

---

**Última atualização**: 25/10/2024
