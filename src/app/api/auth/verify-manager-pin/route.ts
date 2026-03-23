import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import bcrypt from 'bcryptjs'

/**
 * POST /api/auth/verify-manager-pin
 *
 * Verifies a 4-digit PIN belongs to a user with manager/admin/owner role.
 * Used for mid-shift approvals (voids, comps, discounts, overrides).
 * Does NOT create a session — just validates and returns the manager's identity.
 */
export async function POST(request: NextRequest) {
  // Caller must be authenticated (any role)
  const caller = await getAuthUser()
  if (caller instanceof NextResponse) return caller

  let body: { pin?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { pin } = body
  if (!pin || typeof pin !== 'string' || pin.length !== 4) {
    return NextResponse.json({ error: 'A 4-digit PIN is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch all active managers/admins/owners in the same org who have a pin_hash
  const { data: managers, error } = await admin
    .from('users')
    .select('id, display_name, first_name, last_name, email, role, pin_hash')
    .eq('org_id', caller.org_id)
    .eq('is_active', true)
    .in('role', ['manager', 'admin', 'owner'])
    .not('pin_hash', 'is', null)

  if (error || !managers || managers.length === 0) {
    return NextResponse.json({ error: 'No managers available' }, { status: 404 })
  }

  // Check PIN against each manager (bcrypt compare is ~100ms each, but manager count is small)
  for (const mgr of managers) {
    if (!mgr.pin_hash) continue
    const isMatch = await bcrypt.compare(pin, mgr.pin_hash)
    if (isMatch) {
      const displayName =
        mgr.display_name ||
        [mgr.first_name, mgr.last_name].filter(Boolean).join(' ') ||
        mgr.email ||
        'Manager'

      return NextResponse.json({
        data: {
          user_id: mgr.id,
          display_name: displayName,
          role: mgr.role,
        },
      })
    }
  }

  return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
}
