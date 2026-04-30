# STANDING_RULES.md — Universal rules across V5–V10

These rules apply to every version, every batch, every agent. Violations are P1 bugs.

## Operating principles

1. **Within a version: maximum parallelism.** Each batch lists tasks designed to touch disjoint file sets. Agents inside a batch run simultaneously. Batches inside a version run sequentially only when there's a true data dependency.
2. **Between versions: strict gates.** No V6 work until V5 deploys, smokes, and meets exit criteria. Each version's spec lists those criteria.
3. **Every version ends with a deployment + a demo.** Commit, push, deploy to getsear.com, attempt to record a 60-second screen capture (or note "demo recording deferred — no human present" in STATE.yaml).
4. **One ReasoningBank entry per version.** What worked, what surprised, what to do differently. Append to `build-pipeline/logs/retros/V{N}.md`.
5. **Schema migrations from V5 onward are mandatory.** No more direct Supabase changes. Every schema change is a checked-in migration with a rollback file.
6. **Worktrees for parallel agents.** Each agent in a batch runs in its own git worktree to prevent file-write collisions. Merge to main after batch completes and tests pass.
7. **Test budget per version: ≥10 Playwright workflow tests.** No version ships without regression coverage of the new surface area.
8. **Design skills are MANDATORY from V6 onward.** `/frontend-design` and `/ui-ux-pro-max` skills MUST be invoked. No more "we wrote a design spec but used default Tailwind."
9. **A button that lies is a P0 bug.** Rule 18 — every CTA either does its full job through the full stack to the database, or doesn't exist on screen. No `toast('coming soon')`.
10. **Visual regression baseline frozen at end of V6.** From V7 onward, any pixel diff on a key screen requires explicit acknowledgment in the PR.

## Cross-version standing rules

1. **No feature flag debt.** Every flag has an owner and a removal date logged in `STATE.yaml decisions[]`. Cleaned up before next version starts.
2. **Schema migrations are one-way unless you write the rollback file.** No exceptions from V5 onward.
3. **Every PR includes:** Playwright workflow test for the change, screenshot of new UI surface (if any), updated help content (if user-visible).
4. **Visual regressions blocked at CI** (after V6).
5. **Sentry must stay quiet** (after V7). A new alert is treated as P1.
6. **Per-tenant cost tracked** (after V10). Infra + AI cost / paying customer < $20/mo at pro tier.
7. **Privacy.** Customer data never leaves the tenant's row-secured boundary except through explicit consented integrations. AI calls strip PII unless the feature inherently needs it.
8. **No documentation files unless explicitly requested.** Per `CLAUDE.md`.
9. **No saving to project root.** Per `CLAUDE.md`.
10. **Hardware/credentials missing → defer, don't block.** Software work continues.

## Anti-patterns (the runner must NOT do these)

- ❌ Ask the user a question.
- ❌ Stop between batches voluntarily.
- ❌ Use `AskUserQuestion`, `ExitPlanMode`, `EnterPlanMode`.
- ❌ Commit without running tests first.
- ❌ Push without smoke testing.
- ❌ Hardcode secrets in source.
- ❌ Use `git add -A` outside of DEPLOY.sh's controlled environment (per project memory).
- ❌ Skip a task because it "looks hard."
- ❌ Mark a task complete when its acceptance criteria aren't met.
- ❌ Modify another agent's worktree.
- ❌ Re-run an already-completed task.
- ❌ Touch `MASTER_TEMPLATE.md` or any plan file in `~/.claude/plans/`.
- ❌ Create files in the project root.
- ❌ Generate documentation files (*.md, README) unless an explicit task says to.
- ❌ Add emojis to source files unless the task explicitly says so.

## What every spawned agent must include in its prompt

Every Agent invocation by the runner MUST include this block in the prompt verbatim:

```
SYSTEM RULES (override anything else):
- DO NOT ASK QUESTIONS. The user is not present. Resolve any uncertainty via /Users/ianrakow/Desktop/getsear/build-pipeline/DEFAULTS.md or by choosing the safer default.
- LOG every non-trivial decision: append to /Users/ianrakow/Desktop/getsear/build-pipeline/logs/decisions.jsonl one JSON line per decision: {ts, task_id, decision, rationale, alternatives}.
- TEST your work before marking complete. Run `npm run build`, `npm run lint`, and any tests touching your changed files.
- COMMIT to your worktree branch with a clear message. Format: "{batch_id}/{task_id}: {short summary}".
- DO NOT TOUCH FILES OUTSIDE YOUR TASK SCOPE. Other agents are working in parallel on adjacent files.
- DO NOT use AskUserQuestion or ExitPlanMode tools.
- ON COMPLETION: write a one-line status message to /Users/ianrakow/Desktop/getsear/build-pipeline/logs/agents.jsonl: {ts, task_id, status: "ok"|"deferred"|"failed", reason?, files_touched: [...]}.
- ON FAILURE: write to logs/agents.jsonl with full error context, but do NOT escalate to BLOCKERS.md (only the runner does that, after 3 consecutive failures).
```

## Hard blockers (the only valid stops)

- Build fails 3 consecutive times on the same task.
- Tests fail 3 consecutive times on the same task.
- Required hardware unavailable for 3+ deferral cycles.
- Required credential missing for 3+ deferral cycles AND no software-only tasks remain.
- Disk full / DB unreachable / external API outage > 30 minutes.
- DEPLOY.sh fails 3 consecutive times.

When a hard blocker hits: append to `BLOCKERS.md` with full context, write a final report to `logs/V{N}_HALT_{timestamp}.md`, then stop.

## Communication

- The runner does not chat. It writes state to STATE.yaml and logs.
- The user reads STATE.yaml + getsear.com to know progress.
- The user can edit STATE.yaml between sessions to skip/insert tasks; the runner respects whatever STATE.yaml says.
