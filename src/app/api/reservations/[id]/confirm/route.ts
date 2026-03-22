import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/** POST /api/reservations/[id]/confirm — confirm a reservation */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Verify reservation exists and belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase.from('reservations') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
  }

  if (existing.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot confirm reservation with status "${existing.status}"` },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reservations') as any)
    .update({
      status: 'confirmed',
      confirmation_sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to confirm reservation' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
