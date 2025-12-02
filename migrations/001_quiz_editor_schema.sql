-- =====================================================
-- SCHEMA: Editor de Formulários do Quiz
-- Descrição: Tabelas para gerenciar etapas, perguntas
--            e opções do quiz-cesca dinamicamente
-- Data: 2025-11-05
-- =====================================================

-- 1. TABELA: formularios
-- Permite gerenciar múltiplos formulários no futuro
CREATE TABLE IF NOT EXISTS formularios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  slug TEXT UNIQUE NOT NULL, -- 'agendamento-cesca'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA: etapas_formulario
-- Armazena cada step/etapa do quiz
CREATE TABLE IF NOT EXISTS etapas_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL, -- 'boas-vindas', 'regras', 'input', 'email', 'telefone', 'select-atendimento', 'checkbox', 'info', 'resumo', 'sucesso', 'recusa'
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  campo TEXT, -- nome do campo no formData (ex: 'nome_completo', 'email', 'primeira_opcao')
  obrigatorio BOOLEAN DEFAULT true,
  validacao_tipo TEXT, -- 'email', 'telefone', 'nome_completo', 'confirmacao_email'
  validacao_mensagem TEXT, -- Mensagem customizada de erro
  placeholder TEXT,
  icone TEXT, -- emoji ou classe de ícone
  botao_texto TEXT, -- texto do botão de próximo
  botao_secundario_texto TEXT, -- texto do botão secundário (ex: "Recusar")
  botao_secundario_step INTEGER, -- step de destino ao clicar botão secundário
  mostrar_progresso BOOLEAN DEFAULT true, -- exibir barra de progresso
  opcoes JSONB, -- Para campos select/radio: [{value: 'X', label: 'Y', descricao: 'Z'}]
  configuracoes JSONB, -- Configs extras específicas do tipo de etapa
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(formulario_id, ordem)
);

-- 3. TABELA: opcoes_atendimento
-- Opções de atendimento disponíveis (Psicografia, Portal, etc)
CREATE TABLE IF NOT EXISTS opcoes_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE, -- 'Psicografia', 'Portal de Obaluaiê', etc
  label TEXT NOT NULL, -- '📜 Psicografia', '🌿 Portal de Obaluaiê', etc
  emoji TEXT, -- '📜', '🌿', etc
  restricao TEXT, -- 'menor' para menores de idade, NULL caso contrário
  descricao TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  configuracoes JSONB, -- Configs extras (ex: requer roupa branca, tempo de atendimento)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA: regras_formulario
-- Regras exibidas no início do formulário
CREATE TABLE IF NOT EXISTS regras_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  texto TEXT NOT NULL,
  icone TEXT, -- emoji ou classe de ícone
  destaque BOOLEAN DEFAULT false, -- se deve ser destacada visualmente
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(formulario_id, ordem)
);

-- 5. ÍNDICES para melhorar performance
CREATE INDEX IF NOT EXISTS idx_etapas_formulario_ordem ON etapas_formulario(formulario_id, ordem);
CREATE INDEX IF NOT EXISTS idx_opcoes_atendimento_ordem ON opcoes_atendimento(ordem);
CREATE INDEX IF NOT EXISTS idx_regras_formulario_ordem ON regras_formulario(formulario_id, ordem);

-- 6. TRIGGER para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_formularios_updated_at
  BEFORE UPDATE ON formularios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_etapas_formulario_updated_at
  BEFORE UPDATE ON etapas_formulario
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opcoes_atendimento_updated_at
  BEFORE UPDATE ON opcoes_atendimento
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regras_formulario_updated_at
  BEFORE UPDATE ON regras_formulario
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. RLS (Row Level Security) - Políticas de acesso
-- Permitir leitura pública para quiz-cesca
ALTER TABLE formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_formulario ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcoes_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_formulario ENABLE ROW LEVEL SECURITY;

-- Política: Leitura pública (para quiz-cesca sem autenticação)
CREATE POLICY "Permitir leitura pública de formulários ativos"
  ON formularios FOR SELECT
  USING (ativo = true);

CREATE POLICY "Permitir leitura pública de etapas ativas"
  ON etapas_formulario FOR SELECT
  USING (ativo = true);

CREATE POLICY "Permitir leitura pública de opções ativas"
  ON opcoes_atendimento FOR SELECT
  USING (ativo = true);

CREATE POLICY "Permitir leitura pública de regras ativas"
  ON regras_formulario FOR SELECT
  USING (ativo = true);

-- Política: Escrita apenas para usuários autenticados (admin-cesca)
CREATE POLICY "Permitir todas operações para admins"
  ON formularios FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir todas operações para admins em etapas"
  ON etapas_formulario FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir todas operações para admins em opções"
  ON opcoes_atendimento FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir todas operações para admins em regras"
  ON regras_formulario FOR ALL
  USING (auth.role() = 'authenticated');

-- =====================================================
-- COMENTÁRIOS nas tabelas para documentação
-- =====================================================

COMMENT ON TABLE formularios IS 'Formulários disponíveis (quiz de agendamento, etc)';
COMMENT ON TABLE etapas_formulario IS 'Etapas/steps de cada formulário com validações e configurações';
COMMENT ON TABLE opcoes_atendimento IS 'Opções de atendimento disponíveis (Psicografia, Portal, Baralho, etc)';
COMMENT ON TABLE regras_formulario IS 'Regras e avisos exibidos no início do formulário';

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
