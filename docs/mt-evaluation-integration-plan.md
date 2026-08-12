# Integração do acompanhamento formativo de MTs

## Decisão arquitetural

O acompanhamento dos Médiuns em Treinamento será um módulo do Admin CESCA existente. Autenticação, usuários, trabalhadores, eventos, escalas, API Express, PostgreSQL, Docker Swarm e navegação principal serão evoluídos; não será criado um segundo aplicativo.

## Princípios

1. `trabalhadores.id` será a identidade canônica da pessoa.
2. Nome nunca será chave ou mecanismo automático de união.
3. Nível, condição, vínculo e papel exercido são conceitos independentes.
4. Estado atual não reescreve fatos históricos.
5. Escala prevista e execução efetiva são registros diferentes.
6. Toda obrigação avaliativa termina em avaliação ou justificativa explícita.
7. Progressão e aptidão são decisões humanas apoiadas por evidências.
8. Regras rotineiras devem ser configuráveis e versionadas.

## Reuso do modelo atual

| Requisito | Base existente | Direção |
|---|---|---|
| Pessoa | `trabalhadores` | Tornar identidade canônica |
| Usuário | `profiles` | Reusar; ampliar RBAC |
| Gira/evento | `giras` | Estender para calendário e tipos de evento |
| Área operacional | `tipos_atendimento` | Reusar na escala |
| Área formativa | `funcoes_avaliacao` | Vincular à área operacional; eliminar divergência semântica |
| Elegibilidade | `trabalhadores_capacitacoes` | Evoluir para regras por nível, condição e papel |
| Escala mensal | `escalas_mensais` | Reusar; adicionar origem/importação |
| Escala prevista | `escalas_detalhes` | Reusar como alocação original |
| Presença/ausência | `presencas_escalas` | Evoluir para desfecho operacional |
| Troca | `substituicoes` | Reusar com vínculo à execução efetiva |
| Avaliação | `avaliacoes_mediuns` | Evoluir para obrigação, rascunho, finalização e snapshots |
| Critérios | `criterios_avaliacao` | Versionar por Área + Nível + Papel |

## Modelo-alvo

### Identidade e história

- `trabalhadores`: pessoa canônica, com código interno único e imutável.
- `trabalhadores_vinculos`: MT, Médium da Corrente, Coordenador e Administrador, com vigência.
- `mt_niveis_historico`: MT1/MT2/MT3 com início e fim.
- `condicoes_funcionais`: catálogo administrável.
- `mt_condicoes_historico`: condição com vigência e auditoria.

Os cinco registros existentes em `mediuns_treinamento` deverão ser conciliados manualmente com `trabalhadores`. Correspondência aproximada por nome pode sugerir candidatos, mas nunca confirmar a união.

### Eventos, áreas e escala

- Estender `giras` com código único, tipo, `permite_avaliacao`, prazo e status.
- Criar relação de áreas ativas por evento.
- Vincular `funcoes_avaliacao` a `tipos_atendimento` ou consolidar ambas após análise dos dados reais.
- Criar lote de importação, staging, ocorrências de validação e publicação atômica.
- Preservar a linha original importada para auditoria.

### Execução efetiva

Criar uma participação por Pessoa + Evento + Área + Papel, indicando origem:

- escala original;
- troca;
- participação extra;
- supervisão por Médium da Corrente.

Troca preserva original e substituto. Participação extra não remove ninguém. Médium da Corrente pode supervisionar, mas não gera avaliação de MT.

### Obrigações e avaliações

- `obrigacoes_avaliacao`: participação que exige avaliação ou justificativa.
- `fichas_avaliacao_versoes`: versão vigente por Área + Nível + Papel.
- `fichas_avaliacao_itens`: critérios e escala de desenvolvimento.
- Evoluir `avaliacoes_mediuns` com obrigação, versão da ficha, `rascunho/finalizada/corrigida`, timestamps e snapshots.
- `observacoes_formativas`: registro avulso sem alterar indicadores automaticamente.
- `fechamentos_evento_area`: bloqueia conclusão enquanto houver obrigação pendente.

### Aptidão e progressão

- `aptidoes_area`: executar, treinar MT1, treinar MT2 e fiscalizar, com decisão humana, evidências e vigência.
- Indicadores calculados serão sugestões explicáveis, nunca decisão automática.
- Painéis de progressão exibirão evidências, pendências e histórico recente.

## RBAC

Padronizar os papéis técnicos:

- `admin`;
- `coordinator` para Coordenação formativa;
- `coordenador_lanches` e `vendedor` restritos ao PDV;
- `user` sem permissão formativa por padrão.

Além do papel geral, coordenadores devem receber escopo por área. A autorização precisa existir no backend; ocultar menus no frontend não é controle de acesso.

## Fases de implementação

### Fase 0 — baseline e especificação

- Recuperar e versionar produção.
- Registrar schema real.
- Definir modelo-alvo e migração.
- Nenhuma mudança em produção.

Gate: build, testes disponíveis, hashes, revisão de segurança e aprovação do plano.

### Fase 1 — identidade, história e permissões

- Canonizar `trabalhadores`.
- Criar vínculos, níveis e condições com vigência.
- Conciliar os cinco MTs existentes com confirmação humana.
- Padronizar `coordinator` e escopo por área.

Gate: migration dry-run, rollback, integridade temporal, nenhuma pessoa duplicada e testes RBAC frontend/backend.

### Fase 2 — calendário e importação de escala

- Evoluir eventos e áreas ativas.
- Implementar importação em staging.
- Exibir erros sem correção silenciosa.
- Publicar escala atomicamente.

Gate: arquivos válidos e inválidos, duplicidade, ambiguidade de pessoa, inelegibilidade e rollback integral.

### Fase 3 — pós-gira e obrigações

- Registrar trabalho normal, troca, ausência e participação extra.
- Aplicar elegibilidade.
- Gerar/recalcular obrigações.
- Bloquear conclusão com pendências.

Gate: cenários críticos do briefing reproduzidos, incluindo Cambone em treinamento e supervisor da Corrente.

### Fase 4 — fichas e histórico formativo

- Fichas versionadas por Área + Nível + Papel.
- Escala de desenvolvimento e textos qualitativos.
- Rascunho, finalização, bloqueio e correção administrativa.
- Observação avulsa e histórico individual.

Gate: snapshots históricos permanecem iguais após alterações cadastrais e de critérios.

### Fase 5 — aptidão, prioridades e progressão

- Aptidão humana por área.
- Indicadores explicáveis.
- Prioridades para futuras escalas.
- Painéis de progressão e relatórios.

Gate: nenhuma decisão automática de aptidão ou progressão; evidências rastreáveis até avaliações e observações.

## Privacidade e auditoria

- Minimizar exposição de textos qualitativos.
- Registrar autor, criação, finalização, correção e motivo.
- Impedir exclusão física de fatos formativos.
- Definir política específica para menores de idade e retenção de dados.
- Não registrar credenciais, tokens ou segredos em logs e artefatos.

## Aprovações necessárias

Antes da Fase 1:

1. confirmar `trabalhadores` como identidade canônica;
2. aprovar a conciliação manual dos cinco registros atuais;
3. aprovar os papéis e escopos de Coordenador;
4. aprovar a estratégia de versionamento de fichas;
5. definir responsável pelo tratamento de dados e regras para menores.

Migração real, push, pull request e deploy dependem de aprovação explícita após os gates locais.
