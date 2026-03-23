import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/integrations/webhook-dispatcher'
import { randomBytes } from 'crypto'

const validEvents = WEBHOOK_EVENTS.map(e => e.value) as [string, ...string[]]

const CreateWebhookSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(validEvents as [WebhookEventType, ...WebhookEventType[]])).min(1),
  is_active: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('webhook_endpoints') as any)
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mask secrets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masked = (data ?? []).map((ep: any) => ({
    ...ep,
    secret: ep.secret ? `****${ep.secret.slice(-4)}` : '****',
  }))

  return NextResponse.json({ data: masked })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = CreateWebhookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check limit: max 10 per location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from('webhook_endpoints') as any)
    .select('id', { count: 'exact', head: true })
    .eq('location_id', parsed.data.location_id)

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Maximum 10 webhook endpoints per location' }, { status: 400 })
  }

  // Generate secret
  const secret = randomBytes(32).toString('hex')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('webhook_endpoints') as any)
    .insert({
      location_id: parsed.data.location_id,
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      events: parsed.data.events,
      is_active: parsed.data.is_active,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return full secret on creation only
  return NextResponse.json({ data })
}
