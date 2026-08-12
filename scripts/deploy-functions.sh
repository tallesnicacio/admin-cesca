#!/bin/bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI não encontrado. Instale-o pela documentação oficial."
  exit 1
fi

if ! supabase projects list >/dev/null 2>&1; then
  echo "Autentique primeiro com: supabase login"
  exit 1
fi

if [ ! -f ".supabase/config.toml" ]; then
  echo "Vincule o projeto primeiro com: supabase link --project-ref <PROJECT_REF>"
  exit 1
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "Defina RESEND_API_KEY no ambiente antes do deploy."
  exit 1
fi

supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
supabase functions deploy send-confirmation-email
echo "Função send-confirmation-email implantada."
