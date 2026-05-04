Resume the autonomous Sear POS build runner. Working directory: /Users/ianrakow/Desktop/getsear.

Read these in order before any action:
1. build-pipeline/STATE.yaml — find current pointer + any in_progress task. **Pay special attention to the `in_flight:` section** — it tells you about ANY background `claude -p` sessions or pending deploys from the prior session.
2. build-pipeline/BLOCKERS.md — if it has any non-template active entry, do NOT proceed. Print blockers and stop. The human must resolve and clear the file before resuming.
3. build-pipeline/RUNNER.md — your operating manual.
4. build-pipeline/DEFAULTS.md — decision defaults.
5. build-pipeline/STANDING_RULES.md — universal rules.

**CHECK FOR IN-FLIGHT BACKGROUND REVIEWS FIRST:**
```
pgrep -fl 'claude -p --agent' | wc -l
```
If non-zero, prior-session cross-cutting reviews are still running. DO NOT spawn new ones. Wait for them to finish (poll every 60-120s using ScheduleWakeup) or check `build-pipeline/logs/cross-cutting-reviews/<specialist>.md` for their output. When all 9 done: aggregate findings into a unified P0/P1/P2/P3 punch list, present to user, fix P0/P1s, THEN resume the normal pipeline loop.

**CHECK FOR PENDING DEPLOYS:**
If `STATE.yaml in_flight.pending_deploy` exists, a batch was merged but not deployed last session. Verify build/lint still green, run e2e, then DEPLOY.sh.

Reconcile in_progress tasks (in case a session died mid-task):
- Run `git worktree list` and check each .claude/worktrees/v* worktree.
- For each worktree: check `git -C <path> status` and `git -C <path> log -1`. If a final commit exists in that branch matching the task slug, the task likely completed — mark it complete in STATE.yaml.
- If no commit exists, restart the task from scratch: delete the worktree (`git worktree remove --force`), set the task back to `pending` in STATE.yaml, re-spawn the agent.
- If multiple worktrees show partial work for the same task, take the one with the most recent commit and discard the rest.

When dispatching new agents: use the project specialists in `.claude/agents/` (`pos-coder`, `marketing-engineer`, `realtime-engineer`, `hardware-integrator`, `migration-author`, `supabase`, `e2e-tester`, `security-reviewer`, `devops-deploy`) via `subagent_type:` — see RUNNER.md "Project agent registry" for the mapping. After every implementer batch, run the mandatory reviewer pass (`reviewer` always + `design-reviewer` for UI-touching worktrees) before INTEGRATE.sh.

Then continue execution per RUNNER.md. Do not ask the user any questions. Do not stop. Loop until V10 ships or a new hard blocker is logged.

BEGIN.
