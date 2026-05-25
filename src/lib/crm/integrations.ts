import { createHmac, timingSafeEqual } from 'node:crypto'

export const crmIntegrationManageRoles = ['platform_admin', 'owner', 'admin'] as const
export const crmIntegrationReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing', 'analyst'] as const

export type CrmIntegrationConnectionHealth = {
  status: 'connected' | 'disconnected' | 'error' | 'expired' | 'pending'
  sync_status: 'idle' | 'syncing' | 'succeeded' | 'failed'
  webhook_status: 'active' | 'disabled' | 'failing' | 'not_configured'
  credential_expires_at?: string | null
  last_sync_at?: string | null
  last_error?: string | null
  records_imported_count?: number | null
  records_failed_count?: number | null
}

export function summarizeIntegrationHealth(connection: CrmIntegrationConnectionHealth): {
  severity: 'ok' | 'warning' | 'critical'
  label: string
  detail: string
} {
  if (connection.status === 'expired') {
    return { severity: 'critical', label: 'Credential expired', detail: 'Reconnect this provider before the next sync window.' }
  }
  if (connection.status === 'error' || connection.sync_status === 'failed' || connection.webhook_status === 'failing') {
    return { severity: 'critical', label: 'Sync failing', detail: connection.last_error || 'Review the latest integration event for the failing provider.' }
  }
  if (connection.status === 'pending' || connection.status === 'disconnected') {
    return { severity: 'warning', label: 'Needs connection', detail: 'Finish setup before guest, order, loyalty, or report data can flow.' }
  }
  if (connection.credential_expires_at && new Date(connection.credential_expires_at).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 14) {
    return { severity: 'warning', label: 'Credential expiring', detail: 'Refresh credentials within 14 days to avoid sync failure.' }
  }
  return { severity: 'ok', label: 'Healthy', detail: 'Last sync and webhook status are inside the expected operating range.' }
}

export function verifyWebhookSignature(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false
  const provided = signatureHeader.trim().replace(/^sha256=/, '')
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false

  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const providedBuffer = Buffer.from(provided, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (providedBuffer.length !== expectedBuffer.length) return false
  return timingSafeEqual(providedBuffer, expectedBuffer)
}
