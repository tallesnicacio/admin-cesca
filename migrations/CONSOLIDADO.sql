-- ============================================================================
-- MIGRATIONS CONSOLIDADAS - ADMIN CESCA
-- Execute este arquivo completo no Supabase Dashboard → SQL Editor
-- ============================================================================
-- ATENÇÃO: Execute todo o conteúdo deste arquivo de uma vez
-- ============================================================================

-- =====================================================
-- PARTE 1: SCHEMA (001_quiz_editor_schema.sql)
-- =====================================================

-- 1. TABELA: formularios
CREATE TABLE IF NOT EXISTS formularios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA: etapas_formulario
CREATE TABLE IF NOT EXISTS etapas_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  descricao TEXT,
  campo TEXT,
  obrigatorio BOOLEAN DEFAULT true,
  validacao_tipo TEXT,
  validacao_mensagem TEXT,
  placeholder TEXT,
  icone TEXT,
  botao_texto TEXT,
  botao_secundario_texto TEXT,
  botao_secundario_step INTEGER,
  mostrar_progresso BOOLEAN DEFAULT true,
  opcoes JSONB,
  configuracoes JSONB,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(formulario_id, ordem)
);

-- 3. TABELA: opcoes_atendimento
CREATE TABLE IF NOT EXISTS opcoes_atendimento (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  emoji TEXT,
  restricao TEXT,
  descricao TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  configuracoes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA: regras_formulario
CREATE TABLE IF NOT EXISTS regras_formulario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  formulario_id UUID NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  texto TEXT NOT NULL,
  icone TEXT,
  destaque BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(formulario_id, ordem)
);

-- 5. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_etapas_formulario_ordem ON etapas_formulario(formulario_id, ordem);
CREATE INDEX IF NOT EXISTS idx_opcoes_atendimento_ordem ON opcoes_atendimento(ordem);
CREATE INDEX IF NOT EXISTS idx_regras_formulario_ordem ON regras_formulario(formulario_id, ordem);

-- 6. TRIGGER para updated_at
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

-- 7. RLS (Row Level Security)
ALTER TABLE formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_formulario ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcoes_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_formulario ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública
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

-- Políticas de escrita para autenticados
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
-- PARTE 2: DADOS (002_migrate_quiz_data.sql)
-- =====================================================

-- 1. CRIAR FORMULÁRIO PRINCIPAL
INSERT INTO formularios (id, nome, descricao, ativo, slug)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Quiz de Agendamento CESCA',
  'Formulário para agendamento de atendimentos no Centro Espírita Santa Clara de Assis',
  true,
  'agendamento-cesca'
) ON CONFLICT (slug) DO NOTHING;

-- 2. INSERIR OPÇÕES DE ATENDIMENTO
INSERT INTO opcoes_atendimento (value, label, emoji, restricao, descricao, ordem, ativo) VALUES
('Psicografia', '📜 Psicografia', '📜', 'menor', 'Mensagens espirituais escritas através da mediunidade. Um momento de conexão com o plano espiritual para receber orientações e conforto.', 1, true),
('Portal de Obaluaiê', '🌿 Portal de Obaluaiê', '🌿', NULL, 'Trabalho espiritual de cura e limpeza energética conduzido pela entidade Obaluaiê. Indicado para questões de saúde física e espiritual.', 2, true),
('Baralho', '🎴 Baralho', '🎴', 'menor', 'Leitura de cartas conduzida por Mãe Pequena Núbia com orientação espiritual. Uma ferramenta para compreender caminhos e decisões.', 3, true),
('Sala de Tratamento', '🕊 Sala de Tratamento', '🕊', NULL, 'Sessão de passes e tratamento espiritual. Trabalho de harmonização energética e fortalecimento espiritual. Requer uso de roupa branca.', 4, true),
('Caboclos', '🪶 Caboclos', '🪶', NULL, 'Atendimento com entidades caboclas. Orientação espiritual através das linhas de Umbanda, trazendo força e direcionamento.', 5, true)
ON CONFLICT (value) DO NOTHING;

-- 3. INSERIR REGRAS
INSERT INTO regras_formulario (formulario_id, ordem, texto, icone, destaque, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 1, 'Todos os atendimentos dependem de confirmação enviada em até 1 dia por e-mail.', '📧', true, true),
('00000000-0000-0000-0000-000000000001', 2, 'Agendamentos feitos antes das 7h são automaticamente excluídos.', '⏰', false, true),
('00000000-0000-0000-0000-000000000001', 3, 'Cancelamentos devem ser solicitados por e-mail até 12h do dia da gira.', '🚫', false, true),
('00000000-0000-0000-0000-000000000001', 4, 'Menores de idade não podem ser atendidos por Psicografia e Baralho.', '👶', true, true),
('00000000-0000-0000-0000-000000000001', 5, 'Vidência com Mãe Pequena Núbia funciona através de Baralho.', '🔮', false, true),
('00000000-0000-0000-0000-000000000001', 6, 'Sala de Tratamento exige roupa branca e acontece 20h no começo da gira.', '👕', false, true),
('00000000-0000-0000-0000-000000000001', 7, 'Caso sua primeira opção esteja sem vagas, você poderá optar pela segunda.', '🔄', false, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- 4. INSERIR ETAPAS (13 etapas completas)

-- Step 0: Boas-vindas
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, descricao, campo, obrigatorio, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 0, 'boas-vindas', 'Bem-vindo ao Centro Espírita Santa Clara de Assis! 🌟', NULL, 'Estamos felizes em recebê-lo em nossa casa espiritual. Este formulário tem como objetivo facilitar o agendamento dos atendimentos disponíveis em nossas giras.', NULL, false, '🌟', 'Começar Agendamento', false, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 1: Regras
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, icone, botao_texto, botao_secundario_texto, botao_secundario_step, mostrar_progresso, ativo, configuracoes) VALUES
('00000000-0000-0000-0000-000000000001', 1, 'regras', 'Antes de continuar, é importante conhecer nossas regras:', NULL, NULL, false, '📋', 'Próximo', NULL, NULL, false, true, '{"exibir_regras_tabela": true}'::jsonb)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 2: Aceite das regras
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_mensagem, icone, botao_texto, botao_secundario_texto, botao_secundario_step, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 2, 'checkbox', 'Li e concordo com as regras acima', 'É necessário aceitar as regras para continuar', 'aceite_regras', true, 'Você precisa aceitar as regras para continuar', '✅', 'Aceito as Regras', 'Não Aceito', 12, true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 3: Nome completo
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_tipo, validacao_mensagem, placeholder, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 3, 'input', 'Qual é o seu nome completo?', 'Por favor, informe seu nome e sobrenome', 'nome_completo', true, 'nome_completo', 'Por favor, informe seu nome completo (nome e sobrenome)', 'Digite seu nome completo...', '👤', 'Próximo', true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 4: Email
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_tipo, validacao_mensagem, placeholder, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 4, 'email', 'Qual é o seu e-mail?', 'Usaremos para enviar a confirmação do agendamento', 'email', true, 'email', 'Por favor, informe um e-mail válido', 'seu@email.com', '📧', 'Próximo', true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 5: Telefone
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_tipo, validacao_mensagem, placeholder, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 5, 'telefone', 'Qual é o seu telefone?', 'Com DDD, apenas números', 'telefone', true, 'telefone', 'Por favor, informe um telefone válido com DDD (10 ou 11 dígitos)', '(00) 00000-0000', '📱', 'Próximo', true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 6: Primeira opção
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_mensagem, icone, botao_texto, mostrar_progresso, ativo, configuracoes) VALUES
('00000000-0000-0000-0000-000000000001', 6, 'select-atendimento', 'Escolha sua primeira opção de atendimento:', 'Selecione o tipo de atendimento que deseja', 'primeira_opcao', true, 'Por favor, selecione uma opção de atendimento', '🎯', 'Próximo', true, true, '{"fonte": "opcoes_atendimento", "tipo_selecao": "primeira"}'::jsonb)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 7: Segunda opção
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_mensagem, icone, botao_texto, mostrar_progresso, ativo, configuracoes) VALUES
('00000000-0000-0000-0000-000000000001', 7, 'select-atendimento', 'Escolha uma segunda opção (caso a primeira esteja cheia):', 'Esta opção é importante caso não haja mais vagas na primeira', 'segunda_opcao', true, 'Por favor, selecione uma segunda opção diferente da primeira', '🔄', 'Próximo', true, true, '{"fonte": "opcoes_atendimento", "tipo_selecao": "segunda"}'::jsonb)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 8: Info sobre email
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, descricao, campo, obrigatorio, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 8, 'info', 'Importante! 📧', NULL, 'Enviaremos um e-mail de confirmação em até 24 horas. Por favor, verifique sua caixa de entrada e também o spam.', NULL, false, '📧', 'Entendi', true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 9: Confirmação de email
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, validacao_tipo, validacao_mensagem, placeholder, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 9, 'email', 'Confirme seu e-mail:', 'Digite o mesmo e-mail novamente para confirmar', 'email_confirmacao', true, 'confirmacao_email', 'Os e-mails não coincidem. Por favor, verifique.', 'Confirme seu e-mail...', '✉️', 'Próximo', true, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 10: Resumo
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, campo, obrigatorio, icone, botao_texto, mostrar_progresso, ativo, configuracoes) VALUES
('00000000-0000-0000-0000-000000000001', 10, 'resumo', 'Confirme seus dados:', 'Revise as informações antes de finalizar', NULL, false, '📋', 'Confirmar Agendamento', true, true, '{"exibir_campos": ["nome_completo", "email", "telefone", "primeira_opcao", "segunda_opcao"], "permitir_voltar": true}'::jsonb)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 11: Sucesso
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, descricao, campo, obrigatorio, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 11, 'sucesso', 'Agendamento realizado com sucesso! ✨', NULL, 'Seu agendamento foi registrado. Aguarde o e-mail de confirmação em até 24 horas. Caso não receba, verifique sua caixa de spam ou entre em contato conosco.', NULL, false, '✅', 'Fazer Novo Agendamento', false, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- Step 12: Recusa
INSERT INTO etapas_formulario (formulario_id, ordem, tipo, titulo, subtitulo, descricao, campo, obrigatorio, icone, botao_texto, mostrar_progresso, ativo) VALUES
('00000000-0000-0000-0000-000000000001', 12, 'recusa', 'Que pena! 😢', NULL, 'Entendemos que você não pôde aceitar nossas regras. Se tiver dúvidas ou quiser conversar conosco, entre em contato pelo e-mail ou telefone disponíveis em nosso site.', NULL, false, '❌', 'Voltar ao Início', false, true)
ON CONFLICT (formulario_id, ordem) DO NOTHING;

-- ============================================================================
-- FIM DAS MIGRATIONS
-- ============================================================================
-- Verifique se tudo foi criado corretamente:
-- SELECT * FROM formularios;
-- SELECT * FROM etapas_formulario ORDER BY ordem;
-- SELECT * FROM opcoes_atendimento ORDER BY ordem;
-- SELECT * FROM regras_formulario ORDER BY ordem;
-- ============================================================================
