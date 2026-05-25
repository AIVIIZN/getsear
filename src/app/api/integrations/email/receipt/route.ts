import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/integrations/sendgrid-client'
import { renderReceiptEmail } from '@/lib/integrations/email-templates'

const ReceiptSchema = z.object({
  location_id: z.string().uuid(),
  order_id: z.string().uuid(),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager', 'server', 'bartender', 'cashier'])
  if (roleCheck) return roleCheck

  const body = await request.json()
  const parsed = ReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch order with items
   
  const { data: order, error: orderError } = await supabase.from('orders')
    .select(`
      id, order_number, order_type, subtotal, tax_total, tip_total, total,
      status, created_at, server_id, customer_id, metadata,
      location:locations(name, address_line1, city, state, zip)
    `)
    .eq('id', parsed.data.order_id)
    .eq('org_id', auth.org_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Fetch order items
   
  const { data: items } = await supabase.from('order_items')
    .select('id, name, quantity, unit_price, order_item_modifiers(name, quantity)')
    .eq('order_id', parsed.data.order_id)
    .eq('org_id', auth.org_id)

  // Fetch payment method
   
  const { data: payment } = await supabase.from('payments')
    .select('payment_method, card_brand, card_last_four')
    .eq('order_id', parsed.data.order_id)
    .eq('org_id', auth.org_id)
    .eq('status', 'captured')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch server name
  let serverName: string | undefined
  if (order.server_id) {
     
    const { data: server } = await supabase.from('users')
      .select('first_name, last_name')
      .eq('id', order.server_id)
      .maybeSingle()
    if (server) {
      serverName = `${server.first_name} ${server.last_name?.[0] ?? ''}.`
    }
  }

  // Fetch customer name
  let customerName: string | undefined
  if (order.customer_id) {
     
    const { data: customer } = await supabase.from('customers')
      .select('first_name, last_name')
      .eq('id', order.customer_id)
      .maybeSingle()
    if (customer) {
      customerName = `${customer.first_name} ${customer.last_name ?? ''}`.trim()
    }
  }

  // Supabase types treat embedded relations as arrays even when the FK is
  // many-to-one. Take the first row.
  const location = Array.isArray(order.location) ? order.location[0] : order.location
  const locationAddress = location
    ? `${location.address_line1 ?? ''}, ${location.city ?? ''}, ${location.state ?? ''} ${location.zip ?? ''}`
    : ''

  const receiptData = {
    locationName: location?.name ?? 'Restaurant',
    locationAddress,
    orderNumber: order.order_number?.toString() ?? order.id.slice(0, 8),
    orderDate: new Date(order.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    items: (items ?? []).map((item: {
      name: string
      quantity: number
      order_item_modifiers?: Array<{ name: string; quantity: number }>
      unit_price: string | number
    }) => ({
      name: item.name,
      quantity: item.quantity,
      modifiers: item.order_item_modifiers?.map((mod) => (
        mod.quantity > 1 ? `${mod.name} x${mod.quantity}` : mod.name
      )),
      price: Math.round(Number(item.unit_price) * 100),
    })),
    subtotal: Math.round(Number(order.subtotal ?? 0) * 100),
    tax: Math.round(Number(order.tax_total ?? 0) * 100),
    tip: Math.round(Number(order.tip_total ?? 0) * 100),
    total: Math.round(Number(order.total ?? 0) * 100),
    paymentMethod: payment?.card_brand ?? payment?.payment_method ?? 'Card',
    lastFour: payment?.card_last_four ?? undefined,
    customerName,
    serverName,
    feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'}/feedback/${order.id}`,
    loyaltySignupUrl: ((order.metadata as Record<string, unknown> | null)?.crm_checkout_capture as { consent?: { loyalty_signup?: boolean } } | undefined)?.consent?.loyalty_signup
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'}/loyalty/signup?order_id=${order.id}`
      : undefined,
    loyaltyQrUrl: ((order.metadata as Record<string, unknown> | null)?.crm_checkout_capture as { consent?: { loyalty_signup?: boolean } } | undefined)?.consent?.loyalty_signup
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com'}/api/loyalty/qr?order_id=${order.id}`
      : undefined,
    rewardProgressLabel: ((order.metadata as Record<string, unknown> | null)?.crm_guest_id as string | undefined)
      ? 'Your purchase can count toward your next reward.'
      : 'Start earning rewards with this visit.',
    personalizedThankYou: customerName ? `Thanks for visiting, ${customerName}.` : undefined,
  }

  const { subject, html } = renderReceiptEmail(receiptData)

  const result = await sendEmail({
    locationId: parsed.data.location_id,
    to: parsed.data.email,
    subject,
    html,
    templateType: 'receipt',
    idempotencyKey: `receipt:${parsed.data.order_id}:${parsed.data.email}`,
  })

  if (!result.success) {
    return NextResponse.json({ data: { sent: false, error: result.error } })
  }

  return NextResponse.json({
    data: { sent: true, messageId: result.messageId },
  })
}
