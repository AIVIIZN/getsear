import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  location_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().default(true),
})

/**
 * GET /api/scheduling/templates — list schedule templates
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('schedule_templates') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch templates')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/scheduling/templates — create schedule template
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('schedule_templates') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create template')
  }

  return NextResponse.json({ data }, { status: 201 })
}
