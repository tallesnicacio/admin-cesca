// Supabase Edge Function para enviar emails de confirmação via Resend
// Deploy: supabase functions deploy send-confirmation-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar autenticação do usuário que está fazendo a requisição
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obter dados do corpo da requisição
    const { agendamentoId, opcaoEscolhida } = await req.json()

    if (!agendamentoId) {
      return new Response(
        JSON.stringify({ error: 'ID do agendamento é obrigatório' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Buscar dados do agendamento
    const { data: agendamento, error: agendamentoError } = await supabaseAdmin
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .single()

    if (agendamentoError || !agendamento) {
      return new Response(
        JSON.stringify({ error: 'Agendamento não encontrado' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determinar qual opção foi escolhida
    const tipoAtendimento = opcaoEscolhida === 'segunda'
      ? agendamento.segunda_opcao
      : agendamento.primeira_opcao

    // Enviar email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Chave API do Resend não configurada' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Centro Espírita Santa Clara de Assis <onboarding@resend.dev>',
        to: [agendamento.email],
        subject: 'Confirmação de Agendamento - CESCA',
        html: generateEmailTemplate(agendamento, tipoAtendimento),
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('Erro ao enviar email:', errorData)
      return new Response(
        JSON.stringify({
          error: 'Erro ao enviar email',
          details: errorData
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const emailData = await emailResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email enviado com sucesso',
        emailId: emailData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Template HTML do email
function generateEmailTemplate(agendamento: any, tipoAtendimento: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Agendamento</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #667eea;
    }
    .header h1 {
      color: #667eea;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      margin-bottom: 30px;
    }
    .greeting {
      font-size: 18px;
      color: #333;
      margin-bottom: 20px;
    }
    .info-box {
      background-color: #f8f9ff;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h2 {
      color: #667eea;
      margin-top: 0;
      font-size: 18px;
    }
    .info-item {
      margin: 12px 0;
      padding: 8px 0;
    }
    .info-label {
      font-weight: 600;
      color: #555;
      display: inline-block;
      width: 140px;
    }
    .info-value {
      color: #333;
    }
    .highlight {
      background-color: #fff3cd;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #ffc107;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666;
      font-size: 14px;
    }
    .footer p {
      margin: 5px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #667eea;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌟 Centro Espírita Santa Clara de Assis 🌟</h1>
    </div>

    <div class="content">
      <p class="greeting">Olá, <strong>${agendamento.nome_completo}</strong>!</p>

      <p>É com alegria que confirmamos o seu agendamento para <strong>${tipoAtendimento}</strong>.</p>

      <div class="info-box">
        <h2>📋 Detalhes do Agendamento</h2>
        <div class="info-item">
          <span class="info-label">Tipo de Atendimento:</span>
          <span class="info-value">${tipoAtendimento}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Nome:</span>
          <span class="info-value">${agendamento.nome_completo}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Telefone:</span>
          <span class="info-value">${agendamento.telefone}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Canal de Contato:</span>
          <span class="info-value">${agendamento.canal_preferencial}</span>
        </div>
      </div>

      <div class="highlight">
        <strong>📞 Atenção:</strong> Em breve, nossa equipe entrará em contato através do canal preferencial informado (${agendamento.canal_preferencial}) para confirmar os detalhes e horários disponíveis.
      </div>

      <p>Caso você tenha alguma dúvida ou precise fazer alguma alteração, por favor entre em contato conosco.</p>
    </div>

    <div class="footer">
      <p><strong>Centro Espírita Santa Clara de Assis</strong></p>
      <p>Este é um email automático, por favor não responda.</p>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        Email enviado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        })}
      </p>
    </div>
  </div>
</body>
</html>
  `
}
