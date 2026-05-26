import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getIntegrationConfigMasked, saveIntegrationConfig } from '@/lib/integrations/config-store'

const UpdateConfigSchema = z.object({
  location_id: z.string().uuid(),
  api_key: z.string().min(1).optional(),
  sender_email: z.string().email().optional(),
  sender_name: z.string().min(1).optional(),
  reply_to: z.string().email().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  notifications: z.object({
    receipts: z.boolean(),
    daily_reports: z.boolean(),
    marketing: z.boolean(),
    password_reset: z.boolean(),
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

  const config = await getIntegrationConfigMasked(locationId, 'sendgrid')

  return NextResponse.json({
    data: config ? {
      is_active: config.is_active,
      api_key: config.config.api_key ?? '',
      sender_email: config.config.sender_email ?? '',
      sender_name: config.config.sender_name ?? '',
      reply_to: config.config.reply_to ?? '',
      notifications: config.config.notifications ?? {
        receipts: true,
        daily_reports: true,
        marketing: false,
        password_reset: true,
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
    await saveIntegrationConfig(location_id, 'sendgrid', configFields, is_active ?? true)
    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    return apiError(500, err instanceof Error ? err.message : 'Failed to save config')
  }
}
