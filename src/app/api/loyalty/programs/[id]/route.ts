import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['points', 'visits', 'spend']).optional(),
  points_per_dollar: z.number().min(0).optional(),
  points_per_visit: z.number().int().min(0).optional(),
  redemption_threshold: z.number().int().min(1).optional(),
  reward_value: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = updateProgramSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('loyalty_programs') as any)
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!existing) {
    return apiError(404, 'Program not found')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('loyalty_programs') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update program')
  }

  return NextResponse.json({ data })
}
