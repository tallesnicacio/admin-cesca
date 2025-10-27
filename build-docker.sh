#!/bin/bash

# Load environment variables from .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build Docker image with build args
docker build \
    --build-arg REACT_APP_SUPABASE_URL="$REACT_APP_SUPABASE_URL" \
    --build-arg REACT_APP_SUPABASE_ANON_KEY="$REACT_APP_SUPABASE_ANON_KEY" \
    -t admin-cesca:latest \
    .

echo "Build completed!"
