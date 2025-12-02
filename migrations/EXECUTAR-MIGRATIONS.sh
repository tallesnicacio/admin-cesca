#!/bin/bash
# ============================================
# Script para executar migrations no Supabase
# ============================================

echo "╔════════════════════════════════════════════════════════╗"
echo "║     ADMIN CESCA - EXECUTOR DE MIGRATIONS              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  ATENÇÃO:${NC}"
echo "Para executar DDL (CREATE TABLE, etc), você precisa:"
echo "1. Acessar o Supabase Dashboard"
echo "2. Ou ter a SERVICE_ROLE_KEY configurada"
echo ""

# Verificar se existe service role key no .env
if [ -f ".env" ]; then
    if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env; then
        echo -e "${GREEN}✓${NC} SERVICE_ROLE_KEY encontrada no .env"
        echo ""

        # Perguntar se quer executar via service role
        read -p "Deseja executar as migrations via service role key? (s/n): " resposta

        if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
            echo ""
            echo -e "${BLUE}📤 Executando migrations...${NC}"

            # Aqui você poderia usar psql ou API do Supabase
            # Mas por segurança, vamos apenas mostrar instruções
            echo -e "${YELLOW}⚠️  Por segurança, execute manualmente no Dashboard${NC}"
        fi
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📋 INSTRUÇÕES PARA EXECUTAR AS MIGRATIONS:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Acesse o Supabase Dashboard:"
echo "   https://app.supabase.com/project/mmfsesanudlzgfbjlpzk"
echo ""
echo "2️⃣  Vá em: SQL Editor → New Query"
echo ""
echo "3️⃣  Execute as migrations na ordem:"
echo ""
echo "   ${BLUE}Primeira migration:${NC}"
echo "   📄 migrations/001_quiz_editor_schema.sql"
echo ""
echo "   ${BLUE}Segunda migration:${NC}"
echo "   📄 migrations/002_migrate_quiz_data.sql"
echo ""
echo "4️⃣  Verifique se as tabelas foram criadas:"
echo "   - Table Editor → Buscar por:"
echo "     • formularios"
echo "     • etapas_formulario"
echo "     • opcoes_atendimento"
echo "     • regras_formulario"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Para facilitar, os arquivos SQL estão em:${NC}"
echo "   $(pwd)/migrations/"
echo ""
echo "💡 Dica: Abra os arquivos e copie/cole no SQL Editor do Supabase"
echo ""
