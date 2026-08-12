# Baseline de produção — CESCA

Captura somente leitura realizada em 11/12 de agosto de 2026 para reconciliar o repositório Git com os artefatos efetivamente implantados.

## Escopo

- Stack ativa: `cesca`.
- Frontend administrativo e PDV: `admin-cesca:2026.07.23-pdv.15`.
- API: `admin-cesca-api:2026.07.22-pdv.14`.
- Fonte Git usada como comparação: `feat/pdv-lanchonete` em `38086d20a958ae2329456f42f5d8dbefdddba91a`.
- Branch local de recuperação: `recovery/production-baseline-2026-08-11`.

A stack antiga `admin-cesca` estava parada e não foi usada como fonte.

## Proveniência da recuperação

O backend foi copiado diretamente do filesystem do container ativo, sem copiar secrets ou variáveis de ambiente. O frontend foi reconstruído pelos `sourcesContent` dos source maps publicados junto com o build. Foram recuperados 58 arquivos-fonte, sem conflito entre source maps.

Nenhum dado pessoal foi copiado. O inventário do banco contém somente metadados estruturais, contagens agregadas e os catálogos não pessoais de funções e critérios.

## Divergências encontradas

### Backend

Adicionado em produção e ausente no Git:

- `backend/src/routes/avaliacoes.js`

Alterados em produção:

- `backend/src/middleware/auth.js`
- `backend/src/routes/auth.js`
- `backend/src/routes/pdv.js`
- `backend/src/server.js`

### Frontend

Adicionados em produção:

- `src/components/AvaliacaoManager.js`
- `src/pdv/DailyReport.js`
- `src/pdv/offlineStore.js`
- `src/pdv/serviceWorkerRegistration.js`
- `src/pdv/syncManager.js`

Também havia alterações implantadas em Dashboard, usuários, lanchonete, PDV e cliente de API. A lista completa e os hashes permanecem no pacote de evidências externo ao repositório.

### Banco do PDV

O backend recuperado também dependia de estrutura ausente nas migrations `008` e `009`:

- preço promocional no catálogo e no catálogo congelado do caixa;
- estado e auditoria de promoção;
- forma de pagamento separada para doação;
- origem, dispositivo e timestamps de vendas offline;
- dispositivos, eventos de promoção, sincronizações e alertas de conflito.

A migration `010_pdv_offline_promocoes_production_baseline.sql` recupera esse contrato antes da migration de avaliações.

## Schema de avaliações existente

As seguintes tabelas estavam implantadas sem migration correspondente no Git:

- `mediuns_treinamento`
- `mediuns_treinamento_funcoes`
- `funcoes_avaliacao`
- `criterios_avaliacao`
- `avaliacoes_mediuns`
- `avaliacoes_mediuns_criterios`

As migrations `010_pdv_offline_promocoes_production_baseline.sql` e `011_avaliacoes_mediuns_production_baseline.sql` versionam os dois blocos encontrados apenas em produção. A migration de avaliações inclui somente estrutura e catálogos não pessoais; ela não inclui pessoas nem avaliações.

## Estado agregado observado

- 66 trabalhadores no cadastro principal.
- 5 registros no cadastro separado de MTs.
- 7 funções de avaliação.
- 4 critérios.
- Nenhuma avaliação registrada.
- Nenhuma escala mensal registrada.
- Perfis existentes apenas com roles `admin` e `user`.

O estado sem avaliações torna este o momento mais seguro para corrigir a identidade duplicada antes do uso operacional.

## Gates executados

- 58 fontes frontend recuperadas sem conflitos.
- Build de produção React concluído.
- 13 testes frontend aprovados.
- `node --check` aprovado para as rotas e servidor recuperados.
- As migrations recuperadas foram aplicadas duas vezes com sucesso em PostgreSQL 16 descartável.
- Paridade do schema recuperado: 131 colunas, 77 constraints e 30 índices, sem faltas ou sobras em relação ao inventário de produção.
- Teste integrado backend aprovado: fluxo diário, RBAC, idempotência e fechamento.
- Auditoria de dependências: frontend com 63 vulnerabilidades (11 baixas, 16 moderadas, 32 altas e 4 críticas); backend com 1 alta. Não foi aplicado `audit fix` automático.

## Limites

Esta branch representa a melhor reconstrução verificável da fonte implantada. Ela não prova qual checkout ou diretório foi usado durante o build original, pois os artefatos não possuem commit Git incorporado.

Nenhum deploy deve partir desta branch antes de:

1. revisão do diff recuperado;
2. correção ou aceitação explícita das vulnerabilidades;
3. aprovação humana para publicação.
