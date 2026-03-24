import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// GET — List print queue
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { searchParams } = request.nextUrl
  const locationId = searchParams.get('location_id')
  const status = searchParams.get('status') // 'queued' | 'printing' | 'printed' | 'failed'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  const supabase = createAdminClient()

  let query = supabase
    .from('print_queue')
    .select('id, printer_id, job_type, status, attempts, error_message, created_at, completed_at')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch print queue' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// ---------------------------------------------------------------------------
// DELETE — Clear completed jobs
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = request.nextUrl
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  let query = supabase
    .from('print_queue')
    .delete()
    .eq('org_id', user.org_id)
    .in('status', ['completed', 'cancelled'])

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to clear completed jobs' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Completed jobs cleared' })
}
