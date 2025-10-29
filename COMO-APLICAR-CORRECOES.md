# 🚀 COMO APLICAR AS CORREÇÕES - GUIA RÁPIDO

## 📋 Pré-requisitos
- Acesso ao Supabase Dashboard
- Acesso SSH ao servidor

---

## ⚡ PASSO A PASSO (5 minutos)

### 1️⃣ EXECUTAR MIGRATION NO SUPABASE

**Acesse:**
1. https://supabase.com/dashboard
2. Selecione o projeto Admin CESCA
3. Vá em **SQL Editor** (menu lateral esquerdo)

**Execute o SQL:**
```sql
-- Copie TODO o conteúdo do arquivo:
-- /root/admin-cesca/migration-fix-all-definitivo.sql

-- E cole no SQL Editor, depois clique em RUN
```

**Você verá mensagens como:**
```
✓ Coluna numero adicionada
✓ Coluna grupo adicionada
✓ Coluna funcao_permanente adicionada
✓ Constraint caixas_data_setor_unique criada
✅ MIGRAÇÃO DEFINITIVA CONCLUÍDA!
```

---

### 2️⃣ FAZER DEPLOY DA APLICAÇÃO

**No servidor (SSH):**
```bash
cd /root/admin-cesca
./scripts/build-and-update.sh
```

**Aguarde:**
- Build completo (sem cache): ~2-3 minutos
- Update do serviço: ~30 segundos

**Sucesso quando ver:**
```
✓ Build completed successfully!
✓ Service updated successfully!
✓ No-cache build and forced update completed!
```

---

### 3️⃣ TESTAR FUNCIONALIDADES

#### Teste 1: Lista de Trabalhadores
1. Acesse: https://admin.cesca.digital
2. Faça login
3. Vá em **Escalas** → **Capacitações**
4. ✅ Deve aparecer a lista de trabalhadores

#### Teste 2: Caixas Independentes
1. Vá em **Financeiro** → **Caixas**
2. Abra o **Caixa Lanche** (valor inicial: R$ 50,00)
3. Abra o **Caixa Lojinha** (valor inicial: R$ 100,00)
4. ✅ Ambos devem abrir sem erro 409

#### Teste 3: Escalas
1. Vá em **Escalas** → **Revisar Escalas**
2. Selecione um mês
3. ✅ Não deve ter erro 400

---

## ✅ VERIFICAÇÃO DE SUCESSO

Execute no Supabase SQL Editor para confirmar:

```sql
-- 1. Verificar trabalhadores
SELECT
  COUNT(*) as total_trabalhadores,
  COUNT(numero) as tem_numero,
  COUNT(grupo) as tem_grupo,
  COUNT(funcao_permanente) as tem_funcao
FROM trabalhadores;

-- 2. Verificar tipos_atendimento
SELECT
  COUNT(*) as total_tipos,
  COUNT(horario_inicio) as tem_horario_inicio,
  COUNT(horario_fim) as tem_horario_fim
FROM tipos_atendimento;

-- 3. Verificar caixas (constraint)
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'caixas'
AND constraint_name = 'caixas_data_setor_unique';
-- Deve retornar 1 linha
```

---

## 🆘 PROBLEMAS COMUNS

### Erro: "column does not exist"
**Causa:** Migration não foi executada no Supabase
**Solução:** Execute o passo 1️⃣ novamente

### Erro 409 ao abrir caixa
**Causa:** Constraint antiga ainda existe
**Solução:** Execute no Supabase:
```sql
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS caixas_data_unique;
```

### Lista de trabalhadores vazia
**Causa:** Não há trabalhadores cadastrados ou RLS bloqueando
**Solução:** Verifique permissões RLS no Supabase

---

## 📞 SUPORTE

**Arquivos de referência:**
- `/root/admin-cesca/DIAGNOSTICO-E-CORRECOES-DEFINITIVO.md` - Detalhes completos
- `/root/admin-cesca/migration-fix-all-definitivo.sql` - SQL a executar

**Logs úteis:**
```bash
# Ver logs em tempo real
docker service logs admin-cesca_admin-cesca -f

# Ver status do serviço
docker service ps admin-cesca_admin-cesca
```

---

## 🎯 RESULTADO ESPERADO

Após aplicar todas as correções:

✅ **Trabalhadores**
- Lista aparece em todas as telas de escalas
- Pode cadastrar com número, grupo e função
- Pode marcar como afastado

✅ **Escalas**
- Não há mais erro 400
- Consegue revisar escalas
- Consegue gerar novas escalas

✅ **Caixas**
- 3 caixas independentes (lanche, lojinha, mensalidades)
- Cada um pode abrir/fechar separadamente
- Mesmo dia, múltiplos caixas

---

**Tempo total estimado:** 5-10 minutos
**Complexidade:** Baixa
**Risco:** Baixo (migration é idempotente, pode executar múltiplas vezes)
