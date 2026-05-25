import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { cacheTags } from '@/lib/cache/keys'

/**
 * GET /api/orders/active — get all active (non-closed) orders for a location
 */
function fetchActiveOrders(orgId: string, locationId: string | null) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('orders') as any)
        .select('*, order_items(*, order_item_modifiers(*))')
        .eq('org_id', orgId)
        .not('status', 'in', '("closed","voided","refunded")')
        .order('created_at', { ascending: false })

      if (locationId) {
        query = query.eq('location_id', locationId)
      }

      const { data, error } = await query
      if (error) return { error: 'Failed to fetch active orders' as const, data: null }
      return { error: null, data: data ?? [] }
    },
    ['orders-active-list', orgId, locationId ?? ''],
    { tags: [cacheTags.orders(orgId), cacheTags.activeOrders(orgId)], revalidate: 10 }
  )()
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')

  const result = await fetchActiveOrders(user.org_id, locationId)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: result.data ?? [] })
}
