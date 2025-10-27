# Admin CESCA

Painel administrativo para gerenciar quizzes, usuários e visualizar relatórios do sistema CESCA.

## 🚀 Tecnologias

- **React** 19.2.0
- **Supabase** (autenticação e banco de dados)
- **Lucide React** (ícones)
- **jsPDF** + **jsPDF-AutoTable** (exportação PDF)
- **XLSX** (exportação Excel)
- **Docker** + **Docker Swarm** (deploy)
- **Nginx** (servidor web)
- **Traefik** (proxy reverso com SSL)

## 📋 Funcionalidades

### 🔐 Autenticação
- Login via Supabase Auth
- Validação de privilégios de admin
- Logout seguro

### 📚 Gerenciamento de Quizzes
- Listar todos os quizzes
- Criar novos quizzes
- Editar quizzes existentes
- Excluir quizzes
- Visualizar questões de cada quiz
- Ativar/desativar quizzes

### 👥 Gerenciamento de Usuários
- Listar todos os usuários
- Buscar por nome, email ou CPF
- Filtros: Todos, Ativos, Inativos, Admins
- Ativar/Desativar usuários
- Conceder/Remover privilégios de admin
- Exportar lista de usuários para Excel

### 📊 Relatórios e Estatísticas
- Dashboard com métricas:
  - Total de usuários
  - Usuários ativos
  - Total de quizzes
  - Total de tentativas
  - Média geral de notas
  - Taxa de aprovação
- Resultados detalhados por quiz
- Filtro por quiz específico
- Exportação para PDF e Excel

## 🔧 Configuração Local

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Supabase:
```env
REACT_APP_SUPABASE_URL=https://seu-projeto.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
```

### 3. Iniciar em Desenvolvimento
```bash
npm start
```

A aplicação estará disponível em `http://localhost:3000`

### 4. Build de Produção
```bash
npm run build
```

O build será gerado na pasta `build/`

## 🐳 Deploy com Docker

### Build da Imagem
```bash
docker build -t admin-cesca:latest .
```

### Deploy com Docker Swarm
```bash
docker stack deploy -c docker-compose.yml admin-cesca
```

### Verificar Status
```bash
docker service ls | grep admin-cesca
docker service ps admin-cesca_admin-cesca
docker service logs admin-cesca_admin-cesca
```

### Remover Deploy
```bash
docker stack rm admin-cesca
```

## 🌐 Acesso em Produção

A aplicação está disponível em: **https://admin.cesca.digital**

### Configuração DNS
Certifique-se de que o DNS aponta para o servidor:
```
admin.cesca.digital -> IP do servidor
```

### SSL/HTTPS
O SSL é gerenciado automaticamente pelo Traefik com Let's Encrypt.

## 📁 Estrutura do Projeto

```
admin-cesca/
├── public/
│   ├── favicon.ico
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Dashboard.js         # Dashboard principal
│   │   ├── Dashboard.css
│   │   ├── Login.js             # Tela de login
│   │   ├── Login.css
│   │   ├── QuizManager.js       # Gerenciamento de quizzes
│   │   ├── QuizManager.css
│   │   ├── UserManager.js       # Gerenciamento de usuários
│   │   ├── UserManager.css
│   │   ├── Reports.js           # Relatórios e estatísticas
│   │   └── Reports.css
│   ├── App.js                   # Componente raiz
│   ├── App.css
│   ├── index.js                 # Entry point
│   └── supabaseClient.js        # Configuração do Supabase
├── .dockerignore
├── .env                         # Variáveis de ambiente (não comitar!)
├── .env.example                 # Template de variáveis
├── .gitignore
├── docker-compose.yml           # Configuração Docker Swarm
├── Dockerfile                   # Build da imagem
├── nginx.conf                   # Configuração Nginx
├── package.json
└── README.md
```

## 🗄️ Estrutura do Banco de Dados (Supabase)

### Tabela: `profiles`
```sql
- id (uuid, FK para auth.users)
- name (text)
- email (text)
- cpf (text)
- phone (text)
- is_active (boolean)
- is_admin (boolean)
- created_at (timestamp)
```

### Tabela: `quizzes`
```sql
- id (uuid, PK)
- title (text)
- description (text)
- passing_score (integer)
- is_active (boolean)
- created_at (timestamp)
```

### Tabela: `questions`
```sql
- id (uuid, PK)
- quiz_id (uuid, FK)
- question (text)
- options (jsonb array)
- correct_answer (integer)
- created_at (timestamp)
```

### Tabela: `quiz_attempts`
```sql
- id (uuid, PK)
- user_id (uuid, FK)
- quiz_id (uuid, FK)
- score (numeric)
- completed (boolean)
- completed_at (timestamp)
- created_at (timestamp)
```

## 🔒 Segurança

### Proteção de Credenciais
- ✅ Credenciais do Supabase em `.env`
- ✅ `.env` adicionado ao `.gitignore`
- ✅ `.env.example` como template
- ✅ Validação de variáveis de ambiente no `supabaseClient.js`

### Autenticação
- Login com email e senha via Supabase Auth
- Verificação de privilégios de admin (campo `is_admin`)
- Proteção de rotas (usuários não-admin são desconectados)

### Headers de Segurança (nginx)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

## 📝 Comandos Úteis

### Docker
```bash
# Ver logs
docker service logs -f admin-cesca_admin-cesca

# Escalar serviço
docker service scale admin-cesca_admin-cesca=2

# Atualizar serviço
docker service update --force admin-cesca_admin-cesca

# Remover serviço
docker stack rm admin-cesca
```

### NPM
```bash
# Instalar dependências
npm install

# Desenvolvimento
npm start

# Build
npm run build

# Testes
npm test
```

## 🎨 Customização

### Cores e Tema
As cores principais estão definidas nos arquivos CSS:
- Gradiente principal: `#667eea` → `#764ba2`
- Background: `#f5f7fa`

### Logo e Branding
Substitua os arquivos em `public/`:
- `favicon.ico`
- Atualize `index.html` com título e meta tags

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"
**Solução:** Verifique se o arquivo `.env` existe e contém as variáveis corretas.

### Erro: "Acesso negado. Apenas administradores podem acessar."
**Solução:** Certifique-se de que o usuário tem o campo `is_admin = true` na tabela `profiles`.

### Deploy não funciona
**Solução:**
1. Verifique se a imagem foi construída: `docker images | grep admin-cesca`
2. Verifique logs: `docker service logs admin-cesca_admin-cesca`
3. Verifique rede: `docker network ls | grep network_public`

### SSL não funciona
**Solução:**
1. Verifique DNS: `nslookup admin.cesca.digital`
2. Verifique Traefik: `docker service ps traefik`
3. Aguarde alguns minutos para certificado ser gerado

## 📄 Licença

Este projeto é privado e de uso exclusivo do CESCA.

## 👨‍💻 Autor

Desenvolvido com Claude Code
