import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const postShiftSchema = z.object({
  shift_id: z.string().uuid(),
  reason: z.string().min(1),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'open'

  const { data, error } = await db
    .from('shift_marketplace')
    .select('*, shifts(shift_date, start_time, end_time, name), users!shift_marketplace_posted_by_fkey(first_name, last_name), claimed_user:users!shift_marketplace_claimed_by_fkey(first_name, last_name)')
    .eq('org_id', user.org_id)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError(500, error.message)
  }

  const listings = (data ?? []).map((item: Record<string, unknown>) => {
    const shift = item.shifts as Record<string, unknown> | null
    const poster = item.users as Record<string, unknown> | null
    const claimer = item.claimed_user as Record<string, unknown> | null
    return {
      id: item.id,
      shift_id: item.shift_id,
      posted_by: item.posted_by,
      posted_by_name: poster ? `${poster.first_name ?? ''} ${poster.last_name ?? ''}`.trim() : 'Unknown',
      date: shift?.shift_date ?? '',
      start_time: shift?.start_time ?? '',
      end_time: shift?.end_time ?? '',
      role: shift?.name ?? '',
      reason: item.reason,
      status: item.status,
      claimed_by: item.claimed_by,
      claimed_by_name: claimer ? `${claimer.first_name ?? ''} ${claimer.last_name ?? ''}`.trim() : null,
      created_at: item.created_at,
    }
  })

  return NextResponse.json({ data: listings })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = postShiftSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  // Verify the shift belongs to this user
  const { data: shift } = await db
    .from('shifts')
    .select('id, staff_id')
    .eq('id', parsed.data.shift_id)
    .eq('staff_id', user.id)
    .single()

  if (!shift) {
    return apiError(404, 'Shift not found or not yours')
  }

  const { data, error } = await db
    .from('shift_marketplace')
    .insert({
      org_id: user.org_id,
      shift_id: parsed.data.shift_id,
      posted_by: user.id,
      reason: parsed.data.reason,
      status: 'available',
    })
    .select()
    .single()

  if (error) {
    return apiError(500, error.message)
  }

  // Mark shift as posted
  await db.from('shifts').update({ is_posted: true }).eq('id', parsed.data.shift_id)

  return NextResponse.json({ data }, { status: 201 })
}
