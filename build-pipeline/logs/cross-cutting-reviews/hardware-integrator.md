The sandbox is blocking writes to `build-pipeline/logs/cross-cutting-reviews/hardware-integrator.md` (Write/Bash both require an interactive permission grant that isn't being approved). The analysis is complete; relaying findings inline so the parent process can persist them.

## Cross-cutting review — hardware-integrator persona

**15 findings (2× P0, 4× P1, 6× P2, 3× P3)** for the V5.2.0 payment hardware framework + processor lock.

### P0 — broken end-to-end flows
1. **`TerminalDiscoveryDialog.tsx:138`** — `runDiscovery()` POSTs `{}` to `/api/payments/terminals/discover`, but `bodySchema` requires `manager_pin`. ManagerPinDialog default `returnPin=false` so the entered PIN is never forwarded. **Every Scan-for-devices click 400s.**
2. **`TerminalDiscoveryDialog.tsx:162`** — same pattern: `addDevice()` omits `manager_pin` while `registerSchema` requires it. **Every Add-device click 400s.** Fix both: pass `returnPin=true` on the dialog, capture the PIN in `handlePinVerified((id,name,pin)=>...)`, forward in body.

### P1
3. **`auto-detect.ts:78`** — `getCertStatus(...) ?? dev.cert_status` falls back to scanner-supplied cert when matrix lookup misses, contradicting the file's own "matrix is source of truth" comment. Drop the device when matrix returns null.
4. **`/api/payments/terminals/route.ts:169`** — successful registration writes no `audit_log` row despite being a manager-PIN-gated privileged action. V8.3 will flag it.
5. **`drivers/types.ts:43`** — `meta.cert_status` hard-coded in every driver duplicates the matrix and risks silent drift when V9.10 flips `pending_cert → live`. Drop the field; consult `getCertStatus()` only.
6. **`processor-binding.ts:62`** — missing-table fallback synthesizes Valor binding indefinitely with only `console.warn`. Add Sentry telemetry + a CI assertion that migration 5.2.0a is present, then remove the fallback once 5.2.0a ships.

### P2
7. **`auto-detect.ts:63`** — `setTimeout(timeoutMs+250)` never cleared; keeps Node event loop alive ~5s past response. Use AbortController.
8. **`mdns-scanner.ts:49`** — `webpackIgnore: true` is webpack-only; no-op under Next 16 Turbopack/SWC. Misleading comment.
9. **`valor-client.ts:258`** — idempotency key includes `Date.now()` → cross-request retries (UI double-click) produce distinct keys, defeating dedup at Valor.
10. **`compatibility-matrix.ts:25`** — `Record<string, …>` accepts typo'd device_class silently. Introduce `type DeviceClass` literal union, type matrix as `Record<DeviceClass,…>`.
11. **`terminal-registry.ts:47`** — no startup invariant ensuring every `live` matrix entry has a registered driver and vice versa. Add a vitest assertion.
12. **`TerminalListTable.tsx:29`** — POST inserts `status='registered'` but StatusPill maps anything not in `{online,error}` to "Offline" — newly-added devices show as offline immediately. Add a `registered` branch.

### P3
13. **`tap-to-pay-scanner.ts:48`** — comment promises "settings page surfaces 'coming soon'" but `settings/terminals/page.tsx` never reads the matrix. Roadmap signal missing from UI.
14. **`/api/payments/terminals/route.ts:83`** + `discover/route.ts:46` — manager-PIN compare loop is hand-rolled in two places, duplicating `/api/auth/verify-manager-pin` logic. Extract to `src/lib/auth/verify-manager-pin.ts`.
15. **`processor-binding.ts:27`** — `type Processor = 'valor'` literal is correct for V5.2.0, but no test guards against an accidental "Switch Processor" UI surface (defense layer 3 enforced by absence). Add a grep-based vitest test for forbidden strings; document the 4-file checklist for V9.10 multi-processor.

### Positives confirmed
- Tap-to-Pay scanner correctly suppresses synthetic emission unless `cert==='live'` (`tap-to-pay-scanner.ts:32-45`). ✓
- USB / Bluetooth scanner stubs return `[]` cleanly with no native deps. ✓
- mDNS scanner gracefully degrades to `[]` if `bonjour-service` isn't installed. ✓
- POST `/api/payments/terminals` correctly returns `{code:"driver_not_certified", cert_status}` with 400 for `pending_cert` or `unsupported_until_psp_listed`. ✓
- Single-matrix-flip path is architecturally clean for V9.10 — only finding 5 (driver-meta drift) blocks that promise.

**Persistence note:** the log file at `build-pipeline/logs/cross-cutting-reviews/hardware-integrator.md` could not be written — Write/Bash both blocked with permission-grant required. Findings above are the full JSONL; the parent process can redirect them to disk.
