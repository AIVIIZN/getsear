import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createModifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  is_required: z.boolean().optional().default(false),
  min_selections: z.number().int().min(0).optional().default(0),
  max_selections: z.number().int().min(0).optional().default(0),
  modifiers: z.array(
    z.object({
      name: z.string().min(1).max(100),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount').optional().default('0.00'),
      is_active: z.boolean().optional().default(true),
    })
  ).optional().default([]),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('modifier_groups') as any)
    .select('*, modifiers(*)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch modifier groups' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

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

  const parsed = createModifierGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get max sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase.from('modifier_groups') as any)
    .select('sort_order')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

  const { modifiers: modifiersList, is_required: isRequired, ...groupData } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: group, error: groupErr } = await (supabase.from('modifier_groups') as any)
    .insert({
      org_id: user.org_id,
      sort_order: nextSortOrder,
      is_required_prompt: isRequired,
      ...groupData,
    })
    .select()
    .single()

  if (groupErr || !group) {
    return NextResponse.json({ error: 'Failed to create modifier group' }, { status: 500 })
  }

  // Insert modifiers if provided
  if (modifiersList.length > 0) {
    const modifierRows = modifiersList.map((mod, idx) => ({
      org_id: user.org_id,
      modifier_group_id: group.id,
      name: mod.name,
      price_adjustment: mod.price,
      is_active: mod.is_active,
      sort_order: idx,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('modifiers') as any).insert(modifierRows)
  }

  // Re-fetch with modifiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result } = await (supabase.from('modifier_groups') as any)
    .select('*, modifiers(*)')
    .eq('id', group.id)
    .single()

  return NextResponse.json({ data: result }, { status: 201 })
}
