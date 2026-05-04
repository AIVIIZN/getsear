import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { log } from '@/lib/observability/logger'

const rumSchema = z.object({
  name: z.enum(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']),
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  route: z.string().max(500),
  href: z.string().max(2000),
  ts: z.string().datetime(),
})

export async function POST(req: NextRequest) {
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

  log.info('rum', parsed.data)
  return new NextResponse(null, { status: 204 })
}
