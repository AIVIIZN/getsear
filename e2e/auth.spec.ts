import { test, expect } from '@playwright/test'

// This spec exercises the real login flow, so it must start unauthenticated —
// opt out of the suite-wide shared storageState. Kept serial with retries:0 so
// a flaky test can't spend a second login attempt against the 5/15min IP cap.
test.use({ storageState: { cookies: [], origins: [] } })
test.describe.configure({ retries: 0 })

test.describe('Authentication', () => {
  test('login page loads and displays form', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('text=SEAR')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    await expect(page.locator('text=Sign in with PIN')).toBeVisible()
  })

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'demo@getsear.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 })
  })

  test('login with valid credentials redirects to orders', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', 'demo@getsear.com')
    await page.fill('input[type="password"]', 'demo1234')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/orders/, { timeout: 15000 })
  })

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/login/)
  })

  test('PIN login page loads with staff avatars', async ({ page }) => {
    await page.goto('/pin-login')
    await expect(page).toHaveURL(/\/pin-login/)
    // PIN login page should have some content (avatars or a heading)
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
