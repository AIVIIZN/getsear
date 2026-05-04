The harness is blocking file writes for this audit. Since the user explicitly requested JSONL output to `build-pipeline/logs/cross-cutting-reviews/security-reviewer.md` but write permission is being denied, I'll emit the complete JSONL findings inline so the user (or a follow-up agent with write permission) can route them to the file.

# Cross-Cutting Security Review — V5+V6 (Sear POS)

**Summary:** 32 findings — **5 P0**, **14 P1**, **13 P2**. The four highest-risk surfaces, in order:

1. **`/api/auth/verify-manager-pin`** has no rate limit / no lockout against a 4-digit PIN keyspace — a low-privilege employee with any session can iterate all 10,000 PINs in ~17 minutes per manager.
2. **`/api/orders/[id]/discount`** has zero gating — no role check, no manager-PIN, no audit row. A 100% discount is a one-line POST.
3. **`/api/payments/void`** lets server/bartender/cashier roles void payments under $100 with no manager-PIN; only legacy `details:` audit column is written.
4. **Tenant isolation depends entirely on `.eq('org_id', user.org_id)`** because every API route uses `createAdminClient()` (200+ files), which bypasses RLS by default. The 442 RLS policies in the baseline migration are inert in the request path. A single forgotten filter is a cross-tenant data breach. Already missing in `staff/checkout` and `customers/merge`.

Audit-log coverage: only **4** routes use the new `audit.record()` helper. **8** routes write directly to `audit_log` with the legacy `details:` column. **12** privileged routes have no audit at all.

## P0 findings (5)

```jsonl
{"severity":"P0","category":"missing-rate-limit","file":"src/app/api/auth/verify-manager-pin/route.ts","line":13,"problem":"Endpoint accepts unlimited 4-digit PIN attempts from any authenticated user. No rate limit, no lockout, no exponential backoff. ~10k PIN combinations × ~100ms bcrypt per manager → low-priv employee iterates keyspace in ~17 min/manager.","exploit":"Cashier with valid session POSTs {pin:0000}…{pin:9999}. On hit, server returns manager user_id+display_name. Cashier then performs voids/comps/refunds with discovered PIN.","fix":"checkRateLimit('auth', user.id) AND checkRateLimit('auth', `pin:${user.org_id}`). Lock PIN-verify path 15min after 10 cumulative org failures. Log every failure to audit_log."}
{"severity":"P0","category":"missing-pin","file":"src/app/api/orders/[id]/discount/route.ts","line":19,"problem":"NO requireRole, NO manager-PIN, NO audit-log. requires_manager_approval boolean is parsed and never read. Any authenticated user applies 100% discount.","exploit":"Server applies {discount_type:percentage,value:100} to a $400 ticket → $0. Customer leaves; server pockets cash. No actor in audit trail.","fix":"requireRole + threshold gate (>10% or >$10 → manager_pin). Always audit.record({action:order_discount_applied, manager_pin_user_id, before_state, after_state, reason})."}
{"severity":"P0","category":"missing-pin","file":"src/app/api/payments/void/route.ts","line":107,"problem":"Allowed roles include server/bartender/cashier (line 38). Manager-PIN required only when total>$100 AND user not already manager+. Voids under $100 bypass PIN AND skip audit.record() — only legacy details: insert.","exploit":"Cashier voids 50 transactions of $99 each = $4,950 unaudited skim. Per-cashier void volume not surfaced anywhere.","fix":"Always require manager-PIN regardless of amount. Replace legacy insert with audit.record({action:payment_voided, manager_pin_user_id, before_state, after_state})."}
{"severity":"P0","category":"missing-rate-limit","file":"src/app/api/auth/login/route.ts","line":11,"problem":"No rate limit, no failed-attempt tracking, no account lockout. Differential error messages (line 30 vs 56) enable user-enumeration of deactivated accounts.","exploit":"Credential-stuffing at hundreds of req/sec. is_active=false branch returns distinct error narrowing attack to known-active emails.","fix":"checkRateLimit('auth', getClientIp(request)) + checkRateLimit('auth', `email:${email.toLowerCase()}`). Identical 401 for both branches."}
{"severity":"P0","category":"missing-rls","file":"src/lib/supabase/admin.ts (used by 200+ routes)","line":0,"problem":"Every API route under src/app/api/** uses createAdminClient() which bypasses RLS. 442 baseline RLS policies are inert in the request path; only tenant boundary is the explicit .eq('org_id', user.org_id) each author must remember. Already missing in /api/staff/checkout and /api/customers/merge.","exploit":"New endpoint queries orders/payments without .eq('org_id'). Tenant A supplies tenant B order_id (UUIDs leak via screenshots/tickets/receipts), reads/mutates B data.","fix":"(1) Lint rule flagging createAdminClient() without paired .eq('org_id'). (2) Migrate read+mutating routes to user-scoped createClient() where possible. (3) Request-scoped wrapper auto-injecting org_id filter."}
```

## P1 findings (14)

```jsonl
{"severity":"P1","category":"missing-pin","file":"src/app/api/orders/[id]/comp/route.ts","line":105,"problem":"Pre-close comps need only manager role; PIN enforced only post-close. Per spec ALL comps require PIN.","exploit":"Manager leaves iPad unlocked; bartender taps comp on $300 ticket; ambient cookie session lets it through.","fix":"Require manager_pin in schema unconditionally."}
{"severity":"P1","category":"missing-pin","file":"src/app/api/orders/[id]/void/route.ts","line":59,"problem":"Same as comp: PIN only post-close.","fix":"Make manager_pin required in voidSchema regardless of state."}
{"severity":"P1","category":"missing-auth","file":"src/app/api/orders/[id]/walkout/route.ts","line":24,"problem":"getAuthUser but skips requireRole. Audit row has performed_by:validatingManager.id (the PIN-supplier) instead of user.id (the actor) — investigations look at wrong person.","fix":"Add requireRole + fix audit row (performed_by:user.id, approved_by:validatingManager.id) + audit.record."}
{"severity":"P1","category":"missing-audit","file":"src/app/api/orders/[id]/walkout/route.ts","line":133,"problem":"Walkout writes only to legacy order_modifications. No audit.record(). Walkouts invisible to back-office UI / CSV export.","fix":"audit.record({action:order_voided, reason:walkout, manager_pin_user_id, before_state, after_state})."}
{"severity":"P1","category":"missing-auth","file":"src/app/api/cash-management/closing-count/route.ts","line":62,"problem":"No requireRole. Any authenticated user can submit a closing count and force drawer closed.","exploit":"Server hides skim by submitting count matching reduced bank.","fix":"requireRole + manager-PIN for |over_short|>$5 + audit.record."}
{"severity":"P1","category":"missing-auth","file":"src/app/api/cash-management/opening-count/route.ts","line":50,"problem":"No requireRole; no audit_log entry at all.","exploit":"Forge $500 opening when only $100 went in → $400 short on close attributed to closing cashier.","fix":"requireRole + audit.record({action:cash_drawer_count_open})."}
{"severity":"P1","category":"missing-pin","file":"src/app/api/staff/cash-drawers/[id]/open/route.ts","line":21,"problem":"Allows server/bartender/cashier; no manager-PIN required.","fix":"Require manager_pin + validateManagerPin + audit.record({action:cash_drawer_opened})."}
{"severity":"P1","category":"missing-audit","file":"src/app/api/staff/cash-drawers/[id]/close/route.ts","line":18,"problem":"No audit.record(). Only cash_drawer_events.","fix":"audit.record({action:cash_drawer_count_close, manager_pin_user_id, before_state, after_state})."}
{"severity":"P1","category":"missing-auth","file":"src/app/api/staff/[id]/clock-in/route.ts","line":15,"problem":"Accepts arbitrary user_id; no requireRole. Anyone can clock anyone in. No audit.","exploit":"Server B clocks in coworker A 2h early to inflate hours.","fix":"Require user.id===id OR requireRole(['owner','admin','manager']) + audit clock-ins by another user."}
{"severity":"P1","category":"missing-audit","file":"src/app/api/staff/time-entries/[id]/route.ts","line":19,"problem":"PATCH edits clock_in/clock_out/cash_tips/credit_tips. Recalculates pay. No audit.record() — wage-fraud surface invisible.","exploit":"Manager backdates clock_in 2h every shift; zeros credit_tips to under-report tippable income to IRS.","fix":"Capture before_state + audit.record({action:time_entry_edited, before_state, after_state, reason})."}
{"severity":"P1","category":"missing-rate-limit","file":"src/app/api/auth/pin-login/route.ts","line":15,"problem":"Lockout in in-process Map. PM2 cluster mode → each worker has its own Map; attacker rotating workers gets N×MAX_ATTEMPTS attempts. Comment 'replace with Redis' acknowledged but never landed.","exploit":"4 workers × 5 attempts = 20/cycle; 6,000/day approaches 10k PIN keyspace.","fix":"Replace Map with Redis-backed checkRateLimit('auth', `pin-login:${user_id}`) + per-IP limit."}
{"severity":"P1","category":"missing-pin","file":"comp + void + walkout + payments/refund + payments/void","line":0,"problem":"validateManagerPin pattern duplicated across 7 routes; only verify-manager-pin and payments/terminals filter by is_active=true. The 5 mutating routes do NOT — a deactivated manager (terminated, on leave) still authorizes voids/comps/refunds until pin_hash is rotated.","exploit":"Owner fires manager X for theft. X's PIN still works at any terminal until manually cleared. Termination workflows usually disable login, not PINs.","fix":"Centralize in src/lib/auth/manager-pin.ts (file referenced in spec but currently absent). requireManagerPIN(req,user) → {manager_pin_user_id} bcrypt-comparing against pin_hash WHERE org_id=user.org_id AND is_active=true AND role IN(owner,admin,manager). Replace every duplicated copy."}
{"severity":"P1","category":"missing-audit","file":"src/lib/audit/log.ts","line":230,"problem":"audit.record() swallows ALL errors. NEVER throws is intentional, but no caller checks the returned error. Privileged action succeeds while audit row silently fails (DB outage, RLS error, schema drift).","exploit":"Adversary engineers transient DB pressure that fails audit_log inserts. Voids/comps/refunds proceed without trail.","fix":"Return typed result; callers must alert on error (Sentry breadcrumb at minimum). Consider failing privileged actions on audit failure."}
{"severity":"P1","category":"missing-rate-limit","file":"payments/refund + capture + void + preauth + tip-adjust","line":0,"problem":"None of payment-mutating endpoints use checkRateLimit('payment', ...). The tier exists (20/min) but no route consumes it.","fix":"Wrap every payment route with checkRateLimit('payment', user.id)."}
{"severity":"P1","category":"missing-rate-limit","file":"src/app/api/online-ordering/public/order/route.ts","line":28,"problem":"Public order-submission endpoint has no IP rate-limit. Per-slot throttle (line 73) is global per location, not per IP.","exploit":"Attacker scripts 10 fake orders to a competitor location, hitting max_orders_per_slot=10 and triggering 'we're busy' for legit customers. Repeat every 15 min — DoS vector.","fix":"checkRateLimit('public', getClientIp(request)) before slot-throttle. Validate customer_phone format more strictly than .min(10) — currently accepts 'aaaaaaaaaa'."}
```

## P2 findings (13)

```jsonl
{"severity":"P2","category":"missing-rate-limit","file":"marketing/track/click + open","line":0,"problem":"Public tracking endpoints have no rate limit. Mass requests can poison click/open analytics or cause DB pressure.","fix":"checkRateLimit('public', getClientIp) — fail OPEN on Redis outage."}
{"severity":"P2","category":"missing-rate-limit","file":"src/app/api/marketing/unsubscribe/route.ts","line":90,"problem":"No rate limit. UUIDv4 token is high-entropy (negligible risk) but still DB pressure / log-noise.","fix":"checkRateLimit('public', getClientIp); whitelist mailbox-provider IPs for RFC 8058 POSTs."}
{"severity":"P2","category":"input-validation","file":"src/app/api/marketing/segments/count/route.ts","line":22,"problem":"body parsed as Record<string,unknown> — no Zod schema. Untyped fields flow into Supabase filters.","fix":"Define Zod SegmentCriteria; reject unknown keys; cap array sizes."}
{"severity":"P2","category":"missing-rls","file":"src/app/api/staff/checkout/route.ts","line":47,"problem":"time_entries (47-53) and orders (70-74) queries NOT filtered by org_id. user_id and location_id from body. No verification that user_id belongs to caller org.","exploit":"Server submits another tenant's user_id+location_id (if location_id leaks). RLS would block this if user-scoped client.","fix":"Add .eq('org_id', user.org_id) to both queries; verify user_id resolves to a row in users WHERE org_id=user.org_id BEFORE querying entries."}
{"severity":"P2","category":"missing-rls","file":"src/app/api/customers/merge/route.ts","line":108,"problem":"customer_addresses update lacks .eq('org_id', user.org_id).","fix":"Append .eq('org_id', user.org_id) to the update."}
{"severity":"P2","category":"missing-audit","file":"src/app/api/customers/merge/route.ts","line":119,"problem":"action: 'customer.merged' (dot syntax) does NOT match AuditAction enum 'customer_merged'. Uses legacy details: column. New audit-log UI/CSV will not surface this row.","fix":"Replace with audit.record({action:'customer_merged', actor:user, entity_type:'customer', entity_id:primary_id, before_state:{primary,secondary}, after_state:{merged}, manager_pin_user_id})."}
{"severity":"P2","category":"input-validation","file":"src/app/api/auth/login/route.ts","line":53,"problem":"Differential error messages reveal account state.","fix":"Identical generic 401 for both branches."}
{"severity":"P2","category":"missing-audit","file":"src/app/api/payments/void/route.ts","line":214,"problem":"audit_log insert uses details: column; skips audit.record(). No before_state/after_state/manager_pin_user_id.","fix":"Replace with audit.record({action:'payment_voided', manager_pin_user_id:approvingManagerId, before_state, after_state, location_id, request})."}
{"severity":"P2","category":"other","file":"build-pipeline/DEPLOY.sh","line":19,"problem":"git add -A adds every untracked file. CLAUDE.md and AIVIIZN-runbook rule 6 forbid this. Future change to gitignore strategy could silently push secrets.","fix":"Replace with explicit file lists OR pre-commit grep for known secret patterns."}
{"severity":"P2","category":"input-validation","file":"src/app/api/payments/preauth/route.ts","line":21,"problem":"No requireRole. Any authenticated user (kitchen, host) can initiate Valor preauth.","fix":"requireRole(user, ['owner','admin','manager','server','bartender','cashier'])."}
{"severity":"P2","category":"missing-audit","file":"src/app/api/marketing/campaigns/[id]/send/route.ts","line":134,"problem":"approvingManagerId captured then explicitly discarded (`void approvingManagerId`). No audit row records who approved a campaign send.","fix":"audit.record({action:'campaign_sent' (new enum) or 'org_settings_changed', actor:user, manager_pin_user_id:approvingManagerId, before_state:{status:'draft'}, after_state:{status:'sending', recipients_count}})."}
{"severity":"P2","category":"input-validation","file":"src/app/api/payments/refund/route.ts","line":131,"problem":"new Date(processed_at) NaN-bypass: malformed string yields Invalid Date; !(NaN > 120) is TRUE → refund proceeds outside window.","fix":"if (!processed_at || isNaN(date.getTime())) return 422. Tighten upstream so processed_at is non-null on captured."}
{"severity":"P2","category":"output-sanitization","file":"src/app/api/marketing/unsubscribe/route.ts","line":75,"problem":"htmlPage open-coded escape. Future-fragile if user-supplied content is added.","fix":"Render via React DOMServer or extract escape to src/lib/security/html-escape.ts."}
{"severity":"P2","category":"secret-leak","file":"build-pipeline/DEPLOY.sh","line":47,"problem":"`source /opt/sear/app/.env.local` from SSH session. SUPABASE_SERVICE_ROLE_KEY plus all secrets exposed at rest in plaintext on the VM.","exploit":"Lateral movement from another GCP service-account compromise reads .env.local and owns org data via service-role key.","fix":"Migrate to GCP Secret Manager / Doppler. At minimum chmod 0600 + chown pm2-user."}
{"severity":"P2","category":"missing-audit","file":"src/app/api/staff/permissions/[userId]/route.ts","line":71,"problem":"PUT (manager-only) grants/revokes individual permission overrides — high-priv RBAC change. No audit.record().","exploit":"Manager grants self comp_unlimited, comps $4k ticket, revokes — no audit of the privilege escalation.","fix":"audit.record({action:'staff_role_changed' or new 'permission_override_changed', actor:user, before_state, after_state, manager_pin_user_id})."}
```

## Per-checklist tally (24 high-risk routes audited)

| Check | Pass/Total | Notable failures |
|---|---|---|
| Auth gate present | 24/24 | — |
| Role gate present | 15/24 | opening-count, closing-count, walkout, clock-in, preauth, discount, online-ordering public ×2, marketing track ×2, unsubscribe |
| Manager-PIN gate | 7/24 (full), 4/24 (conditional), 13/24 missing | discount, opening-count, closing-count, drawer-open, walkout (role check missing), comp/void (pre-close), payments/void (<$100), staff/permissions, time-entries PATCH |
| Org scoping explicit | 22/24 | staff/checkout (time_entries+orders), customers/merge (customer_addresses) |
| `audit.record()` call | 4/24 use new helper; 8/24 use legacy `details:`; 12/24 have NO audit | walkout, payments/void, cash-management/*, staff/permissions, time-entries PATCH, marketing/campaigns/send, customers/merge (wrong action name), opening-count, closing-count, discount, clock-in, drawer-open/close |
| Zod validation | 22/24 | marketing/segments/count untyped body; pin-login no zod |
| Idempotency-Key | 1/24 | only orders.create wraps with `withIdempotency`. payments/refund, payments/void, comp, void, walkout, discount unprotected → replay risk on offline-queue retries |
| Rate limit | 3/24 | only audit-log + audit-log/export + ai/ask + mfa/* — none on auth/login, payments/*, orders/*, public marketing tracking, public ordering |
| Error-leakage | 23/24 | auth/login differential errors enable user-enumeration |
| Output sanitization | 24/24 | no `dangerouslySetInnerHTML` observed |

## Recommended remediation order

**Priority 1 (now):**
1. `checkRateLimit` + lockout on `verify-manager-pin`.
2. Gate `orders/[id]/discount` with role + PIN + audit.
3. Always require manager-PIN for `payments/void` regardless of amount.
4. Rate-limit + identical error messages on `auth/login`.
5. Centralize `validateManagerPin` in `src/lib/auth/manager-pin.ts` with `is_active` filter; replace 7 duplicates.

**Priority 2 (next):**
6. Add `requireRole` to walkout, opening-count, closing-count, clock-in, cash-drawers/open.
7. Add `audit.record()` calls to walkout, payments/void, cash-management/*, customers/merge, staff/permissions, staff/time-entries PATCH, marketing/campaigns/send.
8. Move pin-login lockout from in-memory Map to Redis.
9. Always require manager-PIN for comp + void (not just post-close).

**Priority 3 (hardening):**
10. Add explicit `org_id` filter to `staff/checkout` queries.
11. Rate-limit all payment-mutating routes.
12. Lint rule banning `createAdminClient()` without paired `.eq('org_id', ...)` filter.
13. Replace `DEPLOY.sh` `git add -A` with explicit file list.
14. Make `audit.record()` failure surface to Sentry; consider failing privileged actions on audit failure.

---

**Note on file output:** The harness blocked writes to `build-pipeline/logs/cross-cutting-reviews/security-reviewer.md` (sandbox-level deny on every `Write`/`touch`/`mkdir` attempt against any path under `/Users/ianrakow/Desktop/getsear`, including the project root). The full JSONL above is in the format the spec requires; route it to that file via a follow-up agent that has write permission, or via `pbpaste > build-pipeline/logs/cross-cutting-reviews/security-reviewer.md` from the user's shell.
