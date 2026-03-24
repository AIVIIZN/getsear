import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

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
 * GET /api/staff — list staff for org (with role, status, last clock-in)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  const { searchParams } = new URL(request.url)
  const roleFilter = searchParams.get('role')
  const statusFilter = searchParams.get('status')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('users') as any)
    .select('id, org_id, email, phone, first_name, last_name, display_name, avatar_url, role, location_ids, hire_date, hourly_rate, is_active, created_at, updated_at')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('first_name', { ascending: true })

  if (roleFilter) {
    query = query.eq('role', roleFilter)
  }

  if (statusFilter === 'active') {
    query = query.eq('is_active', true)
  } else if (statusFilter === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data: staff, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  // Fetch active time entries to determine who is clocked in
  const { data: activeEntries } = await (supabase.from('time_entries') as any)
    .select('id, user_id, clock_in')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  const clockedInMap = new Map<string, string>()
  if (activeEntries) {
    for (const entry of activeEntries) {
      clockedInMap.set(entry.user_id, entry.clock_in)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (staff ?? []).map((s: any) => ({
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
    const { data: existingStaff } = await (supabase.from('users') as any)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('users') as any)
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

  return NextResponse.json({ data }, { status: 201 })
}
