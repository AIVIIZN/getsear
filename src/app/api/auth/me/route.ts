import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    const admin = createAdminClient()
    const { data, error: profileError } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, is_active')
      .eq('id', authUser.id)
      .single()

    const profile = data as UserProfile | null

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found.' },
        { status: 404 }
      )
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { error: 'Account deactivated.' },
        { status: 401 }
      )
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
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}
