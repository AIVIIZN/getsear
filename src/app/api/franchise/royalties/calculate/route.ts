import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const calculateSchema = z.object({
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  location_ids: z.array(z.string().uuid()).optional(),
  royalty_rate: z.string().min(1),
  marketing_fee: z.string().optional().default('0'),
})

/**
 * POST /api/franchise/royalties/calculate — calculate royalties for a period
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = calculateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { period_start, period_end, location_ids, royalty_rate, marketing_fee } = parsed.data
  const supabase = createAdminClient()

  // Get locations for the org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let locQuery = (supabase.from('locations') as any)
    .select('id, name')
    .eq('org_id', user.org_id)

  if (location_ids && location_ids.length > 0) {
    locQuery = locQuery.in('id', location_ids)
  }

  const { data: locations, error: locError } = await locQuery

  if (locError) {
    return apiError(500, 'Failed to fetch locations')
  }

  const locationList = (locations ?? []) as Array<{ id: string; name: string }>
  const royaltyRateNum = parseFloat(royalty_rate)
  const marketingFeeNum = parseFloat(marketing_fee)
  const results: Array<Record<string, unknown>> = []

  for (const loc of locationList) {
    // Sum orders for this location in the period
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orderData } = await (supabase.from('orders') as any)
      .select('total')
      .eq('org_id', user.org_id)
      .eq('location_id', loc.id)
      .in('status', ['closed', 'served'])
      .gte('created_at', period_start)
      .lte('created_at', period_end)

    const grossSales = (orderData ?? []).reduce(
      (sum: number, o: { total: string }) => sum + parseFloat(o.total || '0'),
      0,
    )

    const royaltyAmount = Math.round(grossSales * royaltyRateNum) / 100
    const marketingAmount = Math.round(grossSales * marketingFeeNum) / 100
    const totalDue = royaltyAmount + marketingAmount

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: royalty, error: insertErr } = await (supabase.from('franchise_royalties') as any)
      .insert({
        org_id: user.org_id,
        location_id: loc.id,
        period_start,
        period_end,
        gross_sales: grossSales.toFixed(2),
        royalty_rate: royalty_rate,
        royalty_amount: royaltyAmount.toFixed(2),
        marketing_fee: marketingAmount.toFixed(2),
        total_due: totalDue.toFixed(2),
        status: 'calculated',
        calculated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (!insertErr && royalty) {
      results.push(royalty as Record<string, unknown>)
    }
  }

  return NextResponse.json({ data: results }, { status: 201 })
}
