import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/accounting?error=${encodeURIComponent(error)}`, appUrl)
    )
  }

  if (!code || !realmId) {
    return NextResponse.redirect(
      new URL('/settings/accounting?error=Missing+authorization+code+or+realm+ID', appUrl)
    )
  }

  // In production: exchange code for tokens via Intuit OAuth2 token endpoint
  // POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  // For now, mock the token exchange
  const accessToken = `mock_access_token_${Date.now()}`
  const refreshToken = `mock_refresh_token_${Date.now()}`
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

  const supabase = createAdminClient()

  // Upsert the integration record
  const { error: dbError } = await supabase.from('accounting_integrations')
    .upsert(
      {
        org_id: user.org_id,
        provider: 'quickbooks',
        access_token: accessToken,
        refresh_token: refreshToken,
        realm_id: realmId,
        token_expires_at: expiresAt,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,provider' }
    )

  if (dbError) {
    return NextResponse.redirect(
      new URL('/settings/accounting?error=Failed+to+save+connection', appUrl)
    )
  }

  return NextResponse.redirect(
    new URL('/settings/accounting?success=Connected+to+QuickBooks', appUrl)
  )
}
