# Guia de Configuração - VPS Hetzner

Este documento lista todas as configurações necessárias para deploy do projeto Landeiro Chat IA em uma VPS da Hetzner.

## 📋 Requisitos do Sistema

### Software Base
- **Node.js**: v20.x ou superior
- **npm**: v9.x ou superior

- **PM2** ou **systemd**: Para gerenciar o processo Node.js em produção

### Recursos da VPS
- **CPU**: Mínimo 2 vCPUs (recomendado 4+)
- **RAM**: Mínimo 2GB (recomendado 4GB+)
- **Disco**: Mínimo 20GB SSD
- **Rede**: IP público com porta 80/443 acessível

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

### Configurações Gerais
```bash
# Ambiente
NODE_ENV=production
PORT=5000

# URL do Frontend (usado para links de email, etc.)
# Temporário (enquanto DNS não propaga): use http://SEU_IP ou http://SEU_IP:5000
# Depois: https://pcs.fernandalandeiro.com.br
VITE_FRONTEND_URL=https://pcs.fernandalandeiro.com.br
```

### Supabase (Obrigatório)
```bash
# URL do projeto Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_URL=https://seu-projeto.supabase.co

# Service Role Key (backend - acesso total)
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui

# Anon Key (frontend - acesso limitado)
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
SUPABASE_ANON_KEY=sua-anon-key-aqui

# Publishable Key (alternativa ao anon key)
VITE_SUPABASE_PUBLISHABLE_KEY=sua-publishable-key-aqui
```

### Banco de Dados PostgreSQL
```bash
# URL de conexão do PostgreSQL (usar pooler do Supabase)
# Formato: postgresql://postgres.PROJETO_ID:SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DATABASE_URL=postgresql://postgres.fnprdocklfpmndailkoo:SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

### OpenAI (Obrigatório)
```bash
# API Key da OpenAI
OPENAI_API_KEY=sk-...
```

### Email (Mailtrap - Desenvolvimento ou Produção)
```bash
# Token da API Mailtrap
MAILTRAP_API_TOKEN=seu-token-aqui

# ID da inbox do Mailtrap
MAILTRAP_TEST_INBOX_ID=seu-inbox-id-aqui
```

### Webhook (Opcional)
```bash
# URL do webhook N8N (se usar integração)
LANDEIRO_WEBHOOK_URL=https://seu-n8n.com/webhook/landeiro
```

### Storage (Opcional - se não usar Supabase Storage)
```bash
# Google Cloud Storage (se usar)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Replit Sidecar (apenas se usar Replit)
REPLIT_SIDECAR_ENDPOINT=http://127.0.0.1:1106

# Diretórios de objetos
PRIVATE_OBJECT_DIR=/path/to/private/objects
PUBLIC_OBJECT_SEARCH_PATHS=/path/to/public/objects
```

---

## 🚀 Processo de Deploy

### 1. Preparação da VPS

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar Git
sudo apt install -y git

# Instalar PM2 globalmente
sudo npm install -g pm2

# Instalar Nginx (para reverse proxy)
sudo apt install -y nginx

# Instalar Certbot (para SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Clonar e Configurar o Projeto

```bash
# Criar diretório da aplicação
sudo mkdir -p /var/www/landeiro-chat-ia
sudo chown $USER:$USER /var/www/landeiro-chat-ia

# Clonar repositório
cd /var/www/landeiro-chat-ia
git clone https://seu-repositorio.git .

# Instalar dependências
npm install

# Criar arquivo .env
nano .env
# (Cole todas as variáveis de ambiente listadas acima)
```

### 3. Build do Projeto

```bash
# Build da aplicação
npm run build

# Verificar se o build foi criado
ls -la dist/
```

### 4. Configurar PM2

**⚠️ IMPORTANTE**: Como o projeto usa ES modules (`"type": "module"` no package.json), você precisa escolher UMA das opções abaixo:

- **Opção 1 (Recomendada)**: Arquivo `.cjs` com sintaxe **CommonJS** (`module.exports`)
- **Opção 2**: Arquivo `.js` com sintaxe **ES module** (`export default`)

**NÃO misture**: Se usar `.cjs`, DEVE usar `module.exports`. Se usar `.js`, DEVE usar `export default`.

#### Opção 1: Usar extensão .cjs com CommonJS (Recomendado)

```bash
# Criar arquivo de configuração do PM2
nano ecosystem.config.cjs
```

**⚠️ ATENÇÃO**: Arquivo `.cjs` usa sintaxe CommonJS (`module.exports`), NÃO `export default`!

Conteúdo do `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: 'landeiro-chat-ia',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/landeiro-error.log',
    out_file: '/var/log/pm2/landeiro-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

#### Opção 2: Usar extensão .js com ES module

```bash
# Criar arquivo de configuração do PM2
nano ecosystem.config.js
```

**⚠️ ATENÇÃO**: Arquivo `.js` com `"type": "module"` usa sintaxe ES module (`export default`), NÃO `module.exports`!

Conteúdo do `ecosystem.config.js`:
```javascript
export default {
  apps: [{
    name: 'landeiro-chat-ia',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/landeiro-error.log',
    out_file: '/var/log/pm2/landeiro-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

```bash
# Iniciar aplicação com PM2
# Se usou Opção 1 (.cjs):
pm2 start ecosystem.config.cjs

# Se usou Opção 2 (.js com ES module):
pm2 start ecosystem.config.js

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar no boot
pm2 startup
# (Siga as instruções exibidas)
```

### 5. Configurar Nginx como Reverse Proxy

```bash
# Criar configuração do Nginx
sudo nano /etc/nginx/sites-available/landeiro-chat-ia
```

Conteúdo da configuração:
```nginx
server {
    listen 80;
    server_name pcs.fernandalandeiro.com.br;

    # Logs
    access_log /var/log/nginx/landeiro-access.log;
    error_log /var/log/nginx/landeiro-error.log;

    # Tamanho máximo de upload (para áudios)
    client_max_body_size 10M;

    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para requisições longas (OpenAI)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket support (se necessário)
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Habilitar site
sudo ln -s /etc/nginx/sites-available/landeiro-chat-ia /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 6. Acessar via IP (Temporário - Enquanto DNS não propaga)

Enquanto o DNS não propaga, você pode acessar a aplicação diretamente pelo IP da VPS:

#### Opção 1: Configurar Nginx para aceitar requisições por IP

Edite a configuração do Nginx para aceitar requisições tanto pelo domínio quanto pelo IP:

```bash
sudo nano /etc/nginx/sites-available/landeiro-chat-ia
```

Atualize o `server_name` para aceitar ambos:

```nginx
server {
    listen 80;
    server_name pcs.fernandalandeiro.com.br _;  # _ aceita qualquer hostname/IP
    
    # ... resto da configuração ...
}
```

Ou crie um bloco separado para IP:

```nginx
# Bloco para acesso via IP (temporário)
server {
    listen 80 default_server;
    server_name _;  # Aceita qualquer hostname/IP
    
    # Logs
    access_log /var/log/nginx/landeiro-ip-access.log;
    error_log /var/log/nginx/landeiro-ip-error.log;
    
    # Tamanho máximo de upload (para áudios)
    client_max_body_size 10M;
    
    # Proxy para aplicação Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para requisições longas (OpenAI)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}

# Bloco para acesso via domínio (quando DNS propagar)
server {
    listen 80;
    server_name pcs.fernandalandeiro.com.br;
    
    # ... mesma configuração do bloco acima ...
}
```

```bash
# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

#### Opção 2: Acessar diretamente pela porta 5000 (sem Nginx)

Você pode acessar diretamente pela porta 5000, mas precisará abrir a porta no firewall:

```bash
# Abrir porta 5000 temporariamente
sudo ufw allow 5000/tcp

# Acessar via: http://SEU_IP:5000
```

**⚠️ Importante**: Feche a porta 5000 depois que o DNS propagar e o Nginx estiver funcionando:

```bash
sudo ufw delete allow 5000/tcp
```

#### Configurar variável de ambiente temporária

Enquanto usa o IP, configure a variável `VITE_FRONTEND_URL` temporariamente:

```bash
# Editar .env
nano /var/www/landeiro-chat-ia/.env
```

```bash
# Temporário - usar IP
VITE_FRONTEND_URL=http://SEU_IP_AQUI

# Depois que DNS propagar, altere para:
# VITE_FRONTEND_URL=https://pcs.fernandalandeiro.com.br
```

```bash
# Reiniciar aplicação para aplicar mudanças
pm2 restart landeiro-chat-ia
```

#### Verificar IP da VPS

```bash
# Ver IP público da VPS
curl ifconfig.me
# ou
hostname -I
```

**Acesso temporário**: `http://SEU_IP` ou `http://SEU_IP:5000` (dependendo da opção escolhida)

**⚠️ Lembre-se**: Após o DNS propagar, atualize `VITE_FRONTEND_URL` para o domínio e remova a configuração temporária do IP.

### 7. Configurar DNS

Antes de configurar SSL, certifique-se de que o DNS está apontando corretamente:

1. **No painel de DNS do domínio `fernandalandeiro.com.br`**, adicione um registro A:
   - **Tipo**: A
   - **Nome**: `pcs`
   - **Valor**: IP da sua VPS Hetzner
   - **TTL**: 3600 (ou padrão)

2. **Verificar propagação DNS**:
```bash
# Verificar se o DNS está resolvendo corretamente
dig pcs.fernandalandeiro.com.br
# ou
nslookup pcs.fernandalandeiro.com.br
```

3. **Aguardar propagação**: Pode levar de alguns minutos a 24 horas (geralmente 5-30 minutos)

### 8. Configurar SSL com Let's Encrypt

**Importante**: Configure o DNS primeiro antes de executar este passo!

```bash
# Obter certificado SSL
sudo certbot --nginx -d pcs.fernandalandeiro.com.br

# O Certbot irá:
# - Obter certificado SSL
# - Configurar renovação automática
# - Modificar configuração do Nginx automaticamente
# - Redirecionar HTTP para HTTPS automaticamente
```

**Nota**: Se preferir começar com HTTP primeiro (sem SSL), você pode pular este passo e configurar SSL depois. Nesse caso, use `http://pcs.fernandalandeiro.com.br` na variável `VITE_FRONTEND_URL`.

### 9. Configurar Firewall (UFW)

```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP e HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verificar status
sudo ufw status
```

---

## 🔧 Configurações Adicionais

### Atualizar Aplicação

```bash
cd /var/www/landeiro-chat-ia

# Pull das atualizações
git pull origin main

# Instalar novas dependências (se houver)
npm install

# Rebuild
npm run build

# Reiniciar aplicação
pm2 restart landeiro-chat-ia
```

### Logs

```bash
# Logs do PM2
pm2 logs landeiro-chat-ia

# Logs do Nginx
sudo tail -f /var/log/nginx/landeiro-access.log
sudo tail -f /var/log/nginx/landeiro-error.log

# Logs do sistema
sudo journalctl -u nginx -f
```

### Monitoramento

```bash
# Status do PM2
pm2 status

# Informações detalhadas
pm2 info landeiro-chat-ia

# Monitoramento em tempo real
pm2 monit
```

---

## 🗄️ Banco de Dados

### Usando Supabase (Recomendado)

O projeto está configurado para usar Supabase como banco de dados. Certifique-se de:

1. **Criar projeto no Supabase**: https://supabase.com
2. **Configurar RLS (Row Level Security)**: Execute os scripts SQL em `client/public/supabase_schema.sql`
3. **Usar Pooler**: A URL `DATABASE_URL` deve usar o pooler do Supabase (porta 6543)
4. **Configurar Storage**: Crie bucket `audios` no Supabase Storage

### Migrações do Banco

```bash
# Aplicar migrações (se necessário)
npm run db:push
```

---

## 📧 Configuração de Email

### Mailtrap (Desenvolvimento/Teste)

O projeto usa Mailtrap para envio de emails. Configure:

1. Criar conta em https://mailtrap.io
2. Obter API Token
3. Obter Inbox ID
4. Adicionar variáveis no `.env`

### Produção (Alternativas)

Para produção, considere substituir Mailtrap por:
- **SendGrid**
- **AWS SES**
- **Mailgun**
- **Postmark**

Modifique `server/emailService.ts` conforme necessário.

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] Todas as variáveis de ambiente configuradas
- [ ] `.env` não commitado no Git (verificar `.gitignore`)
- [ ] Firewall configurado (UFW)
- [ ] SSL/HTTPS configurado (Let's Encrypt)
- [ ] Nginx configurado com headers de segurança
- [ ] PM2 configurado para auto-restart
- [ ] Logs configurados e monitorados
- [ ] Backups do banco de dados configurados
- [ ] Rate limiting configurado (se necessário)

### Headers de Segurança no Nginx

Adicione ao bloco `server` do Nginx:

```nginx
# Headers de segurança
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

---

## 🐛 Troubleshooting

### Erro do PM2: "module is not defined" ou "Unexpected token 'export'"

Este erro ocorre quando há confusão entre CommonJS e ES modules no arquivo de configuração do PM2.

**Sintomas**:
- `ReferenceError: module is not defined in ES module scope`
- `SyntaxError: Unexpected token 'export'`

**Solução**:

1. **Verificar qual arquivo você tem**:
```bash
ls -la ecosystem.config.*
```

2. **Se você tem `ecosystem.config.cjs`** (extensão .cjs):
   - DEVE usar `module.exports = { ... }` (CommonJS)
   - NÃO pode usar `export default { ... }`

3. **Se você tem `ecosystem.config.js`** (extensão .js):
   - DEVE usar `export default { ... }` (ES module)
   - NÃO pode usar `module.exports = { ... }`

4. **Corrigir o arquivo**:
```bash
# Se você tem .cjs mas está usando export default, corrija:
nano ecosystem.config.cjs
# Use: module.exports = { ... }

# OU se você tem .js mas está usando module.exports, corrija:
nano ecosystem.config.js
# Use: export default { ... }
```

5. **Reiniciar PM2**:
```bash
pm2 delete all
pm2 start ecosystem.config.cjs  # ou ecosystem.config.js
```

**Recomendação**: Use a Opção 1 (`.cjs` com `module.exports`) que é mais compatível com PM2.

### Aplicação não inicia

```bash
# Verificar logs
pm2 logs landeiro-chat-ia --lines 100

# Verificar se porta está em uso
sudo netstat -tulpn | grep 5000

# Verificar variáveis de ambiente
pm2 env 0
```

### Erro de conexão com banco

- Verificar `DATABASE_URL` está correto
- Verificar se está usando pooler (porta 6543)
- Verificar credenciais do Supabase
- Testar conexão: `psql $DATABASE_URL`

### Erro 502 Bad Gateway

- Verificar se aplicação está rodando: `pm2 status`
- Verificar logs do Nginx: `sudo tail -f /var/log/nginx/landeiro-error.log`
- Verificar se proxy_pass está correto no Nginx

### Problemas com SSL

```bash
# Renovar certificado manualmente
sudo certbot renew

# Verificar status
sudo certbot certificates
```

---

## 📝 Notas Importantes

1. **Domínio**: O projeto está configurado para `pcs.fernandalandeiro.com.br`. Certifique-se de configurar o DNS antes de solicitar o certificado SSL.

2. **Porta 5000**: A aplicação roda na porta 5000 internamente. O Nginx faz proxy para esta porta.

3. **Supabase Pooler**: Sempre use o pooler do Supabase (porta 6543) para evitar problemas de conexão.

4. **Build**: Sempre execute `npm run build` após atualizações antes de reiniciar o PM2.

5. **Variáveis de Ambiente**: Variáveis que começam com `VITE_` são expostas no frontend. Não coloque secrets nelas.

6. **Storage**: O projeto usa Supabase Storage por padrão. Se usar outro serviço, ajuste `server/supabaseStorage.ts`.

7. **HTTPS vs HTTP**: Recomendado usar HTTPS em produção. Se começar com HTTP, atualize `VITE_FRONTEND_URL` para `http://pcs.fernandalandeiro.com.br` temporariamente.

---

## 🔄 Script de Deploy Automatizado

Crie um script `deploy.sh` para facilitar atualizações:

```bash
#!/bin/bash
cd /var/www/landeiro-chat-ia
git pull origin main
npm install
npm run build
pm2 restart landeiro-chat-ia
echo "Deploy concluído!"
```

Tornar executável:
```bash
chmod +x deploy.sh
```

---

## 📞 Suporte

Em caso de problemas:
1. Verificar logs do PM2 e Nginx
2. Verificar variáveis de ambiente
3. Verificar conectividade com Supabase
4. Verificar firewall e portas

---

**Última atualização**: 2025-01-27




# Ultimo caso

# Parar PM2
pm2 stop landeiro-chat-ia

# Limpar build anterior
rm -rf dist

# Build com variáveis explícitas
VITE_SUPABASE_URL=..  \
VITE_SUPABASE_ANON_KEY=... \
VITE_FRONTEND_URL=http://5.78.140.27:5000 \
npm run build

# Verificar se funcionou
grep -r "fnprdocklfpmndailkoo" dist/public/ | head -3

# Reiniciar PM2
pm2 start ecosystem.config.cjs