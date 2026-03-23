import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { testSendGridConnection } from '@/lib/integrations/sendgrid-client'

const TestSchema = z.object({
  api_key: z.string().min(1),
  sender_email: z.string().email(),
  sender_name: z.string().min(1),
  test_to: z.string().email(),
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

  const result = await testSendGridConnection(
    parsed.data.api_key,
    parsed.data.sender_email,
    parsed.data.sender_name,
    parsed.data.test_to
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { success: true } })
}
