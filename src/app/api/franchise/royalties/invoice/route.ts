import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateRoyaltiesForPeriod, type RoyaltyTerms } from '@/lib/franchise/royalty-calc'

const invoiceSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  location_ids: z.array(z.string().uuid()).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = invoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()
  const { period_start, period_end, location_ids } = parsed.data

  // Get locations with royalty terms
  let query = db
    .from('locations')
    .select('id, name, royalty_terms')
    .eq('org_id', user.org_id)
    .eq('is_active', true)

  if (location_ids && location_ids.length > 0) {
    query = query.in('id', location_ids)
  }

  const { data: locations } = await query

  if (!locations || locations.length === 0) {
    return NextResponse.json({ error: 'No locations found' }, { status: 404 })
  }

  // Get gross sales for each location in the period
  const locationData = []
  for (const loc of locations) {
    const { data: orders } = await db
      .from('orders')
      .select('total')
      .eq('location_id', loc.id)
      .in('status', ['closed', 'served'])
      .gte('created_at', `${period_start}T00:00:00Z`)
      .lte('created_at', `${period_end}T23:59:59Z`)

    const grossSales = (orders ?? []).reduce(
      (sum: number, o: Record<string, unknown>) => sum + Math.round(parseFloat(o.total as string) * 100),
      0
    )

    const terms: RoyaltyTerms = (loc.royalty_terms as RoyaltyTerms) ?? {
      type: 'percentage',
      percentage: 5,
      flat_amount: 0,
      tiers: [],
    }

    locationData.push({
      id: loc.id as string,
      name: loc.name as string,
      gross_sales: grossSales,
      terms,
    })
  }

  const period = `${period_start} to ${period_end}`
  const result = calculateRoyaltiesForPeriod(locationData, period)

  // Save invoice records
  for (const royalty of result.results) {
    await db.from('franchise_royalty_invoices').insert({
      org_id: user.org_id,
      location_id: royalty.location_id,
      period_start,
      period_end,
      gross_sales: (royalty.gross_sales / 100).toFixed(2),
      royalty_amount: (royalty.royalty_amount / 100).toFixed(2),
      effective_rate: royalty.effective_rate,
      royalty_type: royalty.royalty_type,
      status: 'pending',
    })
  }

  return NextResponse.json({
    data: {
      period,
      results: result.results.map((r) => ({
        ...r,
        gross_sales_display: `$${(r.gross_sales / 100).toFixed(2)}`,
        royalty_display: `$${(r.royalty_amount / 100).toFixed(2)}`,
      })),
      total_gross_sales: `$${(result.total_gross_sales / 100).toFixed(2)}`,
      total_royalties: `$${(result.total_royalties / 100).toFixed(2)}`,
    },
  })
}
