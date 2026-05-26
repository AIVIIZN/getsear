import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test.describe('V8.3.2 CSRF, auth rate-limit, and security header baseline', () => {
  test('Next config emits a hardened browser security header set', () => {
    const nextConfig = fs.readFileSync('next.config.ts', 'utf8')

    expect(nextConfig).toContain('Content-Security-Policy')
    expect(nextConfig).toContain("frame-ancestors 'none'")
    expect(nextConfig).toContain('X-Frame-Options')
    expect(nextConfig).toContain('X-Content-Type-Options')
    expect(nextConfig).toContain('Referrer-Policy')
    expect(nextConfig).toContain('Cross-Origin-Opener-Policy')
  })

  test('middleware blocks cross-site unsafe API requests before route execution', () => {
    const middleware = fs.readFileSync('src/middleware.ts', 'utf8')

    expect(middleware).toContain('requiresCsrfCheck(request)')
    expect(middleware).toContain('!isSameOrigin(request)')
    expect(middleware).toContain('!hasValidCsrfToken(request)')
    expect(middleware).toContain("code: 'FORBIDDEN'")
    expect(middleware).toContain("'/api/billing/webhook'")
  })

  test('auth logout is covered by the auth rate-limit tier', () => {
    const logoutRoute = fs.readFileSync('src/app/api/auth/logout/route.ts', 'utf8')

    expect(logoutRoute).toContain("checkRateLimit('auth'")
    expect(logoutRoute).toContain('applyRateLimitHeaders')
    expect(logoutRoute).toContain('Retry-After')
  })
})
