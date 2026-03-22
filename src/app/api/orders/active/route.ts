import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/orders/active — get all active (non-closed) orders for a location
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('org_id', user.org_id)
    .not('status', 'in', '("closed","voided","refunded")')
    .order('created_at', { ascending: false })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch active orders' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
