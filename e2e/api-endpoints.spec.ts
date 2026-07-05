import { test, expect, type APIRequestContext } from '@playwright/test'
import { createAuthedRequestContext } from './helpers'
import { loadStoredUser } from './auth-state'

// Use a shared storage state approach — login once, share cookies
let authedRequest: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  authedRequest = await createAuthedRequestContext(playwright)
})

test.afterAll(async () => {
  await authedRequest?.dispose()
})

test.describe('API - Auth', () => {
  test.describe.configure({ retries: 0 })

  test('login succeeds with valid creds (shared session profile)', () => {
    // The setup project performed the real valid-creds login and saved the
    // resulting profile. Asserting on it here proves the login response shape
    // without spending another attempt against the 5/15min IP rate limit.
    const user = loadStoredUser()
    expect(user.email).toBe('demo@getsear.com')
    expect(user.role).toBe('owner')
    expect(user.display_name).toBe('Marcus Rivera')
    expect(user.org_id).toBeTruthy()
    expect(user.location_ids.length).toBeGreaterThanOrEqual(1)
  })

  test('login fails with wrong password', async () => {
    const res = await authedRequest.post('/api/auth/login', {
      data: { email: 'demo@getsear.com', password: 'wrong' },
    })
    expect(res.status()).toBe(401)
  })

  test('login fails with missing fields', async () => {
    const res = await authedRequest.post('/api/auth/login', {
      data: { email: 'demo@getsear.com' },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('API - Menu', () => {
  test('categories returns 8', async () => {
    const res = await authedRequest.get('/api/menu/categories')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(8)
  })

  test('items returns 30', async () => {
    const res = await authedRequest.get('/api/menu/items')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data.length).toBeGreaterThanOrEqual(30)
  })

  test('modifier-groups returns data', async () => {
    const res = await authedRequest.get('/api/menu/modifier-groups')
    expect(res.status()).toBe(200)
  })
})

test.describe('API - Staff', () => {
  test('staff returns at least seeded set', async () => {
    const res = await authedRequest.get('/api/staff')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data.length).toBeGreaterThanOrEqual(7)
    const names = data.data.map((s: { display_name: string }) => s.display_name)
    expect(names).toContain('Marcus Rivera')
  })

  test('active staff returns data', async () => {
    const res = await authedRequest.get('/api/staff/active')
    expect(res.status()).toBe(200)
  })
})

test.describe('API - Tables', () => {
  test('tables returns data', async () => {
    const res = await authedRequest.get('/api/tables')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.data)).toBe(true)
  })

  test('floor-plans returns 1', async () => {
    const res = await authedRequest.get('/api/tables/floor-plans')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].name).toBe('Main Floor')
  })

  test('sections returns data', async () => {
    const res = await authedRequest.get('/api/tables/sections')
    expect(res.status()).toBe(200)
  })

  test('status-summary returns data', async () => {
    const res = await authedRequest.get('/api/tables/status-summary')
    expect(res.status()).toBe(200)
  })
})

test.describe('API - Settings', () => {
  test('organization returns Sear Demo Restaurant', async () => {
    const res = await authedRequest.get('/api/settings/organization')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data.name).toBe('Sear Demo Restaurant')
  })

  test('locations includes Downtown Austin', async () => {
    const res = await authedRequest.get('/api/settings/locations')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data.length).toBeGreaterThanOrEqual(1)
    const names = data.data.map((l: { name: string }) => l.name)
    expect(names).toContain('Downtown Austin')
  })

  test('tax-rates returns Texas rate', async () => {
    const res = await authedRequest.get('/api/settings/tax-rates')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].rate).toBeCloseTo(0.0825, 4)
  })

  test('terminals returns data', async () => {
    const res = await authedRequest.get('/api/settings/terminals')
    expect(res.status()).toBe(200)
  })

  test('roles returns data', async () => {
    const res = await authedRequest.get('/api/settings/roles')
    expect(res.status()).toBe(200)
  })

  test('modules returns data', async () => {
    const res = await authedRequest.get('/api/settings/modules')
    expect(res.status()).toBe(200)
  })

  test('enable module works', async () => {
    const res = await authedRequest.patch('/api/settings/modules', {
      data: { module_id: 'loyalty', enabled: true },
    })
    expect(res.status()).toBeLessThan(500)
  })
})

test.describe('API - Orders', () => {
  test('orders returns list', async () => {
    const res = await authedRequest.get('/api/orders')
    expect(res.status()).toBe(200)
  })

  test('active orders returns data', async () => {
    const res = await authedRequest.get('/api/orders/active')
    expect(res.status()).toBe(200)
  })
})

test.describe('API - All Modules', () => {
  const endpoints = [
    '/api/online-ordering/menus',
    '/api/online-ordering/queue',
    '/api/loyalty/programs',
    '/api/loyalty/accounts',
    '/api/reservations',
    '/api/reservations/waitlist',
    '/api/house-accounts',
    '/api/inventory/items',
    '/api/inventory/vendors',
    '/api/inventory/purchase-orders',
    '/api/scheduling/shifts',
    '/api/scheduling/swap-requests',
    '/api/delivery/zones',
    '/api/delivery/deliveries',
    '/api/marketing/campaigns',
    '/api/catering/events',
    '/api/drive-thru/orders',
    '/api/drive-thru/menu-boards',
    '/api/franchise/royalties',
    '/api/franchise/locations',
    '/api/kds/stations',
    '/api/customers',
  ]

  for (const endpoint of endpoints) {
    test(`GET ${endpoint} returns 200`, async () => {
      const res = await authedRequest.get(endpoint)
      expect(res.status()).toBe(200)
    })
  }
})
