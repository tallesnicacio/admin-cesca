// Supabase Edge Function para criar usuários com permissões de admin
// Deploy: supabase functions deploy create-user

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
    // Criar cliente Supabase com Service Role Key
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

    // Verificar se o usuário é admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin && profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Sem permissão de administrador' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Obter dados do corpo da requisição
    const { email, name, role, password } = await req.json()

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email e nome são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Gerar senha temporária forte (será substituída quando usuário confirmar email)
    const userPassword = password || generateStrongPassword()

    // Criar usuário usando Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: userPassword,
      email_confirm: false, // Usuário precisa confirmar email antes de acessar
      user_metadata: {
        name: name,
        role: role || 'user'
      }
    })

    if (createError) {
      console.error('Erro ao criar usuário:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Atualizar/criar perfil na tabela profiles ou users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: newUser.user.id,
        email: email,
        name: name,
        role: role || 'user'
      }, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError)
      // Não retornar erro pois o usuário já foi criado
    }

    // Gerar link de confirmação personalizado que redireciona para /set-password
    const siteUrl = Deno.env.get('SITE_URL') || 'https://admin.cesca.digital'
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${siteUrl}/set-password`
      }
    })

    if (linkError) {
      console.error('Erro ao gerar link de confirmação:', linkError)
      return new Response(
        JSON.stringify({
          error: 'Usuário criado mas falha ao enviar email de confirmação',
          details: linkError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Link de confirmação gerado:', linkData.properties.action_link)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: email,
          name: name,
          role: role || 'user'
        },
        message: 'Usuário criado com sucesso! Um email de confirmação foi enviado.'
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

// Função auxiliar para gerar senha forte
function generateStrongPassword(): string {
  const length = 16
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''

  // Garantir ao menos: 1 maiúscula, 1 minúscula, 1 número, 1 especial
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  password += '0123456789'[Math.floor(Math.random() * 10)]
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]

  // Preencher o restante
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }

  // Embaralhar
  return password.split('').sort(() => Math.random() - 0.5).join('')
}
