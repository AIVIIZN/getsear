#!/bin/bash
# Sear POS v2 — Deploy script
# Usage: ./deploy.sh
# Runs on the GCP VM via SSH

set -e

VM_USER="ianrakow"
VM_HOST="34.132.111.219"
SSH_KEY="$HOME/.ssh/google_compute_engine"
APP_DIR="/opt/sear/app"

echo "🚀 Deploying Sear POS v2..."

# Build locally first (faster than building on VM)
echo "📦 Building locally..."
npm run build

# Sync files to VM
echo "📤 Syncing to VM..."
rsync -avz --delete \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.env.local \
  --exclude=.next \
  --exclude='*.md' \
  -e "ssh -i $SSH_KEY" \
  . "$VM_USER@$VM_HOST:$APP_DIR/"

# Build and restart on VM
echo "🔨 Building on VM..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" "cd $APP_DIR && \
  npm ci --production=false && \
  npm run build && \
  cp -r .next/static .next/standalone/.next/ && \
  cp -r public .next/standalone/ && \
  cd .next/standalone && \
  pm2 reload sear-pos 2>/dev/null || PORT=3000 HOSTNAME=0.0.0.0 pm2 start server.js --name sear-pos"

echo "✅ Deployed! https://getsear.com"
