import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProposalHtml } from '@/lib/catering/proposal-template'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const db = createAdminClient()

  const { data: event, error } = await db
    .from('catering_events')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !event) {
    return apiError(404, 'Event not found')
  }

  const { data: org } = await db
    .from('organizations')
    .select('name, address, phone, email')
    .eq('id', user.org_id)
    .single()

  const guestCount = (event.guest_count as number) ?? 0
  const menuSelections = (event.menu_selections as Array<Record<string, unknown>>) ?? []
  const subtotal = menuSelections.reduce((sum, course) => {
    const items = (course.items as Array<Record<string, unknown>>) ?? []
    return sum + items.reduce((s, item) => s + ((item.price_per_person as number) ?? 0) * guestCount, 0)
  }, 0)

  const taxRate = 8.5
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  const depositPct = (event.deposit_pct as number) ?? 50
  const depositAmount = total * (depositPct / 100)

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 14)

  const proposalData = {
    event_name: (event.name as string) ?? '',
    event_date: new Date(event.event_date as string).toLocaleDateString(),
    guest_count: guestCount,
    contact_name: (event.contact_name as string) ?? '',
    contact_email: (event.contact_email as string) ?? '',
    packages: menuSelections.map((course) => ({
      name: (course.course as string) ?? 'Package',
      description: '',
      items: ((course.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
        name: (item.name as string) ?? '',
        price_per_person: (item.price_per_person as number) ?? 0,
      })),
      price_per_person: ((course.items as Array<Record<string, unknown>>) ?? []).reduce(
        (s, item) => s + ((item.price_per_person as number) ?? 0), 0
      ),
    })),
    selected_package_index: 0,
    bar_options: event.bar_package ? [{ name: event.bar_package as string, price_per_person: (event.bar_price as number) ?? 0 }] : [],
    selected_bar_index: event.bar_package ? 0 : null,
    addons: [],
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    deposit_pct: depositPct,
    deposit_amount: depositAmount,
    terms: [
      `A ${depositPct}% deposit is required to confirm your event.`,
      'Deposits are non-refundable within 48 hours of the event.',
      'Final guest count must be confirmed 72 hours prior to the event.',
      'Menu substitutions may be available upon request.',
      'Pricing does not include gratuity.',
    ],
    restaurant_name: (org?.name as string) ?? '',
    restaurant_address: (org?.address as string) ?? '',
    restaurant_phone: (org?.phone as string) ?? '',
    restaurant_email: (org?.email as string) ?? '',
    valid_until: validUntil.toLocaleDateString(),
  }

  const html = generateProposalHtml(proposalData)

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  return NextResponse.json({ data: proposalData, html })
}
