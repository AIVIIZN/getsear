import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * PATCH /api/menu/items/[id]/86
 *
 * Toggle 86 status for a single menu item.
 * Broadcasts change via Supabase Realtime for instant propagation
 * to all terminals (< 3 seconds).
 */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'kitchen'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Get current 86 status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: fetchError } = await (supabase.from('menu_items') as any)
    .select('id, name, is_86d, location_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const newStatus = !item.is_86d

  // Update 86 status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('menu_items') as any)
    .update({ is_86d: newStatus, updated_at: now })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to toggle 86 status' }, { status: 500 })
  }

  // Log to eighty_six_log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('eighty_six_log') as any)
    .insert({
      org_id: user.org_id,
      location_id: item.location_id,
      ingredient_id: null,
      item_id: id,
      action: newStatus ? '86' : 'restore',
      performed_by: user.id,
      reason: newStatus ? 'Manual 86' : 'Manual restore',
      created_at: now,
    })
    .then(() => {
      // Fire-and-forget, don't block response
    })

  // Broadcast via Realtime for instant terminal propagation
  if (item.location_id) {
    const channel = supabase.channel(`86:${item.location_id}`)
    channel.send({
      type: 'broadcast',
      event: '86_toggle',
      payload: {
        item_id: id,
        item_name: item.name,
        is_86d: newStatus,
        performed_by: user.id,
        timestamp: now,
      },
    }).then(() => {
      supabase.removeChannel(channel)
    })
  }

  return NextResponse.json({ data })
}
