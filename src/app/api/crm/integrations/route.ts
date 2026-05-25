import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmIntegrationManageRoles, crmIntegrationReadRoles, summarizeIntegrationHealth } from '@/lib/crm/integrations'
import { createCrmIntegrationConnectionSchema, listCrmIntegrationsQuerySchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmIntegrationReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmIntegrationsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid integration query', details: parsed.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  let builder = db
    .from('crm_integration_connections')
    .select('*, crm_integration_events(id, event_type, direction, status, records_imported, records_failed, error_message, payload_summary, occurred_at), crm_webhook_events(id, event_name, delivery_id, signature_status, processing_status, error_message, received_at)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.category) builder = builder.eq('category', parsed.data.category)
  if (parsed.data.status) builder = builder.eq('status', parsed.data.status)

  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Failed to fetch CRM integrations' }, { status: 500 })

  const connections = (data ?? []).map((connection: Record<string, unknown>) => ({
    ...connection,
    health_summary: summarizeIntegrationHealth(connection as never),
  }))

  return NextResponse.json({ data: connections })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmIntegrationManageRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = createCrmIntegrationConnectionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid integration payload', details: parsed.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  const payload = {
    ...parsed.data,
    org_id: user.org_id,
    status: parsed.data.status ?? 'pending',
    sync_status: parsed.data.sync_status ?? 'idle',
    webhook_status: parsed.data.webhook_status ?? (parsed.data.category === 'webhooks' ? 'active' : 'not_configured'),
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  }

  const { data: existing } = await db
    .from('crm_integration_connections')
    .select('id')
    .eq('org_id', user.org_id)
    .eq('provider', parsed.data.provider)
    .eq('category', parsed.data.category)
    .is('deleted_at', null)
    .maybeSingle()

  const mutation = existing
    ? db
      .from('crm_integration_connections')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id)
      .eq('org_id', user.org_id)
    : db.from('crm_integration_connections').insert(payload)

  const { data, error } = await mutation.select().single()

  if (error || !data) return NextResponse.json({ error: 'Failed to save CRM integration' }, { status: 500 })

  await db.from('crm_integration_events').insert({
    org_id: user.org_id,
    location_id: parsed.data.location_id ?? null,
    connection_id: (data as { id: string }).id,
    event_type: 'connection.saved',
    direction: 'inbound',
    status: 'succeeded',
    payload_summary: { provider: parsed.data.provider, category: parsed.data.category, status: payload.status },
  })

  await audit.record({
    actor: user,
    action: 'crm_integration_connection_saved',
    entity_type: 'crm_integration_connection',
    entity_id: (data as { id: string }).id,
    after_state: data as Record<string, unknown>,
    description: `Saved ${parsed.data.display_name} CRM integration`,
    request,
    location_id: parsed.data.location_id ?? null,
  })

  return NextResponse.json({ data: { ...data, health_summary: summarizeIntegrationHealth(data as never) } }, { status: 201 })
}
