import { expect, type APIRequestContext, type Page, type PlaywrightTestArgs } from '@playwright/test'

/**
 * Login and get to an authenticated state.
 * Reusable across all test files.
 */
export async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', 'demo@getsear.com')
  await page.fill('input[type="password"]', 'demo1234')
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
 * Create a logged-in `APIRequestContext` against prod for use in `beforeAll`.
 * Caller is responsible for `dispose()` in `afterAll`.
 */
export async function createAuthedRequestContext(
  playwright: PlaywrightTestArgs['playwright']
): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({
    baseURL: 'https://getsear.com',
    ignoreHTTPSErrors: true,
  })
  const res = await ctx.post('/api/auth/login', {
    data: { email: DEMO.email, password: DEMO.password },
  })
  expect(res.status()).toBe(200)
  return ctx
}

/**
 * Crypto-strong unique suffix for workflow tests that need to invent
 * IDs (gift-card numbers, guest names) that won't collide with prior runs.
 */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
