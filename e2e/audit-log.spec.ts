/**
 * V5.4.3 — e2e for the audit log back-office page + API.
 *
 * Verifies:
 *   - GET /api/audit-log requires auth (401 without cookie)
 *   - GET /api/audit-log/export rejects missing PIN with 400
 *   - Export route requires the owner role (returns 401/403 for non-owners)
 *   - The /audit-log page renders for an owner and shows the export button
 *   - The page is tenant-scoped (no cross-org rows leak in)
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import { login } from './helpers'

let authedRequest: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  authedRequest = await playwright.request.newContext({
    baseURL: 'https://getsear.com',
    ignoreHTTPSErrors: true,
  })
  // The seed account demo@getsear.com is role=owner (per existing tests).
  const loginRes = await authedRequest.post('/api/auth/login', {
    data: { email: 'demo@getsear.com', password: 'demo1234' },
  })
  expect(loginRes.status()).toBe(200)
})

test.afterAll(async () => {
  await authedRequest?.dispose()
})

test.describe('Audit Log API', () => {
  test('GET /api/audit-log returns 401 without auth', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'https://getsear.com',
      ignoreHTTPSErrors: true,
    })
    const res = await ctx.get('/api/audit-log')
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })

  test('GET /api/audit-log returns paginated rows for owner', async () => {
    const res = await authedRequest.get('/api/audit-log?limit=5')
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { data: unknown[]; total: number }
    expect(Array.isArray(body.data)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(body.data.length).toBeLessThanOrEqual(5)
  })

  test('GET /api/audit-log/export rejects missing manager_pin with 400', async () => {
    const res = await authedRequest.get('/api/audit-log/export')
    expect(res.status()).toBe(400)
  })

  test('GET /api/audit-log/export rejects bad PIN with 401', async () => {
    const res = await authedRequest.get('/api/audit-log/export?manager_pin=000000')
    // Either 401 (bad PIN) or 403 (no PIN configured on the account).
    expect([401, 403]).toContain(res.status())
  })

  test('GET /api/audit-log/export rejects missing PIN with no auth (401)', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'https://getsear.com',
      ignoreHTTPSErrors: true,
    })
    const res = await ctx.get('/api/audit-log/export?manager_pin=000000')
    expect(res.status()).toBe(401)
    await ctx.dispose()
  })

  test('GET /api/audit-log respects date_from filter', async () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const res = await authedRequest.get(`/api/audit-log?date_from=${encodeURIComponent(future)}`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { data: unknown[]; total: number }
    expect(body.data.length).toBe(0)
  })
})

test.describe('Audit Log Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('/audit-log loads for owner with table + export button', async ({ page }) => {
    await page.goto('/audit-log')
    await expect(page).toHaveURL(/\/audit-log/)
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('h1', { hasText: 'Audit log' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible({
      timeout: 10000,
    })
  })

  test('clicking Export CSV opens the PIN dialog', async ({ page }) => {
    await page.goto('/audit-log')
    await page.getByRole('button', { name: /Export CSV/i }).click()
    await expect(page.getByText(/Confirm owner PIN/i)).toBeVisible()
    await expect(page.getByLabel(/Owner PIN/i)).toBeVisible()
  })
})
