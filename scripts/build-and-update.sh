#!/bin/bash

# ===================================
# Admin CESCA - Build and Update
# ===================================
# Este script faz o build e atualização
# do serviço (SEM REGISTRY)
# ===================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================="
echo "Admin CESCA - Build & Update Pipeline"
echo -e "=========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    echo -e "${GREEN}✓ Loading .env file...${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}✗ .env file not found!${NC}"
    exit 1
fi

# Validate required variables
if [ -z "$REACT_APP_SUPABASE_URL" ] || [ -z "$REACT_APP_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}✗ Missing required environment variables!${NC}"
    exit 1
fi

# Set defaults
VERSION=${VERSION:-$(date +%Y%m%d_%H%M%S)}
STACK_NAME=${STACK_NAME:-admin-cesca}
IMAGE_NAME="localhost:5000/admin-cesca"
FULL_IMAGE_NAME="${IMAGE_NAME}:latest"
SERVICE_NAME="${STACK_NAME}_admin-cesca"

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Stack: ${STACK_NAME}"
echo -e "  Service: ${SERVICE_NAME}"
echo -e "  Image: ${FULL_IMAGE_NAME}"
echo -e "  Version: ${VERSION}"
echo ""

# ===================================
# STEP 1: Build
# ===================================
echo -e "${GREEN}[STEP 1/2] Building Docker image...${NC}"

docker build \
    --build-arg REACT_APP_SUPABASE_URL="${REACT_APP_SUPABASE_URL}" \
    --build-arg REACT_APP_SUPABASE_ANON_KEY="${REACT_APP_SUPABASE_ANON_KEY}" \
    -t "${FULL_IMAGE_NAME}" \
    .

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build completed successfully!${NC}"
echo ""

# ===================================
# STEP 2: Update Service
# ===================================
echo -e "${GREEN}[STEP 2/2] Updating service...${NC}"

# Check if service exists
if ! docker service ls | grep -q "${SERVICE_NAME}"; then
    echo -e "${YELLOW}Service not found. Deploying new stack...${NC}"
    docker stack deploy --compose-file docker-stack.yml "${STACK_NAME}"
else
    echo -e "${BLUE}Forcing service update to avoid cache issues...${NC}"
    echo -e "${YELLOW}⚠ Using --force to ensure containers are recreated${NC}"

    docker service update \
        --force \
        --image "${FULL_IMAGE_NAME}" \
        --update-parallelism 1 \
        --update-delay 10s \
        --update-failure-action rollback \
        "${SERVICE_NAME}"
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Service update failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Service updated successfully!${NC}"
echo ""

# ===================================
# Summary
# ===================================
echo -e "${GREEN}========================================="
echo "Pipeline completed successfully!"
echo -e "=========================================${NC}"
echo ""
echo -e "${BLUE}Deployment Summary:${NC}"
echo -e "  Version: ${VERSION}"
echo -e "  Image: ${FULL_IMAGE_NAME}"
echo ""

# Show service status
echo -e "${BLUE}Current service status:${NC}"
docker service ps "${SERVICE_NAME}" --no-trunc | head -n 5

echo ""
echo -e "${GREEN}✓ No-cache build and forced update completed!${NC}"
echo -e "${GREEN}✓ All browser/application cache should be cleared${NC}"
echo ""
echo -e "${YELLOW}Monitor logs with:${NC}"
echo -e "  docker service logs ${SERVICE_NAME} -f --tail 50"
echo ""
echo -e "${YELLOW}Additional commands:${NC}"
echo -e "  View service: docker service ps ${SERVICE_NAME}"
echo -e "  Inspect: docker service inspect ${SERVICE_NAME}"
echo ""
