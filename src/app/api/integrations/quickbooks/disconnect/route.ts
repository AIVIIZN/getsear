import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { disconnectQbo } from '@/lib/integrations/quickbooks-client'

const DisconnectSchema = z.object({
  location_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = DisconnectSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const result = await disconnectQbo(parsed.data.location_id)

  if (!result.success) {
    return apiError(500, result.error)
  }

  return NextResponse.json({ data: { success: true } })
}
