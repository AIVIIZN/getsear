/**
 * Shared e2e auth state (RK-0004 — E2E-GREEN).
 *
 * The Sear login endpoint is rate-limited to 5 attempts / 15 min per IP AND
 * per email (Redis sliding window — see src/lib/api/rate-limit.ts). Before this
 * module every spec logged in independently (~18 logins per run), which blew
 * the limit and turned the suite red with 429s. We now log in ONCE in a
 * Playwright `setup` project, persist the browser storage state, and every
 * other spec — browser OR API — reuses that session. A full run costs ~1 login.
 *
 * Two production facts this module encodes:
 *   1. Rate limit: back off + retry on 429, honouring Retry-After.
 *   2. CSRF: the edge middleware (src/lib/security/csrf.ts) 403s an unsafe
 *      /api/* request unless it is same-origin OR carries a matching sear_csrf
 *      double-submit token. A real browser sends `Origin: https://getsear.com`
 *      and passes the same-origin check; a bare Playwright APIRequestContext
 *      sends no Origin and gets 403 "Cross-site request blocked". So every API
 *      context here sets the Origin header exactly like a same-origin browser
 *      fetch — this is the real request path, not a test-only bypass.
 */
import path from 'node:path'
import fs from 'node:fs'
import { type APIRequestContext, expect } from '@playwright/test'

export const PROD_BASE_URL = 'https://getsear.com'
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? PROD_BASE_URL

export const DEMO_EMAIL = 'demo@getsear.com'
export const DEMO_PASSWORD = 'demo1234'

/** Git-ignored directory holding the shared auth artefacts. */
export const AUTH_DIR = path.join(process.cwd(), 'e2e', '.auth')
export const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'user.json')
export const USER_PROFILE_PATH = path.join(AUTH_DIR, 'demo-user.json')

export interface AuthedUser {
  id: string
  org_id: string
  role: string
  email: string
  display_name: string
  location_ids: string[]
}

interface RequestFactory {
  newContext: (options: {
    baseURL?: string
    ignoreHTTPSErrors?: boolean
    storageState?: string
    extraHTTPHeaders?: Record<string, string>
  }) => Promise<APIRequestContext>
}

/** The `playwright` test fixture (or a structural stand-in) exposes `request`. */
export type PlaywrightLike = { request: RequestFactory }

/**
 * The header that makes an APIRequestContext look like a same-origin browser
 * fetch to the CSRF middleware. `Origin` alone satisfies the same-origin branch
 * of isCsrfBlocked(); this is exactly what the browser sends on every mutation.
 */
export function browserOriginHeaders(): Record<string, string> {
  return { Origin: E2E_BASE_URL }
}

/**
 * Log in with retry/back-off on 429. Returns the authed user profile AND the
 * context used (so callers can persist its storageState). Caller disposes.
 *
 * `maxWaitMs` caps total back-off so a genuinely exhausted limiter fails loudly
 * instead of hanging the whole suite for the full 15-minute window.
 */
export async function rateLimitAwareLogin(
  pw: PlaywrightLike,
  opts: { maxWaitMs?: number } = {}
): Promise<{ request: APIRequestContext; user: AuthedUser }> {
  const maxWaitMs = opts.maxWaitMs ?? 60_000
  const request = await pw.request.newContext({
    baseURL: E2E_BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: browserOriginHeaders(),
  })

  const deadline = Date.now() + maxWaitMs
  for (let attempt = 0; ; attempt++) {
    const res = await request.post('/api/auth/login', {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    })
    if (res.status() === 200) {
      const body = (await res.json()) as { user: AuthedUser }
      return { request, user: body.user }
    }
    if (res.status() === 429 && Date.now() < deadline) {
      const retryAfter = Number(res.headers()['retry-after'] ?? '5')
      const waitMs = Math.min(Math.max(retryAfter, 1) * 1000, Math.max(deadline - Date.now(), 0))
      // eslint-disable-next-line no-console
      console.warn(
        `[e2e auth] login rate-limited (429); backing off ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1})`
      )
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }
    // Any other status (or exhausted back-off budget) is a hard failure.
    expect(res.status(), `demo login failed: ${await res.text()}`).toBe(200)
  }
}

/** True when a usable shared session has already been persisted by setup. */
export function hasStoredSession(): boolean {
  return fs.existsSync(STORAGE_STATE_PATH) && fs.existsSync(USER_PROFILE_PATH)
}

/** Read the demo user profile saved by the setup project. */
export function loadStoredUser(): AuthedUser {
  return JSON.parse(fs.readFileSync(USER_PROFILE_PATH, 'utf8')) as AuthedUser
}

/**
 * Build an authenticated APIRequestContext + the demo user profile.
 *
 * Fast path: reuse the shared storageState the setup project saved (zero login
 * attempts). Fallback: if no shared state exists (e.g. a single spec run
 * without the setup dependency) do a real rate-limit-aware login so the spec
 * still works standalone.
 *
 * Either way the context carries the browser Origin header so CSRF-guarded
 * mutations succeed.
 */
export async function buildAuthedContext(
  pw: PlaywrightLike
): Promise<{ request: APIRequestContext; user: AuthedUser }> {
  if (hasStoredSession()) {
    const user = loadStoredUser()
    const request = await pw.request.newContext({
      baseURL: E2E_BASE_URL,
      ignoreHTTPSErrors: true,
      storageState: STORAGE_STATE_PATH,
      extraHTTPHeaders: browserOriginHeaders(),
    })
    return { request, user }
  }
  return rateLimitAwareLogin(pw)
}
