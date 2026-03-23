import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/integrations/quickbooks-client'

/**
 * QuickBooks OAuth 2.0 Callback
 *
 * Handles the redirect from Intuit after authorization.
 * Exchanges the auth code for tokens and stores the connection.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'
  const settingsUrl = `${appUrl}/settings/integrations/quickbooks`

  if (error) {
    console.error('[qbo-callback] Authorization error:', error)
    return NextResponse.redirect(`${settingsUrl}?error=authorization_denied`)
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=missing_params`)
  }

  let stateData: { location_id: string; sandbox: boolean }
  try {
    stateData = JSON.parse(state)
  } catch {
    return NextResponse.redirect(`${settingsUrl}?error=invalid_state`)
  }

  const result = await exchangeCodeForTokens(
    code,
    realmId,
    stateData.location_id,
    stateData.sandbox
  )

  if (!result.success) {
    return NextResponse.redirect(`${settingsUrl}?error=token_exchange_failed`)
  }

  return NextResponse.redirect(`${settingsUrl}?connected=true`)
}
