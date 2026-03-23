import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { testTwilioConnection } from '@/lib/integrations/twilio-client'

const TestSchema = z.object({
  account_sid: z.string().min(1),
  auth_token: z.string().min(1),
  phone_number: z.string().min(1),
  test_to: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = TestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const result = await testTwilioConnection(
    parsed.data.account_sid,
    parsed.data.auth_token,
    parsed.data.phone_number,
    parsed.data.test_to
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { success: true, sid: result.sid } })
}
