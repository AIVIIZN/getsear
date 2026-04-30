#!/usr/bin/env bash
# Auto-deploy script. Runs after every successful batch.
# Commits all changes, pushes to main, deploys to GCP VM, smoke tests.
# Idempotent — safe to run multiple times.

set -euo pipefail

PROJECT_DIR="/Users/ianrakow/Desktop/getsear"
VM_HOST="ianrakow@34.132.111.219"
VM_KEY="$HOME/.ssh/google_compute_engine"
SITE_URL="https://getsear.com"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/deploys.jsonl"
BATCH_ID="${BATCH_ID:-unknown-batch}"

cd "$PROJECT_DIR"

# 1. Commit any pending changes (worktree merges should already be committed,
#    this is a safety net for trivial post-merge changes).
git add -A
if ! git diff --staged --quiet; then
  git commit -m "auto: ${BATCH_ID} via build-pipeline" \
    -m "Co-Authored-By: claude-flow <ruv@ruv.net>"
else
  echo "[deploy] nothing new to commit"
fi

# 2. Push to origin/main.
git push origin main

# 3. Deploy on VM via SSH.
ssh -i "$VM_KEY" -o StrictHostKeyChecking=accept-new "$VM_HOST" '
  set -euo pipefail
  cd /opt/sear/app
  git pull origin main
  npm ci
  npm run build
  cp -r .next/static .next/standalone/.next/
  cp -r public .next/standalone/
  pm2 reload sear-pos
'

# 4. Smoke test: fetch homepage, expect HTTP 200.
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$SITE_URL")
if [ "$HTTP_CODE" != "200" ]; then
  echo "[deploy] SMOKE TEST FAILED: $SITE_URL returned $HTTP_CODE" >&2
  exit 1
fi

# 5. Log success.
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse HEAD)
echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$COMMIT\",\"http\":$HTTP_CODE,\"status\":\"ok\"}" >> "$LOG_FILE"

echo "[deploy] OK $BATCH_ID @ $COMMIT"
