import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateModifierGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_required: z.boolean().optional(),
  min_selections: z.number().int().min(0).optional(),
  max_selections: z.number().int().min(0).optional(),
  modifiers: z.array(
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(100),
      price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount').optional().default('0.00'),
      is_active: z.boolean().optional().default(true),
      sort_order: z.number().int().min(0).optional(),
    })
  ).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const parsed = updateModifierGroupSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { modifiers: modifiersList, is_required: isRequired, ...groupData } = parsed.data

  // Update the group itself
  const groupUpdate = {
    ...groupData,
    ...(isRequired === undefined ? {} : { is_required_prompt: isRequired }),
  }
  if (Object.keys(groupUpdate).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('modifier_groups') as any)
      .update({ ...groupUpdate, updated_at: now })
      .eq('id', id)
      .eq('org_id', user.org_id)

    if (error) {
      return apiError(500, 'Failed to update modifier group')
    }
  }

  // If modifiers are provided, replace them
  if (modifiersList) {
    // Soft-delete existing modifiers not in the new list
    const existingIds = modifiersList.filter((m) => m.id).map((m) => m.id as string)

    // Mark removed modifiers as deleted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let deleteQuery = (supabase.from('modifiers') as any)
      .update({ deleted_at: now, updated_at: now })
      .eq('modifier_group_id', id)
      .eq('org_id', user.org_id)

    if (existingIds.length > 0) {
      deleteQuery = deleteQuery.not('id', 'in', `(${existingIds.join(',')})`)
    }
    await deleteQuery

    // Upsert modifiers
    for (let i = 0; i < modifiersList.length; i++) {
      const mod = modifiersList[i]
      if (mod.id) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('modifiers') as any)
          .update({
            name: mod.name,
            price_adjustment: mod.price,
            is_active: mod.is_active,
            sort_order: i,
            updated_at: now,
            deleted_at: null,
          })
          .eq('id', mod.id)
          .eq('org_id', user.org_id)
      } else {
        // Insert new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('modifiers') as any)
          .insert({
            org_id: user.org_id,
            modifier_group_id: id,
            name: mod.name,
            price_adjustment: mod.price,
            is_active: mod.is_active,
            sort_order: i,
          })
      }
    }
  }

  // Re-fetch with modifiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result } = await (supabase.from('modifier_groups') as any)
    .select('*, modifiers(*)')
    .eq('id', id)
    .single()

  return NextResponse.json({ data: result })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Soft-delete the group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('modifier_groups') as any)
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to delete modifier group')
  }

  // Also remove any links to items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('menu_item_modifier_groups') as any)
    .delete()
    .eq('modifier_group_id', id)

  return NextResponse.json({ data: { success: true } })
}
