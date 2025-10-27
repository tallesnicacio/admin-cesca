# PLANO DE IMPLEMENTAÇÃO COMPLETO - ADMIN CESCA
## Sistema de Gestão Integrado para Centro Espírita

**Data:** 2025-10-27
**Versão:** 1.0
**Status:** Em Planejamento

---

## 📋 ÍNDICE

1. [Análise do Sistema Atual](#1-análise-do-sistema-atual)
2. [Arquitetura Proposta](#2-arquitetura-proposta)
3. [Schema de Banco de Dados Completo](#3-schema-de-banco-de-dados-completo)
4. [Estrutura de Pastas e Código](#4-estrutura-de-pastas-e-código)
5. [Fases de Implementação](#5-fases-de-implementação)
6. [Desafios e Soluções](#6-desafios-e-soluções)
7. [Cronograma Estimado](#7-cronograma-estimado)

---

## 1. ANÁLISE DO SISTEMA ATUAL

### 1.1 Stack Tecnológica Atual
```yaml
Frontend:
  - React: 19.2.0
  - React Router DOM: 7.9.4
  - Supabase JS: 2.76.1
  - UI: Lucide Icons, React Hot Toast
  - Export: jsPDF, jspdf-autotable, XLSX

Backend:
  - Supabase (PostgreSQL + Auth + RLS)
  - Row Level Security habilitado

Build:
  - Create React App (React Scripts 5.0.1)
  - PM2 para produção
```

### 1.2 Módulos Já Implementados
✅ **UserManager** - Gestão de usuários/admins
✅ **TrabalhadorManager** - Gestão de trabalhadores
✅ **PresencaManager** - Registro de presença em giras
✅ **PresencaReports** - Relatórios de presença
✅ **AdvertenciaManager** - Sistema de advertências
✅ **AgendamentoManager** - Agendamentos de atendimento
✅ **Configuracoes** - Configurações do sistema
✅ **Reports** - Relatórios gerais

### 1.3 Padrões de Código Estabelecidos

**Estrutura de Componente Manager:**
```javascript
// 1. Imports (Supabase, Icons, Toast, Modais)
// 2. State (items, filtered, loading, modals)
// 3. useEffect (loadData, filterData)
// 4. loadData() - Fetch do Supabase
// 5. filterData() - Lógica de filtros
// 6. CRUD handlers (create, update, delete)
// 7. Modal handlers (open, close)
// 8. Render (Toaster + UI)
```

**Convenções:**
- PascalCase para arquivos de componente
- camelCase para variáveis e funções
- `handle[Action]` para event handlers
- `load[Entity]` para fetch functions
- RLS com verificação de `is_admin = true`

---

## 2. ARQUITETURA PROPOSTA

### 2.1 Visão Geral dos Módulos

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN CESCA SYSTEM                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   MÓDULO     │  │   MÓDULO     │  │   MÓDULO     │    │
│  │  FINANCEIRO  │  │   ESCALAS    │  │   ESTUDOS    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           MÓDULOS EXISTENTES                         │ │
│  │  UserManager | TrabalhadorManager | PresencaManager │ │
│  │  AgendamentoManager | AdvertenciaManager | Reports  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         CAMADA DE COMPONENTES COMPARTILHADOS         │ │
│  │  Modal | Input | Button | Card | Toast | Loading    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              SUPABASE (Backend)                      │ │
│  │  PostgreSQL | Row Level Security | Auth | Storage   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Arquitetura de Módulos

Cada módulo seguirá a estrutura:

```
Módulo/
├── [Modulo]Manager.js (Componente principal)
├── [Modulo]Manager.css (Estilos)
├── components/ (Componentes específicos, se necessário)
│   ├── [Feature]Form.js
│   ├── [Feature]List.js
│   └── [Feature]Detail.js
└── utils/ (Utilitários específicos)
    ├── validators.js
    ├── calculators.js
    └── formatters.js
```

### 2.3 Fluxo de Dados

```
┌──────────────┐
│  Componente  │
│   Manager    │
└──────┬───────┘
       │ loadData()
       ↓
┌──────────────┐
│   Supabase   │ ← RLS Policy (is_admin)
│   Cliente    │
└──────┬───────┘
       │
       ↓
┌──────────────┐
│  PostgreSQL  │
│   Database   │
└──────────────┘
```

---

## 3. SCHEMA DE BANCO DE DADOS COMPLETO

### 3.1 Módulo Financeiro - Tabelas

#### **alunos** - Cadastro de alunos
```sql
CREATE TABLE alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  data_nascimento DATE,
  endereco TEXT,
  status TEXT DEFAULT 'ativo', -- ativo, inativo, trancado
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alunos_nome ON alunos(nome_completo);
CREATE INDEX idx_alunos_status ON alunos(status);
CREATE INDEX idx_alunos_cpf ON alunos(cpf);
```

#### **cursos** - Cursos disponíveis
```sql
CREATE TABLE cursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  tipo TEXT NOT NULL, -- 'regular', 'avulso'
  valor_mensalidade DECIMAL(10,2) NOT NULL,
  dia_vencimento INTEGER DEFAULT 10, -- 1-31
  duracao_meses INTEGER, -- NULL para regulares, número para avulsos
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_curso CHECK (tipo IN ('regular', 'avulso')),
  CONSTRAINT check_dia_vencimento CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31)
);

CREATE INDEX idx_cursos_tipo ON cursos(tipo);
CREATE INDEX idx_cursos_ativo ON cursos(ativo);
```

#### **matriculas** - Matrícula de alunos em cursos
```sql
CREATE TABLE matriculas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  data_matricula DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio DATE NOT NULL,
  data_fim DATE, -- Para cursos avulsos
  dia_vencimento_personalizado INTEGER, -- Sobrescreve o padrão do curso
  status TEXT DEFAULT 'ativa', -- ativa, trancada, cancelada, concluida
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(aluno_id, curso_id, data_matricula),
  CONSTRAINT check_status_matricula CHECK (status IN ('ativa', 'trancada', 'cancelada', 'concluida'))
);

CREATE INDEX idx_matriculas_aluno ON matriculas(aluno_id);
CREATE INDEX idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX idx_matriculas_status ON matriculas(status);
CREATE INDEX idx_matriculas_data ON matriculas(data_inicio, data_fim);
```

#### **mensalidades** - Mensalidades geradas automaticamente
```sql
CREATE TABLE mensalidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  mes_referencia INTEGER NOT NULL, -- 1-12
  ano_referencia INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago DECIMAL(10,2),
  status TEXT DEFAULT 'pendente', -- pendente, pago, vencido, cancelado
  forma_pagamento TEXT, -- dinheiro, pix, cartao_debito, cartao_credito
  observacoes TEXT,
  gerado_automaticamente BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(matricula_id, mes_referencia, ano_referencia),
  CONSTRAINT check_mes_referencia CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  CONSTRAINT check_status_mensalidade CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado'))
);

CREATE INDEX idx_mensalidades_matricula ON mensalidades(matricula_id);
CREATE INDEX idx_mensalidades_status ON mensalidades(status);
CREATE INDEX idx_mensalidades_vencimento ON mensalidades(data_vencimento);
CREATE INDEX idx_mensalidades_referencia ON mensalidades(ano_referencia, mes_referencia);
```

#### **caixas** - Controle de caixa diário
```sql
CREATE TABLE caixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL UNIQUE,
  valor_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_final_esperado DECIMAL(10,2),
  valor_final_real DECIMAL(10,2),
  diferenca DECIMAL(10,2), -- Calculado: valor_final_real - valor_final_esperado
  status TEXT DEFAULT 'aberto', -- aberto, fechado
  aberto_por UUID REFERENCES profiles(id),
  fechado_por UUID REFERENCES profiles(id),
  hora_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hora_fechamento TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_caixa CHECK (status IN ('aberto', 'fechado'))
);

CREATE INDEX idx_caixas_data ON caixas(data DESC);
CREATE INDEX idx_caixas_status ON caixas(status);
```

#### **movimentacoes_caixa** - Movimentações do caixa
```sql
CREATE TABLE movimentacoes_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- entrada, saida
  setor TEXT NOT NULL, -- lanche, lojinha, mensalidades_cursos
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  forma_pagamento TEXT, -- dinheiro, pix, cartao_debito, cartao_credito
  mensalidade_id UUID REFERENCES mensalidades(id), -- Se for pagamento de mensalidade
  despesa_id UUID REFERENCES despesas(id), -- Se for pagamento de despesa
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_movimentacao CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT check_setor_movimentacao CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos'))
);

CREATE INDEX idx_movimentacoes_caixa ON movimentacoes_caixa(caixa_id);
CREATE INDEX idx_movimentacoes_tipo ON movimentacoes_caixa(tipo);
CREATE INDEX idx_movimentacoes_setor ON movimentacoes_caixa(setor);
CREATE INDEX idx_movimentacoes_data ON movimentacoes_caixa(created_at);
```

#### **despesas** - Registro de despesas
```sql
CREATE TABLE despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT, -- luz, agua, material, manutencao, compras_miudas, etc.
  valor DECIMAL(10,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_pagar', -- a_pagar, pago, vencido, cancelado
  forma_pagamento TEXT, -- dinheiro, pix, cartao_debito, cartao_credito, boleto
  comprovante_url TEXT, -- URL do arquivo no Supabase Storage
  observacoes TEXT,
  registrado_por UUID REFERENCES profiles(id),
  pago_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_despesa CHECK (status IN ('a_pagar', 'pago', 'vencido', 'cancelado'))
);

CREATE INDEX idx_despesas_fornecedor ON despesas(fornecedor);
CREATE INDEX idx_despesas_categoria ON despesas(categoria);
CREATE INDEX idx_despesas_status ON despesas(status);
CREATE INDEX idx_despesas_vencimento ON despesas(data_vencimento);
CREATE INDEX idx_despesas_data_emissao ON despesas(data_emissao);
```

#### **conciliacoes_bancarias** - Conciliação com extrato
```sql
CREATE TABLE conciliacoes_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_importacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  arquivo_nome TEXT,
  banco TEXT,
  periodo_inicio DATE,
  periodo_fim DATE,
  importado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conciliacoes_data ON conciliacoes_bancarias(data_importacao DESC);
CREATE INDEX idx_conciliacoes_periodo ON conciliacoes_bancarias(periodo_inicio, periodo_fim);
```

#### **transacoes_bancarias** - Transações importadas do banco
```sql
CREATE TABLE transacoes_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conciliacao_id UUID NOT NULL REFERENCES conciliacoes_bancarias(id) ON DELETE CASCADE,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  tipo TEXT NOT NULL, -- credito, debito
  saldo DECIMAL(10,2),
  conciliado BOOLEAN DEFAULT false,
  movimentacao_caixa_id UUID REFERENCES movimentacoes_caixa(id), -- Link se conciliado
  despesa_id UUID REFERENCES despesas(id), -- Link se conciliado com despesa
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_transacao CHECK (tipo IN ('credito', 'debito'))
);

CREATE INDEX idx_transacoes_conciliacao ON transacoes_bancarias(conciliacao_id);
CREATE INDEX idx_transacoes_data ON transacoes_bancarias(data_transacao);
CREATE INDEX idx_transacoes_conciliado ON transacoes_bancarias(conciliado);
```

### 3.2 Módulo de Escalas - Tabelas
> ✅ Já criado em `supabase-escalas-schema.sql`

Tabelas:
- `tipos_atendimento`
- `trabalhadores_capacitacoes`
- `funcoes_fixas`
- `restricoes_datas`
- `escalas_mensais`
- `escalas_detalhes`
- `presencas_escalas`
- `substituicoes`

### 3.3 Módulo de Estudos - Tabelas

#### **estudantes** - Link estudante-trabalhador
```sql
CREATE TABLE estudantes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID UNIQUE REFERENCES trabalhadores(id) ON DELETE CASCADE,
  nivel_atual TEXT DEFAULT 'iniciante', -- iniciante, intermediario, avancado
  data_inicio_estudos DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_nivel_estudante CHECK (nivel_atual IN ('iniciante', 'intermediario', 'avancado'))
);

CREATE INDEX idx_estudantes_trabalhador ON estudantes(trabalhador_id);
CREATE INDEX idx_estudantes_nivel ON estudantes(nivel_atual);
CREATE INDEX idx_estudantes_ativo ON estudantes(ativo);
```

#### **temas_estudo** - Temas/matérias de estudo
```sql
CREATE TABLE temas_estudo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  nivel_recomendado TEXT, -- iniciante, intermediario, avancado
  ordem_sugerida INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_temas_nivel ON temas_estudo(nivel_recomendado);
CREATE INDEX idx_temas_ordem ON temas_estudo(ordem_sugerida);
```

#### **aulas** - Cronograma de aulas
```sql
CREATE TABLE aulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tema_id UUID REFERENCES temas_estudo(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  data_aula DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  local TEXT,
  responsavel_id UUID REFERENCES trabalhadores(id) ON DELETE SET NULL,
  material_url TEXT, -- Link para material da aula
  conteudo TEXT, -- Descrição do conteúdo abordado
  status TEXT DEFAULT 'agendada', -- agendada, realizada, cancelada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_aula CHECK (status IN ('agendada', 'realizada', 'cancelada'))
);

CREATE INDEX idx_aulas_tema ON aulas(tema_id);
CREATE INDEX idx_aulas_data ON aulas(data_aula);
CREATE INDEX idx_aulas_responsavel ON aulas(responsavel_id);
CREATE INDEX idx_aulas_status ON aulas(status);
```

#### **presencas_aulas** - Presença em aulas
```sql
CREATE TABLE presencas_aulas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aula_id UUID NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  estudante_id UUID NOT NULL REFERENCES estudantes(id) ON DELETE CASCADE,
  presente BOOLEAN NOT NULL DEFAULT false,
  justificativa TEXT,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(aula_id, estudante_id)
);

CREATE INDEX idx_presencas_aulas_aula ON presencas_aulas(aula_id);
CREATE INDEX idx_presencas_aulas_estudante ON presencas_aulas(estudante_id);
CREATE INDEX idx_presencas_aulas_presente ON presencas_aulas(presente);
```

#### **avaliacoes** - Avaliações e trabalhos
```sql
CREATE TABLE avaliacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tema_id UUID REFERENCES temas_estudo(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_aplicacao DATE NOT NULL,
  data_entrega DATE,
  tipo TEXT NOT NULL, -- prova, trabalho, apresentacao, debate
  peso DECIMAL(5,2) DEFAULT 1.0,
  responsavel_id UUID REFERENCES trabalhadores(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_avaliacao CHECK (tipo IN ('prova', 'trabalho', 'apresentacao', 'debate'))
);

CREATE INDEX idx_avaliacoes_tema ON avaliacoes(tema_id);
CREATE INDEX idx_avaliacoes_data ON avaliacoes(data_aplicacao);
```

#### **notas_avaliacoes** - Notas dos estudantes
```sql
CREATE TABLE notas_avaliacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
  estudante_id UUID NOT NULL REFERENCES estudantes(id) ON DELETE CASCADE,
  nota DECIMAL(5,2), -- 0-10
  conceito TEXT, -- A, B, C, D, F ou outro sistema
  observacoes TEXT,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(avaliacao_id, estudante_id),
  CONSTRAINT check_nota CHECK (nota IS NULL OR (nota >= 0 AND nota <= 10))
);

CREATE INDEX idx_notas_avaliacao ON notas_avaliacoes(avaliacao_id);
CREATE INDEX idx_notas_estudante ON notas_avaliacoes(estudante_id);
```

### 3.4 Views para Relatórios

#### Módulo Financeiro
```sql
-- View: Resumo financeiro por mês
CREATE OR REPLACE VIEW vw_resumo_financeiro_mensal AS
SELECT
  DATE_TRUNC('month', c.data) as mes_ano,
  SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE 0 END) as total_entradas,
  SUM(CASE WHEN mc.tipo = 'saida' THEN mc.valor ELSE 0 END) as total_saidas,
  SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE -mc.valor END) as saldo,
  COUNT(DISTINCT c.id) as dias_abertos
FROM caixas c
LEFT JOIN movimentacoes_caixa mc ON mc.caixa_id = c.id
WHERE c.status = 'fechado'
GROUP BY DATE_TRUNC('month', c.data)
ORDER BY mes_ano DESC;

-- View: Mensalidades em aberto
CREATE OR REPLACE VIEW vw_mensalidades_pendentes AS
SELECT
  m.id as mensalidade_id,
  a.nome_completo as aluno,
  c.nome as curso,
  m.mes_referencia,
  m.ano_referencia,
  m.valor,
  m.data_vencimento,
  CASE
    WHEN m.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN m.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'a_vencer'
  END as situacao,
  CURRENT_DATE - m.data_vencimento as dias_atraso
FROM mensalidades m
JOIN matriculas mat ON mat.id = m.matricula_id
JOIN alunos a ON a.id = mat.aluno_id
JOIN cursos c ON c.id = mat.curso_id
WHERE m.status IN ('pendente', 'vencido')
ORDER BY m.data_vencimento;

-- View: Despesas pendentes
CREATE OR REPLACE VIEW vw_despesas_pendentes AS
SELECT
  d.id,
  d.fornecedor,
  d.descricao,
  d.categoria,
  d.valor,
  d.data_vencimento,
  d.status,
  CASE
    WHEN d.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN d.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    WHEN d.data_vencimento <= CURRENT_DATE + 7 THEN 'vence_semana'
    ELSE 'a_vencer'
  END as urgencia,
  CURRENT_DATE - d.data_vencimento as dias_atraso
FROM despesas d
WHERE d.status IN ('a_pagar', 'vencido')
ORDER BY d.data_vencimento;
```

#### Módulo de Estudos
```sql
-- View: Aproveitamento por estudante
CREATE OR REPLACE VIEW vw_aproveitamento_estudantes AS
SELECT
  e.id as estudante_id,
  t.nome_completo,
  e.nivel_atual,
  COUNT(DISTINCT pa.aula_id) FILTER (WHERE pa.presente = true) as aulas_presentes,
  COUNT(DISTINCT pa.aula_id) as total_aulas,
  ROUND(
    COUNT(DISTINCT pa.aula_id) FILTER (WHERE pa.presente = true)::numeric /
    NULLIF(COUNT(DISTINCT pa.aula_id), 0) * 100, 2
  ) as percentual_presenca,
  AVG(na.nota) as media_notas,
  COUNT(DISTINCT na.id) as total_avaliacoes
FROM estudantes e
JOIN trabalhadores t ON t.id = e.trabalhador_id
LEFT JOIN presencas_aulas pa ON pa.estudante_id = e.id
LEFT JOIN notas_avaliacoes na ON na.estudante_id = e.id
WHERE e.ativo = true
GROUP BY e.id, t.nome_completo, e.nivel_atual;
```

---

## 4. ESTRUTURA DE PASTAS E CÓDIGO

### 4.1 Estrutura Proposta

```
admin-cesca/
├── src/
│   ├── components/
│   │   ├── shared/              # Componentes compartilhados (atuais)
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   ├── Card.js
│   │   │   ├── Modal.js
│   │   │   └── index.js
│   │   │
│   │   ├── financeiro/          # 🆕 Módulo Financeiro
│   │   │   ├── FinanceiroManager.js
│   │   │   ├── FinanceiroManager.css
│   │   │   ├── AlunoManager.js
│   │   │   ├── CursoManager.js
│   │   │   ├── MatriculaManager.js
│   │   │   ├── MensalidadeManager.js
│   │   │   ├── CaixaManager.js
│   │   │   ├── DespesaManager.js
│   │   │   ├── ConciliacaoManager.js
│   │   │   ├── RelatoriosFinanceiros.js
│   │   │   └── utils/
│   │   │       ├── calculadoraFinanceira.js
│   │   │       ├── validadoresFinanceiros.js
│   │   │       └── formatadores.js
│   │   │
│   │   ├── escalas/             # 🆕 Módulo Escalas
│   │   │   ├── EscalasManager.js
│   │   │   ├── EscalasManager.css
│   │   │   ├── TiposAtendimentoConfig.js
│   │   │   ├── CapacitacoesManager.js
│   │   │   ├── FuncoesFixasConfig.js
│   │   │   ├── RestricoesManager.js
│   │   │   ├── GeradorEscalas.js
│   │   │   ├── PainelRevisao.js
│   │   │   ├── SubstituicoesManager.js
│   │   │   ├── PresencaEscalas.js
│   │   │   ├── RelatoriosEscalas.js
│   │   │   └── utils/
│   │   │       ├── algoritmoEscalas.js
│   │   │       ├── detectorConflitos.js
│   │   │       └── formatadorEscalas.js
│   │   │
│   │   ├── estudos/             # 🆕 Módulo Estudos
│   │   │   ├── EstudosManager.js
│   │   │   ├── EstudosManager.css
│   │   │   ├── EstudanteManager.js
│   │   │   ├── TemaEstudoManager.js
│   │   │   ├── AulaManager.js
│   │   │   ├── AvaliacaoManager.js
│   │   │   ├── PresencaAulaManager.js
│   │   │   ├── NotasManager.js
│   │   │   └── RelatoriosEstudos.js
│   │   │
│   │   ├── Login.js
│   │   ├── Dashboard.js
│   │   ├── UserManager.js
│   │   ├── TrabalhadorManager.js
│   │   ├── PresencaManager.js
│   │   ├── PresencaReports.js
│   │   ├── AdvertenciaManager.js
│   │   ├── AgendamentoManager.js
│   │   ├── Reports.js
│   │   └── Configuracoes.js
│   │
│   ├── utils/                   # 🆕 Utilitários globais
│   │   ├── dateUtils.js
│   │   ├── currencyUtils.js
│   │   ├── validationUtils.js
│   │   └── exportUtils.js
│   │
│   ├── hooks/                   # 🆕 Custom hooks
│   │   ├── useSupabase.js
│   │   ├── useAuth.js
│   │   └── useDebounce.js
│   │
│   ├── constants/               # 🆕 Constantes
│   │   ├── roles.js
│   │   ├── status.js
│   │   └── colors.js
│   │
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── supabaseClient.js
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_presenca_schema.sql
│   │   ├── 003_escalas_schema.sql
│   │   ├── 004_financeiro_schema.sql     # 🆕
│   │   └── 005_estudos_schema.sql        # 🆕
│   └── functions/                          # Edge Functions (futuro)
│
├── public/
├── package.json
├── ecosystem.config.js
├── PLANO_IMPLEMENTACAO_COMPLETO.md         # 🆕
├── ARQUITETURA_TECNICA.md                  # 🆕
└── README.md
```

### 4.2 Organização de Componentes Manager

**Padrão para Módulos Grandes (Financeiro, Escalas, Estudos):**

```javascript
// FinanceiroManager.js (Componente hub)
// - Tabs para navegação entre subcomponentes
// - Import dos submanagers
// - Renderiza baseado na tab ativa

import AlunoManager from './AlunoManager';
import CursoManager from './CursoManager';
import CaixaManager from './CaixaManager';
// ...

function FinanceiroManager({ userProfile }) {
  const [activeTab, setActiveTab] = useState('caixa');

  return (
    <div className="financeiro-manager">
      <Toaster />
      <TabNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'caixa' && <CaixaManager userProfile={userProfile} />}
      {activeTab === 'alunos' && <AlunoManager userProfile={userProfile} />}
      {/* ... */}
    </div>
  );
}
```

---

## 5. FASES DE IMPLEMENTAÇÃO

### FASE 1: ESSENCIAL (Prioridade Máxima)
**Objetivo:** Funcionalidades críticas operacionais
**Duração Estimada:** 3-4 semanas

#### 1.1 Módulo Financeiro - Essencial

**Semana 1-2:**
✅ **Schema do Banco de Dados:**
- Criar todas as tabelas do módulo financeiro
- Criar views básicas
- Configurar RLS policies
- Executar no Supabase

✅ **Componentes Base:**
- `AlunoManager.js` - CRUD completo de alunos
- `CursoManager.js` - CRUD completo de cursos
- `MatriculaManager.js` - Gestão de matrículas

**Semana 2-3:**
✅ **Sistema de Mensalidades:**
- `MensalidadeManager.js` - Listagem e gestão
- Função automática de geração mensal (trigger ou cron)
- Interface para marcar como pago
- Alertas de vencimento
- Listagem com filtros (status, curso, aluno, mês)

✅ **Sistema de Caixa:**
- `CaixaManager.js` - Abertura/fechamento de caixa
- Registro de movimentações por setor (Lanche, Lojinha, Mensalidades)
- Validação: não permitir movimentações sem caixa aberto
- Cálculo automático de saldo (esperado vs real)
- Interface de fechamento com diferenças destacadas

**Semana 3:**
✅ **Cadastro de Despesas Básico:**
- `DespesaManager.js` - CRUD de despesas
- Upload de comprovantes (Supabase Storage)
- Estados: a_pagar, pago, vencido
- Marcar como pago com data
- Listagem com filtros

#### 1.2 Módulo de Escalas - Crítico

**Semana 1-2:**
✅ **Schema do Banco (Já criado)**
- ✅ Validar schema criado
- ✅ Executar no Supabase
- ✅ Testar queries

✅ **Cadastros Base:**
- `TiposAtendimentoConfig.js` - CRUD dos 6 tipos de atendimento
- `CapacitacoesManager.js` - Vincular trabalhadores × tipos
- `FuncoesFixasConfig.js` - Configurar funções fixas (Fábia no Baralho, etc.)
- `RestricoesManager.js` - Cadastro de restrições de data

**Semana 2-3:**
✅ **Gerador de Escalas com Detecção de Conflitos:**
- `GeradorEscalas.js` - Interface de geração mensal
- Seleção do mês/ano
- Cálculo automático de segundas e sextas
- Algoritmo de alocação:
  - Respeitar funções fixas
  - Verificar capacitações
  - Verificar restrições de data
  - **Detectar conflitos em tempo real** (pessoa em 2 lugares ao mesmo tempo)
  - Distribuir carga equilibradamente
  - Rodízio automático

✅ **Detecção de Conflitos:**
- Função JS: `detectarConflitos(trabalhador, data, hora, escala)`
- Retorna: `{ temConflito: boolean, detalhes: {...} }`
- Alertas visuais: vermelho (bloqueio), amarelo (aviso)
- Sugestões de trabalhadores disponíveis

**Semana 3-4:**
✅ **Painel de Revisão:**
- `PainelRevisao.js` - Visualizar escala gerada
- Tabela por data × tipo de atendimento
- Edição manual (arrastar e soltar ou modais)
- Validação em tempo real ao editar
- Botão "Publicar Escala"
- Exportar para PDF/impressão

✅ **Dashboard para Coordenadores:**
- Visão consolidada de todas as escalas
- Filtros por coordenador, data, setor
- Mapa de conflitos (se houver)
- Vagas em aberto destacadas

---

### FASE 2: COMPLEMENTAR (Curto Prazo)
**Objetivo:** Complementar funcionalidades essenciais
**Duração Estimada:** 2-3 semanas

#### 2.1 Módulo Financeiro - Complementar

**Semana 1:**
✅ **Alerta de Duplicidade em Despesas:**
- Ao marcar despesa como paga, verificar:
  - Mesmo fornecedor
  - Últimos 7 dias
  - Valor similar (±10%)
- Modal de confirmação se detectar possível duplicidade

✅ **Conciliação Bancária:**
- `ConciliacaoManager.js`
- Upload de arquivo OFX ou CSV
- Parser de OFX/CSV
- Importação de transações
- Interface de matching (sugestões automáticas)
- Marcar como conciliado
- Relatório de divergências

**Semana 2:**
✅ **Relatórios Financeiros:**
- `RelatoriosFinanceiros.js`
- Relatório de mensalidades (com filtros)
- Relatório de vendas por setor
- Dashboard consolidado (entradas, saídas, saldo)
- Gráficos (Chart.js ou Recharts)
- Exportação Excel e PDF

✅ **Melhorias no Caixa:**
- Histórico de caixas anteriores
- Comparação mensal
- Análise de quebras de caixa

#### 2.2 Módulo de Escalas - Complementar

**Semana 1-2:**
✅ **Sistema de Substituições:**
- `SubstituicoesManager.js`
- Trabalhador solicita troca
- Indicar turno específico
- Sugerir substituto (opcional)
- Validar disponibilidade do substituto (sem conflitos!)
- Notificação para coordenador
- Coordenador aprova/rejeita
- Histórico de substituições

✅ **Sistema de Requisições:**
- Interface para coordenadores solicitarem necessidades
- Ex: "Preciso 3 MT1 para cambonagem sábado 14h"
- Sistema valida automaticamente disponibilidade
- Sugestões de alocação
- Aprovação central (Gabi/Roberta)

**Semana 2-3:**
✅ **Presença e Relatórios:**
- `PresencaEscalas.js` - Registro de presença nos dias escalados
- Diferente do PresencaManager existente (que é para giras)
- Justificativa de ausências
- `RelatoriosEscalas.js`:
  - Horas trabalhadas por pessoa
  - Taxa de comparecimento
  - Distribuição de carga
  - Setores com mais faltas

---

### FASE 3: ESTUDOS E MELHORIAS (Médio Prazo)
**Objetivo:** Módulo de Estudos completo + Dashboards avançados
**Duração Estimada:** 3-4 semanas

#### 3.1 Módulo de Estudos Completo

**Semana 1:**
✅ **Schema e Cadastros:**
- Criar todas as tabelas de estudos
- `EstudanteManager.js` - Vincular trabalhadores
- `TemaEstudoManager.js` - CRUD de temas
- `AulaManager.js` - Agendar aulas

**Semana 2:**
✅ **Registro de Atividades:**
- `PresencaAulaManager.js` - Presença em aulas
- `AvaliacaoManager.js` - Criar avaliações
- `NotasManager.js` - Lançar notas

**Semana 3:**
✅ **Relatórios de Estudos:**
- `RelatoriosEstudos.js`
- Frequência individual
- Desempenho por tema
- Estudantes aptos para progressão
- Histórico acadêmico

#### 3.2 Melhorias Gerais

**Semana 4:**
✅ **Dashboards Avançados:**
- Dashboard home unificado
- Indicadores de todos os módulos
- Gráficos e análises
- Ações rápidas

✅ **Auditoria Completa:**
- Histórico de alterações em todas as tabelas
- Logs de acesso
- Relatórios de auditoria

---

## 6. DESAFIOS E SOLUÇÕES

### 6.1 Desafio: Detecção de Conflitos em Tempo Real (Escalas)

**Problema:**
- Mesma pessoa escalada em múltiplos lugares simultaneamente
- Complexidade de validação com 67+ trabalhadores e 9 setores

**Solução Proposta:**

**Algoritmo de Detecção:**
```javascript
// utils/detectorConflitos.js

/**
 * Detecta se um trabalhador já está escalado em outro lugar no mesmo horário
 */
async function detectarConflito(trabalhadorId, data, horarioInicio, horarioFim, escalaIdAtual) {
  // 1. Buscar todas as escalas deste trabalhador na mesma data
  const { data: escalas, error } = await supabase
    .from('escalas_detalhes')
    .select(`
      *,
      tipo_atendimento:tipos_atendimento(nome, horario_inicio, horario_fim)
    `)
    .eq('trabalhador_id', trabalhadorId)
    .eq('data_atendimento', data)
    .neq('id', escalaIdAtual || 'null');

  if (error) throw error;

  // 2. Verificar sobreposição de horários
  const conflitos = escalas.filter(escala => {
    return horariosSeChocam(
      horarioInicio, horarioFim,
      escala.tipo_atendimento.horario_inicio,
      escala.tipo_atendimento.horario_fim
    );
  });

  return {
    temConflito: conflitos.length > 0,
    conflitos: conflitos.map(c => ({
      tipo: c.tipo_atendimento.nome,
      horario: `${c.tipo_atendimento.horario_inicio} - ${c.tipo_atendimento.horario_fim}`
    }))
  };
}

function horariosSeChocam(inicio1, fim1, inicio2, fim2) {
  // Converter para minutos para facilitar comparação
  const i1 = horarioParaMinutos(inicio1);
  const f1 = horarioParaMinutos(fim1);
  const i2 = horarioParaMinutos(inicio2);
  const f2 = horarioParaMinutos(fim2);

  // Há conflito se: (início1 < fim2) E (fim1 > início2)
  return (i1 < f2) && (f1 > i2);
}
```

**Interface Visual:**
```javascript
// Ao tentar alocar trabalhador
const resultado = await detectarConflito(trabalhadorId, data, inicio, fim);

if (resultado.temConflito) {
  showAlert({
    type: 'error',
    title: 'Conflito Detectado!',
    message: `${trabalhadorNome} já está escalado(a) em:
      ${resultado.conflitos.map(c => `- ${c.tipo} (${c.horario})`).join('\n')}`,
    actions: [
      { label: 'Cancelar', action: 'close' },
      { label: 'Ver Alternativas', action: 'suggestOthers' }
    ]
  });

  return false; // Bloqueia alocação
}
```

### 6.2 Desafio: Geração Automática de Mensalidades

**Problema:**
- Gerar mensalidades todo mês para todos os alunos matriculados
- Cursos avulsos vs regulares
- Datas de vencimento personalizadas

**Solução Proposta:**

**Trigger SQL (Executado mensalmente):**
```sql
-- Função para gerar mensalidades automaticamente
CREATE OR REPLACE FUNCTION gerar_mensalidades_mes()
RETURNS void AS $$
DECLARE
  v_mes INTEGER;
  v_ano INTEGER;
  v_matricula RECORD;
  v_dia_vencimento INTEGER;
  v_data_vencimento DATE;
BEGIN
  -- Mês atual
  v_mes := EXTRACT(MONTH FROM CURRENT_DATE);
  v_ano := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Loop em matrículas ativas
  FOR v_matricula IN
    SELECT
      m.id as matricula_id,
      m.aluno_id,
      m.curso_id,
      m.dia_vencimento_personalizado,
      c.valor_mensalidade,
      c.dia_vencimento as dia_vencimento_padrao,
      c.tipo as tipo_curso
    FROM matriculas m
    JOIN cursos c ON c.id = m.curso_id
    WHERE m.status = 'ativa'
      AND c.tipo = 'regular' -- Apenas cursos regulares
      AND (m.data_fim IS NULL OR m.data_fim >= CURRENT_DATE)
  LOOP
    -- Definir dia de vencimento
    v_dia_vencimento := COALESCE(
      v_matricula.dia_vencimento_personalizado,
      v_matricula.dia_vencimento_padrao
    );

    -- Calcular data de vencimento
    v_data_vencimento := make_date(v_ano, v_mes, v_dia_vencimento);

    -- Inserir mensalidade (se não existir)
    INSERT INTO mensalidades (
      matricula_id,
      mes_referencia,
      ano_referencia,
      valor,
      data_vencimento,
      status,
      gerado_automaticamente
    )
    VALUES (
      v_matricula.matricula_id,
      v_mes,
      v_ano,
      v_matricula.valor_mensalidade,
      v_data_vencimento,
      'pendente',
      true
    )
    ON CONFLICT (matricula_id, mes_referencia, ano_referencia) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Mensalidades geradas para o mês %/%', v_mes, v_ano;
END;
$$ LANGUAGE plpgsql;
```

**Executar via Cron (Supabase Edge Function ou PM2):**
```javascript
// supabase/functions/gerar-mensalidades-cron/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Executar função SQL
  const { error } = await supabase.rpc('gerar_mensalidades_mes');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});

// Agendar via cron: todo dia 1 às 00:00
// Configurar no Supabase Dashboard ou via pg_cron
```

### 6.3 Desafio: Matching Inteligente de Mensalidades (R$ 80,00)

**Problema:**
- Identificar automaticamente que um pagamento de R$ 80,00 é uma mensalidade
- Sugerir conciliação correta

**Solução Proposta:**

```javascript
// financeiro/utils/matchingInteligente.js

/**
 * Sugere mensalidades que correspondem a um pagamento recebido
 */
async function sugerirMensalidadesPorValor(valor, dataPagamento) {
  // Buscar mensalidades pendentes com valor igual ou próximo (±5%)
  const { data: mensalidades, error } = await supabase
    .from('vw_mensalidades_pendentes')
    .select('*')
    .gte('valor', valor * 0.95)
    .lte('valor', valor * 1.05)
    .order('data_vencimento', { ascending: true });

  if (error) throw error;

  // Priorizar por data de vencimento próxima à data de pagamento
  const sugestoes = mensalidades.map(m => ({
    ...m,
    score: calcularScoreProximidade(m.data_vencimento, dataPagamento, m.valor, valor)
  }));

  sugestoes.sort((a, b) => b.score - a.score);

  return sugestoes.slice(0, 10); // Top 10 sugestões
}

function calcularScoreProximidade(dataVencimento, dataPagamento, valorMensalidade, valorPago) {
  // Score baseado em:
  // 1. Proximidade de datas (peso 60%)
  // 2. Exatidão do valor (peso 40%)

  const diasDiferenca = Math.abs(
    (new Date(dataPagamento) - new Date(dataVencimento)) / (1000 * 60 * 60 * 24)
  );

  const scoreData = Math.max(0, 100 - (diasDiferenca * 2)); // -2 pontos por dia

  const diferencaValor = Math.abs(valorPago - valorMensalidade);
  const scoreValor = Math.max(0, 100 - (diferencaValor * 100)); // Muito sensível a diferença

  return (scoreData * 0.6) + (scoreValor * 0.4);
}
```

**Interface de Conciliação:**
```javascript
// Ao registrar pagamento de R$ 80,00
const sugestoes = await sugerirMensalidadesPorValor(80.00, dataPagamento);

if (sugestoes.length > 0) {
  showModal({
    title: 'Sugestões de Conciliação',
    content: (
      <div>
        <p>Encontramos mensalidades que podem corresponder a este pagamento:</p>
        <SelectList
          options={sugestoes.map(s => ({
            label: `${s.aluno} - ${s.curso} (${s.mes_referencia}/${s.ano_referencia}) - R$ ${s.valor}`,
            value: s.mensalidade_id,
            badge: s.situacao === 'vencido' ? 'Vencido' : 'A vencer'
          }))}
          onSelect={(id) => vincularMensalidade(id, pagamentoId)}
        />
        <Button onClick={ignorarSugestoes}>Lançar sem vincular</Button>
      </div>
    )
  });
}
```

### 6.4 Desafio: Alerta de Duplicidade de Despesas

**Problema:**
- Evitar pagar a mesma despesa duas vezes
- Detectar pagamentos similares recentes

**Solução Proposta:**

```javascript
// Ao marcar despesa como paga
async function marcarDespesaComoPaga(despesaId, dataPagamento, formaPagamento) {
  const despesa = await carregarDespesa(despesaId);

  // Verificar duplicidade
  const { data: similares, error } = await supabase
    .from('despesas')
    .select('*')
    .eq('fornecedor', despesa.fornecedor)
    .eq('status', 'pago')
    .gte('data_pagamento', subDays(dataPagamento, 7))
    .lte('data_pagamento', addDays(dataPagamento, 7))
    .gte('valor', despesa.valor * 0.90)
    .lte('valor', despesa.valor * 1.10)
    .neq('id', despesaId);

  if (similares && similares.length > 0) {
    // ALERTA!
    const confirmacao = await showConfirmModal({
      type: 'warning',
      title: '⚠️ Possível Duplicidade',
      message: `Detectamos pagamento(s) similar(es) recente(s) para ${despesa.fornecedor}:

${similares.map(s => `- R$ ${s.valor} em ${formatDate(s.data_pagamento)}: ${s.descricao}`).join('\n')}

Tem certeza que deseja marcar esta despesa como paga?`,
      confirmText: 'Sim, confirmar pagamento',
      cancelText: 'Cancelar',
      requiresJustification: true // Exigir justificativa
    });

    if (!confirmacao.confirmed) {
      return; // Cancelado
    }

    // Prosseguir com justificativa
    despesa.observacoes = (despesa.observacoes || '') +
      `\n[${formatDate(new Date())}] Confirmado apesar de alerta de duplicidade: ${confirmacao.justification}`;
  }

  // Atualizar despesa
  await supabase
    .from('despesas')
    .update({
      status: 'pago',
      data_pagamento: dataPagamento,
      forma_pagamento: formaPagamento,
      observacoes: despesa.observacoes,
      pago_por: userProfile.id
    })
    .eq('id', despesaId);

  showToast.success('Despesa marcada como paga!');
}
```

### 6.5 Desafio: Performance com Muitos Trabalhadores/Escalas

**Problema:**
- 67+ trabalhadores
- 9 setores
- Múltiplas datas por mês
- Consultas complexas podem ficar lentas

**Solução Proposta:**

**1. Indexação Correta:**
```sql
-- Índices compostos para queries comuns
CREATE INDEX idx_escalas_detalhes_lookup
  ON escalas_detalhes(trabalhador_id, data_atendimento, tipo_atendimento_id);

CREATE INDEX idx_mensalidades_lookup
  ON mensalidades(matricula_id, status, data_vencimento);

CREATE INDEX idx_movimentacoes_caixa_lookup
  ON movimentacoes_caixa(caixa_id, tipo, setor);
```

**2. Views Materializadas (se necessário):**
```sql
-- Para relatórios pesados
CREATE MATERIALIZED VIEW mv_resumo_escalas_mes AS
SELECT ...
-- Dados agregados
WITH DATA;

-- Atualizar a cada 1h
CREATE INDEX ON mv_resumo_escalas_mes(mes, ano);
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_resumo_escalas_mes;
```

**3. Paginação e Lazy Loading:**
```javascript
// Carregar dados em lotes
const [page, setPage] = useState(0);
const ITEMS_PER_PAGE = 50;

const loadData = async () => {
  const { data, error } = await supabase
    .from('tabela')
    .select('*')
    .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

  // ...
};
```

**4. Debounce em Filtros:**
```javascript
import { useDebounce } from '../hooks/useDebounce';

const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500); // 500ms delay

useEffect(() => {
  if (debouncedSearch) {
    filterData();
  }
}, [debouncedSearch]);
```

---

## 7. CRONOGRAMA ESTIMADO

```
┌────────────────────────────────────────────────────────────────┐
│  FASE 1 - ESSENCIAL (3-4 semanas)                              │
├────────────────────────────────────────────────────────────────┤
│  Semana 1: Schema Financeiro + Alunos/Cursos/Matrículas       │
│  Semana 2: Sistema de Mensalidades + Caixa                     │
│  Semana 3: Despesas Básico + Testes                            │
│  Semana 4: Escalas - Cadastros + Gerador + Conflitos           │
├────────────────────────────────────────────────────────────────┤
│  FASE 2 - COMPLEMENTAR (2-3 semanas)                           │
├────────────────────────────────────────────────────────────────┤
│  Semana 5: Alerta Duplicidade + Conciliação Bancária           │
│  Semana 6: Relatórios Financeiros + Dashboards                 │
│  Semana 7: Substituições + Requisições + Presença Escalas      │
├────────────────────────────────────────────────────────────────┤
│  FASE 3 - ESTUDOS E MELHORIAS (3-4 semanas)                    │
├────────────────────────────────────────────────────────────────┤
│  Semana 8-9: Módulo de Estudos completo                        │
│  Semana 10-11: Dashboards avançados + Auditoria + Refinamentos │
└────────────────────────────────────────────────────────────────┘

TOTAL ESTIMADO: 10-11 semanas
```

### Milestones Principais:

- **Milestone 1 (Semana 3):** Sistema financeiro básico operacional
- **Milestone 2 (Semana 4):** Sistema de escalas com detecção de conflitos operacional
- **Milestone 3 (Semana 7):** Todos os módulos essenciais e complementares concluídos
- **Milestone 4 (Semana 11):** Sistema completo com estudos e dashboards avançados

---

## 8. PRÓXIMOS PASSOS IMEDIATOS

### Checklist de Início:

- [ ] **Revisar e aprovar este plano**
- [ ] **Confirmar prioridades das fases**
- [ ] **Executar schema do módulo financeiro no Supabase**
- [ ] **Validar schema de escalas no Supabase**
- [ ] **Criar branch de desenvolvimento (git)**
- [ ] **Iniciar FASE 1 - Semana 1**

### Para Iniciar Implementação:

1. Execute os schemas SQL no Supabase:
   ```bash
   # supabase-financeiro-schema.sql (a ser criado)
   # supabase-escalas-schema.sql (já existe)
   ```

2. Crie estrutura de pastas:
   ```bash
   mkdir -p src/components/financeiro/utils
   mkdir -p src/components/escalas/utils
   mkdir -p src/components/estudos
   mkdir -p src/utils
   mkdir -p src/hooks
   mkdir -p src/constants
   ```

3. Começe pela implementação de `AlunoManager.js` seguindo o padrão dos Manager existentes

---

**FIM DO PLANO DE IMPLEMENTAÇÃO**

---

**Observações Finais:**

Este plano é um documento vivo e pode ser ajustado conforme necessário durante a implementação. Questões, dúvidas ou sugestões de melhorias devem ser documentadas e discutidas antes de proceder com grandes mudanças na arquitetura.

**Contato para dúvidas:**
- Revisar com usuário antes de iniciar cada fase
- Validar UI/UX dos componentes críticos
- Testar em ambiente de desenvolvimento antes de deploy
