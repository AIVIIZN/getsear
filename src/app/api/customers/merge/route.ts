import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { primary_id, secondary_id } = parsed.data
  const supabase = createAdminClient()

  // Fetch both customers
  const { data: primary, error: pErr } = await supabase.from('customers')
    .select('*')
    .eq('id', primary_id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (pErr || !primary) {
    return apiError(404, 'Primary customer not found')
  }
  const { data: secondary, error: sErr } = await supabase.from('customers')
    .select('*')
    .eq('id', secondary_id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (sErr || !secondary) {
    return apiError(404, 'Secondary customer not found')
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
  await supabase.from('customers')
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
  await supabase.from('orders')
    .update({ customer_id: primary_id, updated_at: now })
    .eq('customer_id', secondary_id)
    .eq('org_id', user.org_id)

  // Move addresses from secondary to primary
  await supabase.from('customer_addresses')
    .update({ customer_id: primary_id })
    .eq('customer_id', secondary_id)

  // Soft-delete secondary
  await supabase.from('customers')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', secondary_id)

  // Create audit log entry
  await supabase.from('audit_log')
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
  const { data: merged } = await supabase.from('customers')
    .select('*')
    .eq('id', primary_id)
    .single()

  return NextResponse.json({ data: merged })
}
