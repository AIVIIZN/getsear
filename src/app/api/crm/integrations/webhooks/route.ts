import { NextRequest, NextResponse } from 'next/server'
import { applyRateLimitHeaders, checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { verifyWebhookSignature } from '@/lib/crm/integrations'
import { receiveCrmWebhookSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

function headersSnapshot(request: NextRequest) {
  return {
    'x-sear-signature': request.headers.get('x-sear-signature'),
    'x-provider-signature': request.headers.get('x-provider-signature'),
    'x-delivery-id': request.headers.get('x-delivery-id'),
    'user-agent': request.headers.get('user-agent'),
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit('public', `crm-webhook:${getClientIp(request)}`)
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ error: 'Too many webhook attempts' }, { status: 429 })
    applyRateLimitHeaders(response.headers, rateLimit)
    return response
  }

  const rawBody = await request.text()
  const parsedJson = (() => {
    try {
      return JSON.parse(rawBody)
    } catch {
      return null
    }
  })()
  const parsed = receiveCrmWebhookSchema.safeParse(parsedJson)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid webhook payload', details: parsed.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  const { data: connection, error } = await db
    .from('crm_integration_connections')
    .select('*')
    .eq('id', parsed.data.connection_id)
    .is('deleted_at', null)
    .single()

  if (error || !connection) return NextResponse.json({ error: 'Unknown webhook connection' }, { status: 404 })

  const credentialRef = (connection as { credential_ref?: string | null }).credential_ref
  const secret = credentialRef ? process.env[credentialRef] : null
  const signature = request.headers.get('x-sear-signature') ?? request.headers.get('x-provider-signature')
  const signatureVerified = Boolean(secret && verifyWebhookSignature(rawBody, signature, secret))
  const signatureStatus = signatureVerified ? 'verified' : signature ? 'failed' : 'missing'

  const webhookRow = {
    org_id: (connection as { org_id: string }).org_id,
    location_id: (connection as { location_id?: string | null }).location_id ?? null,
    connection_id: parsed.data.connection_id,
    provider: (connection as { provider: string }).provider,
    event_name: parsed.data.event_name,
    delivery_id: parsed.data.delivery_id ?? request.headers.get('x-delivery-id'),
    signature_status: signatureStatus,
    processing_status: signatureVerified ? 'processed' : 'ignored',
    headers: headersSnapshot(request),
    payload: parsed.data.payload,
    error_message: signatureVerified ? null : 'webhook_signature_verification_failed',
    processed_at: signatureVerified ? new Date().toISOString() : null,
  }

  const { data: event } = await db.from('crm_webhook_events').insert(webhookRow).select().single()
  await db.from('crm_integration_events').insert({
    org_id: webhookRow.org_id,
    location_id: webhookRow.location_id,
    connection_id: parsed.data.connection_id,
    event_type: parsed.data.event_name,
    direction: 'inbound',
    status: signatureVerified ? 'succeeded' : 'failed',
    records_imported: signatureVerified ? parsed.data.records_imported : 0,
    records_failed: signatureVerified ? parsed.data.records_failed : 1,
    error_message: signatureVerified ? null : 'webhook_signature_verification_failed',
    payload_summary: { webhook_event_id: (event as { id?: string } | null)?.id, delivery_id: webhookRow.delivery_id },
  })

  if (!signatureVerified) {
    const response = NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 401 })
    applyRateLimitHeaders(response.headers, rateLimit)
    return response
  }

  await db
    .from('crm_integration_connections')
    .update({
      webhook_status: 'active',
      last_error_at: null,
      last_error: null,
      records_imported_count: ((connection as { records_imported_count?: number | null }).records_imported_count ?? 0) + parsed.data.records_imported,
      records_failed_count: ((connection as { records_failed_count?: number | null }).records_failed_count ?? 0) + parsed.data.records_failed,
      last_sync_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      sync_status: parsed.data.records_failed > 0 ? 'failed' : 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.connection_id)
    .eq('org_id', webhookRow.org_id)

  const response = NextResponse.json({ data: event }, { status: 202 })
  applyRateLimitHeaders(response.headers, rateLimit)
  return response
}
