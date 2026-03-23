import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateInvoiceHtml } from '@/lib/catering/invoice-template'

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
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: org } = await db
    .from('organizations')
    .select('name, address, phone, email')
    .eq('id', user.org_id)
    .single()

  const guestCount = (event.guest_count as number) ?? 0
  const menuSelections = (event.menu_selections as Array<Record<string, unknown>>) ?? []

  const lineItems = menuSelections.flatMap((course) => {
    const items = (course.items as Array<Record<string, unknown>>) ?? []
    return items.map((item) => ({
      description: `${course.course}: ${item.name}`,
      quantity: guestCount,
      unit_price: (item.price_per_person as number) ?? 0,
      total: ((item.price_per_person as number) ?? 0) * guestCount,
    }))
  })

  if (event.bar_package && event.bar_price) {
    lineItems.push({
      description: `Bar Package: ${event.bar_package}`,
      quantity: guestCount,
      unit_price: event.bar_price as number,
      total: (event.bar_price as number) * guestCount,
    })
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxRate = 8.5
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  const depositPaid = (event.deposit_amount as number) ?? 0
  const balanceDue = total - depositPaid

  const invoiceData = {
    invoice_number: `INV-${(event.id as string).slice(-6).toUpperCase()}`,
    event_name: (event.name as string) ?? '',
    event_date: new Date(event.event_date as string).toLocaleDateString(),
    guest_count: guestCount,
    contact_name: (event.contact_name as string) ?? '',
    contact_email: (event.contact_email as string) ?? '',
    contact_address: (event.contact_address as string) ?? '',
    line_items: lineItems,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    deposit_paid: depositPaid,
    balance_due: balanceDue,
    due_date: new Date(event.event_date as string).toLocaleDateString(),
    payment_terms: 'Due upon receipt',
    restaurant_name: (org?.name as string) ?? '',
    restaurant_address: (org?.address as string) ?? '',
    restaurant_phone: (org?.phone as string) ?? '',
    restaurant_email: (org?.email as string) ?? '',
  }

  const html = generateInvoiceHtml(invoiceData)

  const format = new URL(request.url).searchParams.get('format')
  if (format === 'html') {
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  return NextResponse.json({ data: invoiceData, html })
}
