import { type APIRequestContext, type Page, type PlaywrightTestArgs } from '@playwright/test'
import { buildAuthedContext, DEMO_EMAIL, DEMO_PASSWORD } from './auth-state'

/**
 * Get to an authenticated page state. Idempotent: when the suite's shared
 * storageState (see auth.setup.ts) is active the page is already logged in, so
 * we just confirm /orders loads and return without touching the rate-limited
 * login form. Falls back to a real form login when no session is present.
 */
export async function login(page: Page) {
  await page.goto('/orders')
  if (/\/orders/.test(page.url())) return
  // Not authenticated (no shared storageState) — do a real form login.
  await page.goto('/login')
  await page.fill('input[type="email"]', DEMO_EMAIL)
  await page.fill('input[type="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/orders/, { timeout: 15000 })
}

/**
 * Demo-tenant constants. Verified 2026-05-03 against prod (https://getsear.com).
 * Workflow tests in `e2e/workflows/` rely on these.
 */
export const DEMO = {
  email: 'demo@getsear.com',
  password: 'demo1234',
  ownerName: 'Marcus Rivera',
  orgId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  /** Downtown Austin (primary). The other two locations are Lakeway B&G + Airport QS. */
  primaryLocationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  taxRate: 0.0825,
} as const

/**
 * Create a logged-in `APIRequestContext` for use in `beforeAll`. Reuses the
 * suite-wide shared session (see auth.setup.ts) so it costs zero login attempts,
 * and carries the browser Origin header so CSRF-guarded mutations succeed.
 * Caller is responsible for `dispose()` in `afterAll`.
 */
export async function createAuthedRequestContext(
  playwright: PlaywrightTestArgs['playwright']
): Promise<APIRequestContext> {
  const { request } = await buildAuthedContext(playwright)
  return request
}

/**
 * Crypto-strong unique suffix for workflow tests that need to invent
 * IDs (gift-card numbers, guest names) that won't collide with prior runs.
 */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
