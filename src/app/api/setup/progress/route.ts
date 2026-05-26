import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const progressSchema = z.object({
  current_step: z.number().int().min(0).max(10),
  completed_steps: z.array(z.number().int().min(0).max(10)),
  data: z.record(z.string(), z.unknown()),
})

/**
 * GET /api/setup/progress
 * Returns the setup wizard progress for the authenticated user's org.
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('setup_progress') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    // No progress yet — return defaults
    return NextResponse.json({
      current_step: 0,
      completed_steps: [],
      data: {},
    })
  }

  return NextResponse.json({
    current_step: data.current_step ?? 0,
    completed_steps: data.completed_steps ?? [],
    data: data.data ?? {},
  })
}

/**
 * PUT /api/setup/progress
 * Saves setup wizard progress for the authenticated user's org.
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = progressSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Upsert progress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('setup_progress') as any)
    .upsert(
      {
        org_id: user.org_id,
        user_id: user.id,
        current_step: parsed.data.current_step,
        completed_steps: parsed.data.completed_steps,
        data: parsed.data.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )

  if (error) {
    // If table doesn't exist yet, fail gracefully
    console.error('Failed to save setup progress:', error)
    return NextResponse.json({ saved: false })
  }

  return NextResponse.json({ saved: true })
}
