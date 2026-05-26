import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateStationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['prep', 'expo']).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  settings: z
    .object({
      columns: z.number().int().min(1).max(8).optional(),
      font_size: z.enum(['small', 'medium', 'large']).optional(),
      sound_enabled: z.boolean().optional(),
      aging_thresholds: z
        .object({
          aging: z.number().int().optional(),
          late: z.number().int().optional(),
          critical: z.number().int().optional(),
        })
        .optional(),
      prep_stations: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * PATCH /api/kds/stations/[id] — update a KDS station
 */
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

  const parsed = updateStationSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('kds_stations') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update KDS station')
  }

  if (!data) {
    return apiError(404, 'Station not found')
  }

  return NextResponse.json({ data })
}
