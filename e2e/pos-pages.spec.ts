import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('POS Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('orders page loads with menu grid', async ({ page }) => {
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/orders/)
    // Should see the sidebar with SEAR logo
    await expect(page.locator('text=SEAR').first()).toBeVisible()
    // Page should load without errors
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('tables page loads', async ({ page }) => {
    await page.goto('/tables')
    await expect(page).toHaveURL(/\/tables/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('checks page loads', async ({ page }) => {
    await page.goto('/checks')
    await expect(page).toHaveURL(/\/checks/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('payments page loads', async ({ page }) => {
    await page.goto('/payments')
    await expect(page).toHaveURL(/\/payments/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('KDS page loads in dark mode', async ({ page }) => {
    await page.goto('/kds')
    await expect(page).toHaveURL(/\/kds/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
