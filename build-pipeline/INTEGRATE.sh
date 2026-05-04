#!/usr/bin/env bash
# Worktree integration script. Runs after a parallel batch's agents return.
# Merges every active v* worktree's branch back to main, then runs build/lint/test.
# Idempotent — safe to re-run.
#
# F-01 fix: EXIT trap always writes a JSONL log entry (ok or failed) so every
#           batch leaves evidence regardless of which step blew up.
# F-02 fix: Worktrees must be clean before merge; script aborts if dirty rather
#           than silently sweeping untracked files into the merge commit.

set -euo pipefail

PROJECT_DIR="/Users/ianrakow/Desktop/getsear"
LOG_FILE="$PROJECT_DIR/build-pipeline/logs/integrations.jsonl"
BATCH_ID="${BATCH_ID:-unknown-batch}"

# ── EXIT trap: always emit a JSONL record (F-01) ─────────────────────────────
INTEGRATE_STATUS="failed"
INTEGRATE_STEP="setup"

_on_exit() {
  local exit_code=$?
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if [ "$INTEGRATE_STATUS" = "ok" ]; then
    echo "{\"ts\":\"$ts\",\"batch\":\"$BATCH_ID\",\"status\":\"ok\",\"step\":\"done\"}" >> "$LOG_FILE"
  else
    echo "{\"ts\":\"$ts\",\"batch\":\"$BATCH_ID\",\"status\":\"failed\",\"step\":\"$INTEGRATE_STEP\",\"exit_code\":$exit_code}" >> "$LOG_FILE"
  fi
}
trap _on_exit EXIT

# ─────────────────────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"

# Ensure we're on main.
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "[integrate] not on main (on $CURRENT_BRANCH), checking out main"
  git checkout main
fi
git pull origin main

INTEGRATE_STEP="worktree_merge"

# Find all active v* worktrees.
WORKTREES=$(git worktree list --porcelain | awk '
  /^worktree / { wt=$2 }
  /^branch / { print wt " " $2 }
' | grep "/.claude/worktrees/v" || true)

if [ -z "$WORKTREES" ]; then
  echo "[integrate] no v* worktrees to merge"
else
  # Use a here-string so set -e propagates cleanly into the loop (F-13 fix).
  while read -r wt branch; do
    branch=${branch#refs/heads/}
    echo "[integrate] merging $branch from $wt"

    # Abort on dirty worktree — agents must commit their own work (F-02).
    # We check both staged and unstaged changes.
    if ! (cd "$wt" && git diff --quiet && git diff --cached --quiet); then
      echo "[integrate] ABORT: worktree $wt ($branch) is dirty. Agents must commit their own work before INTEGRATE runs." >&2
      echo "[integrate] Run: cd $wt && git status  to inspect." >&2
      exit 1
    fi

    git merge --no-ff "$branch" -m "merge: $branch into main ($BATCH_ID)"
    git worktree remove --force "$wt"
    git branch -D "$branch" || true
  done <<< "$WORKTREES"
fi

# ── Quality gates ─────────────────────────────────────────────────────────────

INTEGRATE_STEP="unit_test"
echo "[integrate] running unit tests (npm test)"
npm test

INTEGRATE_STEP="build"
echo "[integrate] running build"
npm run build

INTEGRATE_STEP="lint"
echo "[integrate] running lint"
npm run lint

INTEGRATE_STEP="e2e_test"
echo "[integrate] running e2e tests"
npm run test:e2e

# All gates passed.
INTEGRATE_STATUS="ok"
INTEGRATE_STEP="done"
echo "[integrate] OK $BATCH_ID"
