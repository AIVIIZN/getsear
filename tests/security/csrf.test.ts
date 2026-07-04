import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import {
  CSRF_COOKIE,
  isCsrfBlocked,
  isSameOrigin,
  requiresCsrfCheck,
  resolveExternalOrigin,
} from '@/lib/security/csrf'

/**
 * Build a NextRequest as it would arrive at the edge middleware. `url` is the
 * URL Next.js reconstructs from the incoming request — behind nginx (TLS
 * terminated) this is the internal `http://` origin, NOT the public https one.
 */
function makeRequest(opts: {
  url: string
  method?: string
  headers?: Record<string, string>
  cookies?: Record<string, string>
}): NextRequest {
  const headers = new Headers(opts.headers ?? {})
  if (opts.cookies) {
    const cookie = Object.entries(opts.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    headers.set('cookie', cookie)
  }
  return new NextRequest(opts.url, { method: opts.method ?? 'GET', headers })
}

const PUBLIC = 'https://getsear.com'
// Behind nginx the app sees an internal http origin.
const INTERNAL = 'http://10.128.0.5:3000'

describe('resolveExternalOrigin', () => {
  it('reconstructs the public https origin from proxy headers', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      headers: {
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(resolveExternalOrigin(req)).toBe(PUBLIC)
  })

  it('takes the first value of comma-joined forwarded headers', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      headers: {
        'x-forwarded-proto': 'https, http',
        'x-forwarded-host': 'getsear.com, internal',
      },
    })
    expect(resolveExternalOrigin(req)).toBe(PUBLIC)
  })

  it('falls back to the raw origin with no proxy headers (local dev)', () => {
    const req = makeRequest({ url: 'http://localhost:3000/api/orders' })
    expect(resolveExternalOrigin(req)).toBe('http://localhost:3000')
  })
})

describe('isSameOrigin behind a TLS-terminating proxy', () => {
  it('THE BUG FIX: accepts a browser Origin that matches the forwarded host', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/auth/login`,
      method: 'POST',
      headers: {
        origin: PUBLIC,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(isSameOrigin(req)).toBe(true)
  })

  it('rejects a genuine cross-site origin even with proxy headers', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/auth/login`,
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(isSameOrigin(req)).toBe(false)
  })

  it('accepts a same-origin Referer when Origin is absent', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      method: 'POST',
      headers: {
        referer: `${PUBLIC}/pos`,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(isSameOrigin(req)).toBe(true)
  })

  it('rejects when neither Origin nor Referer is present', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      method: 'POST',
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'getsear.com' },
    })
    expect(isSameOrigin(req)).toBe(false)
  })

  it('still works in local dev (no proxy headers, direct origin match)', () => {
    const req = makeRequest({
      url: 'http://localhost:3000/api/orders',
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    expect(isSameOrigin(req)).toBe(true)
  })
})

describe('requiresCsrfCheck', () => {
  it('is true for a mutating API route', () => {
    expect(
      requiresCsrfCheck(makeRequest({ url: `${INTERNAL}/api/orders`, method: 'POST' })),
    ).toBe(true)
  })

  it('is false for safe methods', () => {
    expect(
      requiresCsrfCheck(makeRequest({ url: `${INTERNAL}/api/orders`, method: 'GET' })),
    ).toBe(false)
  })

  it('is false for non-API routes', () => {
    expect(
      requiresCsrfCheck(makeRequest({ url: `${INTERNAL}/login`, method: 'POST' })),
    ).toBe(false)
  })

  it('exempts webhook routes called by external systems', () => {
    expect(
      requiresCsrfCheck(
        makeRequest({ url: `${INTERNAL}/api/billing/webhook`, method: 'POST' }),
      ),
    ).toBe(false)
  })
})

describe('isCsrfBlocked — end-to-end middleware decision', () => {
  it('BEFORE-FIX SCENARIO now passes: browser login POST behind nginx is allowed', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/auth/login`,
      method: 'POST',
      headers: {
        origin: PUBLIC,
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(isCsrfBlocked(req)).toBe(false)
  })

  it('blocks a cross-site mutation with no token', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
      },
    })
    expect(isCsrfBlocked(req)).toBe(true)
  })

  it('allows a cross-site request that presents a valid double-submit token', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'getsear.com',
        'x-csrf-token': 'abc123',
      },
      cookies: { [CSRF_COOKIE]: 'abc123' },
    })
    // Token matches cookie -> allowed (double-submit is honoured).
    expect(isCsrfBlocked(req)).toBe(false)
  })

  it('blocks when the header token does not match the cookie token', () => {
    const req = makeRequest({
      url: `${INTERNAL}/api/orders`,
      method: 'POST',
      headers: {
        origin: 'https://evil.example.com',
        'x-csrf-token': 'attacker-guess',
      },
      cookies: { [CSRF_COOKIE]: 'real-secret' },
    })
    expect(isCsrfBlocked(req)).toBe(true)
  })

  it('never blocks a safe GET', () => {
    const req = makeRequest({ url: `${INTERNAL}/api/orders`, method: 'GET' })
    expect(isCsrfBlocked(req)).toBe(false)
  })
})
