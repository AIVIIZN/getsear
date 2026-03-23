import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateSchema = z.object({
  ask_enabled: z.boolean().optional(),
  insights_enabled: z.boolean().optional(),
  predict_enabled: z.boolean().optional(),
  insight_delivery: z.enum(['dashboard', 'email', 'both']).optional(),
  insight_frequency: z.enum(['daily', 'weekly']).optional(),
  daily_query_limit: z.number().int().min(10).max(500).optional(),
  cost_alert_threshold_cents: z.number().int().min(0).optional(),
})

/**
 * GET /api/ai/settings — get AI configuration for the org
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('ai_settings') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's ok, return defaults
    return NextResponse.json({ error: 'Failed to fetch AI settings' }, { status: 500 })
  }

  const defaults = {
    ask_enabled: true,
    insights_enabled: true,
    predict_enabled: true,
    insight_delivery: 'dashboard',
    insight_frequency: 'daily',
    daily_query_limit: 50,
    cost_alert_threshold_cents: 5000, // $50
    has_api_key: !!process.env.ANTHROPIC_API_KEY,
  }

  return NextResponse.json({
    data: data ? { ...defaults, ...data, has_api_key: !!process.env.ANTHROPIC_API_KEY } : defaults,
  })
}

/**
 * PUT /api/ai/settings — update AI configuration
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('ai_settings') as any)
    .upsert(
      {
        org_id: user.org_id,
        ...parsed.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update AI settings' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
