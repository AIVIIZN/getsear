import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }
type UiCashDrawerEventType = 'pay_in' | 'pay_out' | 'safe_drop'

const eventTypeMap: Record<UiCashDrawerEventType, 'paid_in' | 'paid_out'> = {
  pay_in: 'paid_in',
  pay_out: 'paid_out',
  safe_drop: 'paid_out',
}

/**
 * GET /api/staff/cash-drawers/[id]/events — get event log for drawer
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error } = await (supabase.from('cash_drawer_events') as any)
    .select('*')
    .eq('cash_drawer_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError(500, 'Failed to fetch events')
  }

  // Get user names for events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set((events ?? []).map((e: any) => e.performed_by).filter(Boolean))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('id, first_name, last_name')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  const nameMap = new Map<string, string>()
  if (users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of users as any[]) {
      nameMap.set(u.id, `${u.first_name} ${u.last_name}`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (events ?? []).map((e: any) => ({
    ...e,
    performed_by_name: nameMap.get(e.performed_by) ?? 'System',
  }))

  return NextResponse.json({ data: enriched })
}

const eventSchema = z.object({
  event_type: z.enum(['pay_in', 'pay_out', 'safe_drop']),
  amount: z.string(),
  notes: z.string().optional(),
  denominations: z.record(z.string(), z.number().int().min(0)).optional(),
})

/**
 * POST /api/staff/cash-drawers/[id]/events — record pay-in, pay-out, or safe drop
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = eventSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Get current drawer state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawer } = await (supabase.from('cash_drawers') as any)
    .select('id, is_open, expected_cash')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!drawer) {
    return apiError(404, 'Cash drawer not found')
  }

  if (!drawer.is_open) {
    return apiError(409, 'Drawer must be open to record events')
  }

  // Update expected cash based on event type
  const amount = parseFloat(parsed.data.amount)
  const currentExpected = parseFloat(drawer.expected_cash ?? '0')
  let newExpected = currentExpected

  switch (parsed.data.event_type) {
    case 'pay_in':
      newExpected = currentExpected + amount
      break
    case 'pay_out':
    case 'safe_drop':
      newExpected = currentExpected - amount
      break
  }

  // Update drawer expected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('cash_drawers') as any)
    .update({ expected_cash: newExpected.toFixed(2), updated_at: now })
    .eq('id', id)

  // Record event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event, error } = await (supabase.from('cash_drawer_events') as any)
    .insert({
      cash_drawer_id: id,
      event_type: eventTypeMap[parsed.data.event_type],
      amount,
      running_total: newExpected,
      performed_by: user.id,
      description: parsed.data.notes ?? null,
      created_at: now,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to record event')
  }

  // Record denomination count for safe drops
  if (parsed.data.event_type === 'safe_drop' && parsed.data.denominations) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('cash_drawer_counts') as any)
        .insert({
          cash_drawer_id: id,
          count_type: 'safe_drop',
          denominations: parsed.data.denominations,
          total: parsed.data.amount,
          counted_by: user.id,
          created_at: now,
        })
    } catch {
      // table may not exist
    }
  }

  return NextResponse.json({ data: event }, { status: 201 })
}
