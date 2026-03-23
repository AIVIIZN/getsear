import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const kitchenCloseSchema = z.object({
  location_id: z.string().uuid(),
  closed: z.boolean(),
})

/**
 * POST /api/kitchen/close
 *
 * Toggles kitchen open/closed status for a location.
 * When closed, only drink items can be added to orders (food items blocked).
 *
 * The kitchen_closed flag is stored in locations.settings jsonb.
 * After updating, broadcasts the status change via Supabase Realtime
 * so all POS terminals update their UI immediately.
 *
 * Requires manager role or higher.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = kitchenCloseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { location_id, closed } = parsed.data
  const supabase = createAdminClient()

  // Verify location exists and belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location } = await (supabase.from('locations') as any)
    .select('id, org_id, settings, name')
    .eq('id', location_id)
    .eq('org_id', user.org_id)
    .single()

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // Update the kitchen_closed flag in location settings
  const updatedSettings = {
    ...(location.settings ?? {}),
    kitchen_closed: closed,
    kitchen_closed_at: closed ? new Date().toISOString() : null,
    kitchen_closed_by: closed ? user.id : null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('locations') as any)
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', location_id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update kitchen status' }, { status: 500 })
  }

  // Broadcast kitchen status change via Supabase Realtime
  // Uses a channel that all POS terminals at this location subscribe to
  const channel = supabase.channel(`kitchen:${location_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'kitchen_status',
    payload: {
      location_id,
      kitchen_closed: closed,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    },
  })

  return NextResponse.json({
    data: {
      location_id,
      location_name: location.name,
      kitchen_closed: closed,
      changed_at: new Date().toISOString(),
    },
  })
}
