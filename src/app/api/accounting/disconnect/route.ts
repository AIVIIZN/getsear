import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

export async function POST() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  // In production: revoke tokens via Intuit revoke endpoint
  // POST https://developer.api.intuit.com/v2/oauth2/tokens/revoke
  const { error } = await supabase.from('accounting_integrations')
    .update({
      is_connected: false,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      realm_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', user.org_id)
    .eq('provider', 'quickbooks')

  if (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
