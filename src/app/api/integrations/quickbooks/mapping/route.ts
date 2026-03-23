import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getAccountMappings, saveAccountMappings, type AccountMapping } from '@/lib/integrations/quickbooks-journal'

const SaveMappingSchema = z.object({
  location_id: z.string().uuid(),
  mappings: z.array(z.object({
    sear_category: z.string(),
    qbo_account_id: z.string(),
    qbo_account_name: z.string(),
  })),
})

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 })
  }

  const mappings = await getAccountMappings(locationId)
  return NextResponse.json({ data: mappings })
}

export async function PUT(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = SaveMappingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const result = await saveAccountMappings(
    parsed.data.location_id,
    parsed.data.mappings as AccountMapping[]
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
