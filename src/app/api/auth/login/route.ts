import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/types/database'

type UserProfile = Pick<
  User,
  'id' | 'org_id' | 'email' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'location_ids' | 'avatar_url' | 'is_active'
>

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }

    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    // Sign in via Supabase Auth
    const supabase = await createClient()
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Fetch full user profile from the users table
    const admin = createAdminClient()
    const { data, error: profileError } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, is_active')
      .eq('id', authData.user.id)
      .single()

    const profile = data as UserProfile | null

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found. Contact your administrator.' },
        { status: 401 }
      )
    }

    if (!profile.is_active) {
      // Sign them back out — they shouldn't have a session
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact your administrator.' },
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
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
