-- =====================================================
-- ROLLBACK: Reverter status_presenca de P para AP
-- Data: 2024-10-25
-- Descrição: Reverter migração de 1 letra para 2 letras
--            P (Presente) → AP (Aplicou-se)
-- =====================================================
-- ATENÇÃO: Execute apenas se precisar reverter a migração!
-- =====================================================

-- =====================================================
-- VERIFICAÇÃO INICIAL
-- =====================================================

DO $$
DECLARE
    total_p INTEGER;
    total_f INTEGER;
    total_j INTEGER;
    total_a INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE status_presenca = 'P'),
        COUNT(*) FILTER (WHERE status_presenca = 'F'),
        COUNT(*) FILTER (WHERE status_presenca = 'J'),
        COUNT(*) FILTER (WHERE status_presenca = 'A')
    INTO total_p, total_f, total_j, total_a
    FROM presencas;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SITUAÇÃO ANTES DO ROLLBACK:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'P (Presente): % registros', total_p;
    RAISE NOTICE 'F (Falta): % registros', total_f;
    RAISE NOTICE 'J (Justificado): % registros', total_j;
    RAISE NOTICE 'A (Afastado): % registros', total_a;
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- PASSO 1: Remover constraint atual
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 1: Removendo constraint atual...';
END $$;

ALTER TABLE presencas
DROP CONSTRAINT IF EXISTS presencas_status_presenca_check;

-- =====================================================
-- PASSO 2: Converter dados de P para AP
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 2: Convertendo P → AP...';
END $$;

UPDATE presencas
SET status_presenca = 'AP'
WHERE status_presenca = 'P';

-- =====================================================
-- PASSO 3: Adicionar constraint antigo (AP, F, J, A)
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 3: Adicionando constraint antigo...';
END $$;

ALTER TABLE presencas
ADD CONSTRAINT presencas_status_presenca_check
CHECK (status_presenca IN ('AP', 'F', 'J', 'A'));

-- =====================================================
-- PASSO 4: Atualizar comentário da coluna
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'PASSO 4: Atualizando comentário...';
END $$;

COMMENT ON COLUMN presencas.status_presenca IS
'Status: AP (Aplicou-se/Presente), F (Faltou), J (Justificado), A (Ausente)';

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
    COUNT(CASE WHEN p.status_presenca IN ('AP') THEN 1 END) as presencas,
    COUNT(CASE WHEN p.status_presenca IN ('F', 'J', 'A') THEN 1 END) as ausencias,
    COUNT(CASE WHEN p.status_presenca = 'J' THEN 1 END) as justificadas,
    COUNT(CASE WHEN p.status_presenca = 'F' THEN 1 END) as faltas,
    COUNT(CASE WHEN p.status_presenca = 'A' THEN 1 END) as ausencias_afastamento,
    ROUND(
        CASE
            WHEN COUNT(p.id) > 0 THEN
                (COUNT(CASE WHEN p.status_presenca = 'AP' THEN 1 END)::NUMERIC / COUNT(p.id)::NUMERIC) * 100
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
'Estatísticas de presença por trabalhador com códigos AP/F/J/A';

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
    total_ap INTEGER;
    total_f INTEGER;
    total_j INTEGER;
    total_a INTEGER;
    total_p INTEGER;
BEGIN
    SELECT
        COUNT(*) FILTER (WHERE status_presenca = 'AP'),
        COUNT(*) FILTER (WHERE status_presenca = 'F'),
        COUNT(*) FILTER (WHERE status_presenca = 'J'),
        COUNT(*) FILTER (WHERE status_presenca = 'A'),
        COUNT(*) FILTER (WHERE status_presenca = 'P')
    INTO total_ap, total_f, total_j, total_a, total_p
    FROM presencas;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SITUAÇÃO APÓS O ROLLBACK:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'AP (Aplicou-se/Presente): % registros', total_ap;
    RAISE NOTICE 'F (Falta): % registros', total_f;
    RAISE NOTICE 'J (Justificado): % registros', total_j;
    RAISE NOTICE 'A (Afastado): % registros', total_a;
    RAISE NOTICE 'P (novo - deve ser 0): % registros', total_p;
    RAISE NOTICE '========================================';

    IF total_p > 0 THEN
        RAISE WARNING 'ATENÇÃO: Ainda existem % registros com status P!', total_p;
    ELSE
        RAISE NOTICE '✅ Rollback concluído com sucesso!';
        RAISE NOTICE '✅ Todos os registros P foram revertidos para AP';
        RAISE NOTICE '✅ Constraint revertido para (AP, F, J, A)';
        RAISE NOTICE '✅ View vw_presenca_trabalhadores revertida';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  LEMBRE-SE: Você também precisa reverter o código JavaScript!';
    RAISE NOTICE '⚠️  Arquivo: src/components/PresencaManager.js';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIM DO ROLLBACK
-- =====================================================
