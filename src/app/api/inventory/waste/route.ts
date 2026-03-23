import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const wasteCreateSchema = z.object({
  inventory_item_id: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.enum(['expired', 'dropped', 'returned', 'overproduction', 'other']),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'kitchen'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const limit = parseInt(searchParams.get('limit') ?? '50')

  let query = db
    .from('inventory_waste_log')
    .select('*, inventory_items(name, unit, unit_cost)')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute dollar values
  const entries = (data ?? []).map((entry: Record<string, unknown>) => {
    const item = entry.inventory_items as Record<string, unknown> | null
    const unitCost = item ? parseFloat(item.unit_cost as string) : 0
    return {
      id: entry.id,
      org_id: entry.org_id,
      location_id: entry.location_id,
      inventory_item_id: entry.inventory_item_id,
      item_name: item?.name ?? 'Unknown',
      quantity: entry.quantity,
      unit: item?.unit ?? '',
      reason: entry.reason,
      notes: entry.notes,
      recorded_by: entry.recorded_by,
      recorded_by_name: entry.recorded_by_name ?? '',
      dollar_value: Math.round(unitCost * (entry.quantity as number) * 100) / 100,
      created_at: entry.created_at,
    }
  })

  return NextResponse.json({ data: entries })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = wasteCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()

  // Get the user's name for recording
  const { data: profile } = await db
    .from('users')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const recordedByName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : 'Unknown'

  // Get location from user
  const locationId = user.location_ids?.[0] ?? null

  const { data, error } = await db
    .from('inventory_waste_log')
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      inventory_item_id: parsed.data.inventory_item_id,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      notes: parsed.data.notes ?? null,
      recorded_by: user.id,
      recorded_by_name: recordedByName,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Decrement inventory stock
  const { data: item } = await db
    .from('inventory_items')
    .select('current_stock')
    .eq('id', parsed.data.inventory_item_id)
    .single()

  if (item) {
    const newStock = Math.max(0, (item.current_stock as number) - parsed.data.quantity)
    await db
      .from('inventory_items')
      .update({ current_stock: newStock })
      .eq('id', parsed.data.inventory_item_id)
  }

  return NextResponse.json({ data }, { status: 201 })
}
