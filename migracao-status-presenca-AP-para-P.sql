-- =====================================================
-- MIGRAÇÃO: Alterar status_presenca de AP para P
-- Data: 2024-10-25
-- Descrição: Migrar códigos de presença de 2 letras para 1 letra
--            AP (Aplicou-se) → P (Presente)
-- =====================================================

-- =====================================================
-- VERIFICAÇÃO INICIAL
-- =====================================================

DO $$
DECLARE
    total_ap INTEGER;
    total_f INTEGER;
    total_j INTEGER;
    total_a INTEGER;
    total_null INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE status_presenca = 'AP'),
        COUNT(*) FILTER (WHERE status_presenca = 'F'),
        COUNT(*) FILTER (WHERE status_presenca = 'J'),
        COUNT(*) FILTER (WHERE status_presenca = 'A'),
        COUNT(*) FILTER (WHERE status_presenca IS NULL)
    INTO total_ap, total_f, total_j, total_a, total_null
    FROM presencas;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SITUAÇÃO ANTES DA MIGRAÇÃO:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'AP (Aplicou-se/Presente): % registros', total_ap;
    RAISE NOTICE 'F (Falta): % registros', total_f;
    RAISE NOTICE 'J (Justificado): % registros', total_j;
    RAISE NOTICE 'A (Afastado): % registros', total_a;
    RAISE NOTICE 'NULL: % registros', total_null;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 1: Remover o constraint antigo
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 1: Removendo constraint antigo...';
END $$;

ALTER TABLE presencas
DROP CONSTRAINT IF EXISTS presencas_status_presenca_check;

-- =====================================================
-- PASSO 2: Converter dados existentes de AP para P
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 2: Convertendo AP → P...';
END $$;

UPDATE presencas
SET status_presenca = 'P'
WHERE status_presenca = 'AP';

-- =====================================================
-- PASSO 3: Adicionar novo constraint (P, F, J, A)
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 3: Adicionando novo constraint...';
END $$;

ALTER TABLE presencas
ADD CONSTRAINT presencas_status_presenca_check
CHECK (status_presenca IN ('P', 'F', 'J', 'A'));

-- =====================================================
-- PASSO 4: Atualizar comentário da coluna
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 4: Atualizando comentário...';
END $$;

COMMENT ON COLUMN presencas.status_presenca IS
'Status: P (Presente), F (Faltou), J (Justificado), A (Afastado)';

-- =====================================================
-- PASSO 5: Recriar view vw_presenca_trabalhadores
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 5: Recriando view vw_presenca_trabalhadores...';
END $$;

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

COMMENT ON VIEW vw_presenca_trabalhadores IS
'Estatísticas de presença por trabalhador com códigos de 1 letra (P/F/J/A)';

-- =====================================================
-- PASSO 6: Conceder permissões
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 6: Concedendo permissões...';
END $$;

GRANT SELECT ON vw_presenca_trabalhadores TO authenticated;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

DO $$
DECLARE
    total_p INTEGER;
    total_f INTEGER;
    total_j INTEGER;
    total_a INTEGER;
    total_null INTEGER;
    total_ap INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE status_presenca = 'P'),
        COUNT(*) FILTER (WHERE status_presenca = 'F'),
        COUNT(*) FILTER (WHERE status_presenca = 'J'),
        COUNT(*) FILTER (WHERE status_presenca = 'A'),
        COUNT(*) FILTER (WHERE status_presenca IS NULL),
        COUNT(*) FILTER (WHERE status_presenca = 'AP')
    INTO total_p, total_f, total_j, total_a, total_null, total_ap
    FROM presencas;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SITUAÇÃO APÓS A MIGRAÇÃO:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'P (Presente): % registros', total_p;
    RAISE NOTICE 'F (Falta): % registros', total_f;
    RAISE NOTICE 'J (Justificado): % registros', total_j;
    RAISE NOTICE 'A (Afastado): % registros', total_a;
    RAISE NOTICE 'NULL: % registros', total_null;
    RAISE NOTICE 'AP (antigo - deve ser 0): % registros', total_ap;
    RAISE NOTICE '========================================';

    IF total_ap > 0 THEN
        RAISE WARNING 'ATENÇÃO: Ainda existem % registros com status AP!', total_ap;
    ELSE
        RAISE NOTICE '✅ Migração concluída com sucesso!';
        RAISE NOTICE '✅ Todos os registros AP foram convertidos para P';
        RAISE NOTICE '✅ Constraint atualizado para (P, F, J, A)';
        RAISE NOTICE '✅ View vw_presenca_trabalhadores atualizada';
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
