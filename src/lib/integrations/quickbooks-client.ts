/**
 * QuickBooks Online Client
 *
 * OAuth 2.0 flow management, token refresh, and QBO API wrapper.
 * Supports both sandbox and production environments.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { encrypt, decrypt } from './config-store'

const QBO_AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2'
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

const QBO_SANDBOX_BASE = 'https://sandbox-quickbooks.api.intuit.com'
const QBO_PRODUCTION_BASE = 'https://quickbooks.api.intuit.com'

export interface QboConnection {
  id: string
  location_id: string
  realm_id: string
  company_name: string
  access_token: string
  refresh_token: string
  access_token_expires_at: string
  refresh_token_expires_at: string
  is_sandbox: boolean
  sync_frequency: 'daily' | 'manual'
  sync_config: {
    sales: boolean
    refunds: boolean
    tips: boolean
    tax: boolean
  }
  last_sync_at: string | null
  connected_at: string
  is_active: boolean
}

/**
 * Get QBO environment config from env vars.
 */
function getQboEnvConfig() {
  return {
    clientId: process.env.QBO_CLIENT_ID ?? '',
    clientSecret: process.env.QBO_CLIENT_SECRET ?? '',
    redirectUri: process.env.QBO_REDIRECT_URI ?? '',
  }
}

/**
 * Generate OAuth 2.0 authorization URL.
 */
export function getAuthorizationUrl(locationId: string, isSandbox: boolean = true): string {
  const { clientId, redirectUri } = getQboEnvConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: JSON.stringify({ location_id: locationId, sandbox: isSandbox }),
  })

  return `${QBO_AUTH_BASE}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string, realmId: string, locationId: string, isSandbox: boolean): Promise<{
  success: boolean
  error?: string
}> {
  const { clientId, clientSecret, redirectUri } = getQboEnvConfig()
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('[qbo] Token exchange failed:', body)
    return { success: false, error: 'Failed to exchange authorization code' }
  }

  const tokens = await response.json()

  // Fetch company name from QBO
  let companyName = 'QuickBooks Company'
  try {
    const baseUrl = isSandbox ? QBO_SANDBOX_BASE : QBO_PRODUCTION_BASE
    const infoRes = await fetch(`${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=65`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/json',
      },
    })
    if (infoRes.ok) {
      const info = await infoRes.json()
      companyName = info.CompanyInfo?.CompanyName ?? companyName
    }
  } catch {
    // Non-critical — use default name
  }

  // Store connection
  const supabase = createAdminClient()
  const now = new Date()
  const accessExpires = new Date(now.getTime() + tokens.expires_in * 1000)
  const refreshExpires = new Date(now.getTime() + (tokens.x_refresh_token_expires_in ?? 8640000) * 1000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('qbo_connections') as any)
    .upsert({
      location_id: locationId,
      realm_id: realmId,
      company_name: companyName,
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      access_token_expires_at: accessExpires.toISOString(),
      refresh_token_expires_at: refreshExpires.toISOString(),
      is_sandbox: isSandbox,
      sync_frequency: 'daily',
      sync_config: { sales: true, refunds: true, tips: true, tax: true },
      connected_at: now.toISOString(),
      is_active: true,
    }, { onConflict: 'location_id' })

  if (error) {
    console.error('[qbo] Failed to store connection:', error.message)
    return { success: false, error: 'Failed to store connection' }
  }

  return { success: true }
}

/**
 * Get QBO connection for a location.
 */
export async function getQboConnection(locationId: string): Promise<QboConnection | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('qbo_connections') as any)
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  return {
    ...data,
    access_token: decrypt(data.access_token_enc),
    refresh_token: decrypt(data.refresh_token_enc),
  }
}

/**
 * Refresh the QBO access token if expired.
 * Returns the valid access token.
 */
export async function ensureValidToken(locationId: string): Promise<string | null> {
  const connection = await getQboConnection(locationId)
  if (!connection) return null

  const now = new Date()
  const accessExpires = new Date(connection.access_token_expires_at)
  const refreshExpires = new Date(connection.refresh_token_expires_at)

  // Check if refresh token is expired
  if (now >= refreshExpires) {
    console.error('[qbo] Refresh token expired for location:', locationId)
    // Mark connection as inactive
    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('qbo_connections') as any)
      .update({ is_active: false })
      .eq('location_id', locationId)
    return null
  }

  // If access token still valid (with 5 min buffer), return it
  if (now < new Date(accessExpires.getTime() - 5 * 60 * 1000)) {
    return connection.access_token
  }

  // Refresh the access token
  const { clientId, clientSecret } = getQboEnvConfig()
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }).toString(),
  })

  if (!response.ok) {
    console.error('[qbo] Token refresh failed:', await response.text())
    return null
  }

  const tokens = await response.json()
  const newAccessExpires = new Date(now.getTime() + tokens.expires_in * 1000)
  const newRefreshExpires = new Date(now.getTime() + (tokens.x_refresh_token_expires_in ?? 8640000) * 1000)

  // Update stored tokens
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('qbo_connections') as any)
    .update({
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      access_token_expires_at: newAccessExpires.toISOString(),
      refresh_token_expires_at: newRefreshExpires.toISOString(),
    })
    .eq('location_id', locationId)

  return tokens.access_token
}

/**
 * Make an authenticated QBO API request.
 */
export async function qboApiRequest(
  locationId: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const token = await ensureValidToken(locationId)
  if (!token) {
    return { success: false, error: 'QuickBooks not connected or token expired' }
  }

  const connection = await getQboConnection(locationId)
  if (!connection) return { success: false, error: 'QuickBooks not connected' }

  const baseUrl = connection.is_sandbox ? QBO_SANDBOX_BASE : QBO_PRODUCTION_BASE
  const url = `${baseUrl}/v3/company/${connection.realm_id}${path}?minorversion=65`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  }

  const options: RequestInit = { method, headers }

  if (body && method === 'POST') {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMsg = `QBO API error: ${response.status}`
    try {
      const parsed = JSON.parse(errorBody)
      errorMsg = parsed.Fault?.Error?.[0]?.Detail ?? errorMsg
    } catch {
      // use status code
    }
    return { success: false, error: errorMsg }
  }

  const data = await response.json()
  return { success: true, data }
}

/**
 * Fetch chart of accounts from QBO.
 */
export async function fetchAccounts(locationId: string): Promise<{
  success: boolean
  accounts?: Array<{ id: string; name: string; type: string; number?: string }>
  error?: string
}> {
  const result = await qboApiRequest(
    locationId,
    'GET',
    '/query',
  )

  // Need to use query endpoint properly
  const token = await ensureValidToken(locationId)
  if (!token) return { success: false, error: 'Not connected' }

  const connection = await getQboConnection(locationId)
  if (!connection) return { success: false, error: 'Not connected' }

  const baseUrl = connection.is_sandbox ? QBO_SANDBOX_BASE : QBO_PRODUCTION_BASE
  const query = encodeURIComponent("SELECT * FROM Account WHERE Active = true ORDERBY Name")
  const url = `${baseUrl}/v3/company/${connection.realm_id}/query?query=${query}&minorversion=65`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    return { success: false, error: `Failed to fetch accounts: ${response.status}` }
  }

  const data = await response.json()
  const qboAccounts = data.QueryResponse?.Account ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = qboAccounts.map((a: any) => ({
    id: a.Id,
    name: a.Name,
    type: a.AccountType,
    number: a.AcctNum ?? undefined,
  }))

  return { success: true, accounts }
}

/**
 * Disconnect QuickBooks by revoking tokens and deactivating.
 */
export async function disconnectQbo(locationId: string): Promise<{ success: boolean; error?: string }> {
  const connection = await getQboConnection(locationId)
  if (!connection) return { success: false, error: 'Not connected' }

  // Revoke token
  try {
    const { clientId, clientSecret } = getQboEnvConfig()
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    await fetch(QBO_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: connection.refresh_token }),
    })
  } catch {
    // Non-critical if revoke fails
  }

  // Deactivate connection
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('qbo_connections') as any)
    .update({ is_active: false })
    .eq('location_id', locationId)

  return { success: true }
}
