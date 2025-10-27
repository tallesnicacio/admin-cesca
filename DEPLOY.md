# Deploy Admin CESCA - Docker Swarm + Traefik

## 📋 Pré-requisitos

- ✅ VPS com Docker instalado
- ✅ Docker Swarm inicializado
- ✅ Traefik configurado como reverse proxy
- ✅ Domínio: `admin.cesca.digital` apontando para o servidor
- ✅ Rede `network_public` criada

---

## 🚀 Deploy Rápido (Primeira Vez)

```bash
cd /root/admin-cesca

# 1. O arquivo .env.production já está configurado ✓

# 2. Executar deploy
./deploy.sh
```

Pronto! O sistema estará disponível em: **https://admin.cesca.digital**

---

## 📂 Estrutura de Arquivos

```
admin-cesca/
├── Dockerfile                 # Build da imagem
├── docker-compose.yml         # Configuração do Swarm
├── nginx.conf                 # Configuração do Nginx
├── .env.production           # Variáveis de ambiente (CONFIGURADO ✓)
├── .env.production.example   # Template de exemplo
├── deploy.sh                 # Script de deploy
├── rollback.sh              # Script de rollback
├── DEPLOY.md                # Esta documentação
└── src/                     # Código fonte React
```

---

## 🔧 Configuração Detalhada

### 1. Variáveis de Ambiente

O arquivo `.env.production` já está configurado com:

```bash
# Supabase
REACT_APP_SUPABASE_URL=https://mmfsesanudlzgfbjlpzk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc... (já configurada ✓)

# Build
NODE_ENV=production
GENERATE_SOURCEMAP=false

# App
PUBLIC_URL=https://admin.cesca.digital
```

### 2. Docker Compose (Swarm Mode)

O `docker-compose.yml` está configurado com:

**Traefik Labels:**
- ✅ HTTP → HTTPS redirect automático
- ✅ SSL/TLS com Let's Encrypt
- ✅ Host: `admin.cesca.digital`

**Deploy Config:**
- ✅ 1 réplica (pode aumentar para alta disponibilidade)
- ✅ Restart automático em caso de falha
- ✅ Max 3 tentativas de restart

### 3. Nginx

Otimizado para React SPA:
- ✅ Gzip compression
- ✅ Cache de assets estáticos (1 ano)
- ✅ Security headers
- ✅ SPA routing (fallback para index.html)
- ✅ Health check endpoint

---

## 📦 Processo de Deploy

O script `deploy.sh` executa automaticamente:

1. ✅ Carrega variáveis de ambiente
2. ✅ Verifica Docker Swarm
3. ✅ Verifica rede `network_public`
4. ✅ Constrói imagem Docker com build args
5. ✅ Tagueia imagem com timestamp (para rollback)
6. ✅ Deploya/atualiza stack no Swarm
7. ✅ Mostra status e logs

### Comando:

```bash
./deploy.sh
```

### Saída esperada:

```
==> Carregando variáveis de ambiente...
✓ Variáveis carregadas
==> Verificando Docker Swarm...
✓ Docker Swarm ativo
==> Verificando rede network_public...
✓ Rede existe
==> Construindo imagem Docker...
✓ Imagem construída com sucesso
✓ Imagem tagueada: admin-cesca:20241025_143052
==> Deployando stack no Docker Swarm...
✓ Deploy realizado com sucesso!
=========================================
✓ Deploy concluído com sucesso!
=========================================

URL: https://admin.cesca.digital
```

---

## 🔄 Atualizações (Redeploy)

Após fazer mudanças no código:

```bash
# 1. Commit suas mudanças (opcional)
git add .
git commit -m "Atualização XYZ"

# 2. Executar deploy
./deploy.sh
```

O Docker Swarm faz **rolling update** sem downtime!

---

## ⏪ Rollback (Voltar Versão Anterior)

Se algo der errado, volte para versão anterior:

```bash
# 1. Ver imagens disponíveis
docker images admin-cesca

# Saída:
# REPOSITORY      TAG                 CREATED
# admin-cesca     latest              2 minutes ago
# admin-cesca     20241025_143052     2 minutes ago
# admin-cesca     20241025_120000     2 hours ago

# 2. Fazer rollback para tag específica
./rollback.sh 20241025_120000
```

---

## 🔍 Monitoramento e Logs

### Ver logs em tempo real:
```bash
docker service logs admin-cesca_admin-cesca -f --tail 100
```

### Ver status do serviço:
```bash
docker stack services admin-cesca
```

### Ver containers rodando:
```bash
docker stack ps admin-cesca
```

### Ver todas as stacks:
```bash
docker stack ls
```

### Inspecionar serviço:
```bash
docker service inspect admin-cesca_admin-cesca
```

---

## 🩺 Health Checks

### 1. Health Check do Container:
```bash
# Nginx responde em localhost:80
curl http://localhost:80
```

### 2. Health Check Endpoint:
```bash
# Endpoint dedicado para health check
curl https://admin.cesca.digital/health
```

### 3. Verificar no Traefik:
```bash
# Dashboard do Traefik
https://traefik.seu-dominio.com/dashboard/
```

---

## 🛠️ Troubleshooting

### Problema: Deploy falha

```bash
# Ver logs do serviço
docker service logs admin-cesca_admin-cesca --tail 50

# Ver eventos do Swarm
docker events --since 10m

# Verificar se stack está rodando
docker stack ps admin-cesca
```

### Problema: Site não carrega

```bash
# 1. Verificar se container está rodando
docker ps | grep admin-cesca

# 2. Verificar logs
docker service logs admin-cesca_admin-cesca -f

# 3. Verificar Traefik
docker service logs traefik -f

# 4. Testar conexão direta (bypass Traefik)
docker ps  # pegar CONTAINER_ID
docker exec -it <CONTAINER_ID> wget -O- http://localhost:80
```

### Problema: Variáveis de ambiente não carregam

```bash
# 1. Verificar se .env.production existe
cat .env.production

# 2. Rebuild forçado
docker build --no-cache \
  --build-arg REACT_APP_SUPABASE_URL="$(grep REACT_APP_SUPABASE_URL .env.production | cut -d '=' -f2)" \
  --build-arg REACT_APP_SUPABASE_ANON_KEY="$(grep REACT_APP_SUPABASE_ANON_KEY .env.production | cut -d '=' -f2)" \
  -t admin-cesca:latest .

# 3. Redeploy
docker stack deploy -c docker-compose.yml admin-cesca
```

### Problema: SSL/TLS não funciona

```bash
# 1. Verificar se domínio aponta para o servidor
nslookup admin.cesca.digital

# 2. Verificar logs do Traefik
docker service logs traefik | grep admin.cesca.digital

# 3. Verificar se porta 443 está aberta
sudo netstat -tulpn | grep :443

# 4. Forçar renovação de certificado (Traefik)
# Remover e redeploy a stack
docker stack rm admin-cesca
./deploy.sh
```

---

## 🔒 Segurança

### Headers de Segurança (já configurados no nginx.conf):

```nginx
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

### HTTPS (Traefik + Let's Encrypt):
- ✅ Redirect HTTP → HTTPS automático
- ✅ Certificado SSL renovado automaticamente
- ✅ TLS 1.2+ apenas

### Variáveis Sensíveis:
- ⚠️ **Nunca comite** `.env.production` no git
- ✅ Use `.env.production.example` como template
- ✅ ANON_KEY já está protegida (só leitura)

---

## 📊 Performance

### Build Otimizado:
- ✅ Multi-stage build (menor imagem final)
- ✅ Apenas dependências de produção
- ✅ Sourcemaps desabilitados

### Nginx Otimizado:
- ✅ Gzip compression
- ✅ Cache de assets (1 ano)
- ✅ Serving estático otimizado

### Docker Swarm:
- ✅ Rolling updates (zero downtime)
- ✅ Health checks automáticos
- ✅ Restart automático em falhas

---

## 🔧 Comandos Úteis

### Gerenciamento de Stack:
```bash
# Deployar
docker stack deploy -c docker-compose.yml admin-cesca

# Atualizar
./deploy.sh

# Remover
docker stack rm admin-cesca

# Listar
docker stack ls

# Ver serviços
docker stack services admin-cesca

# Ver containers
docker stack ps admin-cesca
```

### Gerenciamento de Imagens:
```bash
# Listar imagens
docker images admin-cesca

# Remover imagens antigas (manter últimas 5)
docker images admin-cesca --format "{{.Tag}}" | tail -n +6 | xargs -I {} docker rmi admin-cesca:{}

# Limpar imagens não usadas
docker image prune -a -f
```

### Gerenciamento de Logs:
```bash
# Logs em tempo real
docker service logs admin-cesca_admin-cesca -f

# Últimas 100 linhas
docker service logs admin-cesca_admin-cesca --tail 100

# Logs desde timestamp
docker service logs admin-cesca_admin-cesca --since 2024-10-25T14:00:00

# Salvar logs em arquivo
docker service logs admin-cesca_admin-cesca > logs.txt
```

---

## 🌐 DNS e Domínio

### Configuração DNS:

```
Tipo: A
Nome: admin.cesca.digital
Valor: IP_DO_SERVIDOR
TTL: 3600
```

### Verificar DNS:
```bash
# Verificar resolução
nslookup admin.cesca.digital

# Verificar propagação
dig admin.cesca.digital +short
```

---

## 📈 Escalabilidade

### Aumentar réplicas (alta disponibilidade):

Edite `docker-compose.yml`:
```yaml
deploy:
  replicas: 3  # Era 1
```

Redeploy:
```bash
docker stack deploy -c docker-compose.yml admin-cesca
```

### Load Balancing:
O Traefik distribui automaticamente o tráfego entre as réplicas!

---

## ✅ Checklist de Deploy

Antes do deploy:
- [x] `.env.production` configurado
- [x] Docker Swarm inicializado
- [x] Traefik rodando
- [x] Rede `network_public` criada
- [x] DNS apontando para servidor
- [x] Portas 80 e 443 abertas

Durante o deploy:
- [ ] Execute `./deploy.sh`
- [ ] Aguarde build completar (~2-5 min)
- [ ] Verifique logs sem erros
- [ ] Teste URL: https://admin.cesca.digital

Pós-deploy:
- [ ] Teste login
- [ ] Teste funcionalidades principais
- [ ] Monitore logs por 10 minutos
- [ ] Configure backup automático (opcional)

---

## 🎯 URLs Importantes

- **Aplicação:** https://admin.cesca.digital
- **Health Check:** https://admin.cesca.digital/health
- **Supabase Dashboard:** https://supabase.com/dashboard/project/mmfsesanudlzgfbjlpzk

---

## 📞 Suporte

### Logs importantes para debug:
```bash
# Coletar todos os logs
{
  echo "=== STACK STATUS ==="
  docker stack services admin-cesca

  echo -e "\n=== CONTAINERS ==="
  docker stack ps admin-cesca

  echo -e "\n=== SERVICE LOGS ==="
  docker service logs admin-cesca_admin-cesca --tail 50

  echo -e "\n=== TRAEFIK LOGS ==="
  docker service logs traefik --tail 30
} > debug-logs.txt

cat debug-logs.txt
```

---

**Última atualização:** 25/10/2024
**Versão do Deploy:** 1.0
**Status:** ✅ Pronto para produção
