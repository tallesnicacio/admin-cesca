// Supabase Edge Function para verificar se um email/telefone está suspenso
// Deploy: supabase functions deploy verificar-suspensao --no-verify-jwt
// Esta função não requer autenticação pois será chamada pelo formulário público

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
    // Criar cliente Supabase com service role
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

    // Obter dados do corpo da requisição
    const { email, telefone } = await req.json()

    if (!email && !telefone) {
      return new Response(
        JSON.stringify({
          error: 'Email ou telefone é obrigatório',
          suspenso: false
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verificar suspensões ativas usando a função do banco
    const { data, error } = await supabaseAdmin.rpc('verificar_suspensao', {
      p_email: email || '',
      p_telefone: telefone || ''
    })

    if (error) {
      console.error('Erro ao verificar suspensão:', error)
      return new Response(
        JSON.stringify({
          error: 'Erro ao verificar suspensão',
          details: error.message,
          suspenso: false
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Se não retornou dados ou está vazio, não há suspensão
    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          suspenso: false,
          message: 'Nenhuma suspensão ativa encontrada'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Pegar o primeiro resultado (a função retorna apenas um)
    const suspensao = data[0]

    if (suspensao.suspenso) {
      // Formatar data de fim da suspensão
      const dataFim = new Date(suspensao.data_fim)
      const dataFormatada = dataFim.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })

      return new Response(
        JSON.stringify({
          suspenso: true,
          motivo: suspensao.motivo,
          data_fim: suspensao.data_fim,
          data_fim_formatada: dataFormatada,
          dias_restantes: suspensao.dias_restantes,
          message: `Você está temporariamente suspenso de realizar novos agendamentos até ${dataFormatada} devido a: ${suspensao.motivo}. Dias restantes: ${suspensao.dias_restantes}.`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Não suspenso
    return new Response(
      JSON.stringify({
        suspenso: false,
        message: 'Nenhuma suspensão ativa encontrada'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        suspenso: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
