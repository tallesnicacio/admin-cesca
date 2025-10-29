#!/bin/bash

echo "🚀 Iniciando deploy da aplicação Admin CESCA..."

# 1. Build da aplicação React
echo "📦 Building React app..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro no build da aplicação"
    exit 1
fi

echo "✅ Build concluído com sucesso!"

# 2. Backup do .dockerignore
echo "📝 Preparando Docker..."
mv .dockerignore .dockerignore.backup 2>/dev/null
cp .dockerignore.production .dockerignore 2>/dev/null || echo "# Minimal dockerignore" > .dockerignore

# 3. Build da imagem Docker
echo "🐳 Building Docker image..."
docker build -f Dockerfile.production -t admin-cesca:latest .

if [ $? -ne 0 ]; then
    echo "❌ Erro ao construir imagem Docker"
    mv .dockerignore.backup .dockerignore 2>/dev/null
    exit 1
fi

# 4. Restaurar .dockerignore
mv .dockerignore.backup .dockerignore 2>/dev/null

echo "✅ Imagem Docker construída!"

# 5. Atualizar serviço Docker
echo "🔄 Atualizando serviço Docker..."
docker service update --image admin-cesca:latest admin-cesca_admin-cesca

if [ $? -ne 0 ]; then
    echo "❌ Erro ao atualizar serviço Docker"
    exit 1
fi

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🌐 A aplicação foi atualizada e está rodando"
echo ""
echo "Para verificar o status:"
echo "  docker service ps admin-cesca_admin-cesca"
echo ""
