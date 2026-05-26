import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createCustomerSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().max(100).default(''),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).default([]),
  is_vip: z.boolean().default(false),
  birthday: z.string().optional().nullable(),
  allergies: z.array(z.string()).default([]),
  dietary_preferences: z.array(z.string()).default([]),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)))
  const sortBy = searchParams.get('sort_by') ?? 'last_name'
  const sortDir = searchParams.get('sort_dir') === 'desc' ? false : true
  const offset = (page - 1) * limit

  const supabase = createAdminClient()
  let query = supabase.from('customers')
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .is('deleted_at', null)

  if (search.trim()) {
    const s = `%${search.trim()}%`
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`)
  }

  const allowedSorts = ['first_name', 'last_name', 'total_visits', 'total_spend', 'last_visit_at', 'created_at']
  const col = allowedSorts.includes(sortBy) ? sortBy : 'last_name'
  query = query.order(col, { ascending: sortDir }).range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return apiError(500, 'Failed to fetch customers')
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Check for duplicates by phone or email
  if (parsed.data.phone || parsed.data.email) {
    let dupQuery = supabase.from('customers')
      .select('id, first_name, last_name, email, phone')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)

    const orParts: string[] = []
    if (parsed.data.phone) orParts.push(`phone.eq.${parsed.data.phone}`)
    if (parsed.data.email) orParts.push(`email.eq.${parsed.data.email}`)
    if (orParts.length > 0) {
      dupQuery = dupQuery.or(orParts.join(','))
    }

    const { data: duplicates } = await dupQuery
    if (duplicates && duplicates.length > 0) {
      return apiError(409, 'Potential duplicate found', { extra: { duplicates } })
    }
  }
  const { data, error } = await supabase.from('customers')
    .insert({
      org_id: user.org_id,
      ...parsed.data,
      total_visits: 0,
      total_spent: 0,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create customer')
  }

  return NextResponse.json({ data }, { status: 201 })
}
