import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/tables/[id]/history — order history for this table
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error, count } = await (supabase.from('table_history') as any)
    .select('*', { count: 'exact' })
    .eq('table_id', id)
    .eq('org_id', user.org_id)
    .order('seated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch table history' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      total: count ?? 0,
      limit,
      offset,
    },
  })
}
