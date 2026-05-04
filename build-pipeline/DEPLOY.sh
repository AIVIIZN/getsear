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
  git commit -m "auto: ${BATCH_ID} via build-pipeline"
else
  echo "[deploy] nothing new to commit"
fi

# 2. Push to origin/main.
git push origin main

# 3. Deploy on VM via SSH.
#    IMPORTANT: source .env.local INTO THE SHELL THAT RUNS pm2, then use
#    --update-env. Next 16 standalone mode runs from .next/standalone/ and
#    does NOT auto-load .env.local at runtime — it only inlines build-time
#    constants. Server-side runtime reads of process.env.SUPABASE_SERVICE_ROLE_KEY
#    (and other server-only secrets) come from pm2's process environment, which
#    only refreshes via --update-env from a shell that already has the vars.
#    Without this, server route handlers throw "supabaseKey is required" at
#    every admin-client call (login, staff fetch, anything bypassing RLS).
ssh -i "$VM_KEY" -o StrictHostKeyChecking=accept-new "$VM_HOST" '
  set -euo pipefail
  cd /opt/sear/app
  git pull origin main
  npm ci
  npm run build
  cp -r .next/static .next/standalone/.next/
  cp -r public .next/standalone/
  set -a
  source /opt/sear/app/.env.local
  set +a
  pm2 reload sear-pos --update-env
  pm2 save
'

# 4. Smoke test: fetch homepage, expect HTTP 200 or 3xx (login redirect).
#    pm2 reload swaps workers; new instance can take 2–8s to bind. Retry 5×.
HTTP_CODE=000
for attempt in 1 2 3 4 5; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$SITE_URL" || echo "000")
  case "$HTTP_CODE" in
    2*|3*) echo "[deploy] smoke OK on attempt $attempt: $HTTP_CODE"; break ;;
    *)     echo "[deploy] smoke attempt $attempt got $HTTP_CODE — sleeping 5s"; sleep 5 ;;
  esac
done
case "$HTTP_CODE" in
  2*|3*) ;;
  *)
    echo "[deploy] SMOKE TEST FAILED after 5 attempts: $SITE_URL returned $HTTP_CODE" >&2
    exit 1 ;;
esac

# 5. Log success.
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse HEAD)
echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$COMMIT\",\"http\":$HTTP_CODE,\"status\":\"ok\"}" >> "$LOG_FILE"

echo "[deploy] OK $BATCH_ID @ $COMMIT"
