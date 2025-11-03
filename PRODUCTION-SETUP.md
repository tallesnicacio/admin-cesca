# 🚀 Preparação para Produção - Admin CESCA

Guia completo para preparar o sistema Admin CESCA para uso em produção com base de dados limpa.

## ⚠️ ATENÇÃO

Este processo irá **DELETAR TODOS OS DADOS** do banco de dados, mantendo apenas a estrutura. Execute apenas se tiver certeza!

## 📋 Pré-requisitos

- [x] Acesso ao Supabase Dashboard do projeto
- [x] Backup dos dados importantes (se houver)
- [x] Credenciais de um usuário que será administrador

## 🔄 Processo de Limpeza

### Passo 1: Backup (Opcional mas Recomendado)

Se você tem dados importantes, faça backup antes:

1. Acesse: Supabase Dashboard → Database → Backups
2. Ou exporte manualmente as tabelas que precisar

### Passo 2: Executar Script de Limpeza

1. Acesse: **Supabase Dashboard** → **SQL Editor**
2. Abra o arquivo: `database-cleanup.sql`
3. Copie todo o conteúdo
4. Cole no SQL Editor
5. Clique em **Run** (Executar)

**O que o script faz:**
- ✅ Remove todos os dados de TODAS as tabelas
- ✅ Mantém a estrutura (tabelas, colunas, índices, RLS)
- ✅ Insere configuração inicial padrão
- ✅ Exibe contagem de registros para verificação
- ✅ **MANTÉM** apenas 3 usuários administradores:
  - talles.nicacio@gmail.com
  - batistagodoil@gmail.com
  - rovef.amorim@gmail.com
- ✅ Remove todos os outros usuários do `profiles`
- ✅ Garante que os 3 usuários mantidos sejam administradores ativos

### Passo 3: Verificar Usuários Administradores

Os 3 usuários abaixo foram mantidos e configurados como administradores:

1. ✅ talles.nicacio@gmail.com
2. ✅ batistagodoil@gmail.com
3. ✅ rovef.amorim@gmail.com

**Você pode fazer login com qualquer um desses emails!**

Se precisar adicionar mais administradores posteriormente, use o arquivo `create-admin-user.sql`.

### Passo 4: Verificação Final

Execute esta query no SQL Editor para confirmar:

\`\`\`sql
-- Verificar que as tabelas estão vazias
SELECT 'agendamentos' as tabela, COUNT(*) as registros FROM agendamentos
UNION ALL SELECT 'alunos', COUNT(*) FROM alunos
UNION ALL SELECT 'cursos', COUNT(*) FROM cursos
UNION ALL SELECT 'trabalhadores', COUNT(*) FROM trabalhadores
ORDER BY tabela;

-- Verificar usuário admin
SELECT name, email, is_admin, is_active
FROM profiles
WHERE is_admin = true;
\`\`\`

**Resultado esperado:**
- Todas as tabelas com `0` registros (exceto `configuracoes` com 1)
- Exatamente 3 usuários com `is_admin = true`:
  - talles.nicacio@gmail.com
  - batistagodoil@gmail.com
  - rovef.amorim@gmail.com

## 🎯 Próximos Passos

Após a limpeza, você pode começar a usar o sistema:

### 1. Login Inicial
- Acesse: `https://admin.cesca.digital`
- Faça login com o usuário admin criado

### 2. Configurar Sistema

**Configurações Básicas:**
- Dashboard → Configurações
- Ativar/desativar agendamentos
- Configurar restrições de horário

### 3. Cadastrar Dados Iniciais

**Ordem recomendada:**

1. **Trabalhadores** (Escalas → Trabalhadores)
   - Cadastrar funcionários/voluntários do CESCA

2. **Tipos de Atendimento** (Escalas → Tipos de Atendimento)
   - Exemplo: Portal, Caboclo, Passe, etc.
   - Definir dias e horários

3. **Capacitações** (Escalas → Capacitações)
   - Vincular trabalhadores aos tipos de atendimento

4. **Cursos** (Financeiro → Cursos)
   - Cadastrar cursos oferecidos (se aplicável)

5. **Alunos** (Financeiro → Alunos)
   - Cadastrar alunos (se aplicável)

### 4. Usuários Adicionais (Opcional)

Se precisar de mais administradores:

1. Criar usuário via Supabase Auth
2. Executar:
   \`\`\`sql
   UPDATE profiles
   SET is_admin = true
   WHERE email = 'novo-admin@email.com';
   \`\`\`

## 📊 Estrutura de Dados Limpa

Após a limpeza, a base terá:

| Módulo | Tabelas | Registros Iniciais |
|--------|---------|-------------------|
| Quiz | quizzes, questions, quiz_attempts | 0 |
| Agendamentos | agendamentos | 0 |
| Configurações | configuracoes | 1 (padrão) |
| Financeiro | alunos, cursos, matriculas, mensalidades, caixas, despesas | 0 |
| Escalas | trabalhadores, tipos_atendimento, capacitacoes, escalas, etc | 0 |
| Presença | presencas, advertencias | 0 |
| Usuários | profiles | 1+ (admin) |

## 🔒 Segurança

**Checklist de Segurança:**

- [x] Senha forte para usuário admin
- [x] Email confirmado
- [x] RLS (Row Level Security) habilitado em todas as tabelas
- [x] Apenas usuários autenticados podem acessar dados
- [x] Políticas de acesso configuradas
- [x] SSL/HTTPS ativo (via Traefik)

## 🐛 Troubleshooting

### "Não consigo fazer login"
- Verifique se o usuário está em `auth.users` (Supabase Dashboard)
- Verifique se o email foi confirmado
- Verifique se existe registro em `profiles` com mesmo UUID

### "Acesso negado - não é admin"
- Execute: `UPDATE profiles SET is_admin = true WHERE email = 'seu@email.com';`

### "Tabelas não existem"
- Execute primeiro o `database-schema.sql` completo

### "Erro de foreign key"
- O script de limpeza já respeita a ordem correta
- Se persistir, execute com `CASCADE`: `TRUNCATE TABLE nome_tabela CASCADE;`

## 📞 Suporte

Em caso de dúvidas ou problemas:
- Revisar logs do Supabase
- Verificar políticas RLS
- Consultar documentação do projeto no README.md

---

**Última atualização:** 03/11/2024
**Versão do Schema:** 1.0
**Status:** Pronto para Produção ✅
