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
  COUNT(p.id) FILTER (WHERE p.presente = true) as total_presencas,
  COUNT(p.id) FILTER (WHERE p.presente = false) as total_ausencias,
  COUNT(p.id) as total_giras,
  CASE
    WHEN COUNT(p.id) > 0 THEN
      ROUND((COUNT(p.id) FILTER (WHERE p.presente = true)::NUMERIC / COUNT(p.id)::NUMERIC) * 100, 2)
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
  COUNT(p.id) FILTER (WHERE p.presente = true) as total_presentes,
  COUNT(p.id) FILTER (WHERE p.presente = false) as total_ausentes,
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
