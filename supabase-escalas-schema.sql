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
  t.numero,
  t.nome_completo,
  t.grupo,
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
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.trabalhador_original_id = t.id
    AND s.data_solicitacao >= CURRENT_DATE - interval '3 months'
  ) as substituicoes_solicitadas,

  -- Substituições realizadas (quando substituiu alguém)
  COUNT(DISTINCT s.id) FILTER (
    WHERE s.trabalhador_substituto_id = t.id
    AND s.status = 'aprovada'
    AND s.data_solicitacao >= CURRENT_DATE - interval '3 months'
  ) as substituicoes_realizadas,

  -- Capacitações (quantos tipos de atendimento pode fazer)
  COUNT(DISTINCT tc.tipo_atendimento_id) as qtd_capacitacoes

FROM trabalhadores t
LEFT JOIN escalas_detalhes ed ON ed.trabalhador_id = t.id
LEFT JOIN presencas_escalas pe ON pe.escala_detalhe_id = ed.id
LEFT JOIN substituicoes s ON s.trabalhador_original_id = t.id OR s.trabalhador_substituto_id = t.id
LEFT JOIN trabalhadores_capacitacoes tc ON tc.trabalhador_id = t.id

WHERE t.status = 'ativo'
GROUP BY t.id, t.numero, t.nome_completo, t.grupo, t.status
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
      'numero', t.numero,
      'grupo', t.grupo,
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
