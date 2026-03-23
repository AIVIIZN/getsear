import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { testWebhookEndpoint } from '@/lib/integrations/webhook-dispatcher'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: endpoint, error } = await (supabase.from('webhook_endpoints') as any)
    .select('*')
    .eq('id', id)
    .single()

  if (error || !endpoint) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  const result = await testWebhookEndpoint(endpoint)

  return NextResponse.json({
    data: {
      success: result.success,
      status_code: result.statusCode,
      response_time_ms: result.responseTimeMs,
      error: result.error,
    },
  })
}
