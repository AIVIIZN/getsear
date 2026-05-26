import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface DeviceInfo {
  user_agent: string
  screen_width: number
  screen_height: number
  platform: string
  standalone: boolean
}

/**
 * POST /api/terminals/activate
 * Activate a terminal using its 6-digit registration code.
 * This is a PUBLIC endpoint (no auth required) — called from the device being registered.
 */
export async function POST(request: Request) {
  let body: { registration_code: string; device_info: DeviceInfo }
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const { registration_code, device_info } = body

  if (!registration_code || registration_code.length !== 6) {
    return apiError(400, 'A valid 6-digit registration code is required')
  }

  if (!device_info) {
    return apiError(400, 'device_info is required')
  }

  const supabase = createAdminClient()

  // Find terminal with this code
  const { data: terminal, error: findError } = await supabase.from('terminals')
    .select('id, name, location_id, default_view, registration_code_expires_at')
    .eq('registration_code', registration_code)
    .is('device_fingerprint', null)
    .single()

  if (findError || !terminal) {
    return apiError(404, 'Invalid registration code')
  }

  // Check expiry
  const expiresAt = new Date(terminal.registration_code_expires_at)
  if (expiresAt < new Date()) {
    return apiError(410, 'Registration code has expired')
  }

  // Activate the terminal
  const { error: updateError } = await supabase.from('terminals')
    .update({
      device_fingerprint: {
        user_agent: device_info.user_agent,
        screen_width: device_info.screen_width,
        screen_height: device_info.screen_height,
        platform: device_info.platform,
        standalone: device_info.standalone,
      },
      is_active: true,
      is_online: true,
      registration_code: null,
      registration_code_expires_at: null,
      last_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminal.id)

  if (updateError) {
    console.error('Terminal activate error:', updateError)
    return apiError(500, 'Failed to activate terminal')
  }

  return NextResponse.json({
    terminal_id: terminal.id,
    name: terminal.name,
    location_id: terminal.location_id,
    default_view: terminal.default_view,
  })
}
