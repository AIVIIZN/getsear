/**
 * Health check: ping Supabase to verify real internet connectivity.
 * navigator.onLine is unreliable (returns true if connected to LAN but no internet).
 * This pings the Supabase REST endpoint with a lightweight HEAD request.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://lbekiyxqemxozmghgmtp.supabase.co'
const HEALTH_ENDPOINT = `${SUPABASE_URL}/rest/v1/`
const PING_TIMEOUT_MS = 5000

/**
 * Ping Supabase to verify real connectivity.
 * Returns true if the server responds within the timeout.
 */
export async function pingHealth(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
    })

    clearTimeout(timeout)
    // Any response (even 401) means the server is reachable
    return response.status > 0
  } catch {
    return false
  }
}

/**
 * Get the current server time to detect time drift on the device.
 * Returns the server timestamp or null if unreachable.
 */
export async function getServerTime(): Promise<Date | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)

    const response = await fetch(HEALTH_ENDPOINT, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
    })

    clearTimeout(timeout)
    const dateHeader = response.headers.get('date')
    if (dateHeader) {
      return new Date(dateHeader)
    }
    return null
  } catch {
    return null
  }
}

/**
 * Calculate time drift between device and server.
 * Returns drift in milliseconds. Positive = device ahead, Negative = device behind.
 * Returns null if server is unreachable.
 */
export async function getTimeDrift(): Promise<number | null> {
  const serverTime = await getServerTime()
  if (!serverTime) return null
  return Date.now() - serverTime.getTime()
}

/**
 * Check if a Valor payment terminal is reachable on the local network.
 * Valor terminals expose a local HTTP endpoint for store-and-forward.
 * This checks a configurable IP/port.
 */
export async function pingValorTerminal(terminalIp: string, port: number = 8443): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    // Valor terminals expose a status endpoint on local network
    const response = await fetch(`https://${terminalIp}:${port}/status`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeout)
    return response.status > 0
  } catch {
    return false
  }
}
