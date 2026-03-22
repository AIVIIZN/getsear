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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify QBO is connected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integration } = await (supabase.from('accounting_integrations') as any)
    .select('is_connected')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  if (!integration?.is_connected) {
    return NextResponse.json(
      { error: 'QuickBooks is not connected. Please connect first.' },
      { status: 400 }
    )
  }

  // In production: call QBO API to create journal entries / invoices based on sync_type
  // For now, mock the sync by logging it as completed

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: syncLog, error } = await (supabase.from('accounting_sync_log') as any)
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
    return NextResponse.json({ error: 'Failed to create sync log' }, { status: 500 })
  }

  // Update last_sync_at on the integration record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('accounting_integrations') as any)
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
