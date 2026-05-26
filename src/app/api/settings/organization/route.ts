import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  owner_phone: z.string().max(20).optional(),
  owner_email: z.string().email().optional(),
  owner_name: z.string().max(200).optional(),
  primary_color: z.string().max(7).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.org_id)
    .single()

  if (error) {
    return apiError(404, 'Organization not found')
  }

  return NextResponse.json({ data })
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateOrgSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name
  if (parsed.data.owner_name !== undefined) updatePayload.owner_name = parsed.data.owner_name
  if (parsed.data.owner_email !== undefined) updatePayload.owner_email = parsed.data.owner_email
  if (parsed.data.owner_phone !== undefined) updatePayload.owner_phone = parsed.data.owner_phone
  if (parsed.data.primary_color !== undefined) updatePayload.primary_color = parsed.data.primary_color
  if (parsed.data.settings !== undefined) updatePayload.settings = parsed.data.settings

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('organizations') as any)
    .update(updatePayload)
    .eq('id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update organization')
  }

  return NextResponse.json({ data })
}
