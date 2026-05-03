import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import type { AuthUser } from '@/lib/api/auth'

/**
 * POST /api/terminals/register
 * Generate a 6-digit registration code for a new terminal.
 * Requires authenticated manager/owner.
 */
export async function POST(request: Request) {
  const userOrError = await getAuthUser()
  if (userOrError instanceof NextResponse) return userOrError

  const user = userOrError as AuthUser
  const roleError = requireRole(user, ['owner', 'manager'])
  if (roleError) return roleError

  let body: { location_id: string; name: string; terminal_type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { location_id, name, terminal_type } = body

  if (!location_id || !name) {
    return NextResponse.json(
      { error: 'location_id and name are required' },
      { status: 400 }
    )
  }

  // Generate random 6-digit code
  const registration_code = String(crypto.randomInt(100000, 999999))

  // Code expires in 10 minutes
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const supabase = createAdminClient()

  const { data, error } = await supabase.from('terminals').insert({
    org_id: user.org_id,
    location_id,
    name: name.trim(),
    terminal_type: terminal_type ?? 'server_station',
    registration_code,
    registration_code_expires_at: expires_at,
    is_active: false,
    is_online: false,
    default_view: 'pos',
    settings: {},
  }).select('id, registration_code, registration_code_expires_at').single()

  if (error) {
    console.error('Terminal register error:', error)
    return NextResponse.json(
      { error: 'Failed to create terminal' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    terminal_id: data.id,
    registration_code: data.registration_code,
    expires_at: data.registration_code_expires_at,
  })
}
