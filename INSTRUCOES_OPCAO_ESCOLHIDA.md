# Instruções: Seleção da Opção de Agendamento Aceita

## Resumo das Alterações

Foi implementada a funcionalidade para registrar qual opção de agendamento (primeira ou segunda) foi aceita durante a aprovação de um agendamento.

## Alterações Realizadas

### 1. Banco de Dados (Supabase)

**Arquivo:** `supabase-add-opcao-escolhida.sql`

Foi criado um script SQL para adicionar a coluna `opcao_escolhida` na tabela `agendamentos`:

```sql
ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS opcao_escolhida TEXT CHECK (opcao_escolhida IN ('primeira', 'segunda'));
```

**Como aplicar:**
1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute o conteúdo do arquivo `supabase-add-opcao-escolhida.sql`

### 2. Componente AgendamentoManager.js

**Modificações realizadas:**

#### a) Nova função `handleConfirmarAgendamento()`
- Verifica se existe segunda opção de agendamento
- Se existir apenas uma opção, aprova automaticamente com a primeira
- Se existir duas opções, solicita ao atendente qual foi aceita
- Solicita o nome do atendente
- Salva a opção escolhida no banco de dados

#### b) Função `handleUpdateStatus()` atualizada
- Adicionado parâmetro `opcaoEscolhida`
- Salva o valor de `opcao_escolhida` quando o status é "Confirmado"

#### c) Exibição visual na tabela
- Marca com ✓ verde a opção que foi escolhida
- Fica visível ao lado da opção selecionada

#### d) Exportação para Excel
- Adicionada coluna "Opção Escolhida" no arquivo exportado
- Mostra "1ª Opção", "2ª Opção" ou "-" (não definido)

#### e) Lista de Chamada (impressão)
- Agrupa os agendamentos pela opção escolhida
- Se a segunda opção foi escolhida, agrupa por ela
- Caso contrário, agrupa pela primeira opção

## Como Funciona

### Fluxo de Aprovação

1. **Agendamento com apenas 1 opção:**
   - Admin clica em "Confirmar" (botão verde com ✓)
   - Sistema solicita: "Nome do atendente:"
   - Sistema salva automaticamente `opcao_escolhida = 'primeira'`

2. **Agendamento com 2 opções:**
   - Admin clica em "Confirmar" (botão verde com ✓)
   - Sistema pergunta: "Qual opção de atendimento foi aceita?"
     - Exibe: "1 - [nome da primeira opção]"
     - Exibe: "2 - [nome da segunda opção]"
     - Admin digita "1" ou "2"
   - Sistema solicita: "Nome do atendente:"
   - Sistema salva `opcao_escolhida = 'primeira'` ou `'segunda'`

3. **Visualização:**
   - Na tabela de agendamentos, a opção escolhida aparece com ✓ verde
   - Exemplo:
     ```
     1ª: Passe ✓
     2ª: Desobsessão
     ```

## Deploy

Para aplicar as alterações em produção:

```bash
# 1. Execute o SQL no Supabase (conforme instruções acima)

# 2. Faça o build da aplicação
cd /root/admin-cesca
npm run build

# 3. Se estiver usando Docker:
./build-docker.sh

# 4. Ou se estiver usando PM2:
pm2 restart admin-cesca
```

## Validação

Para validar se está funcionando:

1. Acesse o admin-cesca
2. Vá até a aba "Agendamentos"
3. Encontre um agendamento "Pendente de confirmação" com 2 opções
4. Clique em "Confirmar" (✓)
5. Escolha qual opção foi aceita (1 ou 2)
6. Digite o nome do atendente
7. Verifique se aparece o ✓ verde ao lado da opção escolhida
8. Exporte para Excel e verifique se a coluna "Opção Escolhida" está preenchida

## Observações

- A coluna `opcao_escolhida` aceita apenas os valores: `'primeira'` ou `'segunda'`
- Se um agendamento antigo não tem essa informação, aparecerá "-" no export
- A funcionalidade é retrocompatível: agendamentos antigos continuam funcionando normalmente
