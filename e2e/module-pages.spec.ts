import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Module Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('online ordering page loads', async ({ page }) => {
    await page.goto('/online-ordering')
    await expect(page).toHaveURL(/\/online-ordering/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('loyalty page loads', async ({ page }) => {
    await page.goto('/loyalty')
    await expect(page).toHaveURL(/\/loyalty/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('reservations page loads', async ({ page }) => {
    await page.goto('/reservations')
    await expect(page).toHaveURL(/\/reservations/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('house accounts page loads', async ({ page }) => {
    await page.goto('/house-accounts')
    await expect(page).toHaveURL(/\/house-accounts/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('inventory page loads', async ({ page }) => {
    await page.goto('/inventory')
    await expect(page).toHaveURL(/\/inventory/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('scheduling page loads', async ({ page }) => {
    await page.goto('/scheduling')
    await expect(page).toHaveURL(/\/scheduling/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('delivery page loads', async ({ page }) => {
    await page.goto('/delivery')
    await expect(page).toHaveURL(/\/delivery/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('marketing page loads', async ({ page }) => {
    await page.goto('/marketing')
    await expect(page).toHaveURL(/\/marketing/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('catering page loads', async ({ page }) => {
    await page.goto('/catering')
    await expect(page).toHaveURL(/\/catering/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('drive-thru page loads', async ({ page }) => {
    await page.goto('/drive-thru')
    await expect(page).toHaveURL(/\/drive-thru/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('franchise page loads', async ({ page }) => {
    await page.goto('/franchise')
    await expect(page).toHaveURL(/\/franchise/)
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})
