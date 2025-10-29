# ANÁLISE COMPLETA: SISTEMA DE CAPACITAÇÕES NA GESTÃO DE ESCALAS

**Data da Análise:** 2025-10-28  
**Codebase:** admin-cesca  
**Foco:** Capacitações (Qualifications) na Gestão de Escalas  

---

## 1. VISÃO GERAL

O sistema de **capacitações** é um componente fundamental do módulo de Gestão de Escalas que controla em quais tipos de atendimento cada trabalhador está capacitado para atuar. É o alicerce do algoritmo de geração automática de escalas.

### 1.1 Definição
- **Capacitação**: Uma qualificação/competência que permite que um trabalhador execute um determinado tipo de atendimento
- **Exemplo**: Um trabalhador "João" tem capacitação para "Psicografia" e "Acolhimento espiritual"
- **Uso**: O gerador de escalas filtra candidatos apenas entre trabalhadores com capacitação

---

## 2. DEFINIÇÃO E ARMAZENAMENTO

### 2.1 Tabela Principal: `trabalhadores_capacitacoes`

**Localização:** `/root/admin-cesca/supabase-escalas-schema.sql` (Linhas 35-60)

```sql
CREATE TABLE IF NOT EXISTS trabalhadores_capacitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  nivel_experiencia TEXT DEFAULT 'intermediario', -- iniciante, intermediario, experiente
  preferencia_prioridade INTEGER DEFAULT 1, -- 1=alta, 2=média, 3=baixa
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(trabalhador_id, tipo_atendimento_id)
);
```

**Campos:**
| Campo | Tipo | Descrição | Observações |
|-------|------|-----------|-------------|
| `id` | UUID | Identificador único | Primary Key |
| `trabalhador_id` | UUID | Referência ao trabalhador | FK para `trabalhadores(id)` |
| `tipo_atendimento_id` | UUID | Referência ao tipo de atendimento | FK para `tipos_atendimento(id)` |
| `nivel_experiencia` | TEXT | Nível de experiência | 'iniciante', 'intermediario', 'experiente' |
| `preferencia_prioridade` | INTEGER | Prioridade de alocação | 1=alta, 2=média, 3=baixa |
| `observacoes` | TEXT | Campo livre para observações | Opcional |
| `created_at` | TIMESTAMP | Data de criação | Automático |
| `updated_at` | TIMESTAMP | Data de atualização | Automático |

**Constraints:**
- Chave primária: `id`
- Chave estrangeira: `trabalhador_id` → `trabalhadores(id)` (DELETE CASCADE)
- Chave estrangeira: `tipo_atendimento_id` → `tipos_atendimento(id)` (DELETE CASCADE)
- **Uniqueness**: (trabalhador_id, tipo_atendimento_id) - não há duplicatas

**Índices:**
```sql
CREATE INDEX idx_trabalhadores_capacitacoes_trabalhador 
  ON trabalhadores_capacitacoes(trabalhador_id);
CREATE INDEX idx_trabalhadores_capacitacoes_tipo 
  ON trabalhadores_capacitacoes(tipo_atendimento_id);
CREATE INDEX idx_trabalhadores_capacitacoes_prioridade 
  ON trabalhadores_capacitacoes(preferencia_prioridade);
```

### 2.2 Tabela Relacionada: `tipos_atendimento`

**Localização:** `/root/admin-cesca/supabase-escalas-schema.sql` (Linhas 13-24)

Define os tipos de atendimento que existem no sistema:

```sql
CREATE TABLE IF NOT EXISTS tipos_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  qtd_pessoas_necessarias INTEGER NOT NULL,
  dias_funcionamento TEXT[] DEFAULT ARRAY['segunda', 'sexta'],
  cor_destaque TEXT DEFAULT '#667eea',
  ativo BOOLEAN DEFAULT true,
  ordem_exibicao INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Tipos de Atendimento Pré-configurados (Seed Data):**
1. Acolhimento espiritual (6 pessoas)
2. Psicografia (2 pessoas)
3. Sala de tratamento (2 pessoas)
4. Baralho (3 pessoas) - Fábia é fixa todas as sextas
5. Portal de Obaluaê (1 pessoa)
6. Coordenação da desobsessão (1 pessoa)

### 2.3 Tabela Relacionada: `trabalhadores`

**Localização:** `/root/admin-cesca/supabase-presenca-schema.sql`

Armazena dados dos trabalhadores (workers):

```sql
CREATE TABLE IF NOT EXISTS trabalhadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. COMPONENTE UI: CapacitacoesManager

### 3.1 Arquivo Principal

**Localização:** `/root/admin-cesca/src/components/escalas/CapacitacoesManager.js`

**Propósito:** Gerenciar (criar, editar, deletar) as capacitações dos trabalhadores

### 3.2 Estrutura do Componente

```
CapacitacoesManager
├── Header (Título + Ícone Award)
├── Search Container (Busca por nome de trabalhador)
├── Trabalhadores List
│   └── Trabalhador Card (para cada trabalhador ativo)
│       ├── Avatar
│       ├── Nome + Função
│       ├── Badges (capacitações atuais)
│       └── Botão "Editar"
└── Modal de Edição
    ├── Título com nome do trabalhador
    ├── Checkboxes para cada tipo de atendimento
    └── Botões: Cancelar / Salvar
```

### 3.3 Estados (useState)

```javascript
const [trabalhadores, setTrabalhadores] = useState([]); // Lista de trabalhadores ativos
const [tiposAtendimento, setTiposAtendimento] = useState([]); // Tipos disponíveis
const [capacitacoes, setCapacitacoes] = useState([]); // Capacitações atuais
const [loading, setLoading] = useState(true); // Loading state
const [searchTerm, setSearchTerm] = useState(''); // Termo de busca
const [showModal, setShowModal] = useState(false); // Mostrar modal
const [selectedTrabalhador, setSelectedTrabalhador] = useState(null); // Trabalhador em edição
const [selectedTipos, setSelectedTipos] = useState([]); // Tipos selecionados no modal
```

### 3.4 Principais Funções

#### fetchData()
- Carrega trabalhadores ativos
- Carrega tipos de atendimento ativos
- Carrega capacitações existentes
- Chamada via useEffect ao montar componente

#### getCapacitacoesTrabalhador(trabalhadorId)
```javascript
return capacitacoes
  .filter(c => c.trabalhador_id === trabalhadorId)
  .map(c => c.tipo_atendimento_id);
```
Retorna array de IDs dos tipos que o trabalhador tem capacitação

#### handleEditCapacitacoes(trabalhador)
- Abre modal de edição
- Popula selectedTipos com capacitações atuais

#### toggleTipo(tipoId)
- Alterna seleção de um tipo (adiciona/remove do array)

#### handleSave()
**Lógica importante:**
1. Calcula tipos a adicionar (em selectedTipos mas não em atuais)
2. Calcula tipos a remover (em atuais mas não em selectedTipos)
3. Insere novos registros na tabela
4. Deleta registros removidos
5. Recarrega dados

```javascript
// Tipos a adicionar
const tiposAdicionar = selectedTipos.filter(t => !capacitacoesAtuais.includes(t));

// Tipos a remover
const tiposRemover = capacitacoesAtuais.filter(t => !selectedTipos.includes(t));

// Inserir
if (tiposAdicionar.length > 0) {
  const novasCapacitacoes = tiposAdicionar.map(tipoId => ({
    trabalhador_id: trabalhadorId,
    tipo_atendimento_id: tipoId
  }));
  await supabase.from('trabalhadores_capacitacoes').insert(novasCapacitacoes);
}

// Deletar
if (tiposRemover.length > 0) {
  await supabase
    .from('trabalhadores_capacitacoes')
    .delete()
    .eq('trabalhador_id', trabalhadorId)
    .in('tipo_atendimento_id', tiposRemover);
}
```

### 3.5 Interface do Usuário

**Localização CSS:** `/root/admin-cesca/src/components/escalas/CapacitacoesManager.css`

Elementos visuais:
- **Header**: Ícone Award (dourado #f59e0b) + título
- **Search**: Campo de busca com ícone e botão limpar
- **Cards**: Branco, border 1px #e5e7eb, hover com sombra
- **Badges**: Verde (#10b981), mostram capacitações atuais
- **Checkboxes**: Customizadas com accent-color dourado
- **Modal**: Overlay escuro 50%, conteúdo branco, scroll se necessário

---

## 4. USO EM GERAÇÃO DE ESCALAS

### 4.1 Fluxo na Geração Automática

**Arquivo:** `/root/admin-cesca/src/components/escalas/utils/algoritmoEscalas.js`

#### 4.1.1 Função: obterTrabalhadoresCapacitados()

```javascript
function obterTrabalhadoresCapacitados(tipoAtendimentoId, trabalhadores, capacitacoes) {
  return trabalhadores.filter((trab) =>
    temCapacitacao(trab.id, tipoAtendimentoId, capacitacoes)
  );
}
```

**Propósito**: Filtra lista de trabalhadores para apenas aqueles com capacitação específica

**Fluxo:**
1. Recebe tipo de atendimento a ser preenchido
2. Filtra trabalhadores que têm essa capacitação
3. Retorna lista de candidatos válidos

#### 4.1.2 Função: temCapacitacao()

**Arquivo:** `/root/admin-cesca/src/components/escalas/utils/detectorConflitos.js` (Linhas 75-84)

```javascript
export function temCapacitacao(trabalhadorId, tipoAtendimentoId, capacitacoes) {
  return capacitacoes.some(
    (cap) =>
      cap.trabalhador_id === trabalhadorId &&
      cap.tipo_atendimento_id === tipoAtendimentoId &&
      cap.ativo
  );
}
```

**Propósito**: Verifica se um trabalhador tem capacitação para um tipo

**Nota:** O código checa campo `cap.ativo`, mas a tabela não tem esse campo. 
**⚠️ POSSÍVEL BUG**: Se alguma capacitação estiver marcada como inativa, essa verificação não funcionará.

### 4.1.3 Integração no GeradorEscalas

**Arquivo:** `/root/admin-cesca/src/components/escalas/GeradorEscalas.js` (Linhas 68-93)

```javascript
// 1. Carregar capacitações do banco
const { data: caps, error: erroCaps } = await supabase
  .from('trabalhadores_capacitacoes')
  .select('*');

// 2. Passar para função de geração
const resultado = gerarEscalasAutomaticas(
  anoSelecionado,
  mesSelecionado,
  tiposAtendimento,
  trabalhadores,
  capacitacoes,  // <-- Aqui
  funcoesFixas,
  restricoes
);
```

### 4.1.4 Processo de Seleção de Trabalhador

**Arquivo:** `/root/admin-cesca/src/components/escalas/utils/algoritmoEscalas.js` (Linhas 206-248)

```javascript
// ETAPA 2: Alocação automática (sem função fixa)
const candidatos = obterTrabalhadoresCapacitados(tipo.id, trabalhadores, capacitacoes);

if (candidatos.length === 0) {
  erros.push(`Nenhum trabalhador capacitado para ${tipo.nome} em ${data}`);
  return;
}

const selecionado = selecionarMelhorTrabalhador(
  candidatos,  // <-- Aqui, só entram capacitados
  data,
  tipo,
  escalasGeradas,
  restricoes,
  cargaTrabalho
);
```

**Critérios de Seleção:**
1. ✅ Ter capacitação para o tipo
2. ✅ Não ter restrição na data
3. ✅ Não ter conflito de horário
4. ✅ Menor carga de trabalho (load balancing)

---

## 5. ESTRUTURA DE DADOS E RELACIONAMENTOS

### 5.1 Diagrama de Relacionamentos

```
┌──────────────────────┐
│   trabalhadores      │
│                      │
│ id (PK)              │
│ nome_completo        │
│ telefone             │
│ email                │
│ status (ativo/...)   │
└──────────┬───────────┘
           │
           │ 1:N (via FK)
           │
           ▼
┌──────────────────────────────────────┐
│ trabalhadores_capacitacoes           │ ◄─── TABELA CENTRAL
│                                      │
│ id (PK)                              │
│ trabalhador_id (FK) ─────┐           │
│ tipo_atendimento_id (FK) │           │
│ nivel_experiencia        │           │
│ preferencia_prioridade   │           │
│ observacoes              │           │
│ UNIQUE(trab_id, tipo_id) │           │
└──────────────────────────┼───────────┘
           │                │
           │                │ N:1 (via FK)
           │                │
           ▼                ▼
        ┌──────────────────────────┐
        │   tipos_atendimento      │
        │                          │
        │ id (PK)                  │
        │ nome (UNIQUE)            │
        │ qtd_pessoas_necessarias  │
        │ dias_funcionamento       │
        │ cor_destaque             │
        │ ativo                    │
        └──────────────────────────┘
```

### 5.2 Cardinalidade

- **trabalhadores : trabalhadores_capacitacoes = 1:N**
  - Um trabalhador pode ter múltiplas capacitações
  - Exemplo: João tem capacitação para Psicografia, Acolhimento, Baralho

- **tipos_atendimento : trabalhadores_capacitacoes = 1:N**
  - Um tipo de atendimento pode ser executado por múltiplos trabalhadores
  - Exemplo: Psicografia pode ter 10 trabalhadores capacitados

- **Constraint Único**: (trabalhador_id, tipo_atendimento_id)
  - Previne duplicatas
  - Um trabalhador só pode ter uma capacitação por tipo

---

## 6. COMPONENTES QUE USAM CAPACITAÇÕES

### 6.1 Componentes Principais

| Componente | Arquivo | Função | Usa Capacitações |
|-----------|---------|--------|-----------------|
| **CapacitacoesManager** | escalas/CapacitacoesManager.js | Edita capacitações | ✅ CRUD |
| **GeradorEscalas** | escalas/GeradorEscalas.js | Gera escalas automáticas | ✅ Lê para validar |
| **PainelRevisao** | escalas/PainelRevisao.js | Revisa escalas geradas | ✅ Lê para validar |
| **SubstituicoesManager** | escalas/SubstituicoesManager.js | Gerencia trocas | ✅ Lê para validar |
| **DetectorConflitos** | escalas/utils/detectorConflitos.js | Detecta conflitos | ✅ temCapacitacao() |
| **AlgoritmoEscalas** | escalas/utils/algoritmoEscalas.js | Algoritmo de alocação | ✅ obterTrabalhadoresCapacitados() |

### 6.2 EscalasManager (Hub Central)

**Arquivo:** `/root/admin-cesca/src/components/escalas/EscalasManager.js`

Tabs navegáveis:
```javascript
const tabs = [
  { id: 'gerador', label: 'Gerar Escalas', ... },
  { id: 'revisao', label: 'Revisar Escalas', ... },
  { id: 'tipos', label: 'Tipos de Atendimento', ... },
  { id: 'capacitacoes', label: 'Capacitações', ... },  // <-- Aqui
  { id: 'funcoes', label: 'Funções Fixas', ... },
  { id: 'restricoes', label: 'Restrições', ... },
  { id: 'substituicoes', label: 'Substituições', ... },
];
```

---

## 7. FLUXO DE DADOS COMPLETO

### 7.1 Criação de Capacitação

```
1. Admin abre CapacitacoesManager
   │
   ├─► fetchData()
   │   ├─ Carrega trabalhadores (status='ativo')
   │   ├─ Carrega tipos_atendimento (ativo=true)
   │   └─ Carrega trabalhadores_capacitacoes
   │
2. Admin clica "Editar" em um trabalhador
   │
   ├─► handleEditCapacitacoes(trabalhador)
   │   ├─ getCapacitacoesTrabalhador() → array de IDs atuais
   │   └─ Abre modal com checkboxes
   │
3. Admin marca checkboxes e clica "Salvar"
   │
   ├─► handleSave()
   │   ├─ Calcula tiposAdicionar (novos)
   │   ├─ Calcula tiposRemover (deletados)
   │   │
   │   ├─► INSERT: novas capacitações
   │   │   INSERT INTO trabalhadores_capacitacoes
   │   │   (trabalhador_id, tipo_atendimento_id)
   │   │   VALUES (...)
   │   │
   │   ├─► DELETE: capacitações removidas
   │   │   DELETE FROM trabalhadores_capacitacoes
   │   │   WHERE trabalhador_id=? AND tipo_atendimento_id IN (...)
   │   │
   │   ├─ fetchData() ← Recarrega
   │   └─ showToast.success()
```

### 7.2 Uso em Geração de Escalas

```
1. Admin abre GeradorEscalas
   │
   ├─► loadDados()
   │   ├─ Carrega tipos_atendimento
   │   ├─ Carrega trabalhadores
   │   ├─ Carrega trabalhadores_capacitacoes ◄─── AQUI
   │   ├─ Carrega funcoes_fixas
   │   └─ Carrega restricoes_datas
   │
2. Admin seleciona mês/ano e clica "Gerar Escalas"
   │
   ├─► gerarEscalasAutomaticas()
   │   │
   │   ├─ Para cada (data, tipo_atendimento)
   │   │   │
   │   │   ├─ obterTrabalhadoresCapacitados()
   │   │   │   └─ Filtra: temCapacitacao(trab_id, tipo_id) ◄─── AQUI
   │   │   │
   │   │   ├─ selecionarMelhorTrabalhador()
   │   │   │   ├─ Verifica restrições
   │   │   │   ├─ Detecta conflitos
   │   │   │   └─ Ordena por carga
   │   │   │
   │   │   └─ Aloca trabalhador na escala
   │   │
   │   └─ Retorna resultado com escalas, avisos, erros
   │
3. Admin revisa e clica "Salvar Escalas"
   │
   └─► Insere em escalas_mensais e escalas_detalhes
```

---

## 8. SEGURANÇA - ROW LEVEL SECURITY (RLS)

### 8.1 Política RLS para trabalhadores_capacitacoes

**Arquivo:** `/root/admin-cesca/supabase-escalas-schema.sql` (Linhas 411-412)

```sql
CREATE POLICY "Admins acesso total trabalhadores_capacitacoes" 
  ON trabalhadores_capacitacoes 
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND is_admin = true
  ));
```

**Implementação:**
- Apenas admins (is_admin = true) podem acessar
- Todos os operações: SELECT, INSERT, UPDATE, DELETE
- Verificação: `auth.uid()` deve estar em profiles com is_admin = true

---

## 9. ISSUES E LIMITAÇÕES IDENTIFICADAS

### 9.1 BUG POTENCIAL: Campo 'ativo' em temCapacitacao()

**Severidade**: 🔴 CRÍTICO

**Localização**: `/root/admin-cesca/src/components/escalas/utils/detectorConflitos.js` (Linha 82)

```javascript
export function temCapacitacao(trabalhadorId, tipoAtendimentoId, capacitacoes) {
  return capacitacoes.some(
    (cap) =>
      cap.trabalhador_id === trabalhadorId &&
      cap.tipo_atendimento_id === tipoAtendimentoId &&
      cap.ativo  // ◄─── ESTE CAMPO NÃO EXISTE NA TABELA!
  );
}
```

**Problema:**
- A tabela `trabalhadores_capacitacoes` NÃO tem campo `ativo`
- Esta verificação sempre retorna `undefined`
- Funciona por acaso porque `undefined && ... ` = false, mas não é intencional

**Impacto:**
- Capacitações nunca são verdadeiramente "desativadas"
- Sistema não pode desativar capacitação sem deletar registro
- Sem histórico de capacitações inativas

**Solução Recomendada:**
1. Adicionar coluna `ativo BOOLEAN DEFAULT true` à tabela
2. Alterar migrations
3. Atualizar verificação

**Alternativa:**
- Remover verificação de `ativo` se não é necessário histórico
- Simplesmente deletar o registro

### 9.2 LIMITATION: Prioridade Não Implementada

**Severidade**: 🟡 MÉDIO

**Campo na Tabela:**
```sql
preferencia_prioridade INTEGER DEFAULT 1, -- 1=alta, 2=média, 3=baixa
```

**Problema:**
- Campo existe no banco mas não é usado em lugar nenhum
- Algoritmo de seleção só usa carga de trabalho (load balancing)
- Admin não pode indicar preferências

**Impacto:**
- Não há forma de priorizar alocação de certos trabalhadores
- Trabalhadores experientes não são preferidos
- Novatos podem ser alocados em lugar de especialistas

**Solução Recomendada:**
- Implementar sistema de scoring em `selecionarMelhorTrabalhador()`
- Score = (inverso_carga × peso_carga) + (nivel_experiencia × peso_exp) + (prioridade × peso_prior)

### 9.3 LIMITATION: Nível de Experiência Não Implementado

**Severidade**: 🟡 MÉDIO

**Campo na Tabela:**
```sql
nivel_experiencia TEXT DEFAULT 'intermediario', -- iniciante, intermediario, experiente
```

**Problema:**
- Campo não é usado no algoritmo
- UI não permite editar nível
- Não afeta alocação

**Impacto:**
- Impossível garantir que tipos críticos tenham especialistas
- Sem rastreamento de desenvolvimento de skills

### 9.4 NO SOFT DELETE

**Severidade**: 🟡 MÉDIO

**Problema:**
- Quando capacitação é removida, registro é DELETADO
- Sem histórico ou auditoria
- Sem como reverter acidental

**Impacto:**
- Perda de dados
- Sem rastreamento de mudanças
- Admin não pode desfazer acidentalmente

**Solução Recomendada:**
- Implementar soft delete com campo `deleted_at`
- Atualizar constraint UNIQUE para incluir `deleted_at IS NULL`
- Adicionar audit log

### 9.5 SEM VALIDAÇÃO DE RESTRIÇÕES CIRCULARES

**Severidade**: 🟢 BAIXO

**Problema:**
- Sistema não garante que nenhum tipo de atendimento fica sem capacitados
- Não avisa se última capacitação é removida

**Impacto:**
- Gerador de escalas gera erros sem avisar admin previamente
- Admin descobre depois de gerar

**Solução Recomendada:**
- Antes de salvar, verificar: `SELECT COUNT(DISTINCT trabalhador_id) FROM capacitacoes WHERE tipo_id = ?`
- Se = 0, exibir warning

### 9.6 HORÁRIOS NÃO ESTÃO NA TABELA

**Severidade**: 🟡 MÉDIO

**Observação:**
- Tabela `tipos_atendimento` tem campos `horario_inicio` e `horario_fim` no código
- Mas esses campos NÃO estão definidos no schema SQL

**Localização do Problema:**
```javascript
// algoritmoEscalas.js linha 78-79
tipoAtendimento.horario_inicio,
tipoAtendimento.horario_fim,
```

**Schema Real:**
```sql
CREATE TABLE IF NOT EXISTS tipos_atendimento (
  id UUID,
  nome TEXT,
  descricao TEXT,
  qtd_pessoas_necessarias INTEGER,
  dias_funcionamento TEXT[],
  cor_destaque TEXT,
  ativo BOOLEAN,
  ordem_exibicao INTEGER,
  -- ❌ SEM horario_inicio/horario_fim
)
```

**Impacto:**
- Código tenta acessar propriedades que não existem
- Detecção de conflito de horário não funciona
- Sistema acha que sempre há conflito (undefined < undefined = false)

**Solução Recomendada:**
- Adicionar campos `horario_inicio` e `horario_fim` ao schema
- Ou remover lógica de detecção de conflito

---

## 10. VIEWS (RELATÓRIOS)

### 10.1 Vista: vw_resumo_participacao_trabalhadores

**Arquivo:** `/root/admin-cesca/supabase-escalas-schema.sql` (Linhas 240-299)

```sql
SELECT
  ...
  COUNT(DISTINCT tc.tipo_atendimento_id) as qtd_capacitacoes
FROM trabalhadores t
LEFT JOIN trabalhadores_capacitacoes tc ON tc.trabalhador_id = t.id
```

**Inclui:**
- Quantas capacitações cada trabalhador tem
- Comparação com escalas, presenças, substituições

**Uso**: Relatórios de participação e capacidade

---

## 11. TRIGGERS

### 11.1 Trigger: update_trabalhadores_capacitacoes_updated_at

**Arquivo:** `/root/admin-cesca/supabase-escalas-schema.sql` (Linhas 358-361)

```sql
CREATE TRIGGER update_trabalhadores_capacitacoes_updated_at
  BEFORE UPDATE ON trabalhadores_capacitacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
```

**Função:** Atualiza timestamp `updated_at` automaticamente quando há UPDATE

---

## 12. RESUMO DE ARQUIVOS

| Arquivo | Tipo | Função | Linhas |
|---------|------|--------|--------|
| supabase-escalas-schema.sql | Schema | Define tabela e constraints | 35-60 |
| CapacitacoesManager.js | React Component | UI principal de edição | 316 |
| CapacitacoesManager.css | Stylesheet | Estilos | 447 |
| algoritmoEscalas.js | Utility | Algoritmo de geração | 295 |
| detectorConflitos.js | Utility | Validações e detecção | 153 |
| GeradorEscalas.js | React Component | Orquestra geração | 416 |
| EscalasManager.js | React Component | Hub de navegação | 113 |
| PainelRevisao.js | React Component | Revisão de escalas | ~200 |
| SubstituicoesManager.js | React Component | Gerencia substituições | ~200 |

---

## 13. FLUXO RECOMENDADO PARA IMPLEMENTAÇÃO DE MELHORIA

Se fosse implementar suporte melhor a capacitações, a ordem seria:

1. ✅ **Adicionar campo `ativo` na tabela** (schema fix)
2. ✅ **Adicionar campos `horario_inicio/fim` em tipos_atendimento** (schema fix)
3. ✅ **Corrigir `temCapacitacao()` para usar campo `ativo`** (bug fix)
4. ✅ **Implementar soft delete com `deleted_at`** (data integrity)
5. ✅ **UI para editar `nivel_experiencia` e `preferencia_prioridade`** (feature)
6. ✅ **Algoritmo considerar nível e prioridade** (algorithm enhancement)
7. ✅ **Validação: avisar se tipo fica sem capacitados** (UX improvement)
8. ✅ **Audit log de mudanças** (compliance)

---

## 14. QUESTÕES RESPONDIDAS

### P1: Onde são capacitações definidas e armazenadas?
**R:** Tabela `trabalhadores_capacitacoes` no Supabase/PostgreSQL, com campos:
- trabalhador_id, tipo_atendimento_id, nivel_experiencia, preferencia_prioridade
- Constraint UNIQUE garante 1:1 por trabalho-tipo

### P2: Como são usadas na geração de escalas?
**R:** 
1. Carregadas ao iniciar gerador
2. Passadas a `gerarEscalasAutomaticas()`
3. Filtram candidatos via `obterTrabalhadoresCapacitados()`
4. `temCapacitacao()` verifica se trabalhador pode fazer tipo

### P3: Componentes da UI?
**R:** Principal é CapacitacoesManager, com:
- Lista de trabalhadores + busca
- Cards com capacitações atuais
- Modal para editar checkboxes
- Botões CRUD automáticos

### P4: Data structure e relationships?
**R:**
- 1:N trabalho ↔ capacitações
- 1:N tipo_atendimento ↔ capacitações
- PK: id (UUID)
- FK: trabalhador_id, tipo_atendimento_id
- Unique: (trabalhador_id, tipo_atendimento_id)

---

## 15. CONCLUSÃO

O sistema de capacitações é **bem estruturado** mas tem alguns **bugs menores** e **features não implementadas**. 

**Pontos Fortes:**
- ✅ Schema normalizado com constraints apropriados
- ✅ Component bem organizado e reutilizável  
- ✅ Integração perfeita com algoritmo
- ✅ RLS seguro

**Pontos Fracos:**
- ❌ Campo `ativo` não implementado (bug)
- ❌ Horários não estão em tipos_atendimento
- ❌ Prioridade e experiência não utilizados
- ❌ Sem soft delete ou audit
- ❌ Sem validações de estado final

**Recomendação:**
Investir em fixes de bugs críticos e então em features de priorização.

