import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const mergeSchema = z.object({
  primary_id: z.string().uuid(),
  secondary_id: z.string().uuid(),
}).refine((data) => data.primary_id !== data.secondary_id, {
  message: 'Primary and secondary customer must be different',
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { primary_id, secondary_id } = parsed.data
  const supabase = createAdminClient()

  // Fetch both customers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: primary, error: pErr } = await (supabase.from('customers') as any)
    .select('*')
    .eq('id', primary_id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (pErr || !primary) {
    return NextResponse.json({ error: 'Primary customer not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: secondary, error: sErr } = await (supabase.from('customers') as any)
    .select('*')
    .eq('id', secondary_id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (sErr || !secondary) {
    return NextResponse.json({ error: 'Secondary customer not found' }, { status: 404 })
  }

  // Combine stats
  const combinedVisits = (primary.total_visits ?? 0) + (secondary.total_visits ?? 0)
  const combinedSpend = parseFloat(primary.total_spend ?? '0') + parseFloat(secondary.total_spend ?? '0')

  // Merge tags (deduplicate)
  const mergedTags = Array.from(new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])]))

  // Merge allergies (deduplicate)
  const mergedAllergies = Array.from(new Set([...(primary.allergies ?? []), ...(secondary.allergies ?? [])]))

  // Merge dietary preferences
  const mergedDietary = Array.from(new Set([...(primary.dietary_preferences ?? []), ...(secondary.dietary_preferences ?? [])]))

  // Determine last visit
  const primaryVisit = primary.last_visit_at ? new Date(primary.last_visit_at).getTime() : 0
  const secondaryVisit = secondary.last_visit_at ? new Date(secondary.last_visit_at).getTime() : 0
  const lastVisitAt = primaryVisit >= secondaryVisit ? primary.last_visit_at : secondary.last_visit_at

  // Update primary with merged data
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('customers') as any)
    .update({
      total_visits: combinedVisits,
      total_spend: combinedSpend.toFixed(2),
      last_visit_at: lastVisitAt,
      tags: mergedTags,
      allergies: mergedAllergies,
      dietary_preferences: mergedDietary,
      notes: [primary.notes, secondary.notes].filter(Boolean).join('\n---\n') || null,
      is_vip: primary.is_vip || secondary.is_vip,
      updated_at: now,
    })
    .eq('id', primary_id)

  // Move orders from secondary to primary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({ customer_id: primary_id, updated_at: now })
    .eq('customer_id', secondary_id)
    .eq('org_id', user.org_id)

  // Move addresses from secondary to primary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('customer_addresses') as any)
    .update({ customer_id: primary_id })
    .eq('customer_id', secondary_id)

  // Soft-delete secondary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('customers') as any)
    .update({ deleted_at: now, updated_at: now })
    .eq('id', secondary_id)

  // Create audit log entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('audit_log') as any)
    .insert({
      org_id: user.org_id,
      user_id: user.id,
      action: 'customer.merged',
      entity_type: 'customer',
      entity_id: primary_id,
      details: {
        primary_id,
        secondary_id,
        combined_visits: combinedVisits,
        combined_spend: combinedSpend.toFixed(2),
      },
    })

  // Fetch updated primary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: merged } = await (supabase.from('customers') as any)
    .select('*')
    .eq('id', primary_id)
    .single()

  return NextResponse.json({ data: merged })
}
