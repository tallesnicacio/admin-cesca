-- ===================================================================
-- SCHEMA LOCAL - Admin CESCA + Quiz CESCA
-- PostgreSQL puro (sem Supabase / sem auth.users / sem RLS)
-- Controle de acesso feito pelo backend Node.js/Express
-- ===================================================================

-- Extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===================================================================
-- TABELA: users
-- Substitui auth.users do Supabase
-- ===================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL;

-- ===================================================================
-- TABELA: profiles
-- Perfis de usuários (antes referenciava auth.users, agora referencia users)
-- ===================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  cpf TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- ===================================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ===================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- TABELAS: quizzes, questions, quiz_results
-- ===================================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);

CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_id ON quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed_at ON quiz_results(completed_at DESC);

DROP TRIGGER IF EXISTS update_quizzes_updated_at ON quizzes;
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE VIEW vw_quiz_stats AS
SELECT
  q.id as quiz_id, q.title,
  COUNT(DISTINCT qr.user_id) as total_attempts,
  COUNT(DISTINCT CASE WHEN qr.passed THEN qr.user_id END) as passed_count,
  ROUND(AVG(qr.score)::numeric, 2) as avg_score,
  MAX(qr.completed_at) as last_attempt
FROM quizzes q
LEFT JOIN quiz_results qr ON q.id = qr.quiz_id
GROUP BY q.id, q.title;

-- ===================================================================
-- MÓDULO FINANCEIRO
-- ===================================================================

CREATE TABLE IF NOT EXISTS alunos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  cpf TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  data_nascimento DATE,
  endereco TEXT,
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_status_aluno CHECK (status IN ('ativo', 'inativo', 'trancado'))
);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_completo);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_cpf ON alunos(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alunos_created ON alunos(created_at DESC);

CREATE TABLE IF NOT EXISTS cursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  tipo TEXT NOT NULL,
  valor_mensalidade DECIMAL(10,2) NOT NULL,
  dia_vencimento INTEGER DEFAULT 10,
  duracao_meses INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_tipo_curso CHECK (tipo IN ('regular', 'avulso')),
  CONSTRAINT check_dia_vencimento CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  CONSTRAINT check_valor_positivo CHECK (valor_mensalidade > 0),
  CONSTRAINT check_duracao_avulso CHECK (
    (tipo = 'regular' AND duracao_meses IS NULL) OR (tipo = 'avulso' AND duracao_meses > 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_cursos_tipo ON cursos(tipo);
CREATE INDEX IF NOT EXISTS idx_cursos_ativo ON cursos(ativo);

CREATE TABLE IF NOT EXISTS matriculas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES alunos(id) ON DELETE RESTRICT,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
  data_matricula DATE NOT NULL DEFAULT CURRENT_DATE,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dia_vencimento_personalizado INTEGER,
  status TEXT DEFAULT 'ativa',
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_status_matricula CHECK (status IN ('ativa', 'trancada', 'cancelada', 'concluida')),
  CONSTRAINT check_dia_vencimento_personalizado CHECK (
    dia_vencimento_personalizado IS NULL OR
    (dia_vencimento_personalizado >= 1 AND dia_vencimento_personalizado <= 31)
  ),
  CONSTRAINT check_data_fim CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON matriculas(aluno_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_curso ON matriculas(curso_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_status ON matriculas(status);
CREATE INDEX IF NOT EXISTS idx_matriculas_ativas ON matriculas(status) WHERE status = 'ativa';

CREATE TABLE IF NOT EXISTS mensalidades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula_id UUID NOT NULL REFERENCES matriculas(id) ON DELETE CASCADE,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago DECIMAL(10,2),
  status TEXT DEFAULT 'pendente',
  forma_pagamento TEXT,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  gerado_automaticamente BOOLEAN DEFAULT true,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(matricula_id, mes_referencia, ano_referencia),
  CONSTRAINT check_mes_referencia CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  CONSTRAINT check_ano_referencia CHECK (ano_referencia >= 2020 AND ano_referencia <= 2100),
  CONSTRAINT check_status_mensalidade CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado'))
);
CREATE INDEX IF NOT EXISTS idx_mensalidades_matricula ON mensalidades(matricula_id);
CREATE INDEX IF NOT EXISTS idx_mensalidades_status ON mensalidades(status);
CREATE INDEX IF NOT EXISTS idx_mensalidades_vencimento ON mensalidades(data_vencimento);

-- despesas definida antes de movimentacoes_caixa por causa da FK
CREATE TABLE IF NOT EXISTS despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fornecedor TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT,
  valor DECIMAL(10,2) NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'a_pagar',
  forma_pagamento TEXT,
  comprovante_url TEXT,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  registrado_por UUID REFERENCES profiles(id),
  pago_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_status_despesa CHECK (status IN ('a_pagar', 'pago', 'vencido', 'cancelado')),
  CONSTRAINT check_valor_positivo_desp CHECK (valor > 0),
  CONSTRAINT check_data_vencimento_desp CHECK (data_vencimento >= data_emissao)
);
CREATE INDEX IF NOT EXISTS idx_despesas_status ON despesas(status);
CREATE INDEX IF NOT EXISTS idx_despesas_vencimento ON despesas(data_vencimento);

CREATE TABLE IF NOT EXISTS caixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  setor TEXT NOT NULL DEFAULT 'geral',
  valor_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_final_esperado DECIMAL(10,2),
  valor_final_real DECIMAL(10,2),
  diferenca DECIMAL(10,2),
  status TEXT DEFAULT 'aberto',
  aberto_por UUID REFERENCES profiles(id),
  fechado_por UUID REFERENCES profiles(id),
  hora_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  hora_fechamento TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_status_caixa CHECK (status IN ('aberto', 'fechado'))
);
CREATE INDEX IF NOT EXISTS idx_caixas_data ON caixas(data DESC);
CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status);
CREATE INDEX IF NOT EXISTS idx_caixas_setor_data ON caixas(setor, data);

CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  caixa_id UUID NOT NULL REFERENCES caixas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  setor TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  forma_pagamento TEXT,
  mensalidade_id UUID REFERENCES mensalidades(id),
  despesa_id UUID REFERENCES despesas(id),
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_tipo_movimentacao CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT check_setor_movimentacao CHECK (setor IN ('lanche', 'lojinha', 'mensalidades_cursos')),
  CONSTRAINT check_valor_positivo_mov CHECK (valor > 0)
);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa ON movimentacoes_caixa(caixa_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes_caixa(created_at DESC);

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

CREATE TABLE IF NOT EXISTS transacoes_bancarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conciliacao_id UUID NOT NULL REFERENCES conciliacoes_bancarias(id) ON DELETE CASCADE,
  data_transacao DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  tipo TEXT NOT NULL,
  saldo DECIMAL(10,2),
  conciliado BOOLEAN DEFAULT false,
  movimentacao_caixa_id UUID REFERENCES movimentacoes_caixa(id),
  despesa_id UUID REFERENCES despesas(id),
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  conciliado_por UUID REFERENCES profiles(id),
  conciliado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_tipo_transacao CHECK (tipo IN ('credito', 'debito'))
);

-- Triggers financeiro
CREATE OR REPLACE FUNCTION update_updated_at_financeiro()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_alunos_updated_at ON alunos;
CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON alunos FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_cursos_updated_at ON cursos;
CREATE TRIGGER update_cursos_updated_at BEFORE UPDATE ON cursos FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_matriculas_updated_at ON matriculas;
CREATE TRIGGER update_matriculas_updated_at BEFORE UPDATE ON matriculas FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_mensalidades_updated_at ON mensalidades;
CREATE TRIGGER update_mensalidades_updated_at BEFORE UPDATE ON mensalidades FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_caixas_updated_at ON caixas;
CREATE TRIGGER update_caixas_updated_at BEFORE UPDATE ON caixas FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_movimentacoes_caixa_updated_at ON movimentacoes_caixa;
CREATE TRIGGER update_movimentacoes_caixa_updated_at BEFORE UPDATE ON movimentacoes_caixa FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();
DROP TRIGGER IF EXISTS update_despesas_updated_at ON despesas;
CREATE TRIGGER update_despesas_updated_at BEFORE UPDATE ON despesas FOR EACH ROW EXECUTE FUNCTION update_updated_at_financeiro();

-- Trigger calcular diferença caixa
CREATE OR REPLACE FUNCTION calcular_diferenca_caixa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'fechado' AND OLD.status = 'aberto' THEN
    SELECT NEW.valor_inicial +
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO NEW.valor_final_esperado FROM movimentacoes_caixa WHERE caixa_id = NEW.id;
    NEW.diferenca := NEW.valor_final_real - NEW.valor_final_esperado;
    NEW.hora_fechamento := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_diferenca_caixa ON caixas;
CREATE TRIGGER trigger_calcular_diferenca_caixa BEFORE UPDATE ON caixas FOR EACH ROW EXECUTE FUNCTION calcular_diferenca_caixa();

-- Função gerar mensalidades
CREATE OR REPLACE FUNCTION gerar_mensalidades_mes(p_mes INTEGER DEFAULT NULL, p_ano INTEGER DEFAULT NULL)
RETURNS TABLE(matriculas_processadas INTEGER, mensalidades_criadas INTEGER, erros TEXT[]) AS $$
DECLARE
  v_mes INTEGER; v_ano INTEGER; v_matricula RECORD;
  v_dia_vencimento INTEGER; v_data_vencimento DATE;
  v_contador_matriculas INTEGER := 0; v_contador_mensalidades INTEGER := 0;
  v_erros TEXT[] := ARRAY[]::TEXT[];
BEGIN
  v_mes := COALESCE(p_mes, EXTRACT(MONTH FROM (CURRENT_DATE + interval '1 month'))::INTEGER);
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM (CURRENT_DATE + interval '1 month'))::INTEGER);
  FOR v_matricula IN
    SELECT m.id as matricula_id, m.dia_vencimento_personalizado, m.data_fim,
      c.valor_mensalidade, c.dia_vencimento as dia_vencimento_padrao,
      c.tipo as tipo_curso, c.nome as nome_curso, a.nome_completo as nome_aluno
    FROM matriculas m JOIN cursos c ON c.id = m.curso_id JOIN alunos a ON a.id = m.aluno_id
    WHERE m.status = 'ativa' AND c.tipo = 'regular' AND c.ativo = true
      AND (m.data_fim IS NULL OR m.data_fim >= make_date(v_ano, v_mes, 1))
  LOOP
    v_contador_matriculas := v_contador_matriculas + 1;
    BEGIN
      v_dia_vencimento := COALESCE(v_matricula.dia_vencimento_personalizado, v_matricula.dia_vencimento_padrao);
      v_dia_vencimento := LEAST(v_dia_vencimento,
        EXTRACT(DAY FROM (date_trunc('month', make_date(v_ano, v_mes, 1)) + interval '1 month - 1 day'))::INTEGER);
      v_data_vencimento := make_date(v_ano, v_mes, v_dia_vencimento);
      INSERT INTO mensalidades (matricula_id, mes_referencia, ano_referencia, valor, data_vencimento, status, gerado_automaticamente)
      VALUES (v_matricula.matricula_id, v_mes, v_ano, v_matricula.valor_mensalidade, v_data_vencimento, 'pendente', true)
      ON CONFLICT (matricula_id, mes_referencia, ano_referencia) DO NOTHING;
      IF FOUND THEN v_contador_mensalidades := v_contador_mensalidades + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_erros := array_append(v_erros, format('Erro matrícula %s (%s - %s): %s',
        v_matricula.matricula_id, v_matricula.nome_aluno, v_matricula.nome_curso, SQLERRM));
    END;
  END LOOP;
  RETURN QUERY SELECT v_contador_matriculas, v_contador_mensalidades, v_erros;
END;
$$ LANGUAGE plpgsql;

-- Views financeiro
CREATE OR REPLACE VIEW vw_mensalidades_pendentes AS
SELECT m.id as mensalidade_id, a.id as aluno_id, a.nome_completo as aluno, a.telefone as aluno_telefone,
  a.email as aluno_email, c.id as curso_id, c.nome as curso, mat.id as matricula_id,
  m.mes_referencia, m.ano_referencia, m.valor, m.data_vencimento, m.status,
  CASE WHEN m.data_vencimento < CURRENT_DATE THEN 'vencido'
       WHEN m.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
       WHEN m.data_vencimento <= CURRENT_DATE + 7 THEN 'vence_semana'
       ELSE 'a_vencer' END as situacao,
  CASE WHEN m.data_vencimento < CURRENT_DATE THEN CURRENT_DATE - m.data_vencimento ELSE 0 END as dias_atraso
FROM mensalidades m JOIN matriculas mat ON mat.id = m.matricula_id
JOIN alunos a ON a.id = mat.aluno_id JOIN cursos c ON c.id = mat.curso_id
WHERE m.status IN ('pendente', 'vencido') ORDER BY m.data_vencimento, a.nome_completo;

CREATE OR REPLACE VIEW vw_despesas_pendentes AS
SELECT d.id, d.fornecedor, d.descricao, d.categoria, d.valor, d.data_emissao, d.data_vencimento, d.status,
  d.comprovante_url,
  CASE WHEN d.data_vencimento < CURRENT_DATE THEN 'vencido'
       WHEN d.data_vencimento = CURRENT_DATE THEN 'vence_hoje'
       WHEN d.data_vencimento <= CURRENT_DATE + 7 THEN 'vence_semana'
       ELSE 'a_vencer' END as urgencia,
  CASE WHEN d.data_vencimento < CURRENT_DATE THEN CURRENT_DATE - d.data_vencimento ELSE 0 END as dias_atraso,
  p.name as registrado_por_nome
FROM despesas d LEFT JOIN profiles p ON p.id = d.registrado_por
WHERE d.status IN ('a_pagar', 'vencido') ORDER BY d.data_vencimento;

CREATE OR REPLACE VIEW vw_resumo_financeiro_mensal AS
SELECT DATE_TRUNC('month', c.data)::DATE as mes_ano,
  EXTRACT(YEAR FROM c.data)::INTEGER as ano, EXTRACT(MONTH FROM c.data)::INTEGER as mes,
  COUNT(DISTINCT c.id) as dias_abertos,
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE 0 END), 0) as total_entradas,
  COALESCE(SUM(CASE WHEN mc.tipo = 'saida' THEN mc.valor ELSE 0 END), 0) as total_saidas,
  COALESCE(SUM(CASE WHEN mc.tipo = 'entrada' THEN mc.valor ELSE -mc.valor END), 0) as saldo_periodo
FROM caixas c LEFT JOIN movimentacoes_caixa mc ON mc.caixa_id = c.id
GROUP BY DATE_TRUNC('month', c.data)::DATE, EXTRACT(YEAR FROM c.data), EXTRACT(MONTH FROM c.data)
ORDER BY mes_ano DESC;

-- ===================================================================
-- MÓDULO PRESENÇA (TRABALHADORES + GIRAS)
-- ===================================================================

CREATE TABLE IF NOT EXISTS trabalhadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_nome ON trabalhadores(nome_completo);
CREATE INDEX IF NOT EXISTS idx_trabalhadores_status ON trabalhadores(status);

CREATE TABLE IF NOT EXISTS giras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  dia_semana TEXT NOT NULL CHECK (dia_semana IN ('Segunda', 'Sexta')),
  horario_inicio TEXT DEFAULT '19:30',
  horario_fim TEXT DEFAULT '23:00',
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  status TEXT DEFAULT 'planejada' CHECK (status IN ('planejada', 'realizada', 'cancelada')),
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_giras_data_unique ON giras(data);
CREATE INDEX IF NOT EXISTS idx_giras_data ON giras(data DESC);

CREATE TABLE IF NOT EXISTS presencas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gira_id UUID REFERENCES giras(id) ON DELETE CASCADE NOT NULL,
  trabalhador_id UUID REFERENCES trabalhadores(id) ON DELETE CASCADE NOT NULL,
  presente BOOLEAN NOT NULL DEFAULT false,
  funcao TEXT CHECK (funcao IN ('Psicografia', 'Portal de Obaluaiê', 'Baralho', 'Sala de Tratamento', 'Caboclos', 'Outro', NULL)),
  justificativa_ausencia TEXT,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  registrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gira_id, trabalhador_id)
);
CREATE INDEX IF NOT EXISTS idx_presencas_gira_id ON presencas(gira_id);
CREATE INDEX IF NOT EXISTS idx_presencas_trabalhador_id ON presencas(trabalhador_id);

DROP TRIGGER IF EXISTS update_trabalhadores_updated_at ON trabalhadores;
CREATE TRIGGER update_trabalhadores_updated_at BEFORE UPDATE ON trabalhadores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_giras_updated_at ON giras;
CREATE TRIGGER update_giras_updated_at BEFORE UPDATE ON giras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_presencas_updated_at ON presencas;
CREATE TRIGGER update_presencas_updated_at BEFORE UPDATE ON presencas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE VIEW vw_presenca_trabalhadores AS
SELECT t.id, t.nome_completo, t.telefone, t.email, t.status,
  COUNT(CASE WHEN p.presente = true THEN p.id END) as total_presencas,
  COUNT(CASE WHEN p.presente = false THEN p.id END) as total_ausencias,
  COUNT(p.id) as total_giras,
  CASE WHEN COUNT(p.id) > 0 THEN
    ROUND((COUNT(CASE WHEN p.presente = true THEN p.id END)::NUMERIC / COUNT(p.id)::NUMERIC) * 100, 2)
  ELSE 0 END as percentual_presenca
FROM trabalhadores t LEFT JOIN presencas p ON t.id = p.trabalhador_id
GROUP BY t.id, t.nome_completo, t.telefone, t.email, t.status ORDER BY percentual_presenca DESC;

CREATE OR REPLACE FUNCTION get_proximas_giras(dias_futuros INTEGER DEFAULT 30)
RETURNS TABLE (data DATE, dia_semana TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT d::DATE,
    CASE EXTRACT(DOW FROM d) WHEN 1 THEN 'Segunda' WHEN 5 THEN 'Sexta' END
  FROM generate_series(CURRENT_DATE, CURRENT_DATE + dias_futuros, '1 day'::INTERVAL) d
  WHERE EXTRACT(DOW FROM d) IN (1, 5) ORDER BY d;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- MÓDULO ESCALAS
-- ===================================================================

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

CREATE TABLE IF NOT EXISTS trabalhadores_capacitacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  nivel_experiencia TEXT DEFAULT 'intermediario',
  preferencia_prioridade INTEGER DEFAULT 1,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trabalhador_id, tipo_atendimento_id)
);

CREATE TABLE IF NOT EXISTS funcoes_fixas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE CASCADE,
  dia_semana TEXT,
  motivo TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_dia_semana CHECK (dia_semana IS NULL OR dia_semana IN ('segunda', 'sexta'))
);

CREATE TABLE IF NOT EXISTS restricoes_datas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  motivo TEXT,
  tipo_restricao TEXT DEFAULT 'indisponivel',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_datas_restricao CHECK (data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS escalas_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  status TEXT DEFAULT 'rascunho',
  datas_atendimento DATE[] NOT NULL,
  gerada_automaticamente BOOLEAN DEFAULT true,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  criado_por UUID REFERENCES profiles(id),
  publicado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mes, ano),
  CONSTRAINT check_mes CHECK (mes >= 1 AND mes <= 12),
  CONSTRAINT check_status CHECK (status IN ('rascunho', 'publicada', 'concluida'))
);

CREATE TABLE IF NOT EXISTS escalas_detalhes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_mensal_id UUID NOT NULL REFERENCES escalas_mensais(id) ON DELETE CASCADE,
  data_atendimento DATE NOT NULL,
  tipo_atendimento_id UUID NOT NULL REFERENCES tipos_atendimento(id) ON DELETE RESTRICT,
  trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  posicao_na_equipe INTEGER DEFAULT 1,
  eh_fixo BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(escala_mensal_id, data_atendimento, tipo_atendimento_id, trabalhador_id)
);

CREATE TABLE IF NOT EXISTS presencas_escalas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_detalhe_id UUID NOT NULL REFERENCES escalas_detalhes(id) ON DELETE CASCADE,
  presente BOOLEAN,
  justificativa TEXT,
  registrado_por UUID REFERENCES profiles(id),
  registrado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(escala_detalhe_id)
);

CREATE TABLE IF NOT EXISTS substituicoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escala_detalhe_id UUID NOT NULL REFERENCES escalas_detalhes(id) ON DELETE CASCADE,
  trabalhador_original_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  trabalhador_substituto_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE RESTRICT,
  motivo TEXT,
  data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  solicitado_por UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pendente',
  aprovado_por UUID REFERENCES profiles(id),
  data_aprovacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_substituto_diferente CHECK (trabalhador_original_id != trabalhador_substituto_id),
  CONSTRAINT check_status_substituicao CHECK (status IN ('pendente', 'aprovada', 'recusada'))
);

-- Triggers escalas
CREATE OR REPLACE FUNCTION update_updated_at_escalas()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tipos_atendimento_updated_at ON tipos_atendimento;
CREATE TRIGGER update_tipos_atendimento_updated_at BEFORE UPDATE ON tipos_atendimento FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_trabalhadores_capacitacoes_updated_at ON trabalhadores_capacitacoes;
CREATE TRIGGER update_trabalhadores_capacitacoes_updated_at BEFORE UPDATE ON trabalhadores_capacitacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_funcoes_fixas_updated_at ON funcoes_fixas;
CREATE TRIGGER update_funcoes_fixas_updated_at BEFORE UPDATE ON funcoes_fixas FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_restricoes_datas_updated_at ON restricoes_datas;
CREATE TRIGGER update_restricoes_datas_updated_at BEFORE UPDATE ON restricoes_datas FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_escalas_mensais_updated_at ON escalas_mensais;
CREATE TRIGGER update_escalas_mensais_updated_at BEFORE UPDATE ON escalas_mensais FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_escalas_detalhes_updated_at ON escalas_detalhes;
CREATE TRIGGER update_escalas_detalhes_updated_at BEFORE UPDATE ON escalas_detalhes FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_presencas_escalas_updated_at ON presencas_escalas;
CREATE TRIGGER update_presencas_escalas_updated_at BEFORE UPDATE ON presencas_escalas FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();
DROP TRIGGER IF EXISTS update_substituicoes_updated_at ON substituicoes;
CREATE TRIGGER update_substituicoes_updated_at BEFORE UPDATE ON substituicoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_escalas();

CREATE OR REPLACE FUNCTION obter_datas_atendimento(p_mes INTEGER, p_ano INTEGER)
RETURNS DATE[] AS $$
DECLARE v_datas DATE[]; v_data DATE; v_ultimo_dia DATE;
BEGIN
  v_data := make_date(p_ano, p_mes, 1);
  v_ultimo_dia := (date_trunc('month', v_data) + interval '1 month - 1 day')::date;
  v_datas := ARRAY[]::DATE[];
  WHILE v_data <= v_ultimo_dia LOOP
    IF EXTRACT(DOW FROM v_data) IN (1, 5) THEN v_datas := array_append(v_datas, v_data); END IF;
    v_data := v_data + interval '1 day';
  END LOOP;
  RETURN v_datas;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Seed: tipos de atendimento padrão
INSERT INTO tipos_atendimento (nome, descricao, qtd_pessoas_necessarias, dias_funcionamento, cor_destaque, ordem_exibicao) VALUES
  ('Acolhimento espiritual', 'Recepção e acolhimento inicial dos assistidos', 6, ARRAY['segunda', 'sexta'], '#10b981', 1),
  ('Psicografia', 'Atendimento mediúnico através da psicografia', 2, ARRAY['segunda', 'sexta'], '#8b5cf6', 2),
  ('Sala de tratamento', 'Tratamento espiritual e energético', 2, ARRAY['segunda', 'sexta'], '#06b6d4', 3),
  ('Baralho', 'Atendimento através do baralho cigano', 3, ARRAY['sexta'], '#f59e0b', 4),
  ('Portal de Obaluaê', 'Trabalho espiritual do Portal de Obaluaê', 1, ARRAY['segunda', 'sexta'], '#ef4444', 5),
  ('Coordenação da desobsessão', 'Coordenação dos trabalhos de desobsessão', 1, ARRAY['segunda', 'sexta'], '#6366f1', 6)
ON CONFLICT (nome) DO NOTHING;

-- ===================================================================
-- MÓDULO QUIZ-CESCA (Formulário público de agendamentos)
-- ===================================================================

-- Configurações gerais do sistema
CREATE TABLE IF NOT EXISTS configuracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('agendamentos_ativos', 'true', 'Se o sistema de agendamentos está ativo'),
  ('ignorar_restricao_dias', 'false', 'Ignorar restrição de dias da semana'),
  ('ignorar_restricao_horario', 'false', 'Ignorar restrição de horário')
ON CONFLICT (chave) DO NOTHING;

DROP TRIGGER IF EXISTS update_configuracoes_updated_at ON configuracoes;
CREATE TRIGGER update_configuracoes_updated_at BEFORE UPDATE ON configuracoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Formulários dinâmicos
CREATE TABLE IF NOT EXISTS formularios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS etapas_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT,
  subtitulo TEXT,
  descricao TEXT,
  campo TEXT,
  obrigatorio BOOLEAN DEFAULT false,
  validacao_tipo TEXT,
  placeholder TEXT,
  botao_texto TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_etapas_formulario_id ON etapas_formulario(formulario_id);
CREATE INDEX IF NOT EXISTS idx_etapas_ordem ON etapas_formulario(formulario_id, ordem);

CREATE TABLE IF NOT EXISTS opcoes_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  restricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opcoes_atendimento_ordem ON opcoes_atendimento(ordem);
CREATE INDEX IF NOT EXISTS idx_opcoes_atendimento_ativo ON opcoes_atendimento(ativo);

CREATE TABLE IF NOT EXISTS regras_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  texto TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_regras_formulario_id ON regras_formulario(formulario_id);

-- Agendamentos (submetidos via quiz-cesca)
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  primeira_opcao TEXT,
  segunda_opcao TEXT,
  canal_preferencial TEXT DEFAULT 'email',
  status TEXT DEFAULT 'pendente',
  data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_confirmacao TIMESTAMP WITH TIME ZONE,
  atendente TEXT,
  opcao_escolhida TEXT,
  observacoes TEXT,
  menor_de_idade BOOLEAN DEFAULT false,
  nome_responsavel TEXT,
  cpf_responsavel TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_email ON agendamentos(email);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_solicitacao DESC);

DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Suspensões de usuários
CREATE TABLE IF NOT EXISTS suspensoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  telefone TEXT,
  motivo TEXT,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suspensoes_email ON suspensoes(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suspensoes_telefone ON suspensoes(telefone) WHERE telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_suspensoes_ativo ON suspensoes(ativo);

DROP TRIGGER IF EXISTS update_suspensoes_updated_at ON suspensoes;
CREATE TRIGGER update_suspensoes_updated_at BEFORE UPDATE ON suspensoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- MÓDULO ADVERTÊNCIAS
-- ===================================================================
CREATE TABLE IF NOT EXISTS advertencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trabalhador_id UUID REFERENCES trabalhadores(id) ON DELETE CASCADE,
  tipo TEXT,
  descricao TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  registrado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_advertencias_trabalhador ON advertencias(trabalhador_id);

DROP TRIGGER IF EXISTS update_advertencias_updated_at ON advertencias;
CREATE TRIGGER update_advertencias_updated_at BEFORE UPDATE ON advertencias FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- PERMISSÕES PARA admin_cesca_user
-- ===================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_cesca_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_cesca_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO admin_cesca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin_cesca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin_cesca_user;

DO $$ BEGIN RAISE NOTICE 'Schema admin_cesca criado com sucesso!'; END $$;
