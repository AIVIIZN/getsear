import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getAuthorizationUrl } from '@/lib/integrations/quickbooks-client'

const ConnectSchema = z.object({
  location_id: z.string().uuid(),
  is_sandbox: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = ConnectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const authUrl = getAuthorizationUrl(parsed.data.location_id, parsed.data.is_sandbox)

  return NextResponse.json({ data: { authorization_url: authUrl } })
}
