import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { User } from '@/types/database'
import bcrypt from 'bcryptjs'

type UserWithPin = Pick<
  User,
  'id' | 'org_id' | 'email' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'location_ids' | 'avatar_url' | 'pin_hash' | 'is_active'
>

/**
 * In-memory PIN attempt tracking.
 * In production, replace with Redis for persistence across instances.
 */
const pinAttempts = new Map<
  string,
  { count: number; lockedUntil: number | null }
>()

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes

function getAttemptState(userId: string) {
  const state = pinAttempts.get(userId)
  if (!state) return { count: 0, lockedUntil: null }

  // Clear expired lockouts
  if (state.lockedUntil && Date.now() > state.lockedUntil) {
    pinAttempts.delete(userId)
    return { count: 0, lockedUntil: null }
  }

  return state
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { user_id?: string; pin?: string }
    const { user_id, pin } = body

    if (!user_id || !pin) {
      return NextResponse.json(
        { error: 'User ID and PIN are required.' },
        { status: 400 }
      )
    }

    // Check lockout
    const attemptState = getAttemptState(user_id)
    if (attemptState.lockedUntil && Date.now() < attemptState.lockedUntil) {
      const remainingMs = attemptState.lockedUntil - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60_000)
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`,
          locked_until: attemptState.lockedUntil,
        },
        { status: 429 }
      )
    }

    // Fetch user with pin_hash
    const admin = createAdminClient()
    const { data, error: userError } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, pin_hash, is_active')
      .eq('id', user_id)
      .single()

    const user = data as UserWithPin | null

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found.' },
        { status: 404 }
      )
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'This account has been deactivated.' },
        { status: 401 }
      )
    }

    if (!user.pin_hash) {
      return NextResponse.json(
        { error: 'PIN login is not set up for this account. Use email login instead.' },
        { status: 400 }
      )
    }

    // Verify PIN with bcrypt
    const pinValid = await bcrypt.compare(pin, user.pin_hash)

    if (!pinValid) {
      const newCount = attemptState.count + 1
      const locked = newCount >= MAX_ATTEMPTS

      pinAttempts.set(user_id, {
        count: newCount,
        lockedUntil: locked ? Date.now() + LOCKOUT_DURATION_MS : null,
      })

      if (locked) {
        return NextResponse.json(
          {
            error: 'Too many failed attempts. Account locked for 5 minutes.',
            locked_until: Date.now() + LOCKOUT_DURATION_MS,
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error: 'Incorrect PIN.',
          attempts_remaining: MAX_ATTEMPTS - newCount,
        },
        { status: 401 }
      )
    }

    // PIN is valid — clear attempts
    pinAttempts.delete(user_id)

    const displayName =
      user.display_name ||
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.email ||
      'User'

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
        role: user.role,
        org_id: user.org_id,
        location_ids: user.location_ids ?? [],
        avatar_url: user.avatar_url,
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
