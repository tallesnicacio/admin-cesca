# Admin CESCA

![Logo do CESCA](public/logo192.png)

Plataforma operacional do **Centro Espírita Santa Clara de Assis (CESCA)**. O mesmo repositório concentra o painel administrativo, o PDV da lanchonete, a API de negócio e as migrations que sustentam agendamentos, presença, escalas, financeiro, usuários, formulários e avaliações formativas.

> Estado documentado em **12 de agosto de 2026**. A branch `master` contém a baseline recuperada da aplicação implantada e melhorias posteriormente validadas. Consulte [Produção e paridade](#produção-e-paridade) antes de concluir que todo commit da `master` já foi publicado.

## Sumário

- [O que está entregue](#o-que-está-entregue)
- [Aplicações e endereços](#aplicações-e-endereços)
- [Arquitetura](#arquitetura)
- [Módulos funcionais](#módulos-funcionais)
- [Perfis e autorização](#perfis-e-autorização)
- [Fluxos principais](#fluxos-principais)
- [Stack tecnológica](#stack-tecnológica)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como executar](#como-executar)
- [Configuração](#configuração)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Testes e validação](#testes-e-validação)
- [Build e containers](#build-e-containers)
- [Produção e paridade](#produção-e-paridade)
- [Segurança](#segurança)
- [Operação e diagnóstico](#operação-e-diagnóstico)
- [Documentação complementar](#documentação-complementar)
- [Limitações e próximos passos](#limitações-e-próximos-passos)

## O que está entregue

O Admin CESCA já cobre estes domínios:

- gestão segura do ciclo de agendamentos;
- confirmação e reenvio de e-mail;
- cancelamento por link assinado;
- lista de confirmação por gira;
- registro de presença e suspensão por falta;
- cadastro e acompanhamento de trabalhadores;
- advertências e relatórios de presença;
- geração e revisão de escalas;
- restrições, capacitações, funções fixas e substituições;
- gestão financeira, alunos, cursos, matrículas, mensalidades, caixa e despesas;
- editor dinâmico do formulário público de agendamento;
- gestão de usuários e perfis;
- operação da lanchonete;
- PDV instalável com funcionamento offline e sincronização posterior;
- estoque diário, preços promocionais e doações no PDV;
- abertura, fechamento e reabertura auditada de caixa;
- avaliações formativas de médiuns em treinamento;
- relatórios e exportações em PDF/XLSX.

## Aplicações e endereços

| Aplicação | Endereço | Finalidade | Estado observado em produção |
| --- | --- | --- | --- |
| Admin | `https://admin.cesca.digital` | Painel administrativo responsivo | Ativo |
| PDV | `https://pdv.cesca.digital` | Frente de caixa instalável da lanchonete | Ativo |
| Agendamento público | `https://agendamento.cesca.digital` | Formulário consumido pelos consulentes | Cliente externo atendido pela API deste projeto |
| API | Mesma origem, prefixo `/api` | Autenticação, dados e regras de negócio | Ativa atrás do Nginx |
| Health frontend | `/health` | Verificação do container Nginx | Ativo |

Admin e PDV são gerados pelo **mesmo código React**. O modo é escolhido em tempo de execução:

- hostname `pdv.cesca.digital` ativa o `PdvApp`;
- `VITE_APP_MODE=pdv` força o PDV em outro host;
- nos demais casos é carregado o painel administrativo.

O `index.html` também alterna o manifesto PWA conforme o hostname, usando `manifest.json` no Admin e `manifest-pdv.json` no PDV.

## Arquitetura

```mermaid
flowchart LR
    A[Consulente] --> Q[Agendamento público]
    U[Equipe CESCA] --> W[Admin React]
    V[Vendedor] --> P[PDV React/PWA]

    Q -->|/api/data e /api/functions| N[Nginx / Traefik]
    W -->|/api| N
    P -->|/api/pdv| N
    P <-->|IndexedDB + Service Worker| O[Fila offline local]

    N --> E[API Express]
    E --> D[(PostgreSQL)]
    E --> R[Resend]

    subgraph swarm["Docker Swarm — stack cesca"]
      W
      P
      N
      E
    end
```

### Frontend

- React 19 com React Router e Ant Design;
- módulos administrativos carregados com `React.lazy`;
- layout responsivo com sidebar no desktop e drawer no celular;
- cliente compatível com parte da interface do Supabase em `src/supabaseClient.js`, mas apontando para a API própria em `/api`;
- build Vite em `build/`, com assets versionados em `build/static/`;
- PWA gerada por Workbox/VitePWA;
- exportações com jsPDF, jsPDF AutoTable e SheetJS.

### Backend

- API Express em Node.js 20+;
- PostgreSQL acessado com `pg` e pool de conexões;
- autenticação por JWT e conferência do perfil ativo no banco a cada requisição protegida;
- RBAC aplicado no servidor;
- rotas especializadas para autenticação, dados, funções de agendamento, PDV e avaliações;
- integração com Resend para convites e mensagens de agendamento;
- rate limiting em memória para login e rotas gerais;
- health check com consulta real ao banco em `GET /health` quando a API é acessada diretamente.

### Infraestrutura

- imagens separadas `admin-cesca` e `admin-cesca-api`;
- Nginx serve a SPA e encaminha `/api/` para a API;
- Docker Swarm executa Admin, PDV e API na stack `cesca`;
- Traefik publica HTTPS e redireciona HTTP;
- deploy `start-first`, rollback configurado, limites de recursos e logs com rotação;
- credenciais de banco, JWT e Resend fornecidas como Docker Secrets externos.

## Módulos funcionais

### Agendamentos

O módulo administra solicitações originadas no formulário público e mantém o histórico operacional.

Principais capacidades:

- leitura e triagem de solicitações;
- confirmação, cancelamento e arquivamento sem apagar o histórico;
- fixação da data da gira (`gira_data`);
- bloqueio de nomes duplicados na mesma gira;
- tratamento de menores de idade, responsável legal e CPF do responsável;
- envio e reenvio de confirmação;
- token assinado para cancelamento público;
- gestão em lote por regras controladas pela API;
- configuração de abertura e restrições do formulário.

### Confirmação, presença e suspensões

- lista agrupada por gira;
- registro de comparecimento e responsável pelo lançamento;
- cálculo de estatísticas por gira;
- suspensão temporária após falta não justificada;
- consulta pública de suspensão antes de um novo agendamento;
- desativação auditável de suspensões;
- relatórios de presença e advertências.

### Trabalhadores e escalas

- cadastro de trabalhadores;
- capacitações e restrições de data;
- tipos de atendimento e funções fixas;
- geração automática de escala;
- detecção de conflitos e validação de alocação;
- painel de revisão antes da consolidação;
- presenças em escala e substituições;
- advertências relacionadas à operação.

### Financeiro

O painel financeiro reúne:

- alunos;
- cursos;
- matrículas;
- mensalidades;
- caixas e movimentações;
- despesas;
- conciliação e transações bancárias;
- relatórios e exportações.

### Editor do formulário público

O editor retira do código parte do conteúdo que antes era fixo no quiz de agendamento.

Ele trabalha com:

- formulários;
- etapas ordenadas;
- opções de atendimento;
- regras e textos operacionais;
- ativação/desativação de conteúdo;
- leitura pública e escrita autenticada conforme o contrato de dados.

### Lanchonete no Admin

- cadastro e ativação de produtos;
- preço normal e preço promocional;
- visão administrativa da operação;
- acesso reservado a `admin` e `coordenador_lanches`.

### PDV da lanchonete

O PDV é uma PWA focada em uso rápido durante a operação.

Capacidades implementadas:

- login próprio pela mesma API;
- abertura diária do caixa com valor inicial e estoque de todos os produtos;
- catálogo congelado no caixa do dia;
- venda em dinheiro ou Pix;
- forma de pagamento separada para doação;
- preço promocional ativado por caixa;
- baixa de estoque;
- cancelamento com restauração de estoque;
- relatório diário por vendas, produtos, pagamentos e doações;
- fechamento com valor esperado, contado e diferença;
- reabertura somente por supervisor, com motivo e auditoria;
- instalação como aplicativo;
- notificação de atualização disponível.

#### Operação offline

Quando a conexão cai, o PDV mantém no IndexedDB:

- contexto do caixa e catálogo;
- identificador do dispositivo;
- fila de vendas pendentes;
- alterações locais de promoção;
- estado necessário para reconciliar o estoque.

Ao recuperar a conexão, `syncManager.js` envia as vendas e eventos pendentes de forma idempotente. A API registra a sincronização, detecta divergência de estoque e gera alertas. O caixa não pode ser fechado enquanto houver vendas locais pendentes.

### Avaliações formativas

O módulo recuperado da produção inclui:

- cadastro separado de médiuns em treinamento (MT1, MT2 e MT3);
- funções e critérios de avaliação configuráveis;
- regras por nível ou personalizadas;
- lançamento, edição, consulta e exclusão controlada de avaliações;
- resumo por médium;
- acesso de consulta/lançamento para `admin` e `coordinator`;
- manutenção de catálogos e exclusões reservada ao `admin`.

O plano de evolução recomenda usar `trabalhadores.id` como identidade canônica e preservar decisão humana para progressão. Veja `docs/mt-evaluation-integration-plan.md`.

## Perfis e autorização

| Perfil | Capacidades principais |
| --- | --- |
| `admin` | Administração completa, usuários, PDV supervisor, avaliações e catálogos |
| `coordinator` | Consulta e lançamento de avaliações; demais menus não restritos pelo frontend |
| `coordenador_lanches` | Lanchonete, gestão de vendedores, PDV e reabertura de caixa |
| `vendedor` | Operação do PDV |
| `user` | Acesso autenticado básico aos módulos liberados |

Regras importantes:

- o backend nunca confia somente no `role` existente no token;
- o perfil é recarregado de `profiles` e contas inativas recebem `403`;
- apenas `admin` altera ou exclui dados pela rota genérica;
- leitura pública é limitada às tabelas do formulário;
- inserção pública é limitada a `agendamentos`;
- rotas do PDV distinguem operador e supervisor;
- a filtragem de menu melhora a experiência, mas a autorização real permanece na API.

## Fluxos principais

### Da solicitação ao atendimento

1. O consulente preenche o formulário público.
2. A API valida o payload, calcula a próxima gira e impede duplicidade ativa por nome.
3. A equipe analisa a solicitação no Admin.
4. A confirmação dispara o fluxo de e-mail.
5. O agendamento aparece na lista da gira.
6. A presença é registrada após o atendimento.
7. Uma falta pode gerar suspensão temporária segundo as regras existentes.

### Venda online no PDV

1. O operador abre o caixa e informa estoque inicial.
2. O catálogo é congelado para aquele caixa.
3. Produtos, doação e formas de pagamento compõem a venda.
4. A API valida preço, estoque, caixa e operador em transação.
5. A venda gera itens e movimentações de caixa separadas para produtos e doação.
6. O fechamento calcula esperado, contado e diferença.

### Venda offline no PDV

1. A venda recebe `requestId`, horário, dispositivo e snapshot dos preços.
2. Estoque e fila são atualizados localmente.
3. O Service Worker solicita sincronização em segundo plano quando possível.
4. A API deduplica a venda, valida o snapshot e reconcilia o estoque.
5. Conflitos são persistidos em alertas de sincronização.

## Stack tecnológica

| Camada | Tecnologias |
| --- | --- |
| Interface | React 19, React Router 7, Ant Design 5, Ant Design Icons 6, Lucide, Day.js |
| Build/PWA | Vite 7, VitePWA, Workbox |
| Testes frontend | Vitest, jsdom |
| Documentos | jsPDF 4, jsPDF AutoTable, SheetJS 0.20.3 |
| API | Node.js 20+, Express 4 |
| Autenticação | JWT, bcrypt |
| Banco | PostgreSQL, `pg` |
| E-mail | Resend |
| Testes backend | Node Test Runner, Supertest, PostgreSQL 16 |
| Proxy e estáticos | Nginx 1.27 Alpine |
| Produção | Docker Swarm, Traefik, Docker Secrets |

## Estrutura do repositório

```text
admin-cesca/
├── backend/
│   ├── src/
│   │   ├── middleware/auth.js   # JWT, perfil e RBAC
│   │   ├── routes/              # auth, data, functions, pdv, avaliações
│   │   ├── config.js            # env ou arquivo de secret
│   │   ├── db.js                # pool PostgreSQL
│   │   └── server.js            # composição da API
│   └── test/                    # integração do PDV
├── docs/                        # baseline e plano de avaliações
├── migrations/                  # migrations 001–011 e materiais legados
├── public/                      # logos, manifestos, manuais e worker do PDV
├── scripts/                     # deploy de functions e smoke frontend
├── src/
│   ├── components/              # módulos administrativos
│   │   ├── escalas/
│   │   ├── financeiro/
│   │   └── lanchonete/
│   ├── pdv/                     # PWA, offline store, sync e testes
│   ├── services/                # serviços de integração
│   ├── utils/                   # datas de gira e logging
│   ├── App.js                   # seleção Admin/PDV e rotas
│   └── supabaseClient.js        # facade de auth/dados sobre /api
├── Dockerfile                   # build React + Nginx
├── docker-stack.yml             # stack Swarm de produção
├── nginx.conf                   # SPA, cache, headers e proxy /api
├── vite.config.js               # build, testes e PWA
└── package.json
```

Arquivos `.bak`, scripts históricos e o `CONSOLIDADO.sql` foram mantidos como evidência/legado. Para novas mudanças, prefira os arquivos ativos e as migrations numeradas.

## Como executar

### Pré-requisitos

- Node.js `^20.19.0` ou `>=22.12.0` para o frontend;
- Node.js 20+ para a API;
- npm;
- PostgreSQL compatível com as migrations;
- credenciais de desenvolvimento próprias, nunca as de produção.

### Instalação

```bash
git clone git@github.com:tallesnicacio/admin-cesca.git
cd admin-cesca

npm ci
npm --prefix backend ci
```

### API

```bash
cp backend/.env.example backend/.env
# Preencha backend/.env com valores locais.

npm --prefix backend run dev
```

A API usa a porta `3010` por padrão.

### Frontend Admin

```bash
npm run dev
```

### Frontend PDV

```bash
VITE_APP_MODE=pdv npm run dev
```

> O frontend chama `/api` na mesma origem. O repositório não configura atualmente um proxy no servidor de desenvolvimento do Vite. Para desenvolvimento integrado, publique frontend e API atrás de um proxy local equivalente ao Nginx ou adicione uma configuração local de proxy sem versionar segredos.

### Preview do build

```bash
npm run build
npm run preview
```

## Configuração

### Frontend

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `VITE_APP_MODE` | Não | Use `pdv` para forçar a interface do PDV fora do hostname oficial |
| `DOCKER_REGISTRY` | Não no runtime | Convenção legada de build/deploy |
| `VERSION` | Não no runtime | Convenção legada de versionamento |

O frontend não recebe URL nem chave do Supabase: as chamadas seguem para `/api`.

### Backend

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sim* | Connection string PostgreSQL |
| `JWT_SECRET` | Sim* | Assinatura e validação de tokens |
| `RESEND_API_KEY` | Para e-mail* | Convites e mensagens de agendamento |
| `APP_URL` | Sim em produção | Base dos links enviados por e-mail |
| `CORS_ORIGINS` | Recomendável | Lista separada por vírgulas |
| `PORT` | Não | Porta da API; padrão `3010` |
| `NODE_ENV` | Não | Ambiente Node |

`*` Em Swarm, use preferencialmente `DATABASE_URL_FILE`, `JWT_SECRET_FILE` e `RESEND_API_KEY_FILE`. O helper `readSecret` aceita variável direta ou caminho de arquivo.

### Origens CORS oficiais

```text
https://agendamento.cesca.digital
https://admin.cesca.digital
https://pdv.cesca.digital
```

## Banco de dados e migrations

As migrations numeradas representam a evolução conhecida:

| Migration | Conteúdo |
| --- | --- |
| `001` | Schema do editor de formulários |
| `002` | Conteúdo inicial do quiz/agendamento |
| `003` | Configurações globais do sistema |
| `004` | Presença e suspensões |
| `005` | Identificação de menor de idade e responsável |
| `006` | CPF do responsável legal |
| `007` | Gestão segura e histórico de agendamentos |
| `008` | PDV da lanchonete e RBAC relacionado |
| `009` | Estoque diário por caixa |
| `010` | PDV offline, promoções e pagamento separado da doação |
| `011` | Avaliações formativas recuperadas da produção |

As migrations `010` e `011` foram reconstruídas a partir de inspeção somente leitura do schema implantado, sem copiar pessoas ou avaliações.

### Aplicação segura

1. Faça backup e confirme o alvo.
2. Leia integralmente a migration.
3. Teste em PostgreSQL descartável/staging.
4. Execute em ordem.
5. Valide constraints, índices e fluxo da aplicação.
6. Registre quem aplicou, quando e em qual ambiente.

Não execute automaticamente `database-cleanup.sql`, `create-admin-user.sql`, `update-acolhimento.sql` ou `migrations/CONSOLIDADO.sql`. Eles são utilitários operacionais/legados e exigem revisão humana do contexto.

## Testes e validação

### Frontend

```bash
npm test
npm run build
```

Cobertura atual de testes automatizados:

- regras de doação;
- botões de pagamento;
- lógica de preço, carrinho e payload do PDV;
- serviço de e-mail;
- utilitários de datas de gira.

### Backend

```bash
TEST_DATABASE_URL=postgresql://usuario:senha@127.0.0.1:55432/admin_cesca \
  npm --prefix backend test
```

O teste integrado valida autenticação, RBAC, abertura de caixa, estoque, vendas, idempotência, doações, falta de estoque, relatório, fechamento, reabertura e cancelamento.

### Gates confirmados na recuperação da baseline

- 5 suítes e 13 testes frontend aprovados;
- build Vite de produção aprovado;
- integração do backend aprovada em PostgreSQL 16 descartável;
- migrations reaplicáveis no banco descartável;
- build das imagens e smoke Nginx aprovados;
- auditoria npm sem vulnerabilidades no momento da recuperação;
- exportações sintéticas PDF/XLSX aprovadas;
- smoke visual dos logins Admin e PDV sem erros no console.

## Build e containers

### Imagem do frontend

```bash
docker build -t admin-cesca:<tag> .
```

O build é multi-stage:

1. Node 20 executa `npm ci` e `npm run build`;
2. Nginx recebe somente o diretório `build/`.

### Imagem da API

```bash
docker build -t admin-cesca-api:<tag> backend
```

### Stack Swarm

`docker-stack.yml` espera:

- rede externa `network_public`;
- imagens locais/registradas com a mesma `IMAGE_TAG`;
- secrets externos versionados;
- nó manager disponível.

Exemplo conceitual — revise tag, secrets e ambiente antes de executar:

```bash
export IMAGE_TAG=<tag-imutavel>
export CESCA_SECRET_VERSION=<versao>
docker stack deploy -c docker-stack.yml cesca
```

Não use `latest` para uma promoção controlada. Registre a relação entre tag e commit.

### Cache e atualização

O Nginx aplica:

- `no-store` ao shell `index.html` e ao Service Worker;
- cache imutável de um ano a assets com hash;
- `404` quando um asset versionado não existe, evitando servir HTML como JavaScript;
- fallback para `index.html` somente nas rotas da SPA.

## Produção e paridade

### O que foi observado

Na captura de 11/12 de agosto de 2026, a stack ativa era `cesca`:

| Serviço | Imagem observada |
| --- | --- |
| Admin e PDV | `admin-cesca:2026.07.23-pdv.15` |
| API | `admin-cesca-api:2026.07.22-pdv.14` |

A stack antiga `admin-cesca` não foi usada como fonte da recuperação.

### Como a baseline foi recuperada

- backend copiado do filesystem do container ativo, sem variáveis ou secrets;
- 58 fontes frontend recuperadas de `sourcesContent` nos source maps publicados;
- schema comparado por metadados estruturais;
- migrations ausentes reconstruídas sem dados pessoais;
- evidências e limites registrados em `docs/production-baseline-2026-08-11.md`.

### Relação entre GitHub e produção

- o commit `4d4df80` representa a melhor reconstrução verificável da fonte implantada;
- a `master` inclui essa baseline e melhorias posteriores, como atualização de dependências e migração para Vite;
- portanto, **`master` está à frente da imagem atualmente identificada em produção**;
- os artefatos antigos não incorporam SHA Git, então não existe prova criptográfica do checkout original;
- merge no GitHub não significa migration ou deploy automático.

Antes do próximo deploy, revise o diff desde a baseline, gere imagens com tag imutável, associe a tag ao SHA e execute smoke tests após a promoção.

## Segurança

Controles presentes:

- JWT validado pela API;
- perfil e status da conta conferidos no PostgreSQL;
- RBAC no servidor;
- whitelist de tabelas e identificadores na API genérica;
- queries parametrizadas;
- limite de payload e batch;
- leitura/escrita pública reduzida ao necessário para o formulário;
- CORS explícito;
- limite de tamanho do body;
- rate limiting em memória;
- Docker Secrets para produção;
- headers de segurança no Nginx;
- CSP, proteção contra framing e política restrita de permissões;
- logs sem impressão deliberada de secrets.

Pendências conhecidas:

- uma credencial Resend removida do conteúdo atual permanece no histórico Git antigo e deve ser rotacionada no provedor;
- `master` ainda não possui proteção nem checks obrigatórios no GitHub;
- o rate limiting é em memória e não é compartilhado entre réplicas;
- não há pipeline CI versionado no repositório;
- arquivos históricos devem ser revisados antes de qualquer reutilização.

Nunca versione `.env`, connection strings reais, tokens, dumps, dados pessoais ou arquivos de secret.

## Operação e diagnóstico

### Health checks

```bash
curl -fsS https://admin.cesca.digital/health
curl -fsS https://pdv.cesca.digital/health
```

O endpoint publicado pelo Nginx verifica o container frontend. Para avaliar a API e o banco, consulte o `/health` da API dentro da rede ou valide uma operação autenticada controlada.

### Verificação no Swarm

```bash
docker stack services cesca
docker service ps cesca_admin-cesca
docker service ps cesca_pdv-cesca
docker service ps cesca_admin-cesca-api
docker service logs --tail 100 cesca_admin-cesca-api
```

### Smoke frontend local

Com uma instância servindo o build:

```bash
scripts/smoke-frontend.sh http://127.0.0.1:<porta>
```

### Checklist após deploy

- Admin e PDV respondem HTTPS;
- `/health` responde `200`;
- login funciona nos dois hosts;
- Admin abre os módulos permitidos pelo perfil;
- PDV carrega contexto, catálogo e caixa;
- manifestos corretos são entregues em cada hostname;
- Service Worker instala sem erro;
- `/api` alcança a API;
- API alcança o banco;
- logs não mostram loop de restart ou erro de migration;
- uma venda controlada e seu cancelamento preservam estoque e caixa.

## Documentação complementar

| Documento | Assunto |
| --- | --- |
| `docs/production-baseline-2026-08-11.md` | Proveniência, diferenças e gates da recuperação |
| `docs/mt-evaluation-integration-plan.md` | Evolução segura das avaliações de MTs |
| `CONTROLE-PRESENCA-IMPLEMENTACAO.md` | Presença e suspensões |
| `CONFIRMACAO-EMAIL-IMPLEMENTACAO.md` | Fluxo de confirmação por e-mail |
| `DEPLOY-EMAIL-FUNCTION.md` | Histórico do deploy da Edge Function |
| `EDITOR-QUIZ-IMPLEMENTACAO.md` | Editor dinâmico do formulário |
| `INSTRUCOES-MIGRATION.md` | Orientações históricas de migration |
| `PRODUCTION-SETUP.md` | Preparação histórica da base de produção |
| `public/manual-agendamentos.html` | Manual operacional navegável |
| `public/manual-apresentacao.html` | Apresentação visual do fluxo |

Parte da documentação antiga menciona Supabase Functions e procedimentos anteriores à API Express atual. Trate esses arquivos como histórico e confirme o código ativo antes de operar produção.

## Limitações e próximos passos

- rotacionar a credencial Resend exposta no histórico;
- configurar GitHub Actions para testes, build e auditoria;
- proteger `master` e exigir PR/checks;
- criar processo de release que grave SHA na imagem e na aplicação;
- documentar um ambiente de desenvolvimento integrado com proxy `/api`;
- revisar e separar scripts/arquivos legados e backups;
- ampliar testes dos módulos administrativos além do PDV;
- criar staging e runbook formal de rollback;
- revisar o bundle principal, ainda grande apesar do lazy loading;
- reconciliar os cadastros de MT com `trabalhadores.id` antes da evolução formativa;
- revisar a titularidade e o texto do arquivo `LICENSE` legado.

## Licença

Consulte o arquivo `LICENSE`. O arquivo atual foi herdado do conteúdo histórico do repositório e deve passar por revisão de titularidade antes de distribuição externa.

---

Este README descreve o código versionado e o estado operacional conhecido. Para mudanças em banco, secrets ou produção, exija revisão humana, backup, tag imutável e plano de rollback.
