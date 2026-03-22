import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/tables/sections — list unique sections
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id') ?? user.location_ids[0]

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tables') as any)
    .select('section')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .not('section', 'eq', '')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 })
  }

  // Extract unique section names
  const sections = [...new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((row: any) => row.section as string).filter(Boolean)
  )].sort()

  return NextResponse.json({ data: sections })
}
