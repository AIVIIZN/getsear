import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

const createStaffSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  display_name: z.string().max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum([
    'platform_admin', 'owner', 'admin', 'manager', 'server',
    'bartender', 'host', 'kitchen', 'cashier', 'driver', 'kiosk', 'readonly',
  ]),
  hourly_rate: z.string().optional().nullable(),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
  location_ids: z.array(z.string().uuid()).optional(),
  hire_date: z.string().optional().nullable(),
})

/**
 * Org-scoped, tag-revalidated SWR cache for the staff list.
 *
 * Only the static `users` row data is cached — clock-in state is derived from
 * `time_entries` on every request because that table is high-churn and would
 * produce stale "is_clocked_in" values if cached.
 */
function fetchStaffList(
  orgId: string,
  filters: { roleFilter: string | null; statusFilter: string | null }
) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase.from('users')
        .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, created_at, updated_at')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('first_name', { ascending: true })

      if (filters.roleFilter) {
        query = query.eq('role', filters.roleFilter)
      }

      if (filters.statusFilter === 'active') {
        query = query.eq('is_active', true)
      } else if (filters.statusFilter === 'inactive') {
        query = query.eq('is_active', false)
      }

      const { data, error } = await query
      if (error) return { error: 'Failed to fetch staff' as const, data: null }
      return { error: null, data: data ?? [] }
    },
    ['staff-list', orgId, filters.roleFilter ?? '', filters.statusFilter ?? ''],
    { tags: [cacheTags.staff(orgId)], revalidate: 60 }
  )()
}

/**
 * GET /api/staff — list staff for org (with role, status, last clock-in)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const statusFilter = searchParams.get('status')

  const result = await fetchStaffList(user.org_id, { roleFilter, statusFilter })
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  const staff = result.data

  // High-churn: NEVER cache. Always fresh.
  const supabase = createAdminClient()
  const { data: activeEntries } = await supabase.from('time_entries')
    .select('id, user_id, clock_in')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  const clockedInMap = new Map<string, string>()
  if (activeEntries) {
    for (const entry of activeEntries) {
      clockedInMap.set(entry.user_id, entry.clock_in)
    }
  }

  const enriched = staff.map((s: { id: string; [key: string]: unknown }) => ({
    ...s,
    is_clocked_in: clockedInMap.has(s.id),
    last_clock_in: clockedInMap.get(s.id) ?? null,
  }))

  return NextResponse.json({ data: enriched })
}

/**
 * POST /api/staff — create staff member (with bcrypt PIN hash)
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { pin, ...staffData } = parsed.data
  const supabase = createAdminClient()

  // Check PIN uniqueness within org if PIN provided
  if (pin) {
    const { data: existingStaff } = await supabase.from('users')
      .select('id, pin_hash')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .not('pin_hash', 'is', null)

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
  }

  const pinHash = pin ? await bcrypt.hash(pin, 10) : null

  const { data, error } = await supabase.from('users')
    .insert({
      id: randomUUID(),
      org_id: user.org_id,
      ...staffData,
      location_ids: staffData.location_ids ?? user.location_ids ?? [],
      pin_hash: pinHash,
      is_active: true,
      settings: {},
    })
    .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, created_at')
    .single()

  if (error) {
    console.error('[staff/POST]', error.message, error.details, error.hint)
    return NextResponse.json({ error: 'Failed to create staff member', details: error.message }, { status: 500 })
  }

  revalidateTag(cacheTags.staff(user.org_id), CACHE_REVALIDATE_PROFILE)

  return NextResponse.json({ data }, { status: 201 })
}
