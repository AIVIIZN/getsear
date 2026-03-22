import { type Page } from '@playwright/test'

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
