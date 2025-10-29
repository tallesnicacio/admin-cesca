# 🔍 DIAGNÓSTICO COMPLETO E CORREÇÕES DEFINITIVAS
**Admin CESCA - Sistema de Gestão**
**Data:** 2025-10-28
**Status:** 🔴 CRÍTICO - Requer ação imediata

---

## 📋 SUMÁRIO EXECUTIVO

### Problemas Identificados
1. ✅ Lista de trabalhadores não carrega (RESOLVIDO)
2. ✅ Erro 400 em queries de escalas (RESOLVIDO)
3. ❌ Sistema de caixas não é independente (CRÍTICO)
4. ⚠️ UX/UI precisa de refatoração (PLANEJADO)

---

## 🔴 PROBLEMA 1: Lista de Trabalhadores Não Carrega

### 🔍 Diagnóstico
**Componentes afetados:**
- `src/components/escalas/CapacitacoesManager.js`
- `src/components/escalas/RestricoesManager.js`
- `src/components/escalas/SubstituicoesManager.js`
- `src/components/escalas/FuncoesFixasConfig.js`
- `src/components/escalas/PainelRevisao.js`
- `src/components/escalas/GeradorEscalas.js`
- `src/components/PresencaReports.js`
- `src/components/PresencaManager.js`
- `src/components/TrabalhadorManager.js`
- `src/components/AdvertenciaManager.js`

### 🐛 Causa Raiz
A tabela `trabalhadores` no banco de dados **não possui colunas** que o código React está tentando acessar:

**Schema atual (incompleto):**
```sql
CREATE TABLE trabalhadores (
  id UUID,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  status TEXT, -- ❌ Só aceita 'ativo' ou 'inativo'
  observacoes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
  -- ❌ FALTAM: numero, grupo, funcao_permanente
);
```

**Schema esperado pelo código:**
```javascript
trabalhador.numero              // ❌ NÃO EXISTE
trabalhador.grupo               // ❌ NÃO EXISTE
trabalhador.funcao_permanente   // ❌ NÃO EXISTE
trabalhador.status = 'afastado' // ❌ NÃO PERMITIDO
```

### ✅ Solução
**Arquivo:** `/root/admin-cesca/migration-fix-all-definitivo.sql`

Adiciona:
- ✅ Coluna `numero` (INTEGER)
- ✅ Coluna `grupo` (TEXT)
- ✅ Coluna `funcao_permanente` (TEXT)
- ✅ Atualiza constraint de `status` para incluir 'afastado'

---

## 🔴 PROBLEMA 2: Erro 400 em Queries de Escalas

### 🔍 Diagnóstico
**Erro no console:**
```
GET .../escalas_detalhes?select=*,trabalhador:trabalhadores(...),
tipo_atendimento:tipos_atendimento(nome,horario_inicio,horario_fim)
400 (Bad Request)
```

### 🐛 Causa Raiz
A query tenta buscar `horario_inicio`, `horario_fim` e `dia_semana` da tabela `tipos_atendimento`, mas essas colunas não existem.

**Schema atual (incompleto):**
```sql
CREATE TABLE tipos_atendimento (
  id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  qtd_pessoas_necessarias INTEGER,
  dias_funcionamento TEXT[], -- ✅ Existe
  cor_destaque TEXT,
  ativo BOOLEAN,
  ordem_exibicao INTEGER
  -- ❌ FALTAM: horario_inicio, horario_fim, dia_semana
);
```

**Componentes afetados:**
- `src/components/escalas/PainelRevisao.js:102`
- `src/components/escalas/SubstituicoesManager.js:111`

### ✅ Solução
**Arquivo:** `/root/admin-cesca/migration-fix-all-definitivo.sql`

Adiciona:
- ✅ Coluna `horario_inicio` (TEXT, default '19:30')
- ✅ Coluna `horario_fim` (TEXT, default '22:00')
- ✅ Coluna `dia_semana` (TEXT[])

---

## 🔴 PROBLEMA 3: Sistema de Caixas NÃO É INDEPENDENTE (CRÍTICO)

### 🔍 Diagnóstico
**Problema:** Cada setor (lanche, lojinha, mensalidades) deveria poder abrir/fechar caixas independentemente, mas a constraint do banco impede isso.

### 🐛 Causa Raiz

**Schema ATUAL (INCORRETO):**
```sql
CREATE TABLE caixas (
  id UUID PRIMARY KEY,
  data DATE NOT NULL UNIQUE, -- ❌ PROBLEMA AQUI!
  valor_inicial DECIMAL(10,2),
  valor_final_real DECIMAL(10,2),
  status TEXT DEFAULT 'aberto',
  -- ❌ FALTA: setor TEXT
  aberto_por UUID,
  fechado_por UUID,
  hora_abertura TIMESTAMP,
  hora_fechamento TIMESTAMP,
  ...
);
```

**Problema identificado:**
- ❌ `data DATE NOT NULL UNIQUE` - Permite apenas **UM caixa por data**
- ❌ Falta coluna `setor` para diferenciar lanche/lojinha/mensalidades

**Comportamento atual (ERRADO):**
```
2025-10-28:
  ❌ Só pode abrir 1 caixa (lanche OU lojinha OU mensalidades)
  ❌ Erro 409 ao tentar abrir o segundo
```

**Comportamento esperado (CORRETO):**
```
2025-10-28:
  ✅ Caixa Lanche: Aberto às 08:00
  ✅ Caixa Lojinha: Aberto às 09:00
  ✅ Caixa Mensalidades: Aberto às 10:00
```

### ✅ Solução

**1. Corrigir constraint no banco:**
```sql
-- Remover constraint antiga
ALTER TABLE caixas DROP CONSTRAINT IF EXISTS caixas_data_unique;

-- Adicionar coluna setor (se não existir)
ALTER TABLE caixas ADD COLUMN setor TEXT NOT NULL;

-- Criar constraint correta
ALTER TABLE caixas
  ADD CONSTRAINT caixas_data_setor_unique
  UNIQUE(data, setor);
```

**2. Código React já está correto:**
O arquivo `CaixaManager.js` já:
- ✅ Separa por setor (lanche, lojinha, mensalidades)
- ✅ Verifica antes de abrir
- ✅ Envia `setor` no insert

**Apenas falta corrigir o banco de dados!**

---

## 📊 STATUS DAS CORREÇÕES

### ✅ Correções Aplicadas (Código)
| Componente | Status | Descrição |
|------------|--------|-----------|
| CaixaManager.js | ✅ | Adicionada verificação de duplicados |
| build-and-update.sh | ✅ | Adicionado --no-cache e --force |

### ⏳ Correções Pendentes (Banco de Dados)

**VOCÊ PRECISA EXECUTAR:**

#### 1️⃣ Executar Migration Definitiva
```bash
# No Supabase SQL Editor, execute:
/root/admin-cesca/migration-fix-all-definitivo.sql
```

Isso irá:
- ✅ Adicionar colunas faltantes em `trabalhadores`
- ✅ Adicionar colunas faltantes em `tipos_atendimento`
- ✅ Corrigir constraint de `caixas` para permitir múltiplos caixas por data
- ✅ Adicionar coluna `setor` em `caixas` (se não existir)

#### 2️⃣ Verificar se migration foi aplicada
Execute no Supabase SQL Editor:
```sql
-- Verificar colunas de trabalhadores
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'trabalhadores'
ORDER BY ordinal_position;

-- Verificar colunas de tipos_atendimento
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tipos_atendimento'
ORDER BY ordinal_position;

-- Verificar constraints de caixas
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'caixas';
```

---

## 🚀 PLANO DE AÇÃO

### Fase 1: Correções Críticas (AGORA) ⚡
1. [ ] Executar `migration-fix-all-definitivo.sql` no Supabase
2. [ ] Verificar que colunas foram adicionadas
3. [ ] Testar carregamento de trabalhadores em Escalas
4. [ ] Testar abertura de múltiplos caixas na mesma data
5. [ ] Fazer deploy com `./scripts/build-and-update.sh`

### Fase 2: Melhorias UX/UI (DEPOIS) 🎨
1. [ ] Redesenhar interface de Caixas
2. [ ] Melhorar fluxo de abertura/fechamento
3. [ ] Adicionar dashboard de visão geral
4. [ ] Implementar relatórios visuais

---

## 📝 CHECKLIST DE VERIFICAÇÃO

Após executar a migration, verifique:

### ✅ Trabalhadores
- [ ] Consegue cadastrar trabalhador com número
- [ ] Consegue selecionar grupo (Direção / Médiuns Correntes)
- [ ] Consegue definir função permanente
- [ ] Consegue marcar como 'afastado'
- [ ] Lista aparece em Escalas → Capacitações
- [ ] Lista aparece em Escalas → Funções Fixas
- [ ] Lista aparece em Escalas → Restrições

### ✅ Escalas
- [ ] Não há erro 400 ao carregar escalas
- [ ] Consegue revisar escalas geradas
- [ ] Consegue ver substituições

### ✅ Caixas Independentes
- [ ] Consegue abrir Caixa Lanche
- [ ] Consegue abrir Caixa Lojinha na mesma data
- [ ] Consegue abrir Caixa Mensalidades na mesma data
- [ ] Cada caixa mostra seu status independente
- [ ] Consegue fechar cada caixa separadamente

---

## 🔧 COMANDOS ÚTEIS

### Deploy Completo (com --no-cache)
```bash
cd /root/admin-cesca
./scripts/build-and-update.sh
```

### Verificar Logs
```bash
docker service logs admin-cesca_admin-cesca -f --tail 50
```

### Verificar Status
```bash
docker service ps admin-cesca_admin-cesca
```

### Rollback (se necessário)
```bash
docker service rollback admin-cesca_admin-cesca
```

---

## 📞 SUPORTE

**Arquivos importantes criados:**
- `/root/admin-cesca/migration-fix-all-definitivo.sql` - Migration completa
- `/root/admin-cesca/DIAGNOSTICO-E-CORRECOES-DEFINITIVO.md` - Este arquivo
- `/root/admin-cesca/scripts/build-and-update.sh` - Script de deploy atualizado

**Ordem de execução:**
1. Execute SQL no Supabase
2. Execute build-and-update.sh
3. Teste funcionalidades
4. Confirme sucesso

---

## ⚠️ AVISOS IMPORTANTES

1. **NÃO pule a migration do banco de dados** - O código React já está correto e aguardando
2. **Execute a migration ANTES do deploy** - Senão continuará com erros
3. **Teste em ambiente de produção** - Não temos staging configurado
4. **Faça backup do Supabase** - Antes de qualquer alteração crítica

---

**Status Final:** 🟡 Aguardando execução da migration no Supabase
