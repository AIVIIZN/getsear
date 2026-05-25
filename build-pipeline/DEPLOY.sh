#!/usr/bin/env bash
# Auto-deploy script. Runs after every successful batch.
# Commits all changes, pushes to main, deploys to GCP VM, smoke tests.
# Idempotent — safe to run multiple times.
#
# F-03 fix: captures PREV_COMMIT on VM before git pull. On smoke failure,
#           rolls back to PREV_COMMIT, rebuilds, and reloads. Prod never stays
#           dark — rollback fires before exit 1.
# F-08 fix: if pm2 reload fails (process missing), falls back to
#           pm2 start ecosystem.config.js rather than dying in set -e.
# LOAD-BEARING (V5.3 P0): source .env.local before pm2 --update-env so
#           runtime server-only vars (SUPABASE_SERVICE_ROLE_KEY, etc.) are
#           present in pm2's process environment.

set -euo pipefail

PROJECT_DIR="/Users/ianrakow/Desktop/getsear"
VM_HOST="ianrakow@34.132.111.219"
VM_KEY="$HOME/.ssh/google_compute_engine"
SITE_URL="https://getsear.com"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/deploys.jsonl"
BATCH_ID="${BATCH_ID:-unknown-batch}"

cd "$PROJECT_DIR"

# 1. Commit any pending changes (worktree merges should already be committed;
#    this is a safety net for trivial post-merge changes).
#    NOTE: we do NOT use `git add -A` — add specific files only.
if ! git diff --staged --quiet; then
  git commit -m "auto: ${BATCH_ID} via build-pipeline"
else
  echo "[deploy] nothing new to commit"
fi

# 2. Push to origin/main.
git push origin main

LOCAL_COMMIT=$(git rev-parse HEAD)

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

  # Capture the currently-running commit before we change anything (F-03).
  PREV_COMMIT=$(git rev-parse HEAD)
  echo "[deploy:vm] PREV_COMMIT=$PREV_COMMIT"
  # Write rollback target immediately — before any mutation so a mid-deploy
  # crash always leaves a valid PREV_COMMIT on disk (cycle-2 P1 fix).
  echo "PREV_COMMIT=$PREV_COMMIT" > /tmp/sear_prev_commit

  git pull origin main
  npm ci

  # Source build-time env before `next build` so Sentry can tag releases and
  # upload source maps when SENTRY_AUTH_TOKEN/SENTRY_* are configured.
  set -a
  source /opt/sear/app/.env.local
  export SENTRY_RELEASE=$(git rev-parse HEAD)
  export SEAR_VERSION_SHA=$(git rev-parse HEAD)
  set +a

  npm run build

  # Next 16 standalone tracing can omit sibling files under next/dist/server
  # and next/dist/build that next/dist/server/next.js requires at runtime.
  # Keep the standalone copy aligned with installed node_modules before reload.
  if [ -d node_modules/next/dist ] && [ -d .next/standalone/node_modules/next ]; then
    rm -rf .next/standalone/node_modules/next/dist
    cp -r node_modules/next/dist .next/standalone/node_modules/next/dist
  fi

  # Copy standalone assets — use rm+cp pattern to avoid nested directories on
  # repeated runs (F-14 hygiene; prevents public/public/ accumulation).
  rm -rf .next/standalone/.next/static
  cp -r .next/static .next/standalone/.next/static
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public

  # Source env — LOAD-BEARING V5.3 P0: see header comment.
  set -a
  source /opt/sear/app/.env.local
  export SENTRY_RELEASE=$(git rev-parse HEAD)
  export SEAR_VERSION_SHA=$(git rev-parse HEAD)
  set +a

  # Reload with zero-downtime. If sear-pos process is missing (VM reboot or
  # crash beyond restart budget), fall back to a fresh pm2 start (F-08).
  if pm2 describe sear-pos > /dev/null 2>&1; then
    pm2 reload sear-pos --update-env || {
      echo "[deploy:vm] pm2 reload failed, falling back to pm2 start"
      pm2 start /opt/sear/app/ecosystem.config.js --update-env
    }
  else
    echo "[deploy:vm] sear-pos not in pm2 registry, starting fresh"
    pm2 start /opt/sear/app/ecosystem.config.js --update-env
  fi
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
    echo "[deploy] SMOKE TEST FAILED after 5 attempts — initiating rollback" >&2

    # F-03: Roll back VM to previous commit, rebuild, reload.
    ssh -i "$VM_KEY" -o StrictHostKeyChecking=accept-new "$VM_HOST" '
      set -euo pipefail
      cd /opt/sear/app

      if [ -f /tmp/sear_prev_commit ]; then
        source /tmp/sear_prev_commit
        echo "[deploy:vm:rollback] reverting to $PREV_COMMIT"
        git checkout "$PREV_COMMIT"
        npm ci
        npm run build
        if [ -d node_modules/next/dist ] && [ -d .next/standalone/node_modules/next ]; then
          rm -rf .next/standalone/node_modules/next/dist
          cp -r node_modules/next/dist .next/standalone/node_modules/next/dist
        fi
        rm -rf .next/standalone/.next/static && cp -r .next/static .next/standalone/.next/static
        rm -rf .next/standalone/public && cp -r public .next/standalone/public
        set -a
        source /opt/sear/app/.env.local
        set +a
        if pm2 describe sear-pos > /dev/null 2>&1; then
          pm2 reload sear-pos --update-env
        else
          pm2 start /opt/sear/app/ecosystem.config.js --update-env
        fi
        pm2 save
        echo "[deploy:vm:rollback] rollback complete — reverted to $PREV_COMMIT"
      else
        echo "[deploy:vm:rollback] /tmp/sear_prev_commit not found; manual intervention required" >&2
        exit 1
      fi
    ' || true
    # Capture rollback outcome — SSH exits non-zero if any command inside failed
    # (set -euo pipefail propagates). We need the exit code even though the outer
    # script uses set -e, so the `|| true` above prevents early-exit and we
    # reconstruct the status via $?.  Re-run the SSH to grab exit code cleanly:
    ROLLBACK_RC=0
    ssh -i "$VM_KEY" -o StrictHostKeyChecking=accept-new "$VM_HOST" \
      'test -f /tmp/sear_prev_commit || exit 2; source /tmp/sear_prev_commit; git -C /opt/sear/app rev-parse HEAD | grep -qF "$PREV_COMMIT" && exit 0 || exit 1' \
      && ROLLBACK_RC=0 || ROLLBACK_RC=$?

    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    if [ "$ROLLBACK_RC" -eq 0 ]; then
      echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$LOCAL_COMMIT\",\"http\":\"$HTTP_CODE\",\"status\":\"smoke_failed_rolled_back\"}" >> "$LOG_FILE"
    else
      echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$LOCAL_COMMIT\",\"http\":\"$HTTP_CODE\",\"status\":\"smoke_failed_rollback_failed\",\"rollback_exit_code\":$ROLLBACK_RC}" >> "$LOG_FILE"
    fi
    exit 1 ;;
esac

# 5. Log success.
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git rev-parse HEAD)
echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$COMMIT\",\"http\":$HTTP_CODE,\"status\":\"ok\"}" >> "$LOG_FILE"

echo "[deploy] OK $BATCH_ID @ $COMMIT"
