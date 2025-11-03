-- Schema para o Admin CESCA (Sistema de Quiz)
-- Execute este SQL no Supabase SQL Editor

-- 1. Tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  cpf TEXT,
  phone TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- 2. Tabela de quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para quizzes
CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);

-- 3. Tabela de questões
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array de opções
  correct_answer INTEGER NOT NULL, -- Índice da resposta correta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para questions
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

-- 4. Tabela de resultados dos quizzes
CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB, -- Array com as respostas do usuário
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para quiz_results
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at DESC);

-- 5. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Usuários podem ver seus próprios perfis"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem atualizar perfis"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para quizzes
CREATE POLICY "Usuários autenticados podem ver quizzes ativos"
  ON quizzes FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Admins podem ver todos os quizzes"
  ON quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem inserir quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem atualizar quizzes"
  ON quizzes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem deletar quizzes"
  ON quizzes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para questions
CREATE POLICY "Usuários autenticados podem ver questões de quizzes ativos"
  ON questions FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM quizzes WHERE id = questions.quiz_id AND is_active = true)
  );

CREATE POLICY "Admins podem gerenciar questões"
  ON questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para quiz_results
CREATE POLICY "Usuários podem ver seus próprios resultados"
  ON quiz_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os resultados"
  ON quiz_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Usuários podem inserir seus próprios resultados"
  ON quiz_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', ''));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. View para relatórios de quizzes
CREATE OR REPLACE VIEW vw_quiz_stats AS
SELECT
  q.id as quiz_id,
  q.title,
  COUNT(DISTINCT qr.user_id) as total_attempts,
  COUNT(DISTINCT CASE WHEN qr.passed THEN qr.user_id END) as passed_count,
  ROUND(AVG(qr.score)::numeric, 2) as avg_score,
  MAX(qr.completed_at) as last_attempt
FROM quizzes q
LEFT JOIN quiz_results qr ON q.id = qr.quiz_id
GROUP BY q.id, q.title;

-- Conceder permissões na view
GRANT SELECT ON vw_quiz_stats TO authenticated;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Schema criado com sucesso!';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '1. Execute este SQL no Supabase SQL Editor';
  RAISE NOTICE '2. Crie um usuário admin manualmente ou via interface';
  RAISE NOTICE '3. Configure a autenticação por email no Supabase Dashboard';
END $$;
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
  COALESCE(SUM(CASE WHEN c.status = 'fechado' THEN ABS(c.diferenca) ELSE 0 END), 0) as total_diferencas,
  COUNT(CASE WHEN c.status = 'fechado' AND ABS(c.diferenca) > 0 THEN 1 END) as dias_com_diferenca

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
-- ===================================================================
-- SCHEMA SISTEMA DE ESCALAS - Centro Espírita Santa Clara de Assis
-- ===================================================================
-- Sistema para organização automática de escalas mensais de atendimento
-- Contempla: segundas e sextas-feiras
-- Data de criação: 2025-10-27
-- ===================================================================

-- ===================================================================
-- 1. TABELA: tipos_atendimento
-- Define os tipos de atendimento disponíveis no terreiro
-- ===================================================================
CREATE TABLE IF NOT EXISTS tipos_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE, -- Ex: Acolhimento espiritual, Psicografia, etc.
  descricao TEXT,
  qtd_pessoas_necessarias INTEGER NOT NULL, -- Quantas pessoas são necessárias
  dias_funcionamento TEXT[] DEFAULT ARRAY['segunda', 'sexta'], -- Dias que este atendimento funciona
  cor_destaque TEXT DEFAULT '#667eea', -- Cor para identificação visual
  ativo BOOLEAN DEFAULT true,
  ordem_exibicao INTEGER DEFAULT 0, -- Para ordenar na interface
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para tipos_atendimento
CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_ativo ON tipos_atendimento(ativo);
CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_ordem ON tipos_atendimento(ordem_exibicao);

COMMENT ON TABLE tipos_atendimento IS 'Define os tipos de atendimento disponíveis (Acolhimento, Psicografia, Baralho, etc.)';
COMMENT ON COLUMN tipos_atendimento.qtd_pessoas_necessarias IS 'Quantas pessoas são necessárias para realizar este atendimento';
COMMENT ON COLUMN tipos_atendimento.dias_funcionamento IS 'Array com dias que este atendimento funciona: [segunda, sexta]';

-- ===================================================================
-- 2. TABELA: trabalhadores_capacitacoes
-- Define quais atendimentos cada trabalhador está capacitado a realizar
-- ===================================================================
CREATE TABLE IF NOT EXISTS trabalhadores_capacitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  nivel_experiencia TEXT DEFAULT 'intermediario', -- iniciante, intermediario, experiente
  preferencia_prioridade INTEGER DEFAULT 1, -- 1=alta, 2=média, 3=baixa
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir que não haja duplicatas
  UNIQUE(trabalhador_id, tipo_atendimento_id)
);

-- Índices para trabalhadores_capacitacoes
CREATE INDEX IF NOT EXISTS idx_trabalhadores_capacitacoes_trabalhador ON trabalhadores_capacitacoes(trabalhador_id);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_capacitacoes_tipo ON trabalhadores_capacitacoes(tipo_atendimento_id);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_capacitacoes_prioridade ON trabalhadores_capacitacoes(preferencia_prioridade);

COMMENT ON TABLE trabalhadores_capacitacoes IS 'Define em quais atendimentos cada trabalhador está capacitado para atuar';
COMMENT ON COLUMN trabalhadores_capacitacoes.nivel_experiencia IS 'Nível de experiência: iniciante, intermediario, experiente';
COMMENT ON COLUMN trabalhadores_capacitacoes.preferencia_prioridade IS '1=Alta (preferência forte), 2=Média, 3=Baixa (evitar se possível)';

-- ===================================================================
-- 3. TABELA: funcoes_fixas
-- Define pessoas que são fixas em determinadas funções/dias
-- ===================================================================
CREATE TABLE IF NOT EXISTS funcoes_fixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  dia_semana TEXT, -- NULL = todos os dias, ou 'segunda', 'sexta'
  motivo TEXT, -- Ex: "Coordenadora principal", "Curimba principal"
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validar dia da semana
  CONSTRAINT check_dia_semana CHECK (dia_semana IS NULL OR dia_semana IN ('segunda', 'sexta'))
);

-- Índices para funcoes_fixas
CREATE INDEX IF NOT EXISTS idx_funcoes_fixas_trabalhador ON funcoes_fixas(trabalhador_id);
CREATE INDEX IF NOT EXISTS idx_funcoes_fixas_tipo ON funcoes_fixas(tipo_atendimento_id);
CREATE INDEX IF NOT EXISTS idx_funcoes_fixas_dia ON funcoes_fixas(dia_semana);
CREATE INDEX IF NOT EXISTS idx_funcoes_fixas_ativo ON funcoes_fixas(ativo);

COMMENT ON TABLE funcoes_fixas IS 'Define pessoas que são fixas em determinadas funções (Ex: Fábia sempre no Baralho nas sextas)';
COMMENT ON COLUMN funcoes_fixas.dia_semana IS 'NULL=todos os dias, ou segunda/sexta específica';

-- ===================================================================
-- 4. TABELA: restricoes_datas
-- Registra quando trabalhadores não podem trabalhar
-- ===================================================================
CREATE TABLE IF NOT EXISTS restricoes_datas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT,
  tipo_restricao TEXT DEFAULT 'indisponivel', -- indisponivel, ferias, afastamento_medico, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validar datas
  CONSTRAINT check_datas_restricao CHECK (data_fim >= data_inicio)
);

-- Índices para restricoes_datas
CREATE INDEX IF NOT EXISTS idx_restricoes_datas_trabalhador ON restricoes_datas(trabalhador_id);
CREATE INDEX IF NOT EXISTS idx_restricoes_datas_periodo ON restricoes_datas(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_restricoes_datas_tipo ON restricoes_datas(tipo_restricao);

COMMENT ON TABLE restricoes_datas IS 'Registra períodos em que trabalhadores não podem trabalhar (férias, viagens, etc.)';
COMMENT ON COLUMN restricoes_datas.tipo_restricao IS 'Tipo da restrição: indisponivel, ferias, afastamento_medico, outro';

-- ===================================================================
-- 5. TABELA: escalas_mensais
-- Cabeçalho da escala de cada mês
-- ===================================================================
CREATE TABLE IF NOT EXISTS escalas_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL, -- 1-12
  ano INTEGER NOT NULL,
  status TEXT DEFAULT 'rascunho', -- rascunho, publicada, concluida
  datas_atendimento DATE[] NOT NULL, -- Array com todas as segundas e sextas do mês
  gerada_automaticamente BOOLEAN DEFAULT true,
  observacoes TEXT,
  criado_por UUID REFERENCES profiles(id),
  publicado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Garantir uma escala por mês/ano
  UNIQUE(mes, ano),

  -- Validar mês
  CONSTRAINT check_mes CHECK (mes >= 1 AND mes <= 12),
  CONSTRAINT check_status CHECK (status IN ('rascunho', 'publicada', 'concluida'))
);

-- Índices para escalas_mensais
CREATE INDEX IF NOT EXISTS idx_escalas_mensais_periodo ON escalas_mensais(ano, mes);
CREATE INDEX IF NOT EXISTS idx_escalas_mensais_status ON escalas_mensais(status);
CREATE INDEX IF NOT EXISTS idx_escalas_mensais_criado_por ON escalas_mensais(criado_por);

COMMENT ON TABLE escalas_mensais IS 'Cabeçalho da escala de cada mês (segundas e sextas)';
COMMENT ON COLUMN escalas_mensais.status IS 'rascunho, publicada (confirmada), concluida';
COMMENT ON COLUMN escalas_mensais.datas_atendimento IS 'Array com todas as segundas e sextas do mês';

-- ===================================================================
-- 6. TABELA: escalas_detalhes
-- Detalhes de quem trabalha em cada data/atendimento
-- ===================================================================
CREATE TABLE IF NOT EXISTS escalas_detalhes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_mensal_id UUID NOT NULL REFERENCES escalas_mensais(id) ON DELETE CASCADE,
  data_atendimento DATE NOT NULL,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE RESTRICT,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  posicao_na_equipe INTEGER DEFAULT 1, -- 1, 2, 3... (para ordenar na lista)
  eh_fixo BOOLEAN DEFAULT false, -- Se foi alocado por ser função fixa
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validar que não haja duplicata de trabalhador na mesma data/atendimento
  UNIQUE(escala_mensal_id, data_atendimento, tipo_atendimento_id, trabalhador_id)
);

-- Índices para escalas_detalhes
CREATE INDEX IF NOT EXISTS idx_escalas_detalhes_escala ON escalas_detalhes(escala_mensal_id);
CREATE INDEX IF NOT EXISTS idx_escalas_detalhes_data ON escalas_detalhes(data_atendimento);
CREATE INDEX IF NOT EXISTS idx_escalas_detalhes_tipo ON escalas_detalhes(tipo_atendimento_id);
CREATE INDEX IF NOT EXISTS idx_escalas_detalhes_trabalhador ON escalas_detalhes(trabalhador_id);

COMMENT ON TABLE escalas_detalhes IS 'Detalhe de cada alocação: quem trabalha em qual atendimento em qual data';
COMMENT ON COLUMN escalas_detalhes.posicao_na_equipe IS 'Posição na equipe (1, 2, 3...) para ordenação';
COMMENT ON COLUMN escalas_detalhes.eh_fixo IS 'TRUE se foi alocado automaticamente por ser função fixa';

-- ===================================================================
-- 7. TABELA: presencas_escalas
-- Registro de presença/ausência nos dias escalados
-- ===================================================================
CREATE TABLE IF NOT EXISTS presencas_escalas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_detalhe_id UUID NOT NULL REFERENCES escalas_detalhes(id) ON DELETE CASCADE,
  presente BOOLEAN, -- NULL=não marcado, true=presente, false=ausente
  justificativa TEXT,
  registrado_por UUID REFERENCES profiles(id),
  registrado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(escala_detalhe_id)
);

-- Índices para presencas_escalas
CREATE INDEX IF NOT EXISTS idx_presencas_escalas_detalhe ON presencas_escalas(escala_detalhe_id);
CREATE INDEX IF NOT EXISTS idx_presencas_escalas_presente ON presencas_escalas(presente);
CREATE INDEX IF NOT EXISTS idx_presencas_escalas_registrado ON presencas_escalas(registrado_em);

COMMENT ON TABLE presencas_escalas IS 'Registro de presença nos dias escalados';
COMMENT ON COLUMN presencas_escalas.presente IS 'NULL=não marcado ainda, true=presente, false=ausente';

-- ===================================================================
-- 8. TABELA: substituicoes
-- Registro de substituições (trocas de escala)
-- ===================================================================
CREATE TABLE IF NOT EXISTS substituicoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_detalhe_id UUID NOT NULL REFERENCES escalas_detalhes(id) ON DELETE CASCADE,
  trabalhador_original_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  trabalhador_substituto_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  motivo TEXT,
  data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  solicitado_por UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pendente', -- pendente, aprovada, recusada
  aprovado_por UUID REFERENCES profiles(id),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validar que substituto seja diferente do original
  CONSTRAINT check_substituto_diferente CHECK (trabalhador_original_id != trabalhador_substituto_id),
  CONSTRAINT check_status_substituicao CHECK (status IN ('pendente', 'aprovada', 'recusada'))
);

-- Índices para substituicoes
CREATE INDEX IF NOT EXISTS idx_substituicoes_detalhe ON substituicoes(escala_detalhe_id);
CREATE INDEX IF NOT EXISTS idx_substituicoes_original ON substituicoes(trabalhador_original_id);
CREATE INDEX IF NOT EXISTS idx_substituicoes_substituto ON substituicoes(trabalhador_substituto_id);
CREATE INDEX IF NOT EXISTS idx_substituicoes_status ON substituicoes(status);
CREATE INDEX IF NOT EXISTS idx_substituicoes_data ON substituicoes(data_solicitacao);

COMMENT ON TABLE substituicoes IS 'Registro de solicitações de substituição/troca de escala';
COMMENT ON COLUMN substituicoes.status IS 'pendente, aprovada, recusada';

-- ===================================================================
-- 9. VIEWS PARA RELATÓRIOS
-- ===================================================================

-- View: Resumo de participação por trabalhador
CREATE OR REPLACE VIEW vw_resumo_participacao_trabalhadores AS
SELECT
  t.id as trabalhador_id,
  t.nome_completo,
  t.status,

  -- Escalas do mês atual
  COUNT(DISTINCT CASE
    WHEN ed.data_atendimento >= date_trunc('month', CURRENT_DATE)
    AND ed.data_atendimento < date_trunc('month', CURRENT_DATE) + interval '1 month'
    THEN ed.id
  END) as escalas_mes_atual,

  -- Escalas totais (últimos 3 meses)
  COUNT(DISTINCT CASE
    WHEN ed.data_atendimento >= CURRENT_DATE - interval '3 months'
    THEN ed.id
  END) as escalas_ultimos_3_meses,

  -- Presenças confirmadas
  COUNT(DISTINCT CASE
    WHEN pe.presente = true
    AND ed.data_atendimento >= CURRENT_DATE - interval '3 months'
    THEN pe.id
  END) as presencas_confirmadas,

  -- Ausências
  COUNT(DISTINCT CASE
    WHEN pe.presente = false
    AND ed.data_atendimento >= CURRENT_DATE - interval '3 months'
    THEN pe.id
  END) as ausencias,

  -- Substituições solicitadas
  COUNT(DISTINCT CASE
    WHEN s.trabalhador_original_id = t.id
    AND s.data_solicitacao >= CURRENT_DATE - interval '3 months'
    THEN s.id
  END) as substituicoes_solicitadas,

  -- Substituições realizadas (quando substituiu alguém)
  COUNT(DISTINCT CASE
    WHEN s.trabalhador_substituto_id = t.id
    AND s.status = 'aprovada'
    AND s.data_solicitacao >= CURRENT_DATE - interval '3 months'
    THEN s.id
  END) as substituicoes_realizadas,

  -- Capacitações (quantos tipos de atendimento pode fazer)
  COUNT(DISTINCT tc.tipo_atendimento_id) as qtd_capacitacoes

FROM trabalhadores t
LEFT JOIN escalas_detalhes ed ON ed.trabalhador_id = t.id
LEFT JOIN presencas_escalas pe ON pe.escala_detalhe_id = ed.id
LEFT JOIN substituicoes s ON s.trabalhador_original_id = t.id OR s.trabalhador_substituto_id = t.id
LEFT JOIN trabalhadores_capacitacoes tc ON tc.trabalhador_id = t.id

WHERE t.status = 'ativo'
GROUP BY t.id, t.nome_completo, t.status
ORDER BY t.nome_completo;

-- View: Escalas por data com detalhes completos
CREATE OR REPLACE VIEW vw_escalas_por_data AS
SELECT
  em.id as escala_mensal_id,
  em.mes,
  em.ano,
  em.status as status_escala,
  ed.data_atendimento,
  EXTRACT(DOW FROM ed.data_atendimento) as dia_semana_num, -- 0=domingo, 1=segunda, 5=sexta
  CASE EXTRACT(DOW FROM ed.data_atendimento)
    WHEN 1 THEN 'Segunda'
    WHEN 5 THEN 'Sexta'
    ELSE 'Outro'
  END as dia_semana_texto,
  ta.id as tipo_atendimento_id,
  ta.nome as tipo_atendimento,
  ta.qtd_pessoas_necessarias,
  COUNT(DISTINCT ed.trabalhador_id) as qtd_pessoas_escaladas,
  json_agg(
    json_build_object(
      'trabalhador_id', t.id,
      'nome', t.nome_completo,
      'posicao', ed.posicao_na_equipe,
      'eh_fixo', ed.eh_fixo
    ) ORDER BY ed.posicao_na_equipe
  ) as trabalhadores

FROM escalas_mensais em
JOIN escalas_detalhes ed ON ed.escala_mensal_id = em.id
JOIN tipos_atendimento ta ON ta.id = ed.tipo_atendimento_id
JOIN trabalhadores t ON t.id = ed.trabalhador_id

GROUP BY
  em.id, em.mes, em.ano, em.status,
  ed.data_atendimento, ta.id, ta.nome, ta.qtd_pessoas_necessarias;

-- ===================================================================
-- 10. TRIGGERS
-- ===================================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_escalas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas relevantes
DROP TRIGGER IF EXISTS update_tipos_atendimento_updated_at ON tipos_atendimento;
CREATE TRIGGER update_tipos_atendimento_updated_at
  BEFORE UPDATE ON tipos_atendimento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_trabalhadores_capacitacoes_updated_at ON trabalhadores_capacitacoes;
CREATE TRIGGER update_trabalhadores_capacitacoes_updated_at
  BEFORE UPDATE ON trabalhadores_capacitacoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_funcoes_fixas_updated_at ON funcoes_fixas;
CREATE TRIGGER update_funcoes_fixas_updated_at
  BEFORE UPDATE ON funcoes_fixas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_restricoes_datas_updated_at ON restricoes_datas;
CREATE TRIGGER update_restricoes_datas_updated_at
  BEFORE UPDATE ON restricoes_datas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_escalas_mensais_updated_at ON escalas_mensais;
CREATE TRIGGER update_escalas_mensais_updated_at
  BEFORE UPDATE ON escalas_mensais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_escalas_detalhes_updated_at ON escalas_detalhes;
CREATE TRIGGER update_escalas_detalhes_updated_at
  BEFORE UPDATE ON escalas_detalhes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_presencas_escalas_updated_at ON presencas_escalas;
CREATE TRIGGER update_presencas_escalas_updated_at
  BEFORE UPDATE ON presencas_escalas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

DROP TRIGGER IF EXISTS update_substituicoes_updated_at ON substituicoes;
CREATE TRIGGER update_substituicoes_updated_at
  BEFORE UPDATE ON substituicoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

-- ===================================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ===================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE tipos_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE trabalhadores_capacitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE funcoes_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE restricoes_datas ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_detalhes ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas_escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE substituicoes ENABLE ROW LEVEL SECURITY;

-- Políticas: Admins têm acesso total a tudo
CREATE POLICY "Admins acesso total tipos_atendimento" ON tipos_atendimento FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total trabalhadores_capacitacoes" ON trabalhadores_capacitacoes FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total funcoes_fixas" ON funcoes_fixas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total restricoes_datas" ON restricoes_datas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total escalas_mensais" ON escalas_mensais FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total escalas_detalhes" ON escalas_detalhes FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total presencas_escalas" ON presencas_escalas FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins acesso total substituicoes" ON substituicoes FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ===================================================================
-- 12. DADOS INICIAIS (SEED DATA)
-- ===================================================================

-- Inserir tipos de atendimento padrão
INSERT INTO tipos_atendimento (nome, descricao, qtd_pessoas_necessarias, dias_funcionamento, cor_destaque, ordem_exibicao) VALUES
  ('Acolhimento espiritual', 'Recepção e acolhimento inicial dos assistidos (pelo menos 1 entre Rovena, Lohane ou Mateustose)', 6, ARRAY['segunda', 'sexta'], '#10b981', 1),
  ('Psicografia', 'Atendimento mediúnico através da psicografia', 2, ARRAY['segunda', 'sexta'], '#8b5cf6', 2),
  ('Sala de tratamento', 'Tratamento espiritual e energético', 2, ARRAY['segunda', 'sexta'], '#06b6d4', 3),
  ('Baralho', 'Atendimento através do baralho cigano (Fábia é fixa todas as sextas)', 3, ARRAY['sexta'], '#f59e0b', 4),
  ('Portal de Obaluaê', 'Trabalho espiritual do Portal de Obaluaê', 1, ARRAY['segunda', 'sexta'], '#ef4444', 5),
  ('Coordenação da desobsessão', 'Coordenação dos trabalhos de desobsessão (priorizar Luma, ou Matheus, Dulce, Jussara Lopes)', 1, ARRAY['segunda', 'sexta'], '#6366f1', 6)
ON CONFLICT (nome) DO NOTHING;

-- ===================================================================
-- 13. FUNÇÃO AUXILIAR: Obter segundas e sextas de um mês
-- ===================================================================

CREATE OR REPLACE FUNCTION obter_datas_atendimento(p_mes INTEGER, p_ano INTEGER)
RETURNS DATE[] AS $$
DECLARE
  v_datas DATE[];
  v_data DATE;
  v_ultimo_dia DATE;
BEGIN
  -- Primeiro dia do mês
  v_data := make_date(p_ano, p_mes, 1);

  -- Último dia do mês
  v_ultimo_dia := (date_trunc('month', v_data) + interval '1 month - 1 day')::date;

  -- Array vazio para começar
  v_datas := ARRAY[]::DATE[];

  -- Iterar por todos os dias do mês
  WHILE v_data <= v_ultimo_dia LOOP
    -- Se for segunda (1) ou sexta (5)
    IF EXTRACT(DOW FROM v_data) IN (1, 5) THEN
      v_datas := array_append(v_datas, v_data);
    END IF;
    v_data := v_data + interval '1 day';
  END LOOP;

  RETURN v_datas;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION obter_datas_atendimento IS 'Retorna array com todas as segundas e sextas de um determinado mês/ano';

-- ===================================================================
-- MENSAGEM DE SUCESSO
-- ===================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Schema de Escalas criado com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  1. tipos_atendimento - Tipos de atendimento disponíveis';
  RAISE NOTICE '  2. trabalhadores_capacitacoes - Capacitações de cada trabalhador';
  RAISE NOTICE '  3. funcoes_fixas - Funções fixas (ex: Fábia no Baralho)';
  RAISE NOTICE '  4. restricoes_datas - Restrições de disponibilidade';
  RAISE NOTICE '  5. escalas_mensais - Cabeçalho da escala mensal';
  RAISE NOTICE '  6. escalas_detalhes - Detalhe de alocações';
  RAISE NOTICE '  7. presencas_escalas - Registro de presença';
  RAISE NOTICE '  8. substituicoes - Solicitações de troca';
  RAISE NOTICE '';
  RAISE NOTICE 'Views criadas:';
  RAISE NOTICE '  - vw_resumo_participacao_trabalhadores';
  RAISE NOTICE '  - vw_escalas_por_data';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Configure as capacitações dos trabalhadores';
  RAISE NOTICE '  2. Configure funções fixas (ex: Fábia no Baralho)';
  RAISE NOTICE '  3. Gere a primeira escala mensal';
  RAISE NOTICE '';
END $$;
-- ============================================
-- SISTEMA DE CONTROLE DE PRESENÇA - CESCA
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- Data: 2024-10-25
-- ============================================

-- 1. TABELA DE TRABALHADORES
-- Cadastro de trabalhadores espirituais (médiuns, passistas, etc)
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

-- Índices para trabalhadores
CREATE INDEX IF NOT EXISTS idx_trabalhadores_nome ON trabalhadores(nome_completo);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_status ON trabalhadores(status);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_created_at ON trabalhadores(created_at DESC);

-- Comentários
COMMENT ON TABLE trabalhadores IS 'Cadastro de trabalhadores espirituais da casa';
COMMENT ON COLUMN trabalhadores.status IS 'Status do trabalhador: ativo ou inativo';

-- ============================================

-- 2. TABELA DE GIRAS
-- Registro de sessões/trabalhos espirituais
CREATE TABLE IF NOT EXISTS giras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('Segunda', 'Sexta')),
  horario_inicio TEXT DEFAULT '19:30',
  horario_fim TEXT DEFAULT '23:00',
  observacoes TEXT,
  status TEXT DEFAULT 'planejada' CHECK (status IN ('planejada', 'realizada', 'cancelada')),
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para giras
CREATE INDEX IF NOT EXISTS idx_giras_data ON giras(data DESC);
CREATE INDEX IF NOT EXISTS idx_giras_status ON giras(status);
CREATE INDEX IF NOT EXISTS idx_giras_dia_semana ON giras(dia_semana);
CREATE INDEX IF NOT EXISTS idx_giras_criado_por ON giras(criado_por);

-- Constraint para evitar duplicatas de giras na mesma data
CREATE UNIQUE INDEX IF NOT EXISTS idx_giras_data_unique ON giras(data);

-- Comentários
COMMENT ON TABLE giras IS 'Registro de giras/sessões espirituais realizadas';
COMMENT ON COLUMN giras.dia_semana IS 'Dia da semana: Segunda ou Sexta';
COMMENT ON COLUMN giras.status IS 'Status da gira: planejada, realizada ou cancelada';

-- ============================================

-- 3. TABELA DE PRESENÇAS
-- Registro de presença dos trabalhadores em cada gira
CREATE TABLE IF NOT EXISTS presencas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gira_id UUID REFERENCES giras(id) ON DELETE CASCADE NOT NULL,
  trabalhador_id UUID REFERENCES trabalhadores(id) ON DELETE CASCADE NOT NULL,
  presente BOOLEAN NOT NULL DEFAULT false,
  funcao TEXT CHECK (funcao IN ('Psicografia', 'Portal de Obaluaiê', 'Baralho', 'Sala de Tratamento', 'Caboclos', 'Outro', NULL)),
  justificativa_ausencia TEXT,
  observacoes TEXT,
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraint: não pode ter presença duplicada
  UNIQUE(gira_id, trabalhador_id)
);

-- Índices para presencas
CREATE INDEX IF NOT EXISTS idx_presencas_gira_id ON presencas(gira_id);
CREATE INDEX IF NOT EXISTS idx_presencas_trabalhador_id ON presencas(trabalhador_id);
CREATE INDEX IF NOT EXISTS idx_presencas_presente ON presencas(presente);
CREATE INDEX IF NOT EXISTS idx_presencas_funcao ON presencas(funcao);
CREATE INDEX IF NOT EXISTS idx_presencas_created_at ON presencas(created_at DESC);

-- Comentários
COMMENT ON TABLE presencas IS 'Registro de presença dos trabalhadores em cada gira';
COMMENT ON COLUMN presencas.funcao IS 'Função exercida pelo trabalhador na gira';
COMMENT ON COLUMN presencas.presente IS 'true = presente, false = ausente';

-- ============================================

-- 4. TRIGGERS PARA ATUALIZAR updated_at
-- Reutiliza a função já existente update_updated_at_column()

DROP TRIGGER IF EXISTS update_trabalhadores_updated_at ON trabalhadores;
CREATE TRIGGER update_trabalhadores_updated_at
  BEFORE UPDATE ON trabalhadores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_giras_updated_at ON giras;
CREATE TRIGGER update_giras_updated_at
  BEFORE UPDATE ON giras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_presencas_updated_at ON presencas;
CREATE TRIGGER update_presencas_updated_at
  BEFORE UPDATE ON presencas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================

-- 5. ROW LEVEL SECURITY (RLS)

-- Habilitar RLS nas tabelas
ALTER TABLE trabalhadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE giras ENABLE ROW LEVEL SECURITY;
ALTER TABLE presencas ENABLE ROW LEVEL SECURITY;

-- Políticas para TRABALHADORES
-- Admins podem fazer tudo
CREATE POLICY "Admins podem ver todos os trabalhadores"
  ON trabalhadores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem inserir trabalhadores"
  ON trabalhadores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem atualizar trabalhadores"
  ON trabalhadores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem deletar trabalhadores"
  ON trabalhadores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para GIRAS
-- Admins podem fazer tudo
CREATE POLICY "Admins podem ver todas as giras"
  ON giras FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem inserir giras"
  ON giras FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem atualizar giras"
  ON giras FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem deletar giras"
  ON giras FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Políticas para PRESENCAS
-- Admins podem fazer tudo
CREATE POLICY "Admins podem ver todas as presencas"
  ON presencas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem inserir presencas"
  ON presencas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem atualizar presencas"
  ON presencas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins podem deletar presencas"
  ON presencas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ============================================

-- 6. VIEWS ÚTEIS PARA RELATÓRIOS

-- View: Estatísticas de presença por trabalhador
CREATE OR REPLACE VIEW vw_presenca_trabalhadores AS
SELECT
  t.id,
  t.nome_completo,
  t.telefone,
  t.email,
  t.status,
  COUNT(CASE WHEN p.presente = true THEN p.id END) as total_presencas,
  COUNT(CASE WHEN p.presente = false THEN p.id END) as total_ausencias,
  COUNT(p.id) as total_giras,
  CASE
    WHEN COUNT(p.id) > 0 THEN
      ROUND((COUNT(CASE WHEN p.presente = true THEN p.id END)::NUMERIC / COUNT(p.id)::NUMERIC) * 100, 2)
    ELSE 0
  END as percentual_presenca
FROM trabalhadores t
LEFT JOIN presencas p ON t.id = p.trabalhador_id
GROUP BY t.id, t.nome_completo, t.telefone, t.email, t.status
ORDER BY percentual_presenca DESC, t.nome_completo;

COMMENT ON VIEW vw_presenca_trabalhadores IS 'Estatísticas de presença por trabalhador';

-- View: Estatísticas de presença por gira
CREATE OR REPLACE VIEW vw_presenca_giras AS
SELECT
  g.id,
  g.data,
  g.dia_semana,
  g.status,
  COUNT(CASE WHEN p.presente = true THEN p.id END) as total_presentes,
  COUNT(CASE WHEN p.presente = false THEN p.id END) as total_ausentes,
  COUNT(p.id) as total_registros
FROM giras g
LEFT JOIN presencas p ON g.id = p.gira_id
GROUP BY g.id, g.data, g.dia_semana, g.status
ORDER BY g.data DESC;

COMMENT ON VIEW vw_presenca_giras IS 'Estatísticas de presença por gira';

-- View: Estatísticas por função
CREATE OR REPLACE VIEW vw_presenca_funcoes AS
SELECT
  p.funcao,
  COUNT(*) as total_vezes_exercida,
  COUNT(DISTINCT p.trabalhador_id) as total_trabalhadores
FROM presencas p
WHERE p.presente = true AND p.funcao IS NOT NULL
GROUP BY p.funcao
ORDER BY total_vezes_exercida DESC;

COMMENT ON VIEW vw_presenca_funcoes IS 'Estatísticas de funções exercidas nas giras';

-- Conceder permissões nas views
GRANT SELECT ON vw_presenca_trabalhadores TO authenticated;
GRANT SELECT ON vw_presenca_giras TO authenticated;
GRANT SELECT ON vw_presenca_funcoes TO authenticated;

-- ============================================

-- 7. FUNÇÕES ÚTEIS

-- Função: Obter próximas datas de giras (segundas e sextas)
CREATE OR REPLACE FUNCTION get_proximas_giras(dias_futuros INTEGER DEFAULT 30)
RETURNS TABLE (
  data DATE,
  dia_semana TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d::DATE as data,
    CASE EXTRACT(DOW FROM d)
      WHEN 1 THEN 'Segunda'
      WHEN 5 THEN 'Sexta'
    END as dia_semana
  FROM generate_series(
    CURRENT_DATE,
    CURRENT_DATE + dias_futuros,
    '1 day'::INTERVAL
  ) d
  WHERE EXTRACT(DOW FROM d) IN (1, 5) -- 1 = Segunda, 5 = Sexta
  ORDER BY d;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_proximas_giras IS 'Retorna as próximas datas de giras (segundas e sextas)';

-- ============================================

-- 8. DADOS INICIAIS (OPCIONAL - apenas para teste)

-- Inserir alguns trabalhadores de exemplo (REMOVA EM PRODUÇÃO)
-- INSERT INTO trabalhadores (nome_completo, telefone, status) VALUES
-- ('João da Silva', '(11) 98888-7777', 'ativo'),
-- ('Maria Santos', '(11) 97777-6666', 'ativo'),
-- ('Pedro Oliveira', '(11) 96666-5555', 'ativo');

-- ============================================

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SCHEMA DE PRESENÇA CRIADO COM SUCESSO!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  ✓ trabalhadores';
  RAISE NOTICE '  ✓ giras';
  RAISE NOTICE '  ✓ presencas';
  RAISE NOTICE '';
  RAISE NOTICE 'Views criadas:';
  RAISE NOTICE '  ✓ vw_presenca_trabalhadores';
  RAISE NOTICE '  ✓ vw_presenca_giras';
  RAISE NOTICE '  ✓ vw_presenca_funcoes';
  RAISE NOTICE '';
  RAISE NOTICE 'Funções criadas:';
  RAISE NOTICE '  ✓ get_proximas_giras()';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS configurado para todas as tabelas';
  RAISE NOTICE 'Apenas ADMINS têm acesso completo';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximo passo: Implementar componentes React';
  RAISE NOTICE '============================================';
END $$;
