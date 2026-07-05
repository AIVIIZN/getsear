/**
 * RK-0004 — single shared login for the whole e2e suite.
 *
 * Runs as the `setup` Playwright project (a dependency of `chromium`). It logs
 * in ONCE, persists the browser storageState + demo user profile under
 * e2e/.auth/, and every other spec reuses that session instead of hammering the
 * 5/15min-rate-limited /api/auth/login endpoint. If a still-valid session is
 * already on disk it is reused so iterative runs cost zero login attempts.
 */
import { test as setup, expect } from '@playwright/test'
import fs from 'node:fs'
import {
  AUTH_DIR,
  STORAGE_STATE_PATH,
  USER_PROFILE_PATH,
  E2E_BASE_URL,
  browserOriginHeaders,
  hasStoredSession,
  rateLimitAwareLogin,
} from './auth-state'

setup('authenticate once for the whole suite', async ({ playwright }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  // Reuse a still-valid session so re-runs don't burn login attempts.
  if (hasStoredSession()) {
    const probe = await playwright.request.newContext({
      baseURL: E2E_BASE_URL,
      ignoreHTTPSErrors: true,
      storageState: STORAGE_STATE_PATH,
      extraHTTPHeaders: browserOriginHeaders(),
    })
    const res = await probe.get('/api/menu/items')
    await probe.dispose()
    if (res.status() === 200) return
  }

  const { request, user } = await rateLimitAwareLogin(playwright, { maxWaitMs: 120_000 })
  expect(user.org_id, 'demo login should return an org_id').toBeTruthy()
  expect(
    user.location_ids.length,
    'demo user should have at least one location'
  ).toBeGreaterThanOrEqual(1)

  await request.storageState({ path: STORAGE_STATE_PATH })
  fs.writeFileSync(USER_PROFILE_PATH, JSON.stringify(user, null, 2))
  await request.dispose()
})
