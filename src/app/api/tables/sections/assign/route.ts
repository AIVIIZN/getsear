import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const VALID_SECTION_COLORS = [
  'coral', 'teal', 'lavender', 'lime', 'sky', 'peach', 'mint', 'gold',
] as const

const assignSchema = z.object({
  assignments: z.array(
    z.object({
      table_id: z.string().uuid(),
      server_id: z.string().uuid(),
      section_color: z.enum(VALID_SECTION_COLORS),
    })
  ).min(1),
})

const clearSchema = z.object({
  table_ids: z.array(z.string().uuid()).min(1),
})

/**
 * POST /api/tables/sections/assign — Assign server sections to tables
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

  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const results: Array<Record<string, unknown>> = []

  for (const assignment of parsed.data.assignments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('tables') as any)
      .update({
        assigned_server_id: assignment.server_id,
        section_color: assignment.section_color,
        updated_at: now,
      })
      .eq('id', assignment.table_id)
      .eq('org_id', user.org_id)
      .select('id, name, assigned_server_id, section_color')
      .single()

    if (!error && data) {
      results.push(data)
    }
  }

  return NextResponse.json({ data: results, count: results.length })
}

/**
 * DELETE /api/tables/sections/assign — Clear section assignments from tables
 */
export async function DELETE(request: NextRequest) {
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

  const parsed = clearSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  for (const tableId of parsed.data.table_ids) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tables') as any)
      .update({
        assigned_server_id: null,
        section_color: null,
        updated_at: now,
      })
      .eq('id', tableId)
      .eq('org_id', user.org_id)
  }

  return NextResponse.json({ data: { cleared: parsed.data.table_ids.length } })
}
