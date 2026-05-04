import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

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
 * Org-scoped, tag-revalidated SWR cache for a single staff member's profile.
 * Time entries are fetched fresh on every request (high-churn).
 */
function fetchStaffMember(orgId: string, id: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase.from('users')
        .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, settings, created_at, updated_at')
        .eq('id', id)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single()

      if (error || !data) return { error: 'Staff member not found' as const, data: null }
      return { error: null, data }
    },
    ['staff-member', orgId, id],
    { tags: [cacheTags.staffMember(orgId, id)], revalidate: 60 }
  )()
}

/**
 * GET /api/staff/[id] — get single staff member with recent time entries
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  const result = await fetchStaffMember(user.org_id, id)
  if (result.error || !result.data) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  // High-churn: NEVER cache. Always fresh.
  const supabase = createAdminClient()
  const { data: timeEntries } = await supabase.from('time_entries')
    .select('*')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .order('clock_in', { ascending: false })
    .limit(20)

  return NextResponse.json({
    data: {
      ...result.data,
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

  revalidateTag(cacheTags.staff(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.staffMember(user.org_id, id), CACHE_REVALIDATE_PROFILE)

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

  revalidateTag(cacheTags.staff(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.staffMember(user.org_id, id), CACHE_REVALIDATE_PROFILE)

  return NextResponse.json({ data: { success: true } })
}
