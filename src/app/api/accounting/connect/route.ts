import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import crypto from 'crypto'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const clientId = process.env.QBO_CLIENT_ID ?? 'MOCK_CLIENT_ID'
  const redirectUri = process.env.QBO_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'}/api/accounting/callback`
  const isSandbox = process.env.QBO_SANDBOX === 'true'

  const baseUrl = isSandbox
    ? 'https://appcenter.intuit.com/connect/oauth2'
    : 'https://appcenter.intuit.com/connect/oauth2'

  // CSRF state token — in production, store this in the session/DB and validate on callback
  const state = crypto.randomBytes(16).toString('hex')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state,
  })

  const url = `${baseUrl}?${params.toString()}`

  return NextResponse.json({ url, state })
}
