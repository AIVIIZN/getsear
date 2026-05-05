#!/usr/bin/env bash
#
# PreToolUse hook — blocks the orchestrator (main session) from editing
# protected source paths inline. Forces dispatch through specialist agents
# (pos-coder, security-reviewer, migration-author, e2e-tester, etc.) which
# work inside `.claude/worktrees/agent-XXX/` paths that are NOT matched
# by the protected regex below.
#
# Triggered when the orchestrator slips back into inline mode despite
# session-level reminders. Exit 2 = block + show stderr to Claude.
#
# Why path-prefix instead of glob: Claude Code passes absolute paths in
# tool_input.file_path. Worktree paths look like
#   /Users/ianrakow/Desktop/getsear/.claude/worktrees/agent-XXX/src/...
# while main-checkout paths look like
#   /Users/ianrakow/Desktop/getsear/src/...
# A regex anchored to the latter (without `.claude/` in the prefix)
# blocks main-session edits while letting worktree subagents through.

set -euo pipefail

PROJECT_ROOT="/Users/ianrakow/Desktop/getsear"

payload=$(cat)
tool_name=$(echo "$payload" | jq -r '.tool_name // empty')
file_path=$(echo "$payload" | jq -r '.tool_input.file_path // empty')
query=$(echo "$payload" | jq -r '.tool_input.query // empty')

# --- Block Edit/Write/MultiEdit on protected MAIN-checkout paths ---
# Protected: src/, supabase/migrations/, supabase/_rollbacks/,
#            .github/workflows/, e2e/, load-tests/, tests/,
#            scripts/ (deploy + integrate scripts), build-pipeline/DEPLOY.sh,
#            build-pipeline/INTEGRATE.sh
protected_re="^${PROJECT_ROOT}/(src|supabase/migrations|supabase/_rollbacks|\\.github/workflows|e2e|load-tests|tests|scripts)/"
deploy_scripts_re="^${PROJECT_ROOT}/build-pipeline/(DEPLOY|INTEGRATE)\\.sh$"

case "$tool_name" in
  Edit|Write|MultiEdit)
    if [[ -n "$file_path" ]]; then
      # P2a: reject relative paths outright — Claude Code always passes absolutes
      if [[ "$file_path" != /* ]]; then
        echo "BLOCKED: file_path is relative ('$file_path'). Pass an absolute path." >&2
        exit 2
      fi
      # P2b: case-insensitive comparison (bash 4+ ,, operator; macOS has bash 3 but
      #      Claude Code runs under /usr/bin/env bash which is homebrew bash 5+ on dev
      #      machines; use tr fallback to be safe)
      file_path_lower=$(echo "$file_path" | tr '[:upper:]' '[:lower:]')
      protected_re_lower=$(echo "$protected_re" | tr '[:upper:]' '[:lower:]')
      deploy_scripts_re_lower=$(echo "$deploy_scripts_re" | tr '[:upper:]' '[:lower:]')
      if [[ "$file_path_lower" =~ $protected_re_lower || "$file_path_lower" =~ $deploy_scripts_re_lower ]]; then
        cat >&2 <<EOF
BLOCKED: orchestrator inline edit on protected path:
  $file_path

This is the main checkout — protected paths must be edited by a
specialist agent in a worktree. Dispatch via the Agent tool with
isolation: 'worktree'.

Pick the right specialist for the path:
  src/components/pos|kds|tables/**     → pos-coder
  src/components/menu/photos/**         → pos-coder
  src/app/api/auth|payments|orders/**   → security-reviewer
  src/app/api/marketing|emails/**       → marketing-engineer
  src/app/api/menu|catalog/**           → pos-coder or supabase
  src/hooks/use-*realtime*|use-kds-*    → realtime-engineer
  src/lib/supabase/**                   → supabase
  src/lib/audit|auth/**                 → security-reviewer
  supabase/migrations/**                → migration-author
  e2e/**                                → e2e-tester
  load-tests/**                         → e2e-tester
  .github/workflows/**                  → devops-deploy
  build-pipeline/{DEPLOY,INTEGRATE}.sh  → devops-deploy

Worktree paths (.claude/worktrees/agent-XXX/...) are NOT blocked —
subagents work in their own worktree branches, then the orchestrator
runs git merge --no-ff to integrate.

If this block is wrong (e.g. fixing a hook bug, editing CLAUDE.md,
emergency rollback), edit .claude/settings.local.json to disable the
hook temporarily.
EOF
        exit 2
      fi
    fi
    ;;

  # --- Block DDL + schema_migrations writes via Supabase MCP ---
  mcp__claude_ai_Supabase__execute_sql|mcp__claude_ai_Supabase__apply_migration)
    # P1: anchor to the START of the trimmed query so that DDL keywords inside
    # string literals ("SELECT 'CREATE TABLE' AS msg") or line comments
    # ("-- ALTER ...") do not trigger a false block.
    trimmed=$(echo "$query" | sed -E 's/^[[:space:]]+//')
    if [[ "$trimmed" =~ ^[[:space:]]*(CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)[[:space:]] ]] \
       || [[ "$trimmed" =~ ^[[:space:]]*INSERT[[:space:]]+INTO[[:space:]]+supabase_migrations ]]; then
      cat >&2 <<EOF
BLOCKED: orchestrator inline DDL or schema_migrations write detected
in $tool_name. Dispatch the supabase or migration-author agent
instead.

  supabase agent       → edge functions, types regen, RPCs, storage,
                          auth flows, advisors
  migration-author     → schema DDL, RLS policies, indexes, paired
                          rollback files

Read-only queries (SELECT, EXPLAIN) are fine via execute_sql.
EOF
      exit 2
    fi
    ;;
esac

exit 0
