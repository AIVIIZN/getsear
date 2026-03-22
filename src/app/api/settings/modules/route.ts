import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateModuleSchema = z.object({
  module_name: z.string().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
  location_ids: z.array(z.string().uuid()).nullable().optional(),
})

interface OrgModuleRow {
  id: string
  module_name: string
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
    .order('module_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
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
    .eq('module_name', parsed.data.module_name)
    .single() as { data: OrgModuleRow | null }

  if (existing) {
    // Update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('org_modules') as any)
      .update({
        is_enabled: parsed.data.enabled,
        config: parsed.data.config ?? {},
        location_ids: parsed.data.location_ids ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update module' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } else {
    // Insert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('org_modules') as any)
      .insert({
        org_id: user.org_id,
        module_name: parsed.data.module_name,
        is_enabled: parsed.data.enabled,
        config: parsed.data.config ?? {},
        location_ids: parsed.data.location_ids ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to enable module' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  }
}
