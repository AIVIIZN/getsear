import { apiError } from '@/lib/api/error-response'
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
    return apiError(500, 'Failed to fetch insights')
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  if (parsed.data.action === 'dismiss') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('ai_insights') as any)
      .update({ is_dismissed: true })
      .eq('id', parsed.data.insight_id)
      .eq('org_id', user.org_id)

    if (error) {
      return apiError(500, 'Failed to dismiss insight')
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
      return apiError(500, 'Failed to save feedback')
    }

    return NextResponse.json({ success: true })
  }

  return apiError(400, 'Unknown action')
}
