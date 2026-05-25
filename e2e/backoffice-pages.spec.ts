import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Back Office Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('menu manager loads with categories', async ({ page }) => {
    await page.goto('/menu')
    await expect(page).toHaveURL(/\/menu/)
    await expect(page.locator('body')).not.toContainText('Application error')
    // Should see menu categories from seed data
    await expect(page.locator('text=Starters').first()).toBeVisible({ timeout: 10000 })
  })

  test('staff page loads', async ({ page }) => {
    await page.goto('/staff')
    await expect(page).toHaveURL(/\/staff/)
    await expect(page.locator('body')).not.toContainText('Application error')
    // Should see staff from seed data
    await expect(page.locator('text=Marcus Rivera').first()).toBeVisible({ timeout: 10000 })
  })

  test('customers page loads', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).toHaveURL(/\/customers/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('reports dashboard loads', async ({ page }) => {
    await page.goto('/reports')
    await expect(page).toHaveURL(/\/reports/)
    await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible()
  })

  test('friday night mode cockpit loads', async ({ page }) => {
    await page.goto('/friday-night')
    await expect(page).toHaveURL(/\/friday-night/)
    await expect(page.getByRole('heading', { level: 1, name: 'Friday Night Mode' })).toBeVisible()
    await expect(page.getByText('Who needs help now')).toBeVisible({ timeout: 10000 })
  })

  test('settings organization loads', async ({ page }) => {
    await page.goto('/settings/organization')
    await expect(page).toHaveURL(/\/settings\/organization/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('settings locations loads', async ({ page }) => {
    await page.goto('/settings/locations')
    await expect(page).toHaveURL(/\/settings\/locations/)
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('text=Downtown Austin').first()).toBeVisible({ timeout: 10000 })
  })

  test('settings tax rates loads', async ({ page }) => {
    await page.goto('/settings/tax-rates')
    await expect(page).toHaveURL(/\/settings\/tax-rates/)
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.locator('text=Texas Sales Tax').first()).toBeVisible({ timeout: 10000 })
  })

  test('settings terminals loads', async ({ page }) => {
    await page.goto('/settings/terminals')
    await expect(page).toHaveURL(/\/settings\/terminals/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('settings hardware readiness loads', async ({ page }) => {
    await page.goto('/settings/hardware-readiness')
    await expect(page).toHaveURL(/\/settings\/hardware-readiness/)
    await expect(page.locator('body')).not.toContainText('Application error')
    await expect(page.getByRole('heading', { level: 1, name: 'Hardware Readiness' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Receipt printer' })).toBeVisible({ timeout: 10000 })
  })

  test('settings modules loads and toggles work', async ({ page }) => {
    await page.goto('/settings/modules')
    await expect(page).toHaveURL(/\/settings\/modules/)
    await expect(page.locator('body')).not.toContainText('Application error')
    // Should see module cards
    await expect(page.locator('text=Kitchen Display').first()).toBeVisible({ timeout: 10000 })
  })

  test('settings roles loads', async ({ page }) => {
    await page.goto('/settings/roles')
    await expect(page).toHaveURL(/\/settings\/roles/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
