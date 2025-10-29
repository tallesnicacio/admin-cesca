#!/bin/bash

# ===================================
# Admin CESCA - Build Script
# ===================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================="
echo "Admin CESCA - Docker Build"
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

# Validate required variables
if [ -z "$REACT_APP_SUPABASE_URL" ] || [ -z "$REACT_APP_SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}✗ Missing required environment variables!${NC}"
    echo -e "${YELLOW}Please configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY${NC}"
    exit 1
fi

# Set defaults
DOCKER_REGISTRY=${DOCKER_REGISTRY:-localhost:5000}
VERSION=${VERSION:-latest}
IMAGE_NAME="admin-cesca"
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo -e "${GREEN}Building image: ${FULL_IMAGE_NAME}${NC}"

# Build the image
docker build \
    --build-arg REACT_APP_SUPABASE_URL="${REACT_APP_SUPABASE_URL}" \
    --build-arg REACT_APP_SUPABASE_ANON_KEY="${REACT_APP_SUPABASE_ANON_KEY}" \
    -t "${FULL_IMAGE_NAME}" \
    -t "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest" \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed successfully!${NC}"
    echo -e "${GREEN}Image: ${FULL_IMAGE_NAME}${NC}"

    # Ask if user wants to push
    read -p "Do you want to push the image to registry? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Pushing image to registry...${NC}"
        docker push "${FULL_IMAGE_NAME}"
        docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
        echo -e "${GREEN}✓ Image pushed successfully!${NC}"
    fi
else
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}==================================="
echo "Build process completed!"
echo -e "===================================${NC}"
