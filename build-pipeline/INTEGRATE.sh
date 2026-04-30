#!/usr/bin/env bash
# Worktree integration script. Runs after a parallel batch's agents return.
# Merges every active v* worktree's branch back to main, then runs build/lint/test.
# Idempotent — safe to re-run.

set -euo pipefail

PROJECT_DIR="/Users/ianrakow/Desktop/getsear"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/integrations.jsonl"
BATCH_ID="${BATCH_ID:-unknown-batch}"

cd "$PROJECT_DIR"

# Ensure we're on main.
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "[integrate] not on main (on $CURRENT_BRANCH), checking out main"
  git checkout main
fi
git pull origin main

# Find all active v* worktrees.
WORKTREES=$(git worktree list --porcelain | awk '
  /^worktree / { wt=$2 }
  /^branch / { print wt " " $2 }
' | grep "build-pipeline\|/v[0-9]" || true)

if [ -z "$WORKTREES" ]; then
  echo "[integrate] no v* worktrees to merge"
else
  echo "$WORKTREES" | while read -r wt branch; do
    branch=${branch#refs/heads/}
    echo "[integrate] merging $branch from $wt"
    # Ensure the worktree's branch has its work committed.
    (cd "$wt" && git add -A && git diff --staged --quiet || git commit -m "auto-commit: $branch pre-merge")
    git merge --no-ff "$branch" -m "merge: $branch into main ($BATCH_ID)"
    git worktree remove --force "$wt"
    git branch -D "$branch" || true
  done
fi

# Run quality gates.
echo "[integrate] running build"
npm run build

echo "[integrate] running lint"
npm run lint

echo "[integrate] running e2e tests"
npm run test:e2e || {
  echo "[integrate] tests failed for $BATCH_ID" >&2
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"status\":\"tests_failed\"}" >> "$LOG_FILE"
  exit 1
}

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"status\":\"ok\"}" >> "$LOG_FILE"
echo "[integrate] OK $BATCH_ID"
