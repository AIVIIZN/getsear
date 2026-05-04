/**
 * Public unsubscribe endpoint for marketing emails.
 *
 * GET  /api/marketing/unsubscribe?t={uuid}
 *   - Renders an HTML confirmation page (200) and flips
 *     `customers.marketing_opt_in = false`.
 *   - 404 if token is unknown (no leak about whether it ever existed).
 *
 * POST /api/marketing/unsubscribe?t={uuid}
 *   - RFC 8058 one-click compliance. Same DB update, empty 200 body.
 *
 * No auth: token is a per-customer UUIDv4 stored in `customers.unsubscribe_token`
 * (added by migration `20260504010234_add_customer_unsubscribe_token.sql`).
 * Org scoping is implicit — each token belongs to exactly one customer
 * row, and the customer row carries `org_id`.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const TokenSchema = z.string().uuid()

interface UnsubscribeOutcome {
  ok: boolean
  orgName?: string
}

async function unsubscribeByToken(token: string): Promise<UnsubscribeOutcome> {
  const sb = createAdminClient()

  // Look up the customer (and org) by token.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lookup = await (sb.from('customers') as any)
    .select('id, org_id, marketing_opt_in')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  if (lookup.error || !lookup.data) {
    return { ok: false }
  }

  const customer = lookup.data as {
    id: string
    org_id: string
    marketing_opt_in: boolean
  }

  // Idempotent — re-clicking does nothing harmful.
  if (customer.marketing_opt_in) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd = await (sb.from('customers') as any)
      .update({ marketing_opt_in: false, updated_at: new Date().toISOString() })
      .eq('id', customer.id)
      .eq('org_id', customer.org_id)
    if (upd.error) {
      console.error(
        `[unsubscribe] failed to update customer ${customer.id}: ${upd.error.message}`,
      )
      return { ok: false }
    }
  }

  // Best-effort org name fetch for the confirmation page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgRes = await (sb.from('organizations') as any)
    .select('name')
    .eq('id', customer.org_id)
    .maybeSingle()
  const orgName = (orgRes.data as { name?: string } | null)?.name

  return { ok: true, orgName }
}

function htmlPage(orgName: string | undefined): string {
  const safeOrg = (orgName ?? 'Sear').replace(/[<>&"']/g, (c) => {
    return (
      {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
      } as Record<string, string>
    )[c] ?? c
  })
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:48px;text-align:center;color:#111;background:#fafafa"><div style="max-width:480px;margin:0 auto;background:#fff;padding:48px 32px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05)"><h1 style="margin:0 0 12px;font-size:24px;font-weight:600">You've been unsubscribed.</h1><p style="margin:0;color:#555;font-size:15px;line-height:1.5">You will no longer receive marketing emails from ${safeOrg}.</p></div></body></html>`
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t')
  const parsed = TokenSchema.safeParse(token)
  if (!parsed.success) {
    return new NextResponse('Not found', { status: 404 })
  }

  const outcome = await unsubscribeByToken(parsed.data)
  if (!outcome.ok) {
    // Don't leak whether the token ever existed.
    return new NextResponse('Not found', { status: 404 })
  }

  return new NextResponse(htmlPage(outcome.orgName), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: NextRequest) {
  // RFC 8058 one-click: token comes from query string (mailbox providers
  // POST to the URL embedded in `List-Unsubscribe` exactly).
  const token = request.nextUrl.searchParams.get('t')
  const parsed = TokenSchema.safeParse(token)
  if (!parsed.success) {
    return new NextResponse(null, { status: 404 })
  }

  const outcome = await unsubscribeByToken(parsed.data)
  if (!outcome.ok) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(null, { status: 200 })
}
