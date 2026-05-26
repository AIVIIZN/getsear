import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const syncSchema = z.object({
  sync_type: z.enum(['daily_sales', 'payments', 'labor']),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify QBO is connected
  const { data: integration } = await supabase.from('accounting_integrations')
    .select('is_connected')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  if (!integration?.is_connected) {
    return apiError(400, 'QuickBooks is not connected. Please connect first.')
  }

  // In production: call QBO API to create journal entries / invoices based on sync_type
  // For now, mock the sync by logging it as completed
  const { data: syncLog, error } = await supabase.from('accounting_sync_log')
    .insert({
      org_id: user.org_id,
      sync_type: parsed.data.sync_type,
      status: 'completed',
      data: {
        synced_by: user.id,
        records_synced: 0, // Mock — would be real count in production
        mock: true,
      },
    })
    .select('id, sync_type, status, data, created_at')
    .single()

  if (error) {
    return apiError(500, 'Failed to create sync log')
  }

  // Update last_sync_at on the integration record
  await supabase.from('accounting_integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')

  return NextResponse.json({
    sync_id: syncLog.id,
    status: syncLog.status,
    sync_type: syncLog.sync_type,
    created_at: syncLog.created_at,
  })
}
