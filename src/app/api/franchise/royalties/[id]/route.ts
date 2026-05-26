import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateRoyaltySchema = z.object({
  status: z.enum(['calculated', 'invoiced', 'paid']).optional(),
  royalty_rate: z.string().optional(),
  marketing_fee: z.string().optional(),
})

/**
 * GET /api/franchise/royalties/:id — get single royalty record
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('franchise_royalties') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Royalty record not found')
  }

  return NextResponse.json({ data })
}

/**
 * PUT /api/franchise/royalties/:id — update royalty status (e.g., mark as paid)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateRoyaltySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('franchise_royalties') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update royalty')
  }

  return NextResponse.json({ data })
}
