# Deploy da Função de Envio de Email via Resend

Este documento explica como fazer o deploy da Edge Function `send-confirmation-email` no Supabase.

## Pré-requisitos

1. Ter o Supabase CLI instalado
2. Estar autenticado no Supabase CLI
3. Ter acesso ao projeto no Supabase

## Instalação do Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Ou via npm
npm install -g supabase
```

## Autenticação

```bash
supabase login
```

## Link com o projeto

```bash
supabase link --project-ref mmfsesanudlzgfbjlpzk
```

## Deploy da Edge Function

```bash
# Deploy da função de envio de email
supabase functions deploy send-confirmation-email
```

## Configurar Variáveis de Ambiente

Após o deploy, é necessário configurar a chave API do Resend como variável de ambiente secreta:

### Via Dashboard do Supabase:

1. Acesse: https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk/settings/functions
2. Clique em "Edge Functions"
3. Selecione a função `send-confirmation-email`
4. Adicione a variável de ambiente:
   - Nome: `RESEND_API_KEY`
   - Valor: `re_dnCs8W19_MS9jbUydTNgnugEYy6gpv2Qo`

### Via CLI:

```bash
supabase secrets set RESEND_API_KEY=re_dnCs8W19_MS9jbUydTNgnugEYy6gpv2Qo
```

## Testar a Função

Após o deploy, você pode testar a função via:

### 1. Via Dashboard do Supabase

1. Acesse: https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk/functions/send-confirmation-email
2. Use o painel de testes para enviar uma requisição de teste

### 2. Via código da aplicação

A aplicação já está configurada para chamar a função automaticamente após confirmar um agendamento.

## Fluxo de Funcionamento

1. Administrador confirma um agendamento no painel
2. Sistema atualiza o status do agendamento para "Confirmado"
3. Modal aparece perguntando se deseja enviar email
4. Ao clicar em "Enviar Email":
   - Frontend chama a Edge Function `send-confirmation-email`
   - Edge Function busca os dados do agendamento
   - Edge Function formata o email com o template HTML
   - Edge Function envia o email via Resend API
   - Email é enviado para o consulente

## Verificar Logs

Para verificar se há erros na função:

```bash
supabase functions logs send-confirmation-email
```

Ou acesse via Dashboard:
https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk/logs/functions

## Domínio do Email

**IMPORTANTE**: Para usar um domínio personalizado (como `noreply@cesca.digital`), você precisa:

1. Verificar o domínio no Resend Dashboard
2. Adicionar os registros DNS necessários
3. Aguardar a verificação

Até lá, você pode usar:
- `onboarding@resend.dev` (domínio de teste do Resend)
- Ou qualquer domínio já verificado na sua conta Resend

Para alterar o domínio, edite o arquivo:
`supabase/functions/send-confirmation-email/index.ts`

Procure por:
```typescript
from: 'Centro Espírita Santa Clara de Assis <noreply@cesca.digital>',
```

E substitua pelo domínio verificado.

## Troubleshooting

### Erro: "Function not found"
- Verifique se fez o deploy: `supabase functions list`
- Faça o deploy novamente se necessário

### Erro: "RESEND_API_KEY not configured"
- Configure a variável de ambiente conforme explicado acima

### Erro: "Email not sent"
- Verifique se a API key do Resend está correta
- Verifique se o domínio está verificado no Resend
- Verifique os logs da função

### Erro de CORS
- Já está configurado no código, mas verifique se a função está retornando os headers CORS corretos

## Recursos Adicionais

- [Documentação Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Documentação Resend](https://resend.com/docs)
- [Resend Dashboard](https://resend.com/dashboard)
