import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const updateStaffSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum([
    'platform_admin', 'owner', 'admin', 'manager', 'server',
    'bartender', 'host', 'kitchen', 'cashier', 'driver', 'kiosk', 'readonly',
  ]).optional(),
  hourly_rate: z.string().optional().nullable(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional().nullable(),
  location_ids: z.array(z.string().uuid()).optional(),
  hire_date: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
})

/**
 * GET /api/staff/[id] — get single staff member with recent time entries
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  const { data: staff, error } = await supabase.from('users')
    .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, settings, created_at, updated_at')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  // Fetch recent time entries
  const { data: timeEntries } = await supabase.from('time_entries')
    .select('*')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .order('clock_in', { ascending: false })
    .limit(20)

  return NextResponse.json({
    data: {
      ...staff,
      time_entries: timeEntries ?? [],
    },
  })
}

/**
 * PATCH /api/staff/[id] — update staff member
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { pin, ...updateData } = parsed.data
  const supabase = createAdminClient()

  // Build update payload
  const payload: Record<string, unknown> = {
    ...updateData,
    updated_at: new Date().toISOString(),
  }

  // Handle PIN update
  if (pin !== undefined) {
    if (pin === null) {
      payload.pin_hash = null
    } else {
      // Check PIN uniqueness within org
      const { data: existingStaff } = await supabase.from('users')
        .select('id, pin_hash')
        .eq('org_id', user.org_id)
        .is('deleted_at', null)
        .not('pin_hash', 'is', null)
        .neq('id', id)

      if (existingStaff) {
        for (const existing of existingStaff) {
          const matches = await bcrypt.compare(pin, existing.pin_hash)
          if (matches) {
            return NextResponse.json(
              { error: 'PIN is already in use by another staff member' },
              { status: 409 }
            )
          }
        }
      }

      payload.pin_hash = await bcrypt.hash(pin, 10)
    }
  }

  const { data, error } = await supabase.from('users')
    .update(payload)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update staff member' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/staff/[id] — soft delete (set is_active=false)
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params

  if (id === user.id) {
    return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase.from('users')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to deactivate staff member' }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
