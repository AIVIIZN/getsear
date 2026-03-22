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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.name !== undefined) {
    const trimmed = body.name.trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: 'Terminal name cannot be empty' },
        { status: 400 }
      )
    }
    updatePayload.name = trimmed
  }

  if (body.default_view !== undefined) {
    if (!VALID_DEFAULT_VIEWS.includes(body.default_view as typeof VALID_DEFAULT_VIEWS[number])) {
      return NextResponse.json(
        { error: `Invalid default_view. Must be one of: ${VALID_DEFAULT_VIEWS.join(', ')}` },
        { status: 400 }
      )
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
  const { data: terminal, error: findError } = await (supabase.from('terminals') as any)
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (findError || !terminal) {
    return NextResponse.json(
      { error: 'Terminal not found' },
      { status: 404 }
    )
  }

  const { data, error } = await (supabase.from('terminals') as any)
    .update(updatePayload)
    .eq('id', id)
    .select('id, name, default_view, assigned_printer_id, settings')
    .single()

  if (error) {
    console.error('Terminal configure error:', error)
    return NextResponse.json(
      { error: 'Failed to configure terminal' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}
