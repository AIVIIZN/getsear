import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const actionSchema = z.object({
  action: z.enum(['dismiss', 'feedback']),
  insight_id: z.string().uuid(),
  feedback: z.enum(['helpful', 'not_helpful']).optional(),
})

/**
 * GET /api/ai/insights — list insights for the user's location
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()
  const locationId = user.location_ids[0] ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('ai_insights') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_dismissed', false)
    .order('generated_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/ai/insights — dismiss or provide feedback on an insight
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  if (parsed.data.action === 'dismiss') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('ai_insights') as any)
      .update({ is_dismissed: true })
      .eq('id', parsed.data.insight_id)
      .eq('org_id', user.org_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to dismiss insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'feedback') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('ai_insights') as any)
      .update({ feedback: parsed.data.feedback })
      .eq('id', parsed.data.insight_id)
      .eq('org_id', user.org_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
