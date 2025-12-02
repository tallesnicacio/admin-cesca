#!/bin/bash

# Script para deploy das Edge Functions do Supabase
# Uso: ./scripts/deploy-functions.sh

set -e

echo "🚀 Iniciando deploy das Edge Functions..."

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instalando..."
    curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
    chmod +x supabase
    sudo mv supabase /usr/local/bin/supabase
    echo "✅ Supabase CLI instalado com sucesso!"
fi

# Verificar se está logado
if ! supabase projects list &> /dev/null; then
    echo "❌ Você não está autenticado no Supabase."
    echo "Por favor, execute: supabase login"
    exit 1
fi

# Fazer link com o projeto (se ainda não estiver linkado)
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Fazendo link com o projeto..."
    supabase link --project-ref mmfsesanudlzgfbjlpzk
fi

echo "📤 Fazendo deploy da função send-confirmation-email..."
supabase functions deploy send-confirmation-email

echo ""
echo "✅ Deploy concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure a variável de ambiente RESEND_API_KEY:"
echo "   supabase secrets set RESEND_API_KEY=re_dnCs8W19_MS9jbUydTNgnugEYy6gpv2Qo"
echo ""
echo "2. Verifique o domínio do email no Resend se necessário"
echo ""
echo "3. Teste a função via Dashboard do Supabase"
echo ""
