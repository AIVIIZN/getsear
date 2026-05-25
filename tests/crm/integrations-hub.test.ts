import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { summarizeIntegrationHealth, verifyWebhookSignature } from '@/lib/crm/integrations'
import { createCrmIntegrationConnectionSchema, receiveCrmWebhookSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V12.2 integrations hub', () => {
  it('creates tenant-scoped integration and webhook tables with rollback coverage', () => {
    const migration = read('supabase/migrations/20260525203849_add_crm_integrations_hub.sql')
    const rollback = read('supabase/_rollbacks/20260525203849_add_crm_integrations_hub.rollback.sql')

    for (const table of ['crm_integration_connections', 'crm_integration_events', 'crm_webhook_events']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`tenant_select_${table}`)
      expect(migration).toContain(`service_role_bypass_${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain('credential_expires_at')
    expect(migration).toContain('records_imported_count')
    expect(migration).toContain('signature_status text NOT NULL')
  })

  it('validates integration connection and webhook payload contracts', () => {
    expect(createCrmIntegrationConnectionSchema.parse({
      category: 'webhooks',
      provider: 'restaurant-webhook',
      display_name: 'Restaurant webhook',
      credential_ref: 'CRM_WEBHOOK_SIGNING_SECRET',
    }).webhook_status).toBeUndefined()

    expect(receiveCrmWebhookSchema.parse({
      connection_id: '00000000-0000-0000-0000-000000000000',
      event_name: 'guest.created',
      delivery_id: 'evt_123',
      records_imported: 1,
      payload: { guest_id: 'g_1' },
    }).records_failed).toBe(0)

    expect(() => createCrmIntegrationConnectionSchema.parse({
      category: 'webhooks',
      provider: 'Bad Provider',
      display_name: 'Bad',
    })).toThrow()
  })

  it('verifies webhook signatures and summarizes health states', () => {
    const payload = JSON.stringify({ connection_id: '00000000-0000-0000-0000-000000000000', event_name: 'guest.created', payload: {} })
    const signature = createHmac('sha256', 'secret').update(payload).digest('hex')

    expect(verifyWebhookSignature(payload, `sha256=${signature}`, 'secret')).toBe(true)
    expect(verifyWebhookSignature(payload, `sha256=${signature}`, 'wrong')).toBe(false)
    expect(summarizeIntegrationHealth({ status: 'connected', sync_status: 'succeeded', webhook_status: 'active' }).severity).toBe('ok')
    expect(summarizeIntegrationHealth({ status: 'error', sync_status: 'failed', webhook_status: 'failing', last_error: 'bad signature' }).severity).toBe('critical')
  })

  it('ships authenticated dashboard, setup API, and signed webhook intake', () => {
    const listRoute = read('src/app/api/crm/integrations/route.ts')
    const webhookRoute = read('src/app/api/crm/integrations/webhooks/route.ts')
    const page = read('src/app/(backoffice)/settings/integrations/crm/page.tsx')
    const hub = read('src/app/(backoffice)/settings/integrations/page.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(listRoute).toContain('export async function GET')
    expect(listRoute).toContain('export async function POST')
    expect(listRoute).toContain('requireRole(user, [...crmIntegrationReadRoles])')
    expect(listRoute).toContain("from('crm_integration_connections')")
    expect(listRoute).toContain("from('crm_integration_events')")
    expect(listRoute).toContain("action: 'crm_integration_connection_saved'")
    expect(webhookRoute).toContain("checkRateLimit('public'")
    expect(webhookRoute).toContain('verifyWebhookSignature')
    expect(webhookRoute).toContain("signature_status: signatureStatus")
    expect(webhookRoute).toContain("processing_status: signatureVerified ? 'processed' : 'ignored'")
    expect(page).toContain('CRM Integrations')
    expect(page).toContain('/api/crm/integrations')
    expect(page).toContain('Webhook verification')
    expect(page).toContain('Skeleton')
    expect(page).toContain('EmptyState')
    expect(hub).toContain('/settings/integrations/crm')
    expect(auditLog).toContain("'crm_integration_connection_saved'")
  })
})
