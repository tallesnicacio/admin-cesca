# 📧 Configuração de Email Confirmation - Admin CESCA

## 📋 Visão Geral

Este documento descreve como configurar o sistema de criação de usuários com confirmação de email no Admin CESCA.

**Fluxo Completo:**
1. Admin cria novo usuário no sistema
2. Email de confirmação é enviado automaticamente para o usuário
3. Usuário clica no link do email
4. Email é confirmado e usuário é redirecionado para `/set-password`
5. Usuário define sua própria senha
6. Usuário é redirecionado para login e pode acessar o sistema

---

## 🔧 Passo a Passo de Configuração

### 1️⃣ Configurar URLs no Supabase Dashboard

Acesse: **Supabase Dashboard → Authentication → URL Configuration**

#### a) Site URL
```
https://admin.cesca.digital
```

#### b) Redirect URLs (Adicionar ambas):
```
https://admin.cesca.digital/set-password
https://admin.cesca.digital/auth/callback
https://admin.cesca.digital/login
```

📝 **Importante**: Clique em "Save" após adicionar cada URL.

---

### 2️⃣ Configurar Template de Email

Acesse: **Supabase Dashboard → Authentication → Email Templates**

Selecione: **"Confirm signup"**

#### Subject (Assunto):
```
Confirme seu email - Admin CESCA
```

#### Body (HTML):
```html
<h2>Bem-vindo ao Admin CESCA</h2>

<p>Olá {{ .Name }},</p>

<p>Uma conta foi criada para você no sistema <strong>Admin CESCA</strong>.</p>

<p>Clique no botão abaixo para confirmar seu email e criar sua senha de acesso:</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}"
     style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            display: inline-block;">
    Confirmar Email e Criar Senha
  </a>
</p>

<p>Ou copie e cole este link no navegador:</p>
<p style="word-break: break-all; color: #667eea;">{{ .ConfirmationURL }}</p>

<hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

<p style="font-size: 13px; color: #6b7280;">
  <strong>Este link expira em 24 horas.</strong><br>
  Se você não solicitou esta conta, ignore este email.
</p>

<p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
  Admin CESCA - Sistema de Controle Administrativo
</p>
```

📝 **Importante**: Clique em "Save" após editar o template.

---

### 3️⃣ Executar Script SQL no Supabase

Acesse: **Supabase Dashboard → SQL Editor**

Execute o arquivo: `supabase-config-email-confirmation.sql`

```bash
# O script criará:
✓ Tabela users (se não existir)
✓ Função handle_new_user_profile()
✓ Trigger on_auth_user_created
✓ Políticas RLS para tabela users
✓ Funções auxiliares de log
```

---

### 4️⃣ Configurar Edge Function (Opcional)

Se você quiser usar Edge Function em vez de signUp no frontend:

#### a) Deploy da Edge Function:

```bash
# No diretório do projeto
cd supabase/functions/create-user

# Deploy
supabase functions deploy create-user --project-ref mmfsesanudlzgfbjlpzk
```

#### b) Configurar variáveis de ambiente:

No Supabase Dashboard:
- **Edge Functions → create-user → Settings → Secrets**

Adicionar:
```
SITE_URL=https://admin.cesca.digital
```

#### c) Atualizar UserManager.js:

```javascript
// Mudar flag no arquivo src/components/UserManager.js
const USE_EDGE_FUNCTION = true; // Alterar de false para true
```

---

### 5️⃣ Atualizar e Fazer Deploy da Aplicação

```bash
# No diretório /root/admin-cesca

# 1. Instalar dependências (se necessário)
npm install react-router-dom

# 2. Fazer build
npm run build

# 3. Build Docker image
docker build \
  --build-arg REACT_APP_SUPABASE_URL="$REACT_APP_SUPABASE_URL" \
  --build-arg REACT_APP_SUPABASE_ANON_KEY="$REACT_APP_SUPABASE_ANON_KEY" \
  -t admin-cesca:latest .

# 4. Deploy
./deploy.sh
```

---

## 🧪 Testar o Fluxo Completo

### Teste 1: Criar Usuário (Admin)

1. Faça login como admin
2. Vá em "Usuários" → "Novo Usuário"
3. Preencha:
   - Email: `teste@exemplo.com`
   - Nome: `Usuário Teste`
   - Role: `user`
4. Clique em "Criar Usuário"

**Resultado esperado:**
- ✅ Mensagem: "Usuário criado com sucesso!"
- ✅ Email enviado para teste@exemplo.com

---

### Teste 2: Confirmar Email (Novo Usuário)

1. Abra o email em `teste@exemplo.com`
2. Clique no link "Confirmar Email e Criar Senha"

**Resultado esperado:**
- ✅ Redireciona para: `https://admin.cesca.digital/set-password`
- ✅ Mostra mensagem: "Olá, Usuário Teste! Crie uma senha segura..."

---

### Teste 3: Definir Senha

1. Digite uma senha forte (mínimo 8 caracteres)
2. Confirme a senha
3. Clique em "Definir Senha e Acessar"

**Requisitos da senha:**
- ✅ Mínimo 8 caracteres
- ✅ Uma letra maiúscula
- ✅ Uma letra minúscula
- ✅ Um número
- ✅ Um caractere especial (!@#$%^&*)

**Resultado esperado:**
- ✅ Mensagem: "Senha Definida com Sucesso!"
- ✅ Redirecionamento automático para `/login`

---

### Teste 4: Login com Nova Senha

1. Na página de login
2. Digite: `teste@exemplo.com`
3. Digite a senha que você criou
4. Clique em "Entrar"

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Acesso ao dashboard

---

## 🔍 Troubleshooting

### Problema 1: Email não chega

**Verificações:**

1. Checar spam/lixo eletrônico
2. Verificar logs no Supabase:
   ```sql
   SELECT * FROM auth.users WHERE email = 'teste@exemplo.com';
   ```
3. Verificar configuração de SMTP no Supabase Dashboard
4. Testar com outro provedor de email (Gmail, Outlook)

**Solução:**
- Verificar **Authentication → Email Templates** está salvo
- Verificar **Authentication → Settings → SMTP Settings** (se usando custom SMTP)

---

### Problema 2: Link do email não funciona

**Verificações:**

1. Verificar se URL está nas Redirect URLs
2. Verificar se link não expirou (24h)
3. Verificar console do navegador para erros

**SQL para debug:**
```sql
-- Verificar status do usuário
SELECT
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'teste@exemplo.com';
```

**Solução:**
- Adicionar URL em **Authentication → URL Configuration → Redirect URLs**
- Reenviar link de confirmação

---

### Problema 3: Erro ao definir senha

**Mensagem:** "Link inválido ou expirado"

**Causa:** Token já foi usado ou expirou

**Solução:**
1. Criar novo usuário OU
2. Resetar senha via "Esqueci minha senha"

---

### Problema 4: Edge Function não funciona

**Erro:** `User not allowed`

**Solução:**
```javascript
// Mudar para usar signUp em vez de Edge Function
// Em src/components/UserManager.js
const USE_EDGE_FUNCTION = false;
```

---

## 📊 Monitoramento

### Ver usuários pendentes de confirmação:

```sql
SELECT
  id,
  email,
  raw_user_meta_data->>'name' as name,
  email_confirmed_at,
  created_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN 'Pendente'
    ELSE 'Confirmado'
  END as status
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;
```

### Ver logs de autenticação:

```sql
SELECT
  u.email,
  l.event_type,
  l.created_at,
  l.metadata
FROM user_auth_logs l
JOIN auth.users u ON u.id = l.user_id
ORDER BY l.created_at DESC
LIMIT 50;
```

---

## 🔒 Segurança

### Configurações Importantes:

1. **Email Confirmation Obrigatório:**
   - ✅ `email_confirm: false` ao criar usuário
   - ✅ Usuário não pode fazer login sem confirmar

2. **Senha Forte:**
   - ✅ Mínimo 8 caracteres
   - ✅ Validação client-side e server-side
   - ✅ Requisitos: maiúscula, minúscula, número, especial

3. **Links Seguros:**
   - ✅ Tokens únicos e criptografados
   - ✅ Expiração em 24 horas
   - ✅ Uso único (não pode reutilizar)

4. **HTTPS Obrigatório:**
   - ✅ Todas as URLs usam HTTPS
   - ✅ Cookies seguros (httpOnly, secure)

---

## 📝 Arquivos Modificados/Criados

### Novos Arquivos:
```
✓ supabase-config-email-confirmation.sql    # Script SQL de configuração
✓ src/components/SetPassword.js              # Página para definir senha
✓ src/components/SetPassword.css             # Estilos da página
✓ CONFIGURACAO-EMAIL-CONFIRMATION.md         # Esta documentação
```

### Arquivos Modificados:
```
✓ src/App.js                                 # Adicionado routing
✓ supabase/functions/create-user/index.ts   # Atualizado para generateLink
✓ src/components/UserManager.js              # Flag USE_EDGE_FUNCTION
```

---

## 🎯 Checklist de Deploy

Antes de colocar em produção:

- [ ] Configurar Site URL no Supabase
- [ ] Adicionar Redirect URLs no Supabase
- [ ] Configurar Email Template no Supabase
- [ ] Executar script SQL no Supabase
- [ ] Instalar `react-router-dom` (`npm install react-router-dom`)
- [ ] Build da aplicação (`npm run build`)
- [ ] Build da imagem Docker
- [ ] Deploy no Docker Swarm
- [ ] Testar criação de usuário
- [ ] Testar email de confirmação
- [ ] Testar definição de senha
- [ ] Testar login
- [ ] Verificar logs no Supabase

---

## 📞 Suporte

Se encontrar problemas:

1. Verificar logs no Supabase Dashboard
2. Verificar console do navegador (F12)
3. Verificar logs do Docker: `docker service logs admin-cesca_admin-cesca -f`
4. Consultar esta documentação

---

**Última atualização:** 25/10/2024
**Versão:** 1.0
**Status:** ✅ Pronto para uso
