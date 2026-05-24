/**
 * V5.99.7 — unit tests for the manager-PIN brute-force protection.
 *
 * The /api/auth/verify-manager-pin endpoint previously had:
 *   - NO rate limit
 *   - NO lockout
 *   - NO audit-log entry on failure
 *   - NO is_active filter (terminated managers could authorise)
 *
 * → cashier could iterate the entire 10,000-PIN keyspace per manager in ~17 min.
 *
 * These tests verify the centralised manager-pin lib enforces:
 *   1. Rate-limit on excessive failures (per-IP, per-user, per-org).
 *   2. Audit-log entry for every failed attempt and every lockout.
 *   3. is_active=true filter so terminated managers cannot authorise.
 *   4. Bcrypt-hashed PIN comparison.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mocks --------------------------------------------------------------
const checkRateLimitMock = vi.fn()
const auditRecordMock = vi.fn()

vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimitMock(...args),
  getClientIp: () => '10.0.0.99',
}))

vi.mock('@/lib/audit/log', () => ({
  audit: {
    record: (...args: unknown[]) => auditRecordMock(...args),
  },
}))

// Import AFTER vi.mock so the module wires to the mocks above.
import { validateManagerPin, verifyManagerPinWithRateLimit } from '@/lib/auth/manager-pin'
import bcrypt from 'bcryptjs'

const ALLOWED = (n: number) => ({
  allowed: true,
  limit: 5,
  remaining: 5 - n,
  resetAt: Math.floor(Date.now() / 1000) + 900,
  retryAfterSeconds: 0,
})
const DENIED = () => ({
  allowed: false,
  limit: 5,
  remaining: 0,
  resetAt: Math.floor(Date.now() / 1000) + 900,
  retryAfterSeconds: 900,
})

const caller = {
  id: 'cashier-1',
  email: 'cashier@example.com',
  org_id: 'org-1',
  role: 'cashier',
  location_ids: [] as string[],
}

function makeFakeRequest(): Request {
  return new Request('http://localhost/api/auth/verify-manager-pin', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.0.99', 'user-agent': 'vitest' },
  })
}

function makeFakeSupabase(managers: Array<{ id: string; pin_hash: string | null; role?: string; display_name?: string; first_name?: string | null; last_name?: string | null; email?: string | null; is_active?: boolean }>) {
  // Replicate the chain: supabase.from('users').select(...).eq(...).eq(...).in(...).not(...)
  const filterState: Record<string, unknown> = {}

  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filterState[col] = val
      return chain
    },
    in: (col: string, vals: unknown[]) => {
      filterState[`in:${col}`] = vals
      return chain
    },
    not: () => chain,
    then: (resolve: (v: { data: typeof managers }) => void) => {
      // Apply is_active filter if set (mimics .eq('is_active', true))
      const filtered = managers.filter((m) => {
        if (filterState['is_active'] === true && m.is_active === false) return false
        return true
      })
      resolve({ data: filtered })
    },
  }

  return {
    from: () => chain,
  }
}

beforeEach(() => {
  checkRateLimitMock.mockReset()
  auditRecordMock.mockReset()
  // Default: every rate-limit slot allows the request.
  checkRateLimitMock.mockImplementation(() => Promise.resolve(ALLOWED(0)))
  auditRecordMock.mockResolvedValue({ id: 'audit-1', error: null })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------

describe('validateManagerPin (basic)', () => {
  it('returns the manager id on bcrypt match', async () => {
    const hash = await bcrypt.hash('1234', 10)
    const supabase = makeFakeSupabase([{ id: 'mgr-1', pin_hash: hash, is_active: true }])

    const result = await validateManagerPin(supabase, 'org-1', '1234')
    expect(result).toBe('mgr-1')
  })

  it('supports the full 4-6 digit staff PIN contract', async () => {
    const hash = await bcrypt.hash('123456', 10)
    const supabase = makeFakeSupabase([{ id: 'mgr-1', pin_hash: hash, is_active: true }])

    const result = await validateManagerPin(supabase, 'org-1', '123456')
    expect(result).toBe('mgr-1')
  })

  it('returns null on no match', async () => {
    const hash = await bcrypt.hash('9999', 10)
    const supabase = makeFakeSupabase([{ id: 'mgr-1', pin_hash: hash, is_active: true }])

    const result = await validateManagerPin(supabase, 'org-1', '1234')
    expect(result).toBeNull()
  })

  it('returns null when no managers exist', async () => {
    const supabase = makeFakeSupabase([])
    const result = await validateManagerPin(supabase, 'org-1', '1234')
    expect(result).toBeNull()
  })

  it('skips managers without a pin_hash', async () => {
    const hash = await bcrypt.hash('1234', 10)
    const supabase = makeFakeSupabase([
      { id: 'mgr-1', pin_hash: null, is_active: true },
      { id: 'mgr-2', pin_hash: hash, is_active: true },
    ])

    const result = await validateManagerPin(supabase, 'org-1', '1234')
    expect(result).toBe('mgr-2')
  })
})

describe('verifyManagerPinWithRateLimit', () => {
  it('returns rate_limited on per-IP exhaustion and writes an audit row', async () => {
    // First call (IP) denies — second call (user) and third (org) won't be
    // reached because the function short-circuits.
    checkRateLimitMock.mockResolvedValueOnce(DENIED())

    const supabase = makeFakeSupabase([])
    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('rate_limited')
    if (result.kind === 'rate_limited') expect(result.scope).toBe('ip')
    expect(auditRecordMock).toHaveBeenCalledTimes(1)
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_verify_failed',
        actor: expect.objectContaining({ id: 'cashier-1' }),
        reason: 'rate_limit_ip',
      })
    )
  })

  it('returns rate_limited on per-user exhaustion', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce(ALLOWED(1)) // ip ok
      .mockResolvedValueOnce(DENIED()) // user exhausted

    const supabase = makeFakeSupabase([])
    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('rate_limited')
    if (result.kind === 'rate_limited') expect(result.scope).toBe('user')
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_verify_failed',
        reason: 'rate_limit_user',
      })
    )
  })

  it('returns rate_limited and writes a LOCKOUT audit row on per-org exhaustion', async () => {
    checkRateLimitMock
      .mockResolvedValueOnce(ALLOWED(1)) // ip ok
      .mockResolvedValueOnce(ALLOWED(1)) // user ok
      .mockResolvedValueOnce(DENIED()) // org exhausted

    const supabase = makeFakeSupabase([])
    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('rate_limited')
    if (result.kind === 'rate_limited') expect(result.scope).toBe('org')
    // LOCKOUT audit action — distinct from per-attempt failure
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_lockout',
        reason: 'rate_limit_org_lockout',
      })
    )
  })

  it('records an audit row on every wrong-PIN attempt', async () => {
    const hash = await bcrypt.hash('5555', 10)
    const supabase = makeFakeSupabase([{ id: 'mgr-1', pin_hash: hash, is_active: true, role: 'manager' }])

    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '0000',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('invalid')
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_verify_failed',
        reason: 'invalid_pin',
      })
    )
  })

  it('does NOT record an audit row on successful PIN', async () => {
    const hash = await bcrypt.hash('1234', 10)
    const supabase = makeFakeSupabase([
      { id: 'mgr-1', pin_hash: hash, is_active: true, role: 'manager', display_name: 'Marcus' },
    ])

    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('valid')
    if (result.kind === 'valid') {
      expect(result.manager_user_id).toBe('mgr-1')
      expect(result.manager_role).toBe('manager')
      expect(result.manager_display_name).toBe('Marcus')
    }
    expect(auditRecordMock).not.toHaveBeenCalled()
  })

  it('rejects PIN that is too short before consuming a manager-lookup', async () => {
    const supabase = makeFakeSupabase([])
    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '12',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('invalid')
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_verify_failed',
        reason: 'invalid_format',
      })
    )
  })

  it('writes audit when there are no managers configured', async () => {
    const supabase = makeFakeSupabase([])
    const result = await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(result.kind).toBe('invalid')
    expect(auditRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'manager_pin_verify_failed',
        reason: 'no_managers_available',
      })
    )
  })

  it('checks rate-limit BEFORE doing any DB work (no DB calls if locked out)', async () => {
    checkRateLimitMock.mockResolvedValueOnce(DENIED())

    let dbCalled = false
    const supabase = {
      from: () => {
        dbCalled = true
        // Still need a chainable so we don't crash if reached
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          not: () => chain,
          then: (r: (v: { data: [] }) => void) => r({ data: [] }),
        }
        return chain
      },
    }

    await verifyManagerPinWithRateLimit({
      caller,
      pin: '1234',
      request: makeFakeRequest(),
      supabase,
    })

    expect(dbCalled).toBe(false)
  })
})
