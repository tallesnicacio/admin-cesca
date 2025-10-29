#!/bin/bash

# ===================================
# Admin CESCA - Update Script
# ===================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================="
echo "Admin CESCA - Service Update"
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
SERVICE_NAME="${STACK_NAME}_admin-cesca"

echo -e "${BLUE}Stack Name: ${STACK_NAME}${NC}"
echo -e "${BLUE}Service Name: ${SERVICE_NAME}${NC}"
echo -e "${BLUE}Registry: ${DOCKER_REGISTRY}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"

# Check if Swarm is initialized
if ! docker info 2>&1 | grep -q "Swarm: active"; then
    echo -e "${RED}✗ Docker Swarm is not active!${NC}"
    exit 1
fi

# Check if service exists
if ! docker service ls | grep -q "${SERVICE_NAME}"; then
    echo -e "${RED}✗ Service ${SERVICE_NAME} not found!${NC}"
    echo -e "${YELLOW}Available services:${NC}"
    docker service ls
    echo ""
    echo -e "${YELLOW}If this is a new deployment, use: ./scripts/deploy.sh${NC}"
    exit 1
fi

# Show current service info
echo ""
echo -e "${BLUE}Current service status:${NC}"
docker service ps "${SERVICE_NAME}" --no-trunc | head -n 3

echo ""
read -p "Do you want to continue with the update? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Update cancelled.${NC}"
    exit 0
fi

# Update the service
echo -e "${GREEN}Updating service with new image...${NC}"

docker service update \
    --image "${DOCKER_REGISTRY}/admin-cesca:${VERSION}" \
    --update-parallelism 1 \
    --update-delay 10s \
    --update-failure-action rollback \
    --with-registry-auth \
    "${SERVICE_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Service update initiated successfully!${NC}"

    echo ""
    echo -e "${BLUE}Monitoring update progress...${NC}"
    echo -e "${YELLOW}(Press Ctrl+C to stop monitoring, update will continue)${NC}"
    echo ""

    # Monitor the update
    for i in {1..30}; do
        sleep 2
        CURRENT_STATE=$(docker service ps "${SERVICE_NAME}" --format "{{.CurrentState}}" --no-trunc | head -n 1)
        echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} ${CURRENT_STATE}"

        if echo "${CURRENT_STATE}" | grep -q "Running"; then
            echo -e "${GREEN}✓ Service is running with new version!${NC}"
            break
        fi

        if echo "${CURRENT_STATE}" | grep -qi "failed\|rejected"; then
            echo -e "${RED}✗ Update failed! Checking rollback status...${NC}"
            docker service ps "${SERVICE_NAME}" --no-trunc | head -n 5
            exit 1
        fi
    done

    echo ""
    echo -e "${GREEN}==================================="
    echo "Update Summary:"
    echo -e "===================================${NC}"
    docker service ps "${SERVICE_NAME}" --no-trunc | head -n 5

    echo ""
    echo -e "${GREEN}==================================="
    echo "Useful Commands:"
    echo -e "===================================${NC}"
    echo -e "${YELLOW}View logs:${NC}          docker service logs ${SERVICE_NAME} -f --tail 50"
    echo -e "${YELLOW}View tasks:${NC}         docker service ps ${SERVICE_NAME}"
    echo -e "${YELLOW}Rollback:${NC}           docker service update --rollback ${SERVICE_NAME}"
    echo -e "${YELLOW}Scale service:${NC}      docker service scale ${SERVICE_NAME}=3"
    echo ""
else
    echo -e "${RED}✗ Update failed!${NC}"
    exit 1
fi
