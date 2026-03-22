import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/constants'
import type { User } from '@/types/database'

type UserProfile = Pick<
  User,
  'id' | 'org_id' | 'email' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'location_ids' | 'avatar_url' | 'is_active'
>

export interface AuthUser {
  id: string
  email: string | null
  display_name: string
  role: UserRole
  org_id: string
  location_ids: string[]
  avatar_url: string | null
}

/**
 * Get the currently authenticated user's profile, or null if not authenticated.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) return null

    const admin = createAdminClient()
    const { data } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, is_active')
      .eq('id', authUser.id)
      .single()

    const profile = data as UserProfile | null

    if (!profile || !profile.is_active) return null

    const displayName =
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
      profile.email ||
      'User'

    return {
      id: profile.id,
      email: profile.email,
      display_name: displayName,
      role: profile.role as UserRole,
      org_id: profile.org_id,
      location_ids: profile.location_ids ?? [],
      avatar_url: profile.avatar_url,
    }
  } catch {
    return null
  }
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 * Use in Server Components and Server Actions.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

/** Role hierarchy -- higher index = higher privilege */
const ROLE_HIERARCHY: UserRole[] = [
  'readonly',
  'kiosk',
  'cashier',
  'kitchen',
  'host',
  'bartender',
  'server',
  'manager',
  'admin',
  'owner',
  'platform_admin',
]

/**
 * Require the user to have one of the given roles.
 * Throws an error if role is insufficient.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth()

  const userLevel = ROLE_HIERARCHY.indexOf(user.role)
  const hasAccess = allowedRoles.some((role) => {
    const requiredLevel = ROLE_HIERARCHY.indexOf(role)
    return userLevel >= requiredLevel
  })

  if (!hasAccess) {
    throw new Error('Forbidden: Insufficient role privileges.')
  }

  return user
}
