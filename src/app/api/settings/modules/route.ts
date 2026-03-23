import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateModuleSchema = z.object({
  module_id: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  location_ids: z.array(z.string().uuid()).nullable().optional(),
})

interface OrgModuleRow {
  id: string
  module_id: string
  is_enabled: boolean
  config: Record<string, unknown>
}

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('org_modules') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('module_id', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateModuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check if module record exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('org_modules') as any)
    .select('id')
    .eq('org_id', user.org_id)
    .eq('module_id', parsed.data.module_id)
    .single() as { data: OrgModuleRow | null }

  const now = new Date().toISOString()

  if (existing) {
    // Update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('org_modules') as any)
      .update({
        is_enabled: parsed.data.enabled,
        config: parsed.data.config ?? {},
        location_ids: parsed.data.location_ids ?? null,
        enabled_at: parsed.data.enabled ? now : undefined,
        disabled_at: parsed.data.enabled ? null : now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update module', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } else {
    // Insert — use module_id directly (the table accepts plain names like 'pos', 'kds')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('org_modules') as any)
      .insert({
        org_id: user.org_id,
        module_id: parsed.data.module_id,
        is_enabled: parsed.data.enabled,
        enabled_at: parsed.data.enabled ? now : null,
        config: parsed.data.config ?? {},
        location_ids: parsed.data.location_ids ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to enable module', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  }
}
