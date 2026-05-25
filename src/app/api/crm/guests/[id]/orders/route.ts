import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestReadRoles, sanitizeGuestOrderForCrmRole } from '@/lib/crm/api'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestReadRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') ?? '10', 10)))
  const offset = (page - 1) * limit
  const supabase = createAdminClient()

  const { data: guest } = await supabase
    .from('guests')
    .select('id, legacy_customer_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
  }

  const orderMap = new Map<string, unknown>()
  let total = 0

  const crmLinkedQuery = supabase
    .from('orders')
    .select('id, order_number, status, order_type, subtotal, tax_total, total, item_count, created_at, closed_at, guest_name, guest_phone, metadata', { count: 'exact' })
    .eq('org_id', user.org_id)
    .contains('metadata', { crm_guest_id: id })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data: crmLinkedOrders, error: crmLinkedError, count: crmLinkedCount } = await crmLinkedQuery

  if (crmLinkedError) {
    return NextResponse.json({ error: 'Failed to fetch CRM guest order history' }, { status: 500 })
  }

  for (const order of crmLinkedOrders ?? []) {
    orderMap.set((order as { id: string }).id, order)
  }
  total += crmLinkedCount ?? 0

  if (guest.legacy_customer_id) {
    const { data: legacyOrders, error: legacyError, count: legacyCount } = await supabase
      .from('orders')
      .select('id, order_number, status, order_type, subtotal, tax_total, total, item_count, created_at, closed_at, guest_name, guest_phone, metadata', { count: 'exact' })
      .eq('customer_id', guest.legacy_customer_id)
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (legacyError) {
      return NextResponse.json({ error: 'Failed to fetch CRM guest order history' }, { status: 500 })
    }

    for (const order of legacyOrders ?? []) {
      orderMap.set((order as { id: string }).id, order)
    }
    total += legacyCount ?? 0
  }

  const data = Array.from(orderMap.values())
    .sort((a, b) => {
      const left = new Date((a as { created_at: string }).created_at).getTime()
      const right = new Date((b as { created_at: string }).created_at).getTime()
      return right - left
    })
    .map((order) => sanitizeGuestOrderForCrmRole(order as Record<string, unknown>, user))

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  })
}
