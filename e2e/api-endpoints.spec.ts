import { test, expect, type APIRequestContext } from '@playwright/test'

// Use a shared storage state approach — login once, share cookies
let authedRequest: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  // Create a request context and login
  authedRequest = await playwright.request.newContext({
    baseURL: 'https://getsear.com',
    ignoreHTTPSErrors: true,
  })

  const loginRes = await authedRequest.post('/api/auth/login', {
    data: { email: 'demo@getsear.com', password: 'demo1234' },
  })
  expect(loginRes.status()).toBe(200)
  const loginData = await loginRes.json()
  expect(loginData.user.display_name).toBe('Marcus Rivera')
})

test.afterAll(async () => {
  await authedRequest?.dispose()
})

test.describe('API - Auth', () => {
  test('login succeeds with valid creds', async () => {
    const res = await authedRequest.post('/api/auth/login', {
      data: { email: 'demo@getsear.com', password: 'demo1234' },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.user.email).toBe('demo@getsear.com')
    expect(data.user.role).toBe('owner')
    expect(data.user.org_id).toBeTruthy()
    expect(data.user.location_ids).toHaveLength(1)
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
  test('staff returns 7', async () => {
    const res = await authedRequest.get('/api/staff')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(7)
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

  test('locations returns 1', async () => {
    const res = await authedRequest.get('/api/settings/locations')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].name).toBe('Downtown Austin')
  })

  test('tax-rates returns 1', async () => {
    const res = await authedRequest.get('/api/settings/tax-rates')
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.data).toHaveLength(1)
    expect(data.data[0].rate).toBe(8.25)
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
