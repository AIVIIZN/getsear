import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  crmGuestReadRoles,
  escapePostgrestLikePattern,
  hashGuestContactValue,
  normalizeGuestContactValue,
} from '@/lib/crm/api'

const lookupQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(320).optional(),
  name: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(8).default(5),
}).refine((value) => value.q || value.phone || value.email || value.name, {
  message: 'q, phone, email, or name is required',
})

type GuestLookupRow = {
  id: string
  display_name: string
  lifecycle_stage: string
  is_vip: boolean
  total_visits: number
  total_spend: string | number
  last_visit_at: string | null
  guest_contact_points?: {
    contact_type: string
    value: string
    normalized_value: string | null
    is_primary: boolean
  }[]
  guest_allergies?: { allergen: string; severity: string; is_active: boolean }[]
  guest_preferences?: { preference_category: string; preference_key: string }[]
}

function primaryContact(row: GuestLookupRow, type: 'phone' | 'email'): string | null {
  const contacts = row.guest_contact_points ?? []
  return contacts.find((contact) => contact.contact_type === type && contact.is_primary)?.value
    ?? contacts.find((contact) => contact.contact_type === type)?.value
    ?? null
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestReadRoles])
  if (roleErr) return roleErr

  const parsed = lookupQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { q, phone, email, name, limit } = parsed.data
  const supabase = createAdminClient()
  const guestIds = new Set<string>()
  const contactInputs = [
    phone || q ? { contact_type: 'phone' as const, value: phone ?? q ?? '' } : null,
    email || q ? { contact_type: 'email' as const, value: email ?? q ?? '' } : null,
  ].filter(Boolean) as { contact_type: 'phone' | 'email'; value: string }[]

  if (contactInputs.length > 0) {
    const hashes = Array.from(new Set(contactInputs.map((contact) => {
      const normalized = normalizeGuestContactValue(contact)
      return hashGuestContactValue(normalized)
    })))

    const { data: contactMatches } = await supabase
      .from('guest_contact_points')
      .select('guest_id')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .in('value_hash', hashes)
      .limit(limit)

    for (const row of contactMatches ?? []) guestIds.add((row as { guest_id: string }).guest_id)
  }

  const nameSearch = name ?? q
  if (nameSearch) {
    const safeName = escapePostgrestLikePattern(nameSearch)
    const { data: nameMatches } = await supabase
      .from('guests')
      .select('id')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .ilike('display_name', `%${safeName}%`)
      .limit(limit)

    for (const row of nameMatches ?? []) guestIds.add((row as { id: string }).id)
  }

  if (guestIds.size === 0) {
    return NextResponse.json({ data: [] })
  }

  const { data, error } = await supabase
    .from('guests')
    .select('id, display_name, lifecycle_stage, is_vip, total_visits, total_spend, last_visit_at, guest_contact_points(contact_type, value, normalized_value, is_primary), guest_allergies(allergen, severity, is_active), guest_preferences(preference_category, preference_key)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .in('id', Array.from(guestIds))
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Guest lookup failed' }, { status: 500 })
  }

  const rows = (data ?? []) as GuestLookupRow[]
  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      display_name: row.display_name,
      phone: primaryContact(row, 'phone'),
      email: primaryContact(row, 'email'),
      lifecycle_stage: row.lifecycle_stage,
      is_vip: row.is_vip,
      total_visits: row.total_visits,
      total_spend: Number(row.total_spend ?? 0),
      last_visit_at: row.last_visit_at,
      allergies: (row.guest_allergies ?? [])
        .filter((allergy) => allergy.is_active)
        .map(({ allergen, severity }) => ({ allergen, severity })),
      preferences: (row.guest_preferences ?? []).slice(0, 4).map(({ preference_category, preference_key }) => ({
        preference_category,
        preference_key,
      })),
    })),
  })
}
