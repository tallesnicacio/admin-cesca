-- =====================================================
-- MELHORIAS NO SISTEMA DE PRESENÇA - Admin CESCA
-- Data: 25/10/2024
-- Descrição: Adicionar funcionalidades da planilha Excel
-- =====================================================

-- =====================================================
-- 1. ADICIONAR CAMPOS NA TABELA TRABALHADORES
-- =====================================================

-- Adicionar campo "numero" para identificação numérica
ALTER TABLE trabalhadores
ADD COLUMN IF NOT EXISTS numero INTEGER;

-- Adicionar campo "grupo" (Direção ou Médiuns Correntes)
ALTER TABLE trabalhadores
ADD COLUMN IF NOT EXISTS grupo TEXT CHECK (grupo IN ('Direção', 'Médiuns Correntes'));

-- Adicionar campo "funcao_permanente" (Curimba, Cambono, etc)
ALTER TABLE trabalhadores
ADD COLUMN IF NOT EXISTS funcao_permanente TEXT;

-- Atualizar campo "status" para incluir "Afastado"
ALTER TABLE trabalhadores
DROP CONSTRAINT IF EXISTS trabalhadores_status_check;

ALTER TABLE trabalhadores
ADD CONSTRAINT trabalhadores_status_check
CHECK (status IN ('ativo', 'inativo', 'afastado'));

-- Comentários nos campos
COMMENT ON COLUMN trabalhadores.numero IS 'Número de identificação do trabalhador (para facilitar referência)';
COMMENT ON COLUMN trabalhadores.grupo IS 'Grupo do trabalhador: Direção ou Médiuns Correntes';
COMMENT ON COLUMN trabalhadores.funcao_permanente IS 'Função permanente: Curimba, Cambono, MT1, etc';
COMMENT ON COLUMN trabalhadores.status IS 'Status: ativo, inativo ou afastado';

-- =====================================================
-- 2. ATUALIZAR TABELA PRESENCAS COM STATUS EXPANDIDO
-- =====================================================

-- Adicionar campo "status_presenca" (P, F, J, A)
ALTER TABLE presencas
ADD COLUMN IF NOT EXISTS status_presenca TEXT CHECK (status_presenca IN ('P', 'F', 'J', 'A'));

-- Comentário
COMMENT ON COLUMN presencas.status_presenca IS 'Status: P (Presente), F (Faltou), J (Justificado), A (Afastado)';

-- Atualizar registros existentes baseado no campo "presente"
UPDATE presencas
SET status_presenca = CASE
    WHEN presente = TRUE THEN 'P'
    WHEN presente = FALSE AND justificativa_ausencia IS NOT NULL AND justificativa_ausencia != '' THEN 'J'
    WHEN presente = FALSE THEN 'F'
    ELSE 'F'
END
WHERE status_presenca IS NULL;

-- =====================================================
-- 3. CRIAR TABELA DE ADVERTÊNCIAS
-- =====================================================

CREATE TABLE IF NOT EXISTS advertencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trabalhador_id UUID NOT NULL REFERENCES trabalhadores(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('1º Verbal', '2º Verbal', '3º Verbal', '4º Verbal', '5º Verbal')),
    data_advertencia DATE NOT NULL,
    motivo TEXT,
    observacoes TEXT,
    aplicado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_advertencias_trabalhador ON advertencias(trabalhador_id);
CREATE INDEX IF NOT EXISTS idx_advertencias_data ON advertencias(data_advertencia);
CREATE INDEX IF NOT EXISTS idx_advertencias_tipo ON advertencias(tipo);

-- Comentários
COMMENT ON TABLE advertencias IS 'Registro de advertências verbais aplicadas aos trabalhadores';
COMMENT ON COLUMN advertencias.tipo IS 'Tipo da advertência: 1º, 2º, 3º, 4º ou 5º Verbal';
COMMENT ON COLUMN advertencias.data_advertencia IS 'Data em que a advertência foi aplicada';
COMMENT ON COLUMN advertencias.motivo IS 'Motivo da advertência';
COMMENT ON COLUMN advertencias.aplicado_por IS 'UUID do admin que aplicou a advertência';

-- =====================================================
-- 4. RLS (ROW LEVEL SECURITY) PARA ADVERTÊNCIAS
-- =====================================================

-- Habilitar RLS
ALTER TABLE advertencias ENABLE ROW LEVEL SECURITY;

-- Política de SELECT (apenas admins)
CREATE POLICY "Admins podem ver advertências"
ON advertencias FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Política de INSERT (apenas admins)
CREATE POLICY "Admins podem inserir advertências"
ON advertencias FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Política de UPDATE (apenas admins)
CREATE POLICY "Admins podem atualizar advertências"
ON advertencias FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- Política de DELETE (apenas admins)
CREATE POLICY "Admins podem deletar advertências"
ON advertencias FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
);

-- =====================================================
-- 5. TRIGGER PARA ATUALIZAR updated_at
-- =====================================================

-- Trigger para advertencias
CREATE OR REPLACE TRIGGER update_advertencias_updated_at
    BEFORE UPDATE ON advertencias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. VIEW: RESUMO DE ADVERTÊNCIAS POR TRABALHADOR
-- =====================================================

CREATE OR REPLACE VIEW vw_advertencias_resumo AS
SELECT
    t.id as trabalhador_id,
    t.nome_completo,
    t.grupo,
    t.status,
    COUNT(a.id) as total_advertencias,
    COUNT(CASE WHEN a.tipo = '1º Verbal' THEN 1 END) as advertencias_1,
    COUNT(CASE WHEN a.tipo = '2º Verbal' THEN 1 END) as advertencias_2,
    COUNT(CASE WHEN a.tipo = '3º Verbal' THEN 1 END) as advertencias_3,
    COUNT(CASE WHEN a.tipo = '4º Verbal' THEN 1 END) as advertencias_4,
    COUNT(CASE WHEN a.tipo = '5º Verbal' THEN 1 END) as advertencias_5,
    MAX(a.data_advertencia) as ultima_advertencia
FROM trabalhadores t
LEFT JOIN advertencias a ON t.id = a.trabalhador_id
GROUP BY t.id, t.nome_completo, t.grupo, t.status
ORDER BY total_advertencias DESC, t.nome_completo;

-- Comentário
COMMENT ON VIEW vw_advertencias_resumo IS 'Resumo de advertências por trabalhador com contadores por tipo';

-- =====================================================
-- 7. VIEW: HISTÓRICO COMPLETO DE ADVERTÊNCIAS
-- =====================================================

CREATE OR REPLACE VIEW vw_advertencias_historico AS
SELECT
    a.id,
    a.trabalhador_id,
    t.nome_completo as trabalhador_nome,
    t.numero as trabalhador_numero,
    t.grupo,
    a.tipo,
    a.data_advertencia,
    a.motivo,
    a.observacoes,
    p.name as aplicado_por_nome,
    a.created_at
FROM advertencias a
JOIN trabalhadores t ON a.trabalhador_id = t.id
LEFT JOIN profiles p ON a.aplicado_por = p.id
ORDER BY a.data_advertencia DESC, t.nome_completo;

-- Comentário
COMMENT ON VIEW vw_advertencias_historico IS 'Histórico completo de advertências com informações dos trabalhadores';

-- =====================================================
-- 8. ATUALIZAR VIEW DE PRESENÇA PARA INCLUIR NOVOS CAMPOS
-- =====================================================

DROP VIEW IF EXISTS vw_presenca_trabalhadores;

CREATE OR REPLACE VIEW vw_presenca_trabalhadores AS
SELECT
    t.id as trabalhador_id,
    t.numero,
    t.nome_completo,
    t.grupo,
    t.funcao_permanente,
    t.telefone,
    t.email,
    t.status,
    COUNT(p.id) as total_giras,
    COUNT(CASE WHEN p.status_presenca IN ('P') THEN 1 END) as presencas,
    COUNT(CASE WHEN p.status_presenca IN ('F', 'J', 'A') THEN 1 END) as ausencias,
    COUNT(CASE WHEN p.status_presenca = 'J' THEN 1 END) as justificadas,
    COUNT(CASE WHEN p.status_presenca = 'F' THEN 1 END) as faltas,
    COUNT(CASE WHEN p.status_presenca = 'A' THEN 1 END) as ausencias_afastamento,
    ROUND(
        CASE
            WHEN COUNT(p.id) > 0 THEN
                (COUNT(CASE WHEN p.status_presenca = 'P' THEN 1 END)::NUMERIC / COUNT(p.id)::NUMERIC) * 100
            ELSE 0
        END,
        2
    ) as percentual_presenca,
    (SELECT COUNT(*) FROM advertencias WHERE trabalhador_id = t.id) as total_advertencias
FROM trabalhadores t
LEFT JOIN presencas p ON t.id = p.trabalhador_id
LEFT JOIN giras g ON p.gira_id = g.id
WHERE g.status = 'realizada' OR g.status IS NULL
GROUP BY t.id, t.numero, t.nome_completo, t.grupo, t.funcao_permanente, t.telefone, t.email, t.status
ORDER BY t.numero, t.nome_completo;

-- Comentário
COMMENT ON VIEW vw_presenca_trabalhadores IS 'Estatísticas de presença por trabalhador com novos campos e status expandido';

-- =====================================================
-- 9. FUNÇÃO: PRÓXIMA ADVERTÊNCIA SUGERIDA
-- =====================================================

CREATE OR REPLACE FUNCTION get_proxima_advertencia(p_trabalhador_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ultima_advertencia TEXT;
BEGIN
    -- Buscar a última advertência do trabalhador
    SELECT tipo INTO v_ultima_advertencia
    FROM advertencias
    WHERE trabalhador_id = p_trabalhador_id
    ORDER BY data_advertencia DESC, created_at DESC
    LIMIT 1;

    -- Retornar próxima advertência sugerida
    RETURN CASE
        WHEN v_ultima_advertencia IS NULL THEN '1º Verbal'
        WHEN v_ultima_advertencia = '1º Verbal' THEN '2º Verbal'
        WHEN v_ultima_advertencia = '2º Verbal' THEN '3º Verbal'
        WHEN v_ultima_advertencia = '3º Verbal' THEN '4º Verbal'
        WHEN v_ultima_advertencia = '4º Verbal' THEN '5º Verbal'
        ELSE '5º Verbal (Máximo atingido)'
    END;
END;
$$;

-- Comentário
COMMENT ON FUNCTION get_proxima_advertencia IS 'Retorna a próxima advertência sugerida para um trabalhador';

-- =====================================================
-- 10. ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================

-- Índice para busca por número de trabalhador
CREATE INDEX IF NOT EXISTS idx_trabalhadores_numero ON trabalhadores(numero);

-- Índice para busca por grupo
CREATE INDEX IF NOT EXISTS idx_trabalhadores_grupo ON trabalhadores(grupo);

-- Índice para busca por função permanente
CREATE INDEX IF NOT EXISTS idx_trabalhadores_funcao_permanente ON trabalhadores(funcao_permanente);

-- Índice para busca por status de presença
CREATE INDEX IF NOT EXISTS idx_presencas_status ON presencas(status_presenca);

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Schema de melhorias aplicado com sucesso!';
    RAISE NOTICE '📋 Tabelas atualizadas:';
    RAISE NOTICE '   - trabalhadores: +4 campos (numero, grupo, funcao_permanente, status afastado)';
    RAISE NOTICE '   - presencas: +1 campo (status_presenca: P/F/J/A)';
    RAISE NOTICE '   - advertencias: NOVA TABELA criada';
    RAISE NOTICE '📊 Views criadas/atualizadas:';
    RAISE NOTICE '   - vw_advertencias_resumo';
    RAISE NOTICE '   - vw_advertencias_historico';
    RAISE NOTICE '   - vw_presenca_trabalhadores (atualizada)';
    RAISE NOTICE '🔐 RLS configurado para tabela advertencias';
    RAISE NOTICE '🚀 Sistema pronto para implementação no frontend!';
END $$;
