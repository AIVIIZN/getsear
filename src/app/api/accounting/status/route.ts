import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('accounting_integrations') as any)
    .select('is_connected, realm_id, last_sync_at, settings, updated_at')
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      data: {
        is_connected: false,
        realm_id: null,
        last_sync_at: null,
        settings: {},
      },
    })
  }

  return NextResponse.json({
    data: {
      is_connected: data.is_connected,
      realm_id: data.realm_id,
      last_sync_at: data.last_sync_at,
      settings: data.settings ?? {},
    },
  })
}
