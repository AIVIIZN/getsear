import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // Verify account belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase.from('loyalty_accounts') as any)
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!account) {
    return apiError(404, 'Account not found')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, count } = await (supabase.from('loyalty_transactions') as any)
    .select('*', { count: 'exact' })
    .eq('loyalty_account_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return apiError(500, 'Failed to fetch transactions')
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
