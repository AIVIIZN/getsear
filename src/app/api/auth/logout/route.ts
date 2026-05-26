import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch {
    return apiError(500, 'Failed to sign out. Please try again.')
  }
}
