import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export interface AuthUser {
  id: string
  email: string
  org_id: string
  role: string
  location_ids: string[]
}

/**
 * Get the authenticated user from the Supabase session.
 * Uses server client for auth check, admin client for profile lookup (bypasses RLS).
 * Returns the user or a NextResponse error.
 */
export async function getAuthUser(): Promise<AuthUser | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client to bypass RLS for profile lookup
  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id, email, org_id, role, location_ids')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 401 })
  }

  return profile as AuthUser
}

/**
 * Check if user has one of the required roles.
 */
export function requireRole(user: AuthUser, roles: string[]): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 }
    )
  }
  return null
}
