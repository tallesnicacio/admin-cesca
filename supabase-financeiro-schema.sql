-- ===================================================================
-- SCHEMA MÓDULO FINANCEIRO - Centro Espírita Santa Clara de Assis
-- ===================================================================
-- Sistema completo de gestão financeira incluindo:
-- - Controle de alunos, cursos e matrículas
-- - Geração automática de mensalidades
-- - Controle de caixa diário (3 setores)
-- - Gestão de despesas com comprovantes
-- - Conciliação bancária
-- Data de criação: 2025-10-27
-- ===================================================================

-- ===================================================================
-- 1. TABELA: alunos
-- Cadastro de alunos que fazem cursos
-- ===================================================================
CREATE TABLE IF NOT EXISTS alunos (
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_aluno CHECK (status IN ('ativo', 'inativo', 'trancado'))
);

-- Índices para alunos
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_completo);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_cpf ON alunos(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alunos_created ON alunos(created_at DESC);

COMMENT ON TABLE alunos IS 'Cadastro de alunos matriculados em cursos';
COMMENT ON COLUMN alunos.status IS 'Status do aluno: ativo, inativo, trancado';

-- ===================================================================
-- 2. TABELA: cursos
-- Cursos disponíveis (regulares e avulsos)
-- ===================================================================
CREATE TABLE IF NOT EXISTS cursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  tipo TEXT NOT NULL, -- regular, avulso
  valor_mensalidade DECIMAL(10,2) NOT NULL,
  dia_vencimento INTEGER DEFAULT 10, -- 1-31
  duracao_meses INTEGER, -- NULL para regulares, número para avulsos
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_curso CHECK (tipo IN ('regular', 'avulso')),
  CONSTRAINT check_dia_vencimento CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  CONSTRAINT check_valor_positivo CHECK (valor_mensalidade > 0),
  CONSTRAINT check_duracao_avulso CHECK (
    (tipo = 'regular' AND duracao_meses IS NULL) OR
    (tipo = 'avulso' AND duracao_meses > 0)
  )
);

-- Índices para cursos
CREATE INDEX IF NOT EXISTS idx_cursos_tipo ON cursos(tipo);
CREATE INDEX IF NOT EXISTS idx_cursos_ativo ON cursos(ativo);
CREATE INDEX IF NOT EXISTS idx_cursos_nome ON cursos(nome);

COMMENT ON TABLE cursos IS 'Cursos disponíveis (regulares geram mensalidades recorrentes, avulsos têm duração fixa)';
COMMENT ON COLUMN cursos.tipo IS 'regular (recorrente) ou avulso (duração fixa)';
COMMENT ON COLUMN cursos.dia_vencimento IS 'Dia padrão do mês para vencimento das mensalidades (1-31)';
COMMENT ON COLUMN cursos.duracao_meses IS 'Duração em meses para cursos avulsos, NULL para cursos regulares';

-- ===================================================================
-- 3. TABELA: matriculas
-- Matrícula de alunos em cursos
-- ===================================================================
CREATE TABLE IF NOT EXISTS matriculas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  data_matricula DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio DATE NOT NULL,
  data_fim DATE, -- Para cursos avulsos ou quando aluno sair
  dia_vencimento_personalizado INTEGER, -- Sobrescreve o padrão do curso
  status TEXT DEFAULT 'ativa', -- ativa, trancada, cancelada, concluida
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_matricula CHECK (status IN ('ativa', 'trancada', 'cancelada', 'concluida')),
  CONSTRAINT check_dia_vencimento_personalizado CHECK (
    dia_vencimento_personalizado IS NULL OR
    (dia_vencimento_personalizado >= 1 AND dia_vencimento_personalizado <= 31)
  ),
  CONSTRAINT check_data_fim CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

-- Índices para matriculas
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_status ON matriculas(status);
CREATE INDEX IF NOT EXISTS idx_matriculas_data ON matriculas(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_matriculas_ativas ON matriculas(status) WHERE status = 'ativa';

COMMENT ON TABLE matriculas IS 'Vincula alunos a cursos com período de validade';
COMMENT ON COLUMN matriculas.status IS 'ativa, trancada, cancelada, concluida';
COMMENT ON COLUMN matriculas.dia_vencimento_personalizado IS 'Sobrescreve o dia de vencimento padrão do curso para este aluno';
COMMENT ON COLUMN matriculas.data_fim IS 'Data de término (obrigatória para cursos avulsos, opcional para regulares)';

-- ===================================================================
-- 4. TABELA: mensalidades
-- Mensalidades geradas automaticamente
-- ===================================================================
CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  mes_referencia INTEGER NOT NULL, -- 1-12
  ano_referencia INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago DECIMAL(10,2),
  status TEXT DEFAULT 'pendente', -- pendente, pago, vencido, cancelado
  forma_pagamento TEXT, -- dinheiro, pix, cartao_debito, cartao_credito, boleto
  observacoes TEXT,
  gerado_automaticamente BOOLEAN DEFAULT true,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(matricula_id, mes_referencia, ano_referencia),
  CONSTRAINT check_mes_referencia CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  CONSTRAINT check_ano_referencia CHECK (ano_referencia >= 2020 AND ano_referencia <= 2100),
  CONSTRAINT check_status_mensalidade CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  CONSTRAINT check_valores_pagamento CHECK (
    (status = 'pago' AND data_pagamento IS NOT NULL AND valor_pago IS NOT NULL) OR
    (status != 'pago')
  )
);

-- Índices para mensalidades
CREATE INDEX IF NOT EXISTS idx_mensalidades_matricula ON mensalidades(matricula_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_status ON mensalidades(status);
CREATE INDEX IF NOT EXISTS idx_mensalidades_vencimento ON mensalidades(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_mensalidades_referencia ON mensalidades(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_mensalidades_pendentes ON mensalidades(status, data_vencimento)
  WHERE status IN ('pendente', 'vencido');

COMMENT ON TABLE mensalidades IS 'Mensalidades geradas automaticamente para matrículas ativas';
COMMENT ON COLUMN mensalidades.status IS 'pendente, pago, vencido, cancelado';
COMMENT ON COLUMN mensalidades.gerado_automaticamente IS 'TRUE se gerada pelo sistema, FALSE se manual';

-- ===================================================================
-- 5. TABELA: caixas
-- Controle de caixa diário
-- ===================================================================
CREATE TABLE IF NOT EXISTS caixas (
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

  CONSTRAINT check_status_caixa CHECK (status IN ('aberto', 'fechado')),
  CONSTRAINT check_valores_fechamento CHECK (
    (status = 'fechado' AND valor_final_esperado IS NOT NULL AND valor_final_real IS NOT NULL) OR
    (status = 'aberto')
  ),
  CONSTRAINT check_hora_fechamento CHECK (
    (status = 'fechado' AND hora_fechamento IS NOT NULL) OR
    (status = 'aberto')
  )
);

-- Índices para caixas
CREATE INDEX IF NOT EXISTS idx_caixas_data ON caixas(data DESC);
CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status);
CREATE INDEX IF NOT EXISTS idx_caixas_aberto ON caixas(status) WHERE status = 'aberto';

COMMENT ON TABLE caixas IS 'Controle de abertura e fechamento de caixa diário';
COMMENT ON COLUMN caixas.status IS 'aberto ou fechado';
COMMENT ON COLUMN caixas.diferenca IS 'Diferença entre o valor real e o esperado (quebra de caixa)';

-- ===================================================================
-- 6. TABELA: movimentacoes_caixa
-- Movimentações do caixa (entradas e saídas)
-- ===================================================================
CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
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
  CONSTRAINT check_setor_movimentacao CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos')),
  CONSTRAINT check_valor_positivo_mov CHECK (valor > 0)
);

-- Índices para movimentacoes_caixa
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa ON movimentacoes_caixa(caixa_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes_caixa(tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_setor ON movimentacoes_caixa(setor);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes_caixa(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_mensalidade ON movimentacoes_caixa(mensalidade_id) WHERE mensalidade_id IS NOT NULL;

COMMENT ON TABLE movimentacoes_caixa IS 'Registra todas as entradas e saídas do caixa diário';
COMMENT ON COLUMN movimentacoes_caixa.tipo IS 'entrada ou saida';
COMMENT ON COLUMN movimentacoes_caixa.setor IS 'lanche, lojinha, mensalidades_cursos';
COMMENT ON COLUMN movimentacoes_caixa.mensalidade_id IS 'Vincula a uma mensalidade se for pagamento de curso';

-- ===================================================================
-- 7. TABELA: despesas
-- Registro de despesas e contas a pagar
-- ===================================================================
CREATE TABLE IF NOT EXISTS despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT, -- luz, agua, material, manutencao, compras_miudas, internet, telefone, outros
  valor DECIMAL(10,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_pagar', -- a_pagar, pago, vencido, cancelado
  forma_pagamento TEXT, -- dinheiro, pix, cartao_debito, cartao_credito, boleto, transferencia
  comprovante_url TEXT, -- URL do arquivo no Supabase Storage
  observacoes TEXT,
  registrado_por UUID REFERENCES profiles(id),
  pago_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_status_despesa CHECK (status IN ('a_pagar', 'pago', 'vencido', 'cancelado')),
  CONSTRAINT check_valor_positivo_desp CHECK (valor > 0),
  CONSTRAINT check_data_vencimento_desp CHECK (data_vencimento >= data_emissao),
  CONSTRAINT check_pagamento_completo CHECK (
    (status = 'pago' AND data_pagamento IS NOT NULL AND forma_pagamento IS NOT NULL AND pago_por IS NOT NULL) OR
    (status != 'pago')
  )
);

-- Índices para despesas
CREATE INDEX IF NOT EXISTS idx_despesas_fornecedor ON despesas(fornecedor);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON despesas(categoria);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_vencimento ON despesas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_emissao ON despesas(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_pendentes ON despesas(status, data_vencimento)
  WHERE status IN ('a_pagar', 'vencido');

COMMENT ON TABLE despesas IS 'Registro de despesas e contas a pagar com comprovantes';
COMMENT ON COLUMN despesas.status IS 'a_pagar, pago, vencido, cancelado';
COMMENT ON COLUMN despesas.categoria IS 'Categoria da despesa para agrupamento';
COMMENT ON COLUMN despesas.comprovante_url IS 'URL do comprovante (nota fiscal/recibo) no Storage';

-- ===================================================================
-- 8. TABELA: conciliacoes_bancarias
-- Cabeçalho de importação de extrato bancário
-- ===================================================================
CREATE TABLE IF NOT EXISTS conciliacoes_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_importacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  arquivo_nome TEXT NOT NULL,
  banco TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  total_transacoes INTEGER DEFAULT 0,
  total_creditos DECIMAL(10,2) DEFAULT 0,
  total_debitos DECIMAL(10,2) DEFAULT 0,
  importado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_periodo_conciliacao CHECK (periodo_fim >= periodo_inicio)
);

-- Índices para conciliacoes_bancarias
CREATE INDEX IF NOT EXISTS idx_conciliacoes_data ON conciliacoes_bancarias(data_importacao DESC);
CREATE INDEX IF NOT EXISTS idx_conciliacoes_periodo ON conciliacoes_bancarias(periodo_inicio, periodo_fim);
CREATE INDEX IF NOT EXISTS idx_conciliacoes_banco ON conciliacoes_bancarias(banco);

COMMENT ON TABLE conciliacoes_bancarias IS 'Registro de importações de extrato bancário';
COMMENT ON COLUMN conciliacoes_bancarias.arquivo_nome IS 'Nome do arquivo OFX/CSV importado';

-- ===================================================================
-- 9. TABELA: transacoes_bancarias
-- Transações importadas do extrato bancário
-- ===================================================================
CREATE TABLE IF NOT EXISTS transacoes_bancarias (
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
  conciliado_por UUID REFERENCES profiles(id),
  conciliado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT check_tipo_transacao CHECK (tipo IN ('credito', 'debito'))
);

-- Índices para transacoes_bancarias
CREATE INDEX IF NOT EXISTS idx_transacoes_conciliacao ON transacoes_bancarias(conciliacao_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes_bancarias(data_transacao DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_conciliado ON transacoes_bancarias(conciliado);
CREATE INDEX IF NOT EXISTS idx_transacoes_pendentes ON transacoes_bancarias(conciliado, data_transacao)
  WHERE conciliado = false;

COMMENT ON TABLE transacoes_bancarias IS 'Transações importadas do extrato bancário para conciliação';
COMMENT ON COLUMN transacoes_bancarias.tipo IS 'credito (entrada) ou debito (saída)';
COMMENT ON COLUMN transacoes_bancarias.conciliado IS 'TRUE se já foi vinculada a uma movimentação ou despesa';

-- ===================================================================
-- 10. TRIGGERS PARA UPDATED_AT
-- ===================================================================

-- Usar a função existente ou criar se não existir
CREATE OR REPLACE FUNCTION update_updated_at_financeiro()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas
DROP TRIGGER IF EXISTS update_alunos_updated_at ON alunos;
CREATE TRIGGER update_alunos_updated_at
  BEFORE UPDATE ON alunos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_cursos_updated_at ON cursos;
CREATE TRIGGER update_cursos_updated_at
  BEFORE UPDATE ON cursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_matriculas_updated_at ON matriculas;
CREATE TRIGGER update_matriculas_updated_at
  BEFORE UPDATE ON matriculas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_mensalidades_updated_at ON mensalidades;
CREATE TRIGGER update_mensalidades_updated_at
  BEFORE UPDATE ON mensalidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_caixas_updated_at ON caixas;
CREATE TRIGGER update_caixas_updated_at
  BEFORE UPDATE ON caixas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_movimentacoes_caixa_updated_at ON movimentacoes_caixa;
CREATE TRIGGER update_movimentacoes_caixa_updated_at
  BEFORE UPDATE ON movimentacoes_caixa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

DROP TRIGGER IF EXISTS update_despesas_updated_at ON despesas;
CREATE TRIGGER update_despesas_updated_at
  BEFORE UPDATE ON despesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

-- ===================================================================
-- 11. TRIGGER: Atualizar status de mensalidade vencida
-- ===================================================================

CREATE OR REPLACE FUNCTION atualizar_status_mensalidades_vencidas()
RETURNS void AS $$
BEGIN
  UPDATE mensalidades
  SET status = 'vencido'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atualizar_status_mensalidades_vencidas IS 'Atualiza status de mensalidades pendentes que venceram';

-- ===================================================================
-- 12. TRIGGER: Calcular diferença ao fechar caixa
-- ===================================================================

CREATE OR REPLACE FUNCTION calcular_diferenca_caixa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
    -- Calcular valor esperado (inicial + entradas - saídas)
    SELECT
      NEW.valor_inicial +
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO NEW.valor_final_esperado
    FROM movimentacoes_caixa
    WHERE caixa_id = NEW.id;

    -- Calcular diferença
    NEW.diferenca := NEW.valor_final_real - NEW.valor_final_esperado;
    NEW.hora_fechamento := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_diferenca_caixa ON caixas;
CREATE TRIGGER trigger_calcular_diferenca_caixa
  BEFORE UPDATE ON caixas
  FOR EACH ROW EXECUTE FUNCTION calcular_diferenca_caixa();

-- ===================================================================
-- 13. FUNÇÃO: Gerar mensalidades automaticamente
-- ===================================================================

CREATE OR REPLACE FUNCTION gerar_mensalidades_mes(p_mes INTEGER DEFAULT NULL, p_ano INTEGER DEFAULT NULL)
RETURNS TABLE(
  matriculas_processadas INTEGER,
  mensalidades_criadas INTEGER,
  erros TEXT[]
) AS $$
DECLARE
  v_mes INTEGER;
  v_ano INTEGER;
  v_matricula RECORD;
  v_dia_vencimento INTEGER;
  v_data_vencimento DATE;
  v_contador_matriculas INTEGER := 0;
  v_contador_mensalidades INTEGER := 0;
  v_erros TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Usar mês/ano fornecido ou usar próximo mês
  v_mes := COALESCE(p_mes, EXTRACT(MONTH FROM (CURRENT_DATE + interval '1 month'))::INTEGER);
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM (CURRENT_DATE + interval '1 month'))::INTEGER);

  -- Loop em matrículas ativas de cursos regulares
  FOR v_matricula IN
    SELECT
      m.id as matricula_id,
      m.aluno_id,
      m.curso_id,
      m.dia_vencimento_personalizado,
      m.data_fim,
      c.valor_mensalidade,
      c.dia_vencimento as dia_vencimento_padrao,
      c.tipo as tipo_curso,
      c.nome as nome_curso,
      a.nome_completo as nome_aluno
    FROM matriculas m
    JOIN cursos c ON c.id = m.curso_id
    JOIN alunos a ON a.id = m.aluno_id
    WHERE m.status = 'ativa'
      AND c.tipo = 'regular' -- Apenas cursos regulares
      AND c.ativo = true
      AND (m.data_fim IS NULL OR m.data_fim >= make_date(v_ano, v_mes, 1))
  LOOP
    v_contador_matriculas := v_contador_matriculas + 1;

    BEGIN
      -- Definir dia de vencimento
      v_dia_vencimento := COALESCE(
        v_matricula.dia_vencimento_personalizado,
        v_matricula.dia_vencimento_padrao
      );

      -- Ajustar dia se exceder o último dia do mês
      v_dia_vencimento := LEAST(
        v_dia_vencimento,
        EXTRACT(DAY FROM (date_trunc('month', make_date(v_ano, v_mes, 1)) + interval '1 month - 1 day'))::INTEGER
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

      -- Verificar se foi inserido
      IF FOUND THEN
        v_contador_mensalidades := v_contador_mensalidades + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Registrar erro mas continuar processamento
      v_erros := array_append(v_erros,
        format('Erro ao processar matrícula %s (%s - %s): %s',
          v_matricula.matricula_id,
          v_matricula.nome_aluno,
          v_matricula.nome_curso,
          SQLERRM
        )
      );
    END;
  END LOOP;

  -- Retornar estatísticas
  RETURN QUERY SELECT v_contador_matriculas, v_contador_mensalidades, v_erros;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_mensalidades_mes IS 'Gera mensalidades automaticamente para o mês especificado (ou próximo mês se não especificado)';

-- ===================================================================
-- 14. VIEWS PARA RELATÓRIOS
-- ===================================================================

-- View: Mensalidades pendentes com detalhes
CREATE OR REPLACE VIEW vw_mensalidades_pendentes AS
SELECT
  m.id as mensalidade_id,
  a.id as aluno_id,
  a.nome_completo as aluno,
  a.telefone as aluno_telefone,
  a.email as aluno_email,
  c.id as curso_id,
  c.nome as curso,
  c.tipo as tipo_curso,
  mat.id as matricula_id,
  m.mes_referencia,
  m.ano_referencia,
  m.valor,
  m.data_vencimento,
  m.status,
  CASE
    WHEN m.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN m.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    WHEN m.data_vencimento <= CURRENT_DATE + 7 THEN 'vence_semana'
    ELSE 'a_vencer'
  END as situacao,
  CASE
    WHEN m.data_vencimento < CURRENT_DATE THEN CURRENT_DATE - m.data_vencimento
    ELSE 0
  END as dias_atraso,
  m.observacoes,
  m.created_at
FROM mensalidades m
JOIN matriculas mat ON mat.id = m.matricula_id
JOIN alunos a ON a.id = mat.aluno_id
JOIN cursos c ON c.id = mat.curso_id
WHERE m.status IN ('pendente', 'vencido')
ORDER BY m.data_vencimento, a.nome_completo;

-- View: Despesas pendentes
CREATE OR REPLACE VIEW vw_despesas_pendentes AS
SELECT
  d.id,
  d.fornecedor,
  d.descricao,
  d.categoria,
  d.valor,
  d.data_emissao,
  d.data_vencimento,
  d.status,
  d.comprovante_url,
  CASE
    WHEN d.data_vencimento < CURRENT_DATE THEN 'vencido'
    WHEN d.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    WHEN d.data_vencimento <= CURRENT_DATE + 7 THEN 'vence_semana'
    ELSE 'a_vencer'
  END as urgencia,
  CASE
    WHEN d.data_vencimento < CURRENT_DATE THEN CURRENT_DATE - d.data_vencimento
    ELSE 0
  END as dias_atraso,
  d.observacoes,
  p.name as registrado_por_nome,
  d.created_at
FROM despesas d
LEFT JOIN profiles p ON p.id = d.registrado_por
WHERE d.status IN ('a_pagar', 'vencido')
ORDER BY d.data_vencimento;

-- View: Resumo financeiro mensal
CREATE OR REPLACE VIEW vw_resumo_financeiro_mensal AS
SELECT
  DATE_TRUNC('month', c.data)::DATE as mes_ano,
  EXTRACT(YEAR FROM c.data)::INTEGER as ano,
  EXTRACT(MONTH FROM c.data)::INTEGER as mes,
  COUNT(DISTINCT c.id) as dias_abertos,
  COUNT(DISTINCT CASE WHEN c.status = 'fechado' THEN c.id END) as dias_fechados,

  -- Entradas
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE 0 END), 0) as total_entradas,
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' AND mc.setor = 'lanche' THEN mc.valor ELSE 0 END), 0) as entradas_lanche,
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' AND mc.setor = 'lojinha' THEN mc.valor ELSE 0 END), 0) as entradas_lojinha,
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' AND mc.setor = 'mensalidades_cursos' THEN mc.valor ELSE 0 END), 0) as entradas_mensalidades,

  -- Saídas
  COALESCE(SUM(CASE WHEN mc.tipo = 'saida' THEN mc.valor ELSE 0 END), 0) as total_saidas,
  COALESCE(SUM(CASE WHEN mc.tipo = 'saida' AND mc.setor = 'lanche' THEN mc.valor ELSE 0 END), 0) as saidas_lanche,
  COALESCE(SUM(CASE WHEN mc.tipo = 'saida' AND mc.setor = 'lojinha' THEN mc.valor ELSE 0 END), 0) as saidas_lojinha,
  COALESCE(SUM(CASE WHEN mc.tipo = 'saida' AND mc.setor = 'mensalidades_cursos' THEN mc.valor ELSE 0 END), 0) as saidas_mensalidades,

  -- Saldo
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE -mc.valor END), 0) as saldo_periodo,

  -- Diferenças de caixa (quebras)
  COALESCE(SUM(ABS(c.diferenca)), 0) FILTER (WHERE c.status = 'fechado') as total_diferencas,
  COUNT(*) FILTER (WHERE c.status = 'fechado' AND ABS(c.diferenca) > 0) as dias_com_diferenca

FROM caixas c
LEFT JOIN movimentacoes_caixa mc ON mc.caixa_id = c.id
GROUP BY DATE_TRUNC('month', c.data)::DATE, EXTRACT(YEAR FROM c.data), EXTRACT(MONTH FROM c.data)
ORDER BY mes_ano DESC;

-- View: Alunos com mensalidades em atraso
CREATE OR REPLACE VIEW vw_alunos_inadimplentes AS
SELECT
  a.id as aluno_id,
  a.nome_completo,
  a.telefone,
  a.email,
  a.status as status_aluno,
  COUNT(DISTINCT m.id) as total_mensalidades_atrasadas,
  SUM(m.valor) as valor_total_devido,
  MIN(m.data_vencimento) as vencimento_mais_antigo,
  MAX(m.data_vencimento) as vencimento_mais_recente,
  CURRENT_DATE - MIN(m.data_vencimento) as dias_atraso_maior
FROM alunos a
JOIN matriculas mat ON mat.aluno_id = a.id
JOIN mensalidades m ON m.matricula_id = mat.id
WHERE m.status IN ('pendente', 'vencido')
  AND m.data_vencimento < CURRENT_DATE
GROUP BY a.id, a.nome_completo, a.telefone, a.email, a.status
ORDER BY dias_atraso_maior DESC, valor_total_devido DESC;

-- View: Movimentações do dia (caixa aberto)
CREATE OR REPLACE VIEW vw_movimentacoes_hoje AS
SELECT
  mc.id,
  mc.tipo,
  mc.setor,
  mc.valor,
  mc.descricao,
  mc.forma_pagamento,
  mc.created_at as horario,
  p.name as registrado_por_nome,
  c.data as data_caixa,
  c.status as status_caixa,
  CASE
    WHEN mc.mensalidade_id IS NOT NULL THEN 'Mensalidade'
    WHEN mc.despesa_id IS NOT NULL THEN 'Despesa'
    ELSE 'Venda'
  END as tipo_operacao
FROM movimentacoes_caixa mc
JOIN caixas c ON c.id = mc.caixa_id
LEFT JOIN profiles p ON p.id = mc.registrado_por
WHERE c.data = CURRENT_DATE
ORDER BY mc.created_at DESC;

-- ===================================================================
-- 15. ROW LEVEL SECURITY (RLS)
-- ===================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes_caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacoes_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes_bancarias ENABLE ROW LEVEL SECURITY;

-- Políticas: Admins têm acesso total
CREATE POLICY "Admins acesso total alunos" ON alunos FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total cursos" ON cursos FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total matriculas" ON matriculas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total mensalidades" ON mensalidades FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total caixas" ON caixas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total movimentacoes_caixa" ON movimentacoes_caixa FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total despesas" ON despesas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total conciliacoes_bancarias" ON conciliacoes_bancarias FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total transacoes_bancarias" ON transacoes_bancarias FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ===================================================================
-- 16. DADOS INICIAIS (SEED DATA)
-- ===================================================================

-- Inserir categorias padrão de despesas (como comentário para referência)
-- Categorias sugeridas:
-- - luz, agua, internet, telefone
-- - material_escritorio, material_limpeza
-- - manutencao, reparos
-- - compras_miudas (carvão, cigarro, etc.)
-- - aluguel, condominio
-- - impostos, taxas
-- - outros

-- ===================================================================
-- MENSAGEM DE SUCESSO
-- ===================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Schema do Módulo Financeiro criado com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  1. alunos - Cadastro de alunos';
  RAISE NOTICE '  2. cursos - Cursos disponíveis (regulares e avulsos)';
  RAISE NOTICE '  3. matriculas - Matrícula aluno × curso';
  RAISE NOTICE '  4. mensalidades - Mensalidades geradas automaticamente';
  RAISE NOTICE '  5. caixas - Controle de caixa diário';
  RAISE NOTICE '  6. movimentacoes_caixa - Entradas/saídas do caixa';
  RAISE NOTICE '  7. despesas - Contas a pagar com comprovantes';
  RAISE NOTICE '  8. conciliacoes_bancarias - Importação de extratos';
  RAISE NOTICE '  9. transacoes_bancarias - Transações do extrato';
  RAISE NOTICE '';
  RAISE NOTICE 'Views criadas:';
  RAISE NOTICE '  - vw_mensalidades_pendentes';
  RAISE NOTICE '  - vw_despesas_pendentes';
  RAISE NOTICE '  - vw_resumo_financeiro_mensal';
  RAISE NOTICE '  - vw_alunos_inadimplentes';
  RAISE NOTICE '  - vw_movimentacoes_hoje';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções criadas:';
  RAISE NOTICE '  - gerar_mensalidades_mes(mes, ano) - Gera mensalidades automaticamente';
  RAISE NOTICE '  - atualizar_status_mensalidades_vencidas() - Atualiza status vencidos';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Cadastrar cursos no sistema';
  RAISE NOTICE '  2. Cadastrar alunos';
  RAISE NOTICE '  3. Criar matrículas';
  RAISE NOTICE '  4. Executar gerar_mensalidades_mes() para criar mensalidades';
  RAISE NOTICE '  5. Começar a usar o sistema de caixa diário';
  RAISE NOTICE '';
  RAISE NOTICE 'Para gerar mensalidades do próximo mês:';
  RAISE NOTICE '  SELECT * FROM gerar_mensalidades_mes();';
  RAISE NOTICE '';
  RAISE NOTICE 'Para gerar mensalidades de um mês específico:';
  RAISE NOTICE '  SELECT * FROM gerar_mensalidades_mes(11, 2025); -- Novembro 2025';
  RAISE NOTICE '';
END $$;
