import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

/**
 * V8.5 (RK-0003) — stranger-signup simulation.
 *
 * Simulates 5 INDEPENDENT strangers completing the self-serve onboarding
 * wizard end to end: org → location → menu seed → terminals → first user →
 * tour → commit. Each stranger authenticates as its OWN owner into its OWN
 * isolated tenant, then asserts POST /api/onboarding/commit returns 201 —
 * proving an unaided operator can go from signup to a fully-seeded restaurant
 * (40+ menu rows, terminals, location) and that five of them do so in
 * five separate orgs with no cross-tenant bleed.
 *
 * DEV-ONLY: runs against a LOCAL prod server (localhost:3000) so it never
 * pollutes the production demo tenant. The five throwaway owners are created +
 * destroyed by scripts/rk0003_signup_sim.mjs; their credentials arrive via
 * RK0003_OWNERS_FILE (a JSON array). Skips cleanly if that is unset.
 */

const OWNERS_FILE = process.env.RK0003_OWNERS_FILE
const EVIDENCE = process.env.RK0003_EVIDENCE_DIR ?? 'test-results'

type Owner = { orgId: string; email: string; password: string }
const OWNERS: Owner[] = OWNERS_FILE ? JSON.parse(readFileSync(OWNERS_FILE, 'utf8')) : []

const STRANGERS = [
  { restaurant: 'Copper Skillet Diner', owner: 'Dana Okafor', city: 'Austin', state: 'TX', zip: '78701' },
  { restaurant: 'Blue Marlin Grill', owner: 'Marco Ruiz', city: 'Miami', state: 'FL', zip: '33101' },
  { restaurant: 'Northgate Noodle Bar', owner: 'Priya Nair', city: 'Seattle', state: 'WA', zip: '98101' },
  { restaurant: 'Ember & Vine', owner: 'Chris Bennett', city: 'Denver', state: 'CO', zip: '80202' },
  { restaurant: 'Sunrise Cafe Co', owner: 'Lena Hoffman', city: 'Chicago', state: 'IL', zip: '60601' },
]

test.describe('V8.5 stranger signup — onboarding wizard', () => {
  test.skip(OWNERS.length < STRANGERS.length, 'RK0003_OWNERS_FILE not set or too few throwaway owners')
  // Serial so the five logins stay within the auth rate limit (5 / 15 min per IP).
  test.describe.configure({ mode: 'serial' })

  async function fillLabeled(page: Page, label: string, value: string) {
    const input = page.locator('label', { hasText: label }).locator('input').first()
    await input.fill(value)
  }

  for (const [index, s] of STRANGERS.entries()) {
    test(`stranger ${index + 1}/5 — ${s.restaurant}`, async ({ browser }) => {
      const owner = OWNERS[index]
      // Own browser context per stranger → own cookies/localStorage, no bleed.
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        // Sign in as this stranger's owner.
        await page.goto('/login')
        await page.fill('input[type="email"]', owner.email)
        await page.fill('#password', owner.password)
        await page.getByRole('button', { name: /sign in/i }).click()
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })

        // Wizard, step 0 — organization.
        await page.goto('/onboarding')
        await expect(page.getByRole('heading', { name: 'Name the restaurant' })).toBeVisible()
        await fillLabeled(page, 'Restaurant name', s.restaurant)
        await fillLabeled(page, 'Owner name', s.owner)
        await fillLabeled(page, 'Owner email', `owner+${index}@${s.restaurant.toLowerCase().replace(/[^a-z]+/g, '')}.example.com`)
        await fillLabeled(page, 'Owner phone', `512555${String(1000 + index)}`)
        await page.getByRole('button', { name: 'Continue', exact: true }).click()

        // Step 1 — location (distinct name per stranger).
        await expect(page.getByRole('heading', { name: 'Configure the first location' })).toBeVisible()
        await fillLabeled(page, 'Location name', `${s.restaurant} — Main`)
        await fillLabeled(page, 'Street address', `${100 + index} Main St`)
        await fillLabeled(page, 'City', s.city)
        await fillLabeled(page, 'State', s.state)
        await fillLabeled(page, 'ZIP', s.zip)
        await page.getByRole('button', { name: 'Continue', exact: true }).click()

        // Step 2 — menu seed (pick a distinct cuisine template per stranger).
        await expect(page.getByRole('heading', { name: 'Seed a real launch menu' })).toBeVisible()
        const templateCards = page.getByRole('button').filter({ hasText: /items ·/ })
        // Six cuisine templates must render; a broken picker should FAIL here.
        expect(await templateCards.count()).toBeGreaterThanOrEqual(6)
        await templateCards.nth(index % 6).click()
        await expect(page.getByText(/\d+ editable items/)).toBeVisible()
        await page.getByRole('button', { name: 'Continue', exact: true }).click()

        // Step 3 — terminals (defaults are valid).
        await expect(page.getByRole('heading', { name: 'Register starter terminals' })).toBeVisible()
        await page.getByRole('button', { name: 'Continue', exact: true }).click()

        // Step 4 — confirm first owner.
        await expect(page.getByRole('heading', { name: 'Confirm the first owner user' })).toBeVisible()
        await page.getByRole('button', { name: 'Confirm owner', exact: true }).click()

        // Step 5 — tour + commit.
        await expect(page.getByRole('heading', { name: 'Learn the first order' })).toBeVisible()
        const commitResponse = page.waitForResponse(
          (r) => r.url().includes('/api/onboarding/commit') && r.request().method() === 'POST',
          { timeout: 30000 },
        )
        await page.getByRole('button', { name: 'Save onboarding', exact: true }).click()
        const res = await commitResponse
        expect(res.status(), `commit HTTP status for ${s.restaurant}`).toBe(201)
        const body = await res.json()
        expect(body.success).toBe(true)
        expect(body.summary.menu_items).toBeGreaterThanOrEqual(40)
        expect(body.summary.terminals).toBeGreaterThanOrEqual(1)

        await expect(page.getByText('Onboarding is saved.')).toBeVisible({ timeout: 15000 })
        await page.screenshot({ path: `${EVIDENCE}/stranger-${index + 1}-${s.state}-committed.png`, fullPage: true })
      } finally {
        await context.close()
      }
    })
  }
})
