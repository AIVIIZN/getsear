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
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateOrgSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
