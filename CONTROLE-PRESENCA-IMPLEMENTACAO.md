# Sistema de Controle de Presença e Suspensão de Consulentes

## 📋 Visão Geral

Este sistema permite o controle de presença dos consulentes nas giras e suspende automaticamente aqueles que não comparecem aos agendamentos confirmados.

### Funcionalidades Principais

1. **Lista de Confirmação de Presença**: Interface para registrar presença/falta dos consulentes após cada gira
2. **Suspensão Automática**: Consulentes que não comparecem são suspensos automaticamente por 2 semanas
3. **Validação no Formulário Público**: Bloqueio de novos agendamentos para consulentes suspensos
4. **Agrupamento por Gira**: Agendamentos organizados por data da gira (segunda e sexta-feira)

---

## 🗄️ Estrutura do Banco de Dados

### Novos Campos na Tabela `agendamentos`

```sql
ALTER TABLE agendamentos ADD COLUMN:
- compareceu: BOOLEAN (NULL=pendente, TRUE=compareceu, FALSE=não compareceu)
- data_registro_presenca: TIMESTAMP WITH TIME ZONE
- responsavel_registro: TEXT (nome de quem registrou)
```

### Nova Tabela `suspensoes`

```sql
CREATE TABLE suspensoes (
  id: UUID PRIMARY KEY
  email: TEXT NOT NULL
  telefone: TEXT NOT NULL
  agendamento_id: UUID (referência ao agendamento)
  motivo: TEXT
  data_inicio: TIMESTAMP WITH TIME ZONE
  data_fim: TIMESTAMP WITH TIME ZONE
  ativa: BOOLEAN
  registrado_por: TEXT
  observacoes: TEXT
  created_at: TIMESTAMP WITH TIME ZONE
  updated_at: TIMESTAMP WITH TIME ZONE
)
```

### Funções do Banco de Dados

#### 1. `verificar_suspensao(p_email, p_telefone)`
- Verifica se um email ou telefone está suspenso
- Retorna: suspenso (boolean), data_fim, motivo, dias_restantes
- Desativa automaticamente suspensões expiradas

#### 2. `desativar_suspensoes_expiradas()`
- Desativa suspensões que já expiraram
- Chamada automaticamente pela função `verificar_suspensao`

#### 3. `criar_suspensao_por_falta()` (TRIGGER)
- Trigger acionado ao atualizar campo `compareceu` para FALSE
- Cria automaticamente suspensão de 14 dias

---

## 📦 Arquivos Criados/Modificados

### Novos Arquivos

1. **Migration SQL**
   - `/migrations/004_controle_presenca_suspensoes.sql`
   - Cria campos, tabela, índices, funções e trigger

2. **Utilitários de Gira**
   - `/src/utils/giraUtils.js`
   - Funções para calcular datas de giras (segunda/sexta)
   - Agrupamento de agendamentos por gira
   - Cálculo de estatísticas de presença

3. **Componente de Lista de Confirmação**
   - `/src/components/ListaConfirmacaoPresenca.js`
   - Interface para registrar presença após giras
   - `/src/components/ListaConfirmacaoPresenca.css`

4. **Edge Function de Verificação**
   - `/supabase/functions/verificar-suspensao/index.ts`
   - API pública para verificar se email/telefone está suspenso
   - Usada pelo formulário público de agendamento

### Arquivos Modificados

1. **Dashboard**
   - `/src/components/Dashboard.js`
   - Adicionado menu "Lista de Confirmação"
   - Import do componente ListaConfirmacaoPresenca

---

## 🚀 Instruções de Deploy

### 1. Aplicar Migration no Banco de Dados

Execute a migration no Supabase:

```bash
# Via Supabase Dashboard
1. Acesse Supabase Dashboard > SQL Editor
2. Cole o conteúdo de /migrations/004_controle_presenca_suspensoes.sql
3. Execute

# OU via CLI do Supabase
supabase db push
```

### 2. Deploy da Edge Function

```bash
cd supabase
supabase functions deploy verificar-suspensao --no-verify-jwt
```

**Importante**: A flag `--no-verify-jwt` é necessária pois esta função será chamada pelo formulário público sem autenticação.

### 3. Deploy da Aplicação Admin

```bash
npm run build
# Deploy conforme seu processo atual
```

---

## 💻 Como Usar o Sistema

### 1. Registrar Presença após uma Gira

1. Acesse o menu **"Lista de Confirmação"** no dashboard
2. Selecione a gira na lista lateral (organizadas por data)
3. Você verá todos os agendamentos confirmados para aquela gira
4. Para cada consulente:
   - Clique **"✓ Presente"** se compareceu
   - Clique **"✗ Ausente"** se NÃO compareceu
5. Ao marcar como ausente:
   - Uma suspensão de 2 semanas é criada automaticamente
   - O consulente não poderá fazer novos agendamentos neste período

### 2. Resetar Registro de Presença

Se registrou por engano:
1. Clique no botão **"↺ Resetar"**
2. Confirme a ação
3. O registro de presença será removido
4. **ATENÇÃO**: Se marcou ausente e resetou, a suspensão NÃO é removida automaticamente. Você precisará removê-la manualmente no banco de dados.

### 3. Visualizar Estatísticas

A interface mostra automaticamente:
- Total de agendamentos da gira
- Número de presentes
- Número de ausentes
- Número de pendentes de registro
- Percentuais de presença e ausência

---

## 🌐 Integração com Formulário Público (agendamento.cesca.digital)

### O que precisa ser feito no quiz-cesca

Para bloquear agendamentos de consulentes suspensos, o formulário público deve:

#### 1. Chamar a Edge Function antes de salvar

```javascript
// Exemplo de integração
async function verificarSuspensao(email, telefone) {
  try {
    const response = await fetch(
      'https://[SEU-PROJECT-ID].supabase.co/functions/v1/verificar-suspensao',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'SUA_ANON_KEY'
        },
        body: JSON.stringify({ email, telefone })
      }
    )

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao verificar suspensão:', error)
    return { suspenso: false }
  }
}

// Usar antes de enviar o formulário
async function submeterAgendamento(formData) {
  const { email, telefone } = formData

  // 1. Verificar suspensão
  const verificacao = await verificarSuspensao(email, telefone)

  // 2. Se suspenso, bloquear
  if (verificacao.suspenso) {
    alert(`Você está temporariamente suspenso de realizar novos agendamentos.

Motivo: ${verificacao.motivo}
Suspensão válida até: ${verificacao.data_fim_formatada}
Dias restantes: ${verificacao.dias_restantes}

Se você acredita que isso é um erro, entre em contato conosco.`)

    return false // Bloqueia o envio
  }

  // 3. Se não suspenso, continuar com o agendamento
  await salvarAgendamento(formData)
}
```

#### 2. Exibir Mensagem Amigável

Sugestão de mensagem para usuário suspenso:

```
⚠️ Agendamento Temporariamente Suspenso

Identificamos que você possui um agendamento anterior confirmado ao qual não compareceu.

Por esta razão, novos agendamentos estão temporariamente suspensos até [DATA].

📅 Suspensão válida até: [DATA_FIM_FORMATADA]
⏰ Dias restantes: [DIAS_RESTANTES]

Se você acredita que isso é um erro ou possui justificativa,
por favor entre em contato conosco pelo email: contato@cesca.digital
```

#### 3. Configurar CORS (se necessário)

Se encontrar erros de CORS, adicione o domínio `agendamento.cesca.digital` às configurações do Supabase:

1. Acesse Supabase Dashboard > Settings > API
2. Em "CORS Origins", adicione: `https://agendamento.cesca.digital`

---

## 🔍 Fluxo Completo do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│  1. CONSULENTE FAZ AGENDAMENTO NO FORMULÁRIO PÚBLICO        │
│     (agendamento.cesca.digital)                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. FORMULÁRIO CHAMA: verificar-suspensao                   │
│     - Se SUSPENSO: Bloqueia e exibe mensagem               │
│     - Se NÃO SUSPENSO: Permite continuar                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. AGENDAMENTO SALVO COM STATUS "Pendente"                 │
│     (tabela: agendamentos)                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. ADMIN CONFIRMA NO PAINEL (AgendamentoManager)           │
│     - Status muda para "Confirmado"                         │
│     - Email de confirmação enviado (opcional)               │
│     - Registra data_confirmacao                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5. GIRA ACONTECE (segunda ou sexta-feira)                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  6. APÓS A GIRA: Admin acessa "Lista de Confirmação"        │
│     - Seleciona a gira pela data                            │
│     - Marca cada consulente como:                           │
│       • ✓ Presente (compareceu = TRUE)                      │
│       • ✗ Ausente (compareceu = FALSE)                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  7. SE MARCADO COMO AUSENTE:                                │
│     - TRIGGER criar_suspensao_por_falta() é acionado        │
│     - Cria registro na tabela "suspensoes"                  │
│     - data_fim = hoje + 14 dias                             │
│     - ativa = TRUE                                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  8. PRÓXIMO AGENDAMENTO DO CONSULENTE:                      │
│     - verificar-suspensao retorna: suspenso = TRUE          │
│     - Formulário bloqueia novo agendamento                  │
│     - Exibe mensagem com data de liberação                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  9. APÓS 14 DIAS:                                           │
│     - verificar_suspensao() desativa automaticamente        │
│     - ativa = FALSE                                         │
│     - Consulente pode agendar novamente                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Queries Úteis

### Verificar suspensões ativas

```sql
SELECT
  s.email,
  s.telefone,
  s.motivo,
  s.data_inicio,
  s.data_fim,
  EXTRACT(DAY FROM (s.data_fim - CURRENT_TIMESTAMP))::INTEGER as dias_restantes,
  a.nome_completo
FROM suspensoes s
LEFT JOIN agendamentos a ON s.agendamento_id = a.id
WHERE s.ativa = true
  AND s.data_fim > CURRENT_TIMESTAMP
ORDER BY s.data_fim DESC;
```

### Listar consulentes com faltas

```sql
SELECT
  a.nome_completo,
  a.email,
  a.telefone,
  a.data_confirmacao,
  a.data_registro_presenca,
  a.responsavel_registro
FROM agendamentos a
WHERE a.status = 'Confirmado'
  AND a.compareceu = false
ORDER BY a.data_registro_presenca DESC;
```

### Estatísticas de presença por período

```sql
SELECT
  DATE(data_confirmacao) as data_gira,
  COUNT(*) as total_agendamentos,
  COUNT(*) FILTER (WHERE compareceu = true) as presentes,
  COUNT(*) FILTER (WHERE compareceu = false) as ausentes,
  COUNT(*) FILTER (WHERE compareceu IS NULL) as pendentes,
  ROUND(
    (COUNT(*) FILTER (WHERE compareceu = true)::NUMERIC / COUNT(*)) * 100,
    2
  ) as percentual_presenca
FROM agendamentos
WHERE status = 'Confirmado'
  AND data_confirmacao >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(data_confirmacao)
ORDER BY data_gira DESC;
```

### Remover suspensão manualmente (em caso de erro)

```sql
-- Desativar suspensão específica
UPDATE suspensoes
SET ativa = false,
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'email@exemplo.com'
  AND ativa = true;

-- Ou deletar completamente
DELETE FROM suspensoes
WHERE email = 'email@exemplo.com'
  AND ativa = true;
```

---

## ⚠️ Considerações Importantes

### 1. Suspensão vs Falta

- **Marcar como ausente**: Cria suspensão de 2 semanas automaticamente
- **Resetar registro**: Remove o registro de presença MAS NÃO remove a suspensão
- Para remover suspensão, faça manualmente via SQL

### 2. Giras Futuras

- O sistema mostra giras futuras (que ainda não aconteceram)
- Elas aparecem com badge "Futura" e opacidade reduzida
- Você pode registrar presença antecipadamente, mas o ideal é aguardar a gira acontecer

### 3. Cálculo de Datas de Gira

- Giras acontecem nas **segundas** e **sextas-feiras**
- O sistema calcula automaticamente a próxima gira a partir da data de confirmação
- Exemplo: Confirmado na terça → Gira na sexta

### 4. Performance

- Índices criados em:
  - `suspensoes(email, ativa)`
  - `suspensoes(telefone, ativa)`
  - `suspensoes(data_fim)`
  - `agendamentos(compareceu)`
- Função `desativar_suspensoes_expiradas()` é chamada em cada verificação

### 5. Privacidade e LGPD

- A tabela `suspensoes` armazena email e telefone
- Considere implementar:
  - Política de retenção de dados
  - Anonimização após período
  - Aviso de suspensão no email de confirmação

---

## 🐛 Troubleshooting

### "Erro ao verificar suspensão" no formulário público

1. Verifique se a Edge Function foi deployada: `supabase functions list`
2. Verifique os logs: `supabase functions logs verificar-suspensao`
3. Confirme que a flag `--no-verify-jwt` foi usada
4. Verifique as variáveis de ambiente do Supabase

### Suspensão não é criada ao marcar ausente

1. Verifique se o trigger foi criado:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_suspensao_por_falta';
```
2. Verifique os logs do Postgres no Supabase Dashboard
3. Tente marcar ausente novamente

### Suspensão não expira automaticamente

- A função `desativar_suspensoes_expiradas()` é chamada em cada `verificar_suspensao()`
- Se ninguém tentar agendar, a suspensão não será marcada como inativa
- Mas isso não impacta o funcionamento: a verificação sempre checa se `data_fim > NOW()`

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do Supabase Dashboard
2. Consulte esta documentação
3. Entre em contato com o desenvolvedor

---

**Última atualização**: Dezembro 2025
**Versão**: 1.0.0
