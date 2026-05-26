import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'location_id required')
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
    return apiError(400, parsed.error.issues[0].message)
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
    return apiError(500, err instanceof Error ? err.message : 'Failed to save config')
  }
}
