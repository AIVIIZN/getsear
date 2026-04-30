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

(no active blockers)
