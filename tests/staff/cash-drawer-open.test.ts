/**
 * RK-0001 — regression tests for the Cash Drawers "Open Drawer" fix.
 *
 * The bug: the CashDrawerDetail client hardcoded `assigned_to: 'current-user'`,
 * a non-UUID literal. The open route's Zod schema requires
 * `assigned_to: z.string().uuid()`, so every open attempt failed with HTTP 400
 * "Validation failed" and no drawer could ever be opened.
 *
 * These tests prove:
 *   1. The real open-route handler rejects the old `'current-user'` literal (400).
 *   2. The real open-route handler accepts an authenticated user's UUID (200)
 *      and writes it to `opened_by` (which the API serialises back as
 *      `assigned_to`).
 *   3. Already-open drawers still return 409 (regression check on the guard).
 *   4. The client component sends `user.id`, not a literal (source guard —
 *      no jsdom in this test env, so the payload contract is asserted statically).
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks --------------------------------------------------------------
const getAuthUserMock = vi.fn()
const requireRoleMock = vi.fn()

vi.mock('@/lib/api/auth', () => ({
  getAuthUser: () => getAuthUserMock(),
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}))

// Chainable Supabase mock. `single()` shifts results off a per-table queue so
// the same builder can serve the initial SELECT then the UPDATE...SELECT.
let drawerResults: Array<{ data: unknown; error?: unknown }>
const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }))

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.insert = insertMock
  builder.single = vi.fn(() => {
    if (table === 'cash_drawers') {
      return Promise.resolve(drawerResults.shift() ?? { data: null })
    }
    return Promise.resolve({ data: null })
  })
  return builder
}

const mockDb = { from: vi.fn((table: string) => makeBuilder(table)) }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockDb,
}))

import { POST } from '@/app/api/staff/cash-drawers/[id]/open/route'

const USER = { id: '98a8e291-d5eb-44a1-abd1-ab9e92cfc139', org_id: 'org-1', role: 'manager' }
const DRAWER_ID = '331110c2-3e37-4166-a868-a28899156609'

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/staff/cash-drawers/${DRAWER_ID}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
}

const params = { params: Promise.resolve({ id: DRAWER_ID }) }

beforeEach(() => {
  getAuthUserMock.mockResolvedValue(USER)
  requireRoleMock.mockReturnValue(null)
  drawerResults = []
  insertMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/staff/cash-drawers/[id]/open', () => {
  it('rejects the legacy non-UUID "current-user" literal with 400 Validation failed', async () => {
    // The closed drawer would be here, but validation must fail before any DB read.
    drawerResults = [{ data: { id: DRAWER_ID, is_open: false } }]

    const res = await POST(
      makeRequest({ assigned_to: 'current-user', starting_cash: '200.00', denominations: { hundred: 2 } }),
      params,
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Validation failed')
  })

  it('accepts an authenticated user UUID and writes it to opened_by (200)', async () => {
    drawerResults = [
      { data: { id: DRAWER_ID, is_open: false } }, // initial SELECT
      { data: { id: DRAWER_ID, is_open: true, opened_by: USER.id, expected_cash: '200.00' } }, // UPDATE...SELECT
    ]

    const res = await POST(
      makeRequest({ assigned_to: USER.id, starting_cash: '200.00', denominations: { hundred: 2 } }),
      params,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_open).toBe(true)
    expect(body.data.opened_by).toBe(USER.id)

    // Confirm the UPDATE carried the real UUID into opened_by, not a literal.
    const drawerBuilder = mockDb.from.mock.results
      .map((r) => r.value)
      .find((b) => (b.update as ReturnType<typeof vi.fn>).mock.calls.length > 0)
    const updatePayload = (drawerBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload.opened_by).toBe(USER.id)
    expect(updatePayload.opened_by).not.toBe('current-user')
  })

  it('returns 409 when the drawer is already open (guard regression)', async () => {
    drawerResults = [{ data: { id: DRAWER_ID, is_open: true } }]

    const res = await POST(
      makeRequest({ assigned_to: USER.id, starting_cash: '200.00', denominations: { hundred: 2 } }),
      params,
    )

    expect(res.status).toBe(409)
  })
})

describe('CashDrawerDetail open payload (source contract)', () => {
  const source = readFileSync(
    path.join(process.cwd(), 'src/components/staff/CashDrawerDetail.tsx'),
    'utf8',
  )

  it('no longer sends the hardcoded "current-user" literal', () => {
    expect(source).not.toContain("assigned_to: 'current-user'")
  })

  it('sends the authenticated user id and disables open when signed out', () => {
    expect(source).toContain('assigned_to: user.id')
    expect(source).toContain('useAuthStore')
    expect(source).toContain('disabled={saving || !user}')
  })
})
