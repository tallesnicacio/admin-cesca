# Configuração do Supabase - Admin CESCA

Este guia mostra como configurar corretamente o banco de dados Supabase para o sistema Admin CESCA.

## 📋 Pré-requisitos

- Acesso ao Dashboard do Supabase
- Projeto Supabase já criado
- Tabela `profiles` já existente

## 🚀 Passos de Configuração

### Passo 1: Adicionar Colunas na Tabela Profiles

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Copie e cole o conteúdo do arquivo `supabase-add-columns-profiles.sql`
5. Clique em **Run** (ou pressione Ctrl+Enter)

✅ Isso irá adicionar as colunas necessárias:
- `role` (admin/user)
- `name` (nome do usuário)
- `active` (ativo/inativo)
- `created_at` (data de criação)

### Passo 2: Adicionar Coluna opcao_escolhida em Agendamentos

1. No **SQL Editor**, crie uma nova query
2. Copie e cole o conteúdo do arquivo `supabase-add-opcao-escolhida.sql`
3. Clique em **Run**

✅ Isso adiciona a coluna para rastrear qual opção de atendimento foi escolhida.

### Passo 3: Configurar Políticas RLS (Row Level Security)

1. No **SQL Editor**, crie uma nova query
2. Copie e cole o conteúdo do arquivo `supabase-rls-policies.sql`
3. **IMPORTANTE**: Leia os comentários e ajuste conforme necessário
4. Clique em **Run**

✅ Isso irá:
- Habilitar RLS nas tabelas
- Criar políticas de acesso
- Criar trigger para auto-criação de perfis
- Configurar permissões

### Passo 4: Criar o Primeiro Administrador

Existem duas formas de criar o primeiro admin:

#### Opção A - Via Dashboard (Recomendado)

1. Vá em **Authentication** > **Users** no Supabase Dashboard
2. Clique em **Add User**
3. Preencha:
   - Email: seu email
   - Password: uma senha forte
   - Auto Confirm User: ✅ (marque)
4. Clique em **Create User**
5. Vá para o **SQL Editor**
6. Execute este comando (substituindo o email):

```sql
UPDATE profiles
SET role = 'admin',
    name = 'Seu Nome'
WHERE email = 'seu-email@exemplo.com';
```

#### Opção B - Via SQL

Execute no **SQL Editor**:

```sql
-- Substitua os valores
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'seu-email@exemplo.com',
  crypt('sua-senha-segura', gen_salt('bf')),
  now(),
  '{"name": "Seu Nome", "role": "admin"}'::jsonb,
  now(),
  now()
);
```

### Passo 5: Verificar a Configuração

Execute no **SQL Editor**:

```sql
-- Verificar se as colunas foram criadas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public';

-- Verificar RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'agendamentos');

-- Verificar políticas criadas
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Listar administradores
SELECT id, email, name, role, active
FROM profiles
WHERE role = 'admin';
```

### Passo 6: Configurar API Keys no Admin

As API keys já devem estar configuradas no arquivo `.env`:

```env
REACT_APP_SUPABASE_URL=https://mmfsesanudlzgfbjlpzk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

⚠️ **IMPORTANTE**: Use a **anon key** (pública), NÃO a service_role key!

## 🔧 Scripts Úteis

O arquivo `supabase-rls-utils.sql` contém vários scripts úteis:

### Promover usuário a admin
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email@exemplo.com';
```

### Desativar usuário
```sql
UPDATE profiles SET active = false WHERE email = 'email@exemplo.com';
```

### Listar todos os admins
```sql
SELECT * FROM profiles WHERE role = 'admin';
```

### Ver estatísticas
```sql
SELECT
  role,
  COUNT(*) as total,
  COUNT(CASE WHEN active = true THEN 1 END) as ativos
FROM profiles
GROUP BY role;
```

## 🐛 Troubleshooting

### Erro: "Could not find the 'role' column"
- Execute o `supabase-add-columns-profiles.sql` novamente
- Verifique se as colunas foram criadas com o script de verificação

### Erro: "new row violates row-level security policy"
- Verifique se as políticas RLS foram criadas corretamente
- Certifique-se de que está logado como admin
- Temporariamente, desabilite RLS para testar:
```sql
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

### Usuário não consegue fazer login
- Verifique se o usuário está ativo: `SELECT * FROM profiles WHERE email = 'email'`
- Verifique se o email foi confirmado no auth.users
- Tente resetar a senha pelo Dashboard

### Trigger não está funcionando
- Verifique se o trigger foi criado: use script 20 do `supabase-rls-utils.sql`
- Recrie o trigger executando a seção 4 do `supabase-rls-policies.sql`

## 📚 Estrutura das Tabelas

### Tabela: profiles
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK, referencia auth.users |
| email | text | Email do usuário |
| name | text | Nome completo |
| role | text | 'admin' ou 'user' |
| active | boolean | Usuário ativo? |
| created_at | timestamp | Data de criação |

### Tabela: agendamentos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| nome_completo | text | Nome do solicitante |
| email | text | Email do solicitante |
| telefone | text | Telefone/WhatsApp |
| primeira_opcao | text | 1ª opção de atendimento |
| segunda_opcao | text | 2ª opção (opcional) |
| opcao_escolhida | text | 'primeira' ou 'segunda' |
| status | text | Status do agendamento |
| canal_preferencial | text | WhatsApp, Email, etc |
| observacoes | text | Observações adicionais |
| atendente | text | Nome do atendente |
| data_solicitacao | timestamp | Data da solicitação |
| data_confirmacao | timestamp | Data da confirmação |

## 🔒 Segurança

- ✅ RLS habilitado em todas as tabelas
- ✅ Políticas baseadas em roles (admin/user)
- ✅ Apenas admins podem criar/editar usuários
- ✅ Usuários só veem seu próprio perfil
- ✅ Soft delete (usuários não são removidos, apenas desativados)

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase Dashboard
2. Execute os scripts de verificação do `supabase-rls-utils.sql`
3. Consulte a documentação oficial: https://supabase.com/docs

---

**Última atualização**: 2025-10-24
**Versão**: 1.0
