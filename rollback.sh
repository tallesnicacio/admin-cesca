#!/bin/bash

# ================================================
# ADMIN CESCA - ROLLBACK SCRIPT
# Rollback para versão anterior
# ================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

IMAGE_NAME="admin-cesca"
STACK_NAME="admin-cesca"

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Check if tag was provided
if [ -z "$1" ]; then
    print_error "Tag da imagem não fornecida!"
    echo ""
    echo "Uso: ./rollback.sh <tag>"
    echo ""
    echo "Imagens disponíveis:"
    docker images $IMAGE_NAME --format "table {{.Tag}}\t{{.CreatedAt}}"
    exit 1
fi

TAG=$1

# Check if image exists
if ! docker images $IMAGE_NAME:$TAG | grep -q $TAG; then
    print_error "Imagem $IMAGE_NAME:$TAG não encontrada!"
    echo ""
    echo "Imagens disponíveis:"
    docker images $IMAGE_NAME --format "table {{.Tag}}\t{{.CreatedAt}}"
    exit 1
fi

print_warning "========================================="
print_warning "ROLLBACK PARA: $IMAGE_NAME:$TAG"
print_warning "========================================="
echo ""
read -p "Tem certeza que deseja fazer rollback? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    print_warning "Rollback cancelado"
    exit 0
fi

# Tag old image as latest
print_step "Atualizando tag latest para $TAG..."
docker tag $IMAGE_NAME:$TAG $IMAGE_NAME:latest
print_success "Tag atualizada"

# Update stack
print_step "Atualizando stack..."
docker stack deploy -c docker-compose.yml $STACK_NAME

if [ $? -eq 0 ]; then
    print_success "Rollback realizado com sucesso!"

    # Wait and show status
    print_step "Aguardando atualização..."
    sleep 5

    print_step "Status dos serviços:"
    docker stack services $STACK_NAME

    echo ""
    print_success "Rollback concluído!"
    echo ""
else
    print_error "Falha no rollback!"
    exit 1
fi
