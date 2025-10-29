#!/bin/bash

# ===================================
# Admin CESCA - Deploy Script
# ===================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================="
echo "Admin CESCA - Docker Swarm Deploy"
echo -e "===================================${NC}"

# Load environment variables
if [ -f .env ]; then
    echo -e "${GREEN}✓ Loading .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}✗ .env file not found!${NC}"
    echo -e "${YELLOW}Please create .env from .env.example${NC}"
    exit 1
fi

# Set defaults
STACK_NAME=${STACK_NAME:-admin-cesca}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
VERSION=${VERSION:-latest}

echo -e "${BLUE}Stack Name: ${STACK_NAME}${NC}"
echo -e "${BLUE}Registry: ${DOCKER_REGISTRY}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"

# Check if Swarm is initialized
if ! docker info 2>&1 | grep -q "Swarm: active"; then
    echo -e "${RED}✗ Docker Swarm is not active!${NC}"
    echo -e "${YELLOW}Initialize Swarm with: docker swarm init${NC}"
    exit 1
fi

# Check if stack file exists
if [ ! -f docker-stack.yml ]; then
    echo -e "${RED}✗ docker-stack.yml not found!${NC}"
    exit 1
fi

# Deploy the stack
echo -e "${GREEN}Deploying stack...${NC}"

docker stack deploy \
    --compose-file docker-stack.yml \
    --with-registry-auth \
    "${STACK_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Stack deployed successfully!${NC}"

    echo ""
    echo -e "${BLUE}Waiting for services to start...${NC}"
    sleep 5

    echo ""
    echo -e "${GREEN}==================================="
    echo "Service Status:"
    echo -e "===================================${NC}"
    docker stack services "${STACK_NAME}"

    echo ""
    echo -e "${GREEN}==================================="
    echo "Useful Commands:"
    echo -e "===================================${NC}"
    echo -e "${YELLOW}View services:${NC}      docker stack services ${STACK_NAME}"
    echo -e "${YELLOW}View logs:${NC}          docker service logs ${STACK_NAME}_admin-cesca -f"
    echo -e "${YELLOW}Scale service:${NC}      docker service scale ${STACK_NAME}_admin-cesca=3"
    echo -e "${YELLOW}Update service:${NC}     docker service update ${STACK_NAME}_admin-cesca --image ${DOCKER_REGISTRY}/admin-cesca:${VERSION}"
    echo -e "${YELLOW}Remove stack:${NC}       docker stack rm ${STACK_NAME}"
    echo ""
else
    echo -e "${RED}✗ Deploy failed!${NC}"
    exit 1
fi
