import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { applyRateLimitHeaders, checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { log } from '@/lib/observability/logger'
import { recordRumMetric } from '@/lib/observability/rum-store'

const rumSchema = z.object({
  name: z.enum(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']),
  value: z.number().finite().nonnegative().max(600_000),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  route: z.string().max(500),
  href: z.string().max(2000),
  ts: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  const rateLimit = await checkRateLimit('public', `rum:${getClientIp(req)}`)
  if (!rateLimit.allowed) {
    const res = new NextResponse(null, { status: 429 })
    applyRateLimitHeaders(res.headers, rateLimit)
    res.headers.set('Retry-After', String(rateLimit.retryAfterSeconds))
    return res
  }

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    console.error('[rum] parse', err)
    return new NextResponse(null, { status: 400 })
  }

  const parsed = rumSchema.safeParse(body)
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 })
  }

  recordRumMetric(parsed.data)
  log.info('rum', parsed.data)
  return new NextResponse(null, { status: 204 })
}
