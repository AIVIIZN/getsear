# RUNNER.md — Autonomous Build Runner Operating Manual

You are the autonomous build runner. You read this file every loop. Your job is to advance Sear POS from V5 to V10, deploying after every batch, until either V10 ships or you log a hard blocker.

You are alone. The user is not watching. You will not ask the user any questions. You will not stop between batches.

## Your tools

You may use:
- `Read`, `Write`, `Edit` — for state files and code reads.
- `Bash` — for git, npm, scripts, and shell ops.
- `Agent` — for spawning sub-agents (with `run_in_background: true` for parallel batches).
- `EnterWorktree` / `ExitWorktree` — for git worktree management.
- `Monitor` — for watching long-running background processes (e.g., dev server during smoke).

You MUST NOT use:
- `AskUserQuestion` — the user is not here.
- `ExitPlanMode` / `EnterPlanMode` — never enter plan mode.
- `TodoWrite` for status the user needs — STATE.yaml is the only progress source.

If you find yourself wanting to use a forbidden tool, that's a signal you're trying to escape the rules. Re-read DEFAULTS.md and pick a default.

## Your loop (run forever until V10 ships or hard blocker)

```
loop:
  # 1. State read
  state = read("build-pipeline/STATE.yaml")
  blockers = read("build-pipeline/BLOCKERS.md")
  if blockers contains an active (non-template) entry:
    halt("Active blocker; waiting for human resolution.")

  if state.versions.V10.status == "complete":
    final_report()
    halt("V10 shipped — pipeline complete.")

  # 2. Find next pending item
  current_v = state.current_version
  current_b = state.current_batch
  version_file = "build-pipeline/versions/V{current_v}_*.md"
  spec = read(version_file)

  next_item = first_pending(state.versions[current_v].batches[current_b])
  if next_item is None:
    advance_to_next_batch_or_version(state)
    continue

  # 3. Execute
  if next_item.batch.type == "parallel":
    spawn_parallel_agents(next_item.batch, spec)
    wait_for_all_agents()
  else:
    execute_inline(next_item, spec)

  # 4. Integrate
  bash("BATCH_ID={current_b} ./build-pipeline/INTEGRATE.sh")
  if integrate_failed:
    handle_failure(next_item)
    continue

  # 5. Deploy
  bash("BATCH_ID={current_b} ./build-pipeline/DEPLOY.sh")
  if deploy_failed:
    handle_failure(next_item)
    continue

  # 6. Update state
  mark_complete(state, next_item)
  advance_pointer(state)
  write_state(state)
  append_log("logs/batch-runs.jsonl", {ts: now(), batch: current_b, status: "ok"})

  # 7. Loop
  continue
```

## Spawning parallel agents — exact protocol

For a parallel batch with N tasks, you spawn N agents in **one message** containing N `Agent` tool calls. Each agent gets:

- `subagent_type`: pick the most specific agent for the task (coder, backend-dev, frontend-design, ml-developer, etc.). Defaults to `coder`.
- `description`: 3-5 word task summary.
- `run_in_background`: `true`.
- `prompt`: includes everything the agent needs (see template below).

### Worktree setup before spawn

For each task, before spawning, run:

```bash
cd /Users/ianrakow/Desktop/getsear
git worktree add -b "v{N}-batch-{B}-{slug}" ".claude/worktrees/v{N}-batch-{B}-{slug}" main
```

Replace `{N}`, `{B}`, `{slug}` with concrete values. The slug is a lowercase-kebab summary of the task title.

If the worktree already exists from a prior failed attempt, remove it first with `git worktree remove --force` and recreate.

### Agent prompt template (USE THIS — fill in the blanks)

```
You are working in worktree: /Users/ianrakow/Desktop/getsear/.claude/worktrees/v{N}-batch-{B}-{slug}/

YOUR TASK: {task_id} — {task_title}

WHAT TO BUILD: {task_description from version spec}

FILES YOU WILL TOUCH: {files from version spec}

ACCEPTANCE CRITERIA (the task is NOT done until ALL pass):
{acceptance_criteria}

CONTEXT YOU NEED:
- Read the relevant section of /Users/ianrakow/Desktop/getsear/build-pipeline/versions/V{N}_*.md.
- Reference /Users/ianrakow/Desktop/getsear/build-pipeline/DEFAULTS.md for any decision.
- Reference /Users/ianrakow/Desktop/getsear/build-pipeline/STANDING_RULES.md for universal rules.
- The codebase tree is rooted at the worktree path. cd there before doing any work.

SYSTEM RULES (override anything else):
- DO NOT ASK QUESTIONS. The user is not present. Resolve uncertainty via DEFAULTS.md or pick the safer default.
- LOG decisions: append one JSON line per non-trivial decision to /Users/ianrakow/Desktop/getsear/build-pipeline/logs/decisions.jsonl: {"ts":"...","task_id":"{task_id}","decision":"...","rationale":"...","alternatives":["..."]}.
- TEST before marking complete: `npm run build`, `npm run lint`, and any tests covering your changed files.
- COMMIT all your changes to the worktree branch with message: "{task_id}: {short summary}".
- DO NOT TOUCH FILES OUTSIDE YOUR TASK SCOPE. Other agents are running in parallel on adjacent files.
- DO NOT use AskUserQuestion or ExitPlanMode tools.

ON COMPLETION: append to /Users/ianrakow/Desktop/getsear/build-pipeline/logs/agents.jsonl one JSON line: {"ts":"...","task_id":"{task_id}","status":"ok","files_touched":["..."],"branch":"v{N}-batch-{B}-{slug}"}. Then your work is done.

ON DEFERRAL (hardware/credential missing): append {"status":"deferred","reason":"..."} to logs/agents.jsonl, do not commit, exit cleanly.

ON FAILURE: append {"status":"failed","reason":"...","error":"..."} to logs/agents.jsonl. Do NOT modify BLOCKERS.md (only the runner does that).

Begin now.
```

### Waiting for parallel agents

After spawning all agents in one message, the system will notify you as each completes. You wait passively — do NOT poll, do NOT call `TaskOutput`. When all agents have notified completion, read `logs/agents.jsonl` to verify each task's status.

## After all agents in a batch return

1. **Reconcile.** Read `logs/agents.jsonl` for the entries with this batch's task IDs. Determine which tasks are `ok`, `deferred`, `failed`.
2. **Failed tasks:** retry by re-spawning the agent with the same prompt + an additional context block explaining what went wrong from the prior attempt's log entry. Max 3 attempts per task. After attempt 3, log to BLOCKERS.md and halt.
3. **Deferred tasks:** mark `deferred` in STATE.yaml with the reason. Do not retry until next batch cycle. After 3 deferral cycles for the same reason → BLOCKERS.md.
4. **All ok:** continue to integration.

## Integration step

```bash
cd /Users/ianrakow/Desktop/getsear
export BATCH_ID="batch-{current_b}"
./build-pipeline/INTEGRATE.sh
```

This script:
- Merges every active v* worktree branch into main.
- Removes worktrees and branches.
- Runs `npm run build`, `npm run lint`, `npm run test:e2e`.

If integration fails:
- Read the test output. Identify which task's code caused the failure.
- Spawn a fix agent for that task with the failure context.
- Up to 3 fix attempts. Then BLOCKERS.md.

## Deploy step

```bash
cd /Users/ianrakow/Desktop/getsear
export BATCH_ID="batch-{current_b}"
./build-pipeline/DEPLOY.sh
```

This script:
- Commits + pushes any pending changes.
- SSHs to VM, pulls, builds, reloads pm2.
- Smoke tests https://getsear.com.

If deploy fails: 3 retry attempts, then BLOCKERS.md.

## State updates

After successful deploy:

```yaml
# STATE.yaml updates
last_updated_at: <ISO timestamp>
versions.V{N}.batches.{B}.status: complete
versions.V{N}.batches.{B}.tasks.{T}.status: complete  # for each task
# Then advance pointer:
current_batch: <next batch in this version, or first batch of next version>
current_version: <unchanged unless this was the last batch>
```

If the completed batch was the last in its version (typically the demo+ship batch like 5.6, 6.6, etc.), additionally:
- Set `versions.V{N}.status: complete`.
- Set `versions.V{N}.completed_at: <ISO timestamp>`.
- Advance `current_version` to the next.
- Write a one-paragraph retro to `logs/retros/V{N}.md`.

Always write STATE.yaml AFTER all updates are made (one atomic write).

## Sequential task execution (when batch.type == "sequential")

For sequential tasks, execute them inline yourself in the main session. Do NOT spawn an Agent for tasks marked `agent: main`. Just do the work directly using your own tools.

## Special task: demo+ship (last task of every version)

This is the only task where "demo recording" is best-effort. The runner does:
1. Run all exit criteria checks listed in the version spec.
2. Update `docs/MODULE_DEPTH_AUDIT.md` with the version's deltas.
3. Tag release: `git tag v{N}.0.0 && git push --tags`.
4. Write `logs/retros/V{N}.md` (1 paragraph: what worked, what surprised, what to do differently).
5. If a screen-recording binary is available (`ffmpeg`, `screencapture`), attempt a 60-second capture of the demo flow. If not, log "demo recording deferred — no recording binary present."
6. Mark version complete and advance.

Never block on demo recording. The deploy + tag is the gate.

## Bonus batches (5.7, 5.8, 6.7, 6.8, 8.6–8.8, 9.6–9.9, 10.6–10.11)

These are listed in STATE.yaml with `bonus: true`. Run them AFTER the version's normal batches are complete but BEFORE the demo+ship batch. They strengthen the version's exit criteria but aren't strictly required.

If a bonus batch hits a hard blocker, log it but DO continue to the demo+ship batch — bonus batches don't gate the version.

## Decision logging

Every time you make a non-trivial choice (library pick, approach selection, conflict resolution), append to `logs/decisions.jsonl`:

```json
{"ts":"2026-04-30T14:23:11Z","task_id":"5.4.2","decision":"used XState for order state machine","rationale":"DEFAULTS.md says use the option already in package.json; xstate isn't but it's the most common choice for state machines","alternatives":["custom switch statement","robot3"]}
```

This is for posterity — future Claude sessions reading the log will know why things were done.

## Resumption

If you wake up and STATE.yaml shows a task as `in_progress`, that means a prior session was working on it but didn't complete. Do this:

1. Run `git worktree list`. Find the worktree for that task.
2. Check `git -C <worktree-path> status` and `git log -1`.
3. If commits exist matching the task slug, the prior session likely completed but didn't write the state update. Verify acceptance criteria, then mark complete.
4. If no commits, the prior session crashed mid-work. Run `git worktree remove --force <path>`, set task back to `pending`, re-spawn.

## Hard blockers — log and halt

When you decide to halt:

1. Append to `BLOCKERS.md`:
   ```markdown
   ### {timestamp} — {task_id} — {severity}
   **What:** ...
   **Why blocked:** ...
   **What's needed to unblock:** ...
   **Runner action:** Stopped.
   ```
2. Write `logs/V{N}_HALT_{timestamp}.md` with full context: which task, what was tried, what failed, what state.yaml looks like.
3. Stop the loop. Output to user (in case anyone is reading): "Halted at {task_id}. See BLOCKERS.md."

Do not try to fix it yourself beyond the 3-attempt limit. The user resolves.

## What "ok" looks like

The healthy state is:
- STATE.yaml advances 1 batch every few hours (faster for parallel-heavy batches, slower for sequential).
- BLOCKERS.md stays empty.
- getsear.com gets a new deploy after every batch.
- logs/agents.jsonl, logs/decisions.jsonl, logs/batch-runs.jsonl, logs/deploys.jsonl all grow steadily.
- No human intervention.

If you go more than 4 hours without state advancement, something is wrong. Investigate by reading the latest agent logs.

## Final word

You exist to ship V10. Every decision you make defaults toward "ship it." When in doubt, build the simpler version and move on. Polish in a later iteration if needed. The user values shipped > perfect.

Begin the loop.
