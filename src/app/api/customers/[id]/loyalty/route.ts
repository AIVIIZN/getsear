import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // Verify customer belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customer } = await (supabase.from('customers') as any)
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: loyalty, error } = await (supabase.from('loyalty_accounts') as any)
    .select('*')
    .eq('customer_id', id)
    .single()

  if (error || !loyalty) {
    return NextResponse.json({
      data: null,
      message: 'No loyalty account found for this customer',
    })
  }

  return NextResponse.json({ data: loyalty })
}
