import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const db = createAdminClient()

  // Get the marketplace listing
  const { data: listing } = await db
    .from('shift_marketplace')
    .select('*, shifts(date, start_time, end_time, role)')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .eq('status', 'available')
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found or already claimed' }, { status: 404 })
  }

  // Cannot claim your own shift
  if (listing.posted_by === user.id) {
    return NextResponse.json({ error: 'Cannot claim your own shift' }, { status: 400 })
  }

  // Check for scheduling conflicts
  const shift = listing.shifts as Record<string, unknown>
  const { data: conflicts } = await db
    .from('shifts')
    .select('id')
    .eq('staff_id', user.id)
    .eq('date', shift.date)
    .or(`start_time.lt.${shift.end_time},end_time.gt.${shift.start_time}`)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'You have a scheduling conflict' }, { status: 409 })
  }

  // Claim the shift
  const { error } = await db
    .from('shift_marketplace')
    .update({
      claimed_by: user.id,
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Reassign the shift to the new person
  await db
    .from('shifts')
    .update({ staff_id: user.id, is_posted: false })
    .eq('id', listing.shift_id)

  return NextResponse.json({ success: true, message: 'Shift claimed successfully' })
}
