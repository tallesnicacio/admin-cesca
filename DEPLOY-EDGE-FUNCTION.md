# Deploy da Edge Function - Criar Usuários

## 📋 Pré-requisitos

1. **Supabase CLI instalado**
```bash
npm install -g supabase
```

2. **Login no Supabase**
```bash
supabase login
```

3. **Link com seu projeto**
```bash
cd /root/admin-cesca
supabase link --project-ref mmfsesanudlzgfbjlpzk
```

---

## 🚀 Deploy da Edge Function

### Passo 1: Fazer Deploy

```bash
cd /root/admin-cesca
supabase functions deploy create-user
```

### Passo 2: Configurar Variáveis de Ambiente

As seguintes variáveis já estão disponíveis automaticamente:
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅

Se precisar configurar `SITE_URL`:
```bash
supabase secrets set SITE_URL=https://seu-dominio.com
```

### Passo 3: Testar a Function

```bash
curl -i --location --request POST 'https://mmfsesanudlzgfbjlpzk.supabase.co/functions/v1/create-user' \
  --header 'Authorization: Bearer SEU_TOKEN_JWT' \
  --header 'Content-Type: application/json' \
  --data '{"email":"teste@example.com","name":"Teste User","role":"user"}'
```

---

## 🔧 Atualizar UserManager.js para usar a Edge Function

Depois de fazer o deploy, atualize o `UserManager.js` para chamar a Edge Function:

```javascript
// Substituir a chamada supabase.auth.signUp por:

const { data: functionData, error: functionError } = await supabase.functions.invoke('create-user', {
  body: {
    email: formData.email,
    name: formData.name,
    role: formData.role
  }
});

if (functionError) throw functionError;

showToast.success(functionData.message || 'Usuário criado com sucesso!');
```

---

## 🧪 Solução Temporária (Enquanto não faz deploy)

**Opção 1: Usar signUp direto (implementado)**

O código atual usa `supabase.auth.signUp()` que:
- ✅ Funciona sem Edge Function
- ✅ Envia email de confirmação automaticamente
- ⚠️ Usuário precisa definir senha via email
- ⚠️ Senha temporária é gerada mas não é enviada ao usuário

**Opção 2: Criar usuários manualmente no Supabase Dashboard**

1. Acesse: https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk/auth/users
2. Clique em "Invite user"
3. Digite o email
4. O usuário receberá um email para definir senha

---

## 📝 Código da Edge Function

A Edge Function criada em `supabase/functions/create-user/index.ts` faz:

1. ✅ Valida que o usuário que está criando é admin
2. ✅ Usa `supabase.auth.admin.createUser()` com Service Role Key
3. ✅ Cria o perfil na tabela `profiles`
4. ✅ Envia email de convite
5. ✅ Retorna dados do usuário criado

### Segurança

- ✅ Apenas admins podem criar usuários
- ✅ Service Role Key não é exposta no frontend
- ✅ CORS configurado para aceitar requisições do seu domínio
- ✅ Validação de dados de entrada

---

## 🔍 Logs e Debug

### Ver logs da function:
```bash
supabase functions logs create-user
```

### Ver logs em tempo real:
```bash
supabase functions logs create-user --tail
```

---

## ⚙️ Comandos Úteis

### Listar functions deployadas:
```bash
supabase functions list
```

### Deletar uma function:
```bash
supabase functions delete create-user
```

### Testar localmente (antes do deploy):
```bash
supabase functions serve create-user
```

---

## 📌 Notas Importantes

1. **Email de Confirmação**: A Edge Function envia automaticamente um email de convite para o novo usuário.

2. **Senha Temporária**: Uma senha forte é gerada automaticamente, mas o usuário deve definir sua própria senha via email.

3. **Perfis**: A função cria/atualiza automaticamente o registro na tabela `profiles`.

4. **Permissões**: Apenas usuários com `is_admin = true` podem criar novos usuários.

---

## 🐛 Troubleshooting

### Erro: "Function not found"
```bash
# Verifique se o deploy foi feito
supabase functions list

# Refaça o deploy
supabase functions deploy create-user
```

### Erro: "Sem permissão de administrador"
```sql
-- Verifique se você é admin no banco:
SELECT id, email, is_admin, role FROM profiles WHERE email = 'seu-email@example.com';

-- Se necessário, torne-se admin:
UPDATE profiles SET is_admin = true, role = 'admin' WHERE email = 'seu-email@example.com';
```

### Erro: "Service role key not found"
As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase. Se o erro persistir, verifique as configurações do projeto.

---

## ✅ Checklist de Deploy

- [ ] Supabase CLI instalado
- [ ] Login feito (`supabase login`)
- [ ] Projeto linkado (`supabase link`)
- [ ] Edge Function deployada (`supabase functions deploy create-user`)
- [ ] UserManager.js atualizado para usar a function
- [ ] Testado criação de usuário
- [ ] Email de confirmação recebido

---

**Última atualização**: 25/10/2024
