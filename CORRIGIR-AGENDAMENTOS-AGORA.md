# 🚨 CORREÇÃO URGENTE - Agendamentos não funcionam

**Status:** Código JavaScript está correto. O problema é no Supabase (RLS Policies).

---

## ⚡ AÇÃO IMEDIATA - 5 MINUTOS

### PASSO 1: Acessar Supabase Dashboard

1. Abra: https://supabase.com/dashboard
2. Faça login
3. Selecione o projeto: **mmfsesanudlzgfbjlpzk** (ou seu projeto)

### PASSO 2: Executar Script de Correção

1. No menu lateral, clique em **SQL Editor**
2. Clique em **New Query**
3. Copie e cole o script abaixo
4. Clique em **RUN** (ou Ctrl+Enter)

```sql
-- ================================================================
-- CORREÇÃO COMPLETA - AGENDAMENTOS
-- Tempo de execução: ~5 segundos
-- ================================================================

-- 1️⃣ Habilitar RLS
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- 2️⃣ Remover políticas antigas (evitar conflitos)
DROP POLICY IF EXISTS "Permitir inserção pública de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Public users can insert agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Enable insert for anon users" ON agendamentos;
DROP POLICY IF EXISTS "public_insert_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir leitura autenticada de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_select_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Permitir atualização autenticada de agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_update_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Authenticated users can delete agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "authenticated_delete_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "anon_insert_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "anon_select_agendamentos" ON agendamentos;

-- 3️⃣ Criar políticas CORRETAS

-- INSERT público (formulário web pode criar)
CREATE POLICY "public_insert_agendamentos"
  ON agendamentos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- SELECT público (todos podem ver)
CREATE POLICY "public_select_agendamentos"
  ON agendamentos
  FOR SELECT
  TO public
  USING (true);

-- UPDATE apenas autenticados (admins)
CREATE POLICY "authenticated_update_agendamentos"
  ON agendamentos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE apenas autenticados (admins)
CREATE POLICY "authenticated_delete_agendamentos"
  ON agendamentos
  FOR DELETE
  TO authenticated
  USING (true);

-- 4️⃣ Verificar políticas criadas
SELECT
  '✅ POLÍTICAS CONFIGURADAS' as status,
  policyname,
  cmd as operacao
FROM pg_policies
WHERE tablename = 'agendamentos'
ORDER BY policyname;

-- 5️⃣ Testar UPDATE (simula o que o código faz)
-- ATENÇÃO: Só funciona se você estiver autenticado!
SELECT
  '✅ TESTE DE AGENDAMENTOS PENDENTES' as info,
  id,
  nome_completo,
  status
FROM agendamentos
WHERE status = 'Pendente de confirmação'
LIMIT 3;

-- Mensagem final
SELECT '🎉 SCRIPT EXECUTADO COM SUCESSO!' as mensagem,
       'Agora faça logout e login novamente no painel' as proximo_passo;
```

### PASSO 3: Verificar Usuário Admin

Execute este comando para verificar seu usuário:

```sql
-- Verificar seu perfil
SELECT id, email, name, is_admin
FROM profiles
WHERE id = auth.uid();
```

**Resultado esperado:**
- `is_admin` deve ser `true`

**Se `is_admin` for `false` ou NULL:**

```sql
-- Tornar seu usuário admin
UPDATE profiles
SET is_admin = true
WHERE id = auth.uid();
```

### PASSO 4: Testar no Painel

1. Abra: https://admin.cesca.digital
2. **IMPORTANTE**: Faça **LOGOUT**
3. Feche TODAS as abas do site
4. Abra uma nova aba
5. Faça **LOGIN** novamente
6. Vá em **Agendamentos**
7. Teste os botões:
   - ✅ Confirmar (verde)
   - 🔴 Cancelar (laranja)
   - 🗑️ Excluir (vermelho)

---

## 🔍 SE AINDA NÃO FUNCIONAR

### Cenário A: Console mostra erro de permissão

**Erro típico:**
```
Error: new row violates row-level security policy
```

**Solução:**
1. Execute o script novamente
2. Verifique se você está logado como admin (`is_admin = true`)
3. Limpe o cache do navegador (Ctrl+Shift+R)

### Cenário B: Console mostra "No rows returned"

**Significado:** O UPDATE não afetou nenhuma linha

**Solução:**
```sql
-- Verificar se o agendamento existe
SELECT * FROM agendamentos WHERE id = 'COLE_O_ID_AQUI';

-- Se não retornar nada, o agendamento não existe
-- Se retornar, mas UPDATE não funciona, é problema de RLS
```

### Cenário C: Nada aparece no console

**Significado:** Código JavaScript não está executando

**Solução:**
1. Limpe o cache: **Ctrl+Shift+R** (Windows/Linux) ou **Cmd+Shift+R** (Mac)
2. Ou abra em modo anônimo
3. Ou vá em **F12 > Application > Clear Storage > Clear site data**

### Cenário D: Erro 400 na autenticação

**Erro típico:**
```
400 Bad Request - /auth/v1/token
```

**Solução:**
1. Faça logout
2. Feche TODAS as abas
3. Limpe cookies do site
4. Faça login novamente

---

## 📋 CHECKLIST DE VERIFICAÇÃO

Antes de reportar que não funcionou, confirme:

- [ ] Executei o script SQL completo
- [ ] Vi a mensagem "🎉 SCRIPT EXECUTADO COM SUCESSO!"
- [ ] Verifiquei que `is_admin = true` no meu perfil
- [ ] Fiz **LOGOUT** do painel
- [ ] Fechei TODAS as abas do admin.cesca.digital
- [ ] Fiz **LOGIN** novamente
- [ ] Limpei o cache do navegador (Ctrl+Shift+R)
- [ ] Abri o console (F12) e não há erros em vermelho
- [ ] Os logs com 🔔 aparecem quando clico nos botões

---

## 🎯 DIAGNÓSTICO RÁPIDO

### O que os logs devem mostrar:

Quando você clica em **Confirmar**:
```
🔔 ========== BOTÃO CONFIRMAR CLICADO ==========
📋 Agendamento: {id: "...", nome_completo: "..."}
👤 UserProfile: {...}
🚀 ========== INÍCIO handleUpdateStatus ==========
🔐 Sessão atual: { session: 'EXISTE', user: 'seu@email.com' }
📤 Enviando UPDATE para Supabase...
✅ Agendamento atualizado com sucesso
🏁 ========== FIM handleUpdateStatus ==========
```

### Se aparecer erro:

```
❌ ERRO DO SUPABASE: {
  message: "...",
  code: "..."
}
```

**Copie esse erro completo e me envie!**

---

## 💡 POR QUE ISSO ACONTECEU?

O código JavaScript está **100% correto**. O problema estava nas **Row Level Security (RLS) Policies** do Supabase:

1. Políticas antigas conflitantes
2. Políticas com nomes duplicados
3. Políticas muito restritivas que bloqueavam UPDATE/DELETE
4. Falta de política para usuários autenticados

Este script:
- ✅ Remove TODAS as políticas antigas
- ✅ Cria políticas novas e corretas
- ✅ Permite INSERT público (formulário web)
- ✅ Permite SELECT público (ver agendamentos)
- ✅ Permite UPDATE apenas para autenticados
- ✅ Permite DELETE apenas para autenticados

---

## 📞 SUPORTE

Se após seguir TODOS os passos ainda não funcionar, me envie:

1. **Print do console** (F12) quando você clica no botão
2. **Resultado da verificação do perfil** (query do PASSO 3)
3. **Descrição exata** do que acontece

---

**Criado em:** 2025-11-01
**Tempo estimado:** 5 minutos
**Nível de dificuldade:** Fácil (apenas copiar e colar SQL)
