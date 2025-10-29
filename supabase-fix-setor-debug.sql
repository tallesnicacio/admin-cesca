-- Verificar todas as constraints da tabela caixas
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM
    pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = connamespace
WHERE
    rel.relname = 'caixas'
    AND con.contype = 'c'
ORDER BY
    con.conname;
