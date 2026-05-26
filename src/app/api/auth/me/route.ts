import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCrmGuestPermissions } from '@/lib/crm/api'
import type { User } from '@/types/database'

type UserProfile = Pick<
  User,
  'id' | 'org_id' | 'email' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'location_ids' | 'avatar_url' | 'is_active'
>

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return apiError(401, 'Not authenticated.')
    }

    const admin = createAdminClient()
    const { data, error: profileError } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, is_active')
      .eq('id', authUser.id)
      .single()

    const profile = data as UserProfile | null

    if (profileError || !profile) {
      return apiError(404, 'User profile not found.')
    }

    if (!profile.is_active) {
      return apiError(401, 'Account deactivated.')
    }

    const displayName =
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
      profile.email ||
      'User'

    return NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        display_name: displayName,
        role: profile.role,
        org_id: profile.org_id,
        location_ids: profile.location_ids ?? [],
        avatar_url: profile.avatar_url,
        crm_permissions: getCrmGuestPermissions(profile),
      },
    })
  } catch {
    return apiError(500, 'An unexpected error occurred.')
  }
}
