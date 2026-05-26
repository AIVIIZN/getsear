import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const qrCreateSchema = z.object({
  location_id: z.string().uuid(),
  type: z.enum(['table', 'takeout', 'general']),
  table_number: z.string().optional(),
  label: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  let query = db
    .from('online_ordering_qr_codes')
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) return apiError(500, error.message)

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = qrCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  // Get location slug
  const { data: location } = await db
    .from('locations')
    .select('slug')
    .eq('id', parsed.data.location_id)
    .single()

  if (!location) {
    return apiError(404, 'Location not found')
  }

  // Build QR URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'
  let qrUrl = `${baseUrl}/order/${location.slug}`
  if (parsed.data.type === 'table' && parsed.data.table_number) {
    qrUrl += `?table=${parsed.data.table_number}`
  }

  const { data, error } = await db
    .from('online_ordering_qr_codes')
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      type: parsed.data.type,
      table_number: parsed.data.table_number ?? null,
      label: parsed.data.label ?? `${parsed.data.type} QR`,
      url: qrUrl,
    })
    .select()
    .single()

  if (error) return apiError(500, error.message)

  return NextResponse.json({ data }, { status: 201 })
}
