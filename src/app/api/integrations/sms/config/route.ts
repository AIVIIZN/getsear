import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getIntegrationConfigMasked, saveIntegrationConfig } from '@/lib/integrations/config-store'

const UpdateConfigSchema = z.object({
  location_id: z.string().uuid(),
  account_sid: z.string().min(1).optional(),
  auth_token: z.string().min(1).optional(),
  phone_number: z.string().min(1).optional(),
  test_phone: z.string().optional(),
  is_active: z.boolean().optional(),
  notifications: z.object({
    order_ready: z.boolean(),
    reservation_reminder: z.boolean(),
    waitlist_alert: z.boolean(),
    marketing: z.boolean(),
  }).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'admin'])
  if (roleCheck) return roleCheck

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 })
  }

  const config = await getIntegrationConfigMasked(locationId, 'twilio')

  return NextResponse.json({
    data: config ? {
      is_active: config.is_active,
      account_sid: config.config.account_sid ?? '',
      auth_token: config.config.auth_token ?? '',
      phone_number: config.config.phone_number ?? '',
      test_phone: config.config.test_phone ?? '',
      notifications: config.config.notifications ?? {
        order_ready: true,
        reservation_reminder: true,
        waitlist_alert: true,
        marketing: false,
      },
    } : null,
  })
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = UpdateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { location_id, is_active, ...configFields } = parsed.data

  try {
    await saveIntegrationConfig(
      location_id,
      'twilio',
      configFields,
      is_active ?? true
    )

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save config' },
      { status: 500 }
    )
  }
}
