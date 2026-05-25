import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestReadRoles } from '@/lib/crm/api'

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

  if (!guest.legacy_customer_id) {
    return NextResponse.json({
      data: [],
      pagination: { page, limit, total: 0, total_pages: 0 },
    })
  }

  const { data, error, count } = await supabase
    .from('orders')
    .select('id, order_number, status, order_type, subtotal, tax_total, total, item_count, created_at, closed_at', { count: 'exact' })
    .eq('customer_id', guest.legacy_customer_id)
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch CRM guest order history' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}
