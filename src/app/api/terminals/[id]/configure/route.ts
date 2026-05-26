import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import type { AuthUser } from '@/lib/api/auth'

const VALID_DEFAULT_VIEWS = ['pos', 'kds', 'customer_display', 'kiosk'] as const

/**
 * PATCH /api/terminals/[id]/configure
 * Configure a terminal's name, default view, printer, and settings.
 * Requires authenticated manager/owner.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userOrError = await getAuthUser()
  if (userOrError instanceof NextResponse) return userOrError

  const user = userOrError as AuthUser
  const roleError = requireRole(user, ['owner', 'manager'])
  if (roleError) return roleError

  const { id } = await params

  let body: {
    name?: string
    default_view?: string
    assigned_printer_id?: string | null
    settings?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) {
    const trimmed = body.name.trim()
    if (!trimmed) {
      return apiError(400, 'Terminal name cannot be empty')
    }
    updatePayload.name = trimmed
  }

  if (body.default_view !== undefined) {
    if (!VALID_DEFAULT_VIEWS.includes(body.default_view as typeof VALID_DEFAULT_VIEWS[number])) {
      return apiError(400, `Invalid default_view. Must be one of: ${VALID_DEFAULT_VIEWS.join(', ')}`)
    }
    updatePayload.default_view = body.default_view
  }

  if (body.assigned_printer_id !== undefined) {
    updatePayload.assigned_printer_id = body.assigned_printer_id
  }

  if (body.settings !== undefined) {
    updatePayload.settings = body.settings
  }

  const supabase = createAdminClient()

  // Ensure terminal belongs to user's org
  const { data: terminal, error: findError } = await supabase.from('terminals')
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (findError || !terminal) {
    return apiError(404, 'Terminal not found')
  }

  const { data, error } = await supabase.from('terminals')
    .update(updatePayload)
    .eq('id', id)
    .select('id, name, default_view, assigned_printer_id, settings')
    .single()

  if (error) {
    console.error('Terminal configure error:', error)
    return apiError(500, 'Failed to configure terminal')
  }

  return NextResponse.json({ data })
}
