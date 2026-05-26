import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { calculateCrmAdvancedIntelligence } from '@/lib/crm/advanced-intelligence'
import type {
  AdvancedIntelligenceAttributionEvent,
  AdvancedIntelligenceCampaign,
  AdvancedIntelligenceGuest,
  AdvancedIntelligenceOrder,
} from '@/lib/crm/advanced-intelligence'
import { crmReportReadRoles } from '@/lib/crm/reports'
import { crmAdvancedIntelligenceQuerySchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

function crmGuestId(order: Record<string, unknown>): string | null {
  const metadata = order.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>).crm_guest_id
  return typeof value === 'string' ? value : null
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportReadRoles])
  if (roleErr) return roleErr

  const parsed = crmAdvancedIntelligenceQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
  if (!parsed.success) return apiError(400, 'Invalid advanced intelligence query', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  const since = new Date(Date.now() - parsed.data.days * 86_400_000).toISOString()
  const db = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guestQuery = (db.from('guests') as any)
    .select('id, display_name, lifecycle_stage, total_spend, total_visits, average_check, last_visit_at, birthday, is_vip, metadata')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.location_id) guestQuery = guestQuery.eq('location_id', parsed.data.location_id)

  const { data: guests, error: guestError } = await guestQuery
  if (guestError) return apiError(500, 'Failed to fetch CRM guests for advanced intelligence')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderQuery = (db.from('orders') as any)
    .select('id, location_id, total, discount_total, closed_at, created_at, metadata')
    .eq('org_id', user.org_id)
    .eq('status', 'closed')
    .gte('closed_at', since)
    .limit(5000)

  if (parsed.data.location_id) orderQuery = orderQuery.eq('location_id', parsed.data.location_id)

  const { data: rawOrders, error: orderError } = await orderQuery
  if (orderError) return apiError(500, 'Failed to fetch CRM order signals for advanced intelligence')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaigns, error: campaignError } = await (db.from('crm_campaigns') as any)
    .select('id, name, status, campaign_type, metadata')
    .eq('org_id', user.org_id)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (campaignError) return apiError(500, 'Failed to fetch CRM campaigns for advanced intelligence')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: attributionEvents, error: attributionError } = await (db.from('crm_attribution_events') as any)
    .select('campaign_id, guest_id, event_type, revenue_amount, profit_estimate_amount, cost_amount, baseline_segment, excluded_from_roi, metadata')
    .eq('org_id', user.org_id)
    .gte('event_at', since)
    .limit(5000)

  if (attributionError) return apiError(500, 'Failed to fetch CRM attribution signals for advanced intelligence')

  const orders = ((rawOrders ?? []) as Array<Record<string, unknown>>).map((order) => ({
    ...order,
    guest_id: crmGuestId(order),
  })) as AdvancedIntelligenceOrder[]

  return NextResponse.json({
    data: calculateCrmAdvancedIntelligence({
      guests: (guests ?? []) as AdvancedIntelligenceGuest[],
      orders,
      campaigns: (campaigns ?? []) as AdvancedIntelligenceCampaign[],
      attributionEvents: (attributionEvents ?? []) as AdvancedIntelligenceAttributionEvent[],
      proposedDiscountPercent: parsed.data.proposed_discount_percent,
    }),
  })
}
