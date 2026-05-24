# Hardware-Integration Cross-Cutting Audit — 2026-05-05

**Scope:** Star printer driver, Valor card reader, Bematech drawer, processor-binding lock, compatibility matrix, auto-detect framework, receipt format, mock mode.
**Branch/commit:** `main` @ `77aa1e1`
**Honest framing:** V5.2.1/2/3 are explicitly DEFERRED awaiting physical hardware. The framework (V5.2.0) is in. Most issues found are framework-level, UI plumbing, or testable-today spec gaps — not hardware-runtime defects.

---

## P0 — Ship-blocking

**None.** The 3-layer processor-binding lock is correctly implemented and the framework is sound.

---

## P1 — Real bugs that block hardware light-up or surface lying buttons

### P1-1. `HardwareSubWizard` offers Valor terminals that don't exist in the registry

`src/components/setup/HardwareSubWizard.tsx:42-47` lists `vp800 / vp550 / vp300pro / rckt` as the Valor model picker. None of these `device_class` values exist in `compatibility-matrix.ts` or `terminal-registry.ts`, which only know about `valor-vl100 / valor-vl300 / valor-vl500 / valor-vp200`. This is exactly the "lying button" pattern Rule 18 prohibits — the user picks a model and it goes nowhere because the next call would 400 with `unknown_device_class`. (The wizard's "pair" step today just shows static instructions, so the user doesn't crash, but the affordance is broken on completion.)

A **second namespace conflict** exists at `src/lib/payments/valor-connect.ts:31` which independently defines `TerminalModel = 'VP800' | 'VP550' | 'VP300_Pro' | 'RCKT'` and seeds three mock terminals. Two parallel terminal taxonomies (registry: VL/VP200; valor-connect: VP800/550/300/RCKT) will be a maintenance landmine.

**Fix:** Pick one taxonomy. The registry is canonical (it has matrix + driver files); rename `valor-connect.ts` and the wizard to use VL100/VL300/VL500/VP200, OR add new driver/matrix entries for VP800/VP550/VP300_Pro/RCKT. Whichever — they must agree.

### P1-2. Discovery and terminal-register UI never sends `manager_pin`

`POST /api/payments/terminals/discover/route.ts:21-24` and `POST /api/payments/terminals/route.ts:26-32` both require `manager_pin` in the request body (validated with Zod). But `TerminalDiscoveryDialog.tsx:138-142` posts `JSON.stringify({})` to discover, and `:165-168` posts `{ device_class, identifier }` to terminals — neither includes `manager_pin`. The server will return 400 ("Manager PIN is required") or 403 ("Invalid manager PIN") on every call. The `ManagerPinDialog` *is* shown client-side, but the verified PIN is never propagated into the fetch body.

**Fix:** plumb the verified PIN out of `ManagerPinDialog.onVerified` and include it in both POST bodies.

### P1-3. `cash-drawer/open` does not record audit-log row per spec

Spec says: *"Every drawer open writes to `audit_log` with `actor_user_id`, `manager_pin_user_id`, `reason`."* The endpoint at `src/app/api/printing/cash-drawer/open/route.ts:73-83` writes only to `cash_drawer_events` with `staff_id` (no manager_pin reference). It also gates "no_sale" by RBAC role, not by `manager_pin` re-prompt — the spec for V5.2.3 calls for `requireManagerPIN()`. (`src/lib/auth/manager-pin.ts` exists with rate-limited verify already wired for `/api/auth/verify-manager-pin`.)

**Fix when 5.2.3 lights up:** require `manager_pin` in body, validate against `verifyManagerPin`, write `audit_log` row alongside `cash_drawer_events`.

### P1-4. Receipt format missing `card_brand`, `card_last_four`, EMV AID — testable today via mock

`src/lib/printing/receipt-formatter.ts` `ReceiptOrderData` exposes only `payment_method` (string) and `auth_code` (string). It does NOT carry `card_brand`, `card_last_four`, or `emv_aid`. `valor-client.ts` and `valor-connect.ts` already produce all three fields; receipts simply discard them. Per the V5.2.2 task spec: *"Receipt: must include card brand (Visa/MC/Amex/Disc), last4, auth code, EMV AID for chip transactions."*

This is testable today against the mock — no physical hardware needed. Add fields to `ReceiptOrderData` and the formatter. Also add a "MOCK" tag (see P2-3) so a sandbox receipt can never be mistaken for a live one.

---

## P2 — Framework-level issues

### P2-1. `valor-client-loader.ts` uses `require()` for live-mode dynamic import

`src/lib/payments/valor-client-loader.ts:154-159` does `require('@/lib/payments/valor-client')` inside `getValorClient()`. This works at Node runtime but tripped the TypeScript ESLint rule (the file even has `// eslint-disable-next-line @typescript-eslint/no-require-imports`). It also defeats Next 16's bundling — a server-only path-alias `require` may break in standalone output. Switch to a static import; both modules already exist on `main`, so the dynamic-load fallback is no longer earning its keep.

### P2-2. `valor-client.ts` (live API path) and `valor-mock.ts` have divergent interface shapes

`valor-client.ts` exports a richer interface (`ValorAuthResponse` includes `status`, `decline_code`, `rrn`, `entry_mode`, `response_code`); `valor-mock.ts` exposes a much smaller surface (only `decline_reason`). `valor-client-loader.ts` declares a *third* shape (`ValorClientInterface`) used by API routes. Switching `VALOR_MODE=live` will silently widen response payloads for callers that consume the loader interface — fine — but the mock cannot be a faithful test substitute for the live path. The mock should be deleted in favor of `valor-client.ts`'s built-in sandbox mode (which already simulates declines, mock entry modes, batch IDs, etc.).

### P2-3. Mock mode is not visible to operators

Spec: *"Mock should NOT silently succeed — should clearly indicate 'MOCK' in receipt + audit log."* Today, `valor-client.ts` sandbox returns realistic-looking transactions with no marker; receipts print without a sandbox watermark; audit/payment_events rows don't tag the environment. A real merchant in dev mode could tender a mock charge and not realize it. Add `environment: 'sandbox' | 'production'` to every payment row, and surface a "TEST MODE" stripe on the receipt header when `VALOR_ENVIRONMENT === 'sandbox'`.

### P2-4. Star adapter doesn't match V5.2.1 spec model name

Task spec calls for **Star TSP650II** with raw TCP socket port 9100 + ESC/POS. The model enum in `printer-interface.ts:12-19` lists `tsp143iv/iii, mc_print3, mpop, sm_l200` — no TSP650II. The 650II shipped in Toast/Square units and is what most US restaurants have. Either add `star_tsp650ii` to the enum or update the spec. (Driver wire path is identical — port 9100 + ESC/POS — so the gap is cosmetic until 5.2.1 lights up.)

---

## P3 — Polish / observations

- `tap-to-pay-scanner.ts:46-49` correctly returns `[]` when `cert === 'unsupported_until_psp_listed'` — no UI pollution. Good. Comment explains the PSP allowlist mechanic clearly. Single-edit flip path verified.
- `processor-binding.ts:67-72` falls back to a synthesized Valor binding if the table is missing (Postgres `42P01`). Migration `20260504043344` shipped, so this branch should never fire on prod, but a periodic cleanup would tighten the surface.
- `AddPrinterWizard.tsx` (legacy V4-era) and `HardwareSubWizard.tsx` (V6 setup-flow) are two separate printer-add flows. Worth consolidating eventually; not blocking.
- The `PrinterSetupWizard.tsx` referenced in V5.2.1's task description does not exist — the V4 wizard is `AddPrinterWizard.tsx`. When 5.2.1 lights up, decide whether to extend the existing wizard or create the named one.
- Driver stubs for `verifone-p400 / ingenico-lane3000 / clover-flex` correctly throw on `connect()` ("pending Valor EMV cert"). Driver stubs for `valor-vl100 / valor-vl300 / valor-vl500 / valor-vp200` correctly `console.log` and resolve. Symmetry is good.
- `compatibility-matrix.ts` is data-only as documented (no helpers leaked in). 9 entries: 4 live, 3 pending_cert, 2 unsupported_until_psp_listed — math checks out (the "9 stubs" claim in the handoff = 3 alt-mfg drivers + 4 valor stubs + 2 tap-to-pay matrix-only entries; only 7 driver files exist, the 2 tap-to-pay are intentionally driver-less per registry comment).
- `cash-drawer.ts` ESC/POS bytes (1B 70 m t1 t2) are correct and bound-checked. Pin map and pulse clamp are sound. Drawer-kicks-via-printer wiring path matches the Bematech requirement.

---

## Defense-in-depth audit summary (clean)

- **Layer 1 (TS):** `processor-binding.ts:27` → `export type Processor = 'valor'` literal.
- **Layer 2 (DB):** `20260504043344_add_org_processor_binding.sql:37-55` → BEFORE UPDATE trigger `prevent_processor_binding_change` raises `check_violation`. CHECK constraint pins to `'valor'`. RLS grants SELECT only. Service-role bypass is the only INSERT path.
- **Layer 3 (no UI):** Confirmed via grep — no settings page exposes a "Switch Processor" control.

All three layers verified. Word count: ~1,100.
