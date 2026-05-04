import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertOpen } from '@/lib/marketing/analytics'

/**
 * GET /api/marketing/track/open?r={tracking_id}
 *
 * Email open tracking pixel. PUBLIC endpoint — hit by email clients with
 * no Supabase session. Always returns a 1×1 transparent GIF, even on
 * malformed input, because email clients can't render JSON errors and
 * leaking failure detail would let spammers probe valid tracking_ids.
 *
 * Side effect: when `r` is a valid UUID v4 matching a campaign_recipients
 * row, sets opened_at (first open only) and increments open_count.
 *
 * Performance budget: <100ms. One read + one write on a unique index.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 43-byte 1×1 transparent GIF89a. Hardcoded so we never hit disk or imports.
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const QuerySchema = z.object({
  r: z.string().uuid(),
})

function pixelResponse(): NextResponse {
  // Cast to BlobPart-compatible to satisfy NextResponse's body type.
  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    r: request.nextUrl.searchParams.get('r') ?? undefined,
  })

  // Always return the GIF — never reveal validation failure to an email client.
  if (!parsed.success) {
    return pixelResponse()
  }

  // Fire-and-render: kick off the DB write but don't block the pixel on it
  // beyond what's strictly needed. Awaiting keeps the operation reliable
  // (Vercel/Next routes can suspend post-response work) and the cost is a
  // single indexed update, well inside the 100ms budget.
  try {
    await upsertOpen(parsed.data.r)
  } catch {
    // Swallow — pixel must always render.
  }

  return pixelResponse()
}
