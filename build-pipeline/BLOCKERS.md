# Blockers Log

The runner appends to this file ONLY when it cannot proceed. The presence of any active entry below stops the pipeline. Format:

## TEMPLATE — copy this when logging a real blocker

### [TIMESTAMP] — [TASK_ID] — [SEVERITY]
**What:** Short description of the failing task or condition.
**Why blocked:** Concrete reason — error message, missing credential, hardware unavailable, etc.
**What's needed to unblock:** Specific human action.
**Runner action:** Stopped. Awaiting human resolution.
**Resolved at:** (Ian fills this in when resolving, then deletes the entire entry before pasting resume.md.)

---

### 2026-05-04T18:00:00Z — batch-5.99-cross-cutting-fixes — HARD-BLOCKER
**What:** Cannot execute synthetic batch `5.99-cross-cutting-fixes` end-to-end. The orchestrator pattern requires the `Agent`/`Task` tool to dispatch the 8 specialists (`supabase`, `realtime-engineer` ×3, `migration-author`, `marketing-engineer`, `security-reviewer`, `devops-deploy`) in parallel worktrees with `run_in_background: true`, then dispatch `reviewer`/`design-reviewer` for the mandatory verdict pass.
**Why blocked:** This CLI session does not expose the `Agent`/`Task` tool. ToolSearch was queried under `select:Task`, keyword search for "agent subagent specialist dispatch", and "+task" — all returned no matches. The deferred-tool registry presented at session start lists EnterWorktree/ExitWorktree/Monitor/TaskStop/WebFetch/WebSearch and ~150 MCP tools but no Agent/Task dispatcher. This is a session capability gap, not a persona/spec issue.

The runner's `RUNNER.md` doctrine forbids the only obvious fallbacks:
- `claude -p` subprocesses → "proven 2026-05-04 to hit Write-tool sandbox blocks even with --allow-dangerously-skip-permissions" (see how every cross-cutting-reviews/*.md file reports "Write blocked … harness blocked writes" — that's the same constraint biting again).
- `general-purpose + prompt-injected persona` → "ALWAYS dispatch via NATIVE subagent_type — never general-purpose + prompt-inject persona."
- Inline single-Opus serial execution → loses reviewer-pass independence (RUNNER.md: "NEVER skip the reviewer pass — proven necessary V5.1.3 and V5.4.2"); also loses per-specialist persona discipline that the cross-cutting review just established.

**What's needed to unblock:** Pick ONE of:
1. **Re-launch this work in a CLI session that exposes the Agent tool.** The persona personas at `~/.claude/agents/sear-batch-implementer.md` will route correctly once Agent is callable. (Best option — preserves the orchestrator pattern Ian designed.)
2. **Authorize inline serial execution by a single Opus operator** without the reviewer-pass independence guarantee. Trade off: ~16-20 hours of work compressed into one session, single point of failure on review judgment, but does ship the P0 fixes. (Acceptable IF Ian explicitly says "do it serially, I'll review the diff myself".)
3. **Re-spec the batch as eight separately-launched single-task sessions** (each a fresh CLI invocation with the right persona file referenced). Equivalent to option 1 but executed by the human as 8 sequential CLI sessions instead of one orchestrator session.
4. **Defer the P0 fixes**, deploy V6.2 against the current open RLS / TOCTOU / open-DELETE attack surfaces, accept the risk, and address findings opportunistically as V6.3+ batches naturally touch those files. (NOT recommended — security-reviewer report flags 5 P0s and `validate-manager-pin` rate-limit gap is a 17-min-per-manager keyspace exploit that would land in prod.)

**Runner action:** Stopped. Awaiting human decision on which path forward.
**Resolved at:** (Ian fills in when resolving.)

