import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const bulkTableUpdate = z.object({
  id: z.string().uuid(),
  pos_x: z.number().min(0).optional(),
  pos_y: z.number().min(0).optional(),
  width: z.number().min(40).max(400).optional(),
  height: z.number().min(40).max(400).optional(),
  rotation: z.number().min(0).max(360).optional(),
})

const bulkUpdateSchema = z.object({
  tables: z.array(bulkTableUpdate).min(1).max(200),
})

/**
 * PATCH /api/tables/bulk-update — update multiple tables (for drag reposition in edit mode)
 */
export async function PATCH(request: NextRequest) {
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

  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const errors: string[] = []

  // Update each table individually (Supabase doesn't support bulk upsert with different values easily)
  for (const tableUpdate of parsed.data.tables) {
    const { id, ...updateFields } = tableUpdate

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('tables') as any)
      .update({
        ...updateFields,
        updated_at: now,
      })
      .eq('id', id)
      .eq('org_id', user.org_id)

    if (error) {
      errors.push(`Failed to update table ${id}`)
    }
  }

  if (errors.length > 0) {
    return apiError(207, 'Some tables failed to update', { details: errors, extra: { "details": errors } })
  }

  return NextResponse.json({ data: { success: true, updated: parsed.data.tables.length } })
}
