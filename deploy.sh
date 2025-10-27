#!/bin/bash

# ================================================
# ADMIN CESCA - DEPLOY SCRIPT
# Deploy com Docker Swarm + Traefik
# ================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="admin-cesca"
IMAGE_TAG="latest"
STACK_NAME="admin-cesca"
COMPOSE_FILE="docker-compose.yml"

# Functions
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    print_warning "Este script precisa de permissões sudo para alguns comandos"
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    print_error "Arquivo .env.production não encontrado!"
    echo "Copie .env.production.example para .env.production e configure as variáveis"
    exit 1
fi

# Load environment variables
print_step "Carregando variáveis de ambiente..."
export $(cat .env.production | grep -v '^#' | xargs)
print_success "Variáveis carregadas"

# Check if Docker Swarm is initialized
print_step "Verificando Docker Swarm..."
if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    print_warning "Docker Swarm não está inicializado. Inicializando..."
    docker swarm init
    print_success "Docker Swarm inicializado"
else
    print_success "Docker Swarm ativo"
fi

# Check if network_public exists
print_step "Verificando rede network_public..."
if ! docker network ls | grep -q "network_public"; then
    print_warning "Rede network_public não existe. Criando..."
    docker network create --driver=overlay --attachable network_public
    print_success "Rede criada"
else
    print_success "Rede existe"
fi

# Build Docker image
print_step "Construindo imagem Docker..."
docker build \
    --build-arg REACT_APP_SUPABASE_URL="$REACT_APP_SUPABASE_URL" \
    --build-arg REACT_APP_SUPABASE_ANON_KEY="$REACT_APP_SUPABASE_ANON_KEY" \
    -t $IMAGE_NAME:$IMAGE_TAG \
    .

if [ $? -eq 0 ]; then
    print_success "Imagem construída com sucesso"
else
    print_error "Falha ao construir imagem"
    exit 1
fi

# Tag image with timestamp for rollback capability
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker tag $IMAGE_NAME:$IMAGE_TAG $IMAGE_NAME:$TIMESTAMP
print_success "Imagem tagueada: $IMAGE_NAME:$TIMESTAMP"

# Deploy or update stack
print_step "Deployando stack no Docker Swarm..."

if docker stack ls | grep -q "$STACK_NAME"; then
    print_warning "Stack já existe. Atualizando..."
    docker stack deploy -c $COMPOSE_FILE $STACK_NAME
else
    print_step "Criando nova stack..."
    docker stack deploy -c $COMPOSE_FILE $STACK_NAME
fi

if [ $? -eq 0 ]; then
    print_success "Deploy realizado com sucesso!"
else
    print_error "Falha no deploy"
    exit 1
fi

# Wait for service to be ready
print_step "Aguardando serviço ficar pronto..."
sleep 5

# Check service status
print_step "Verificando status dos serviços..."
docker stack services $STACK_NAME

# Show container logs
print_step "Últimas linhas do log:"
CONTAINER_ID=$(docker ps -q -f "name=${STACK_NAME}_admin-cesca" | head -n 1)
if [ ! -z "$CONTAINER_ID" ]; then
    docker logs --tail 20 $CONTAINER_ID
fi

echo ""
print_success "========================================="
print_success "Deploy concluído com sucesso!"
print_success "========================================="
echo ""
echo "Comandos úteis:"
echo "  - Ver logs: docker service logs ${STACK_NAME}_admin-cesca -f"
echo "  - Ver status: docker stack services ${STACK_NAME}"
echo "  - Ver containers: docker stack ps ${STACK_NAME}"
echo "  - Remover stack: docker stack rm ${STACK_NAME}"
echo "  - Rollback: ./rollback.sh $TIMESTAMP"
echo ""
print_success "URL: https://admin.cesca.digital"
echo ""
