/**
 * Catering invoice PDF template.
 */

export interface InvoiceData {
  invoice_number: string
  event_name: string
  event_date: string
  guest_count: number
  contact_name: string
  contact_email: string
  contact_address: string
  line_items: Array<{
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  deposit_paid: number
  balance_due: number
  due_date: string
  payment_terms: string
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  restaurant_email: string
}

export function generateInvoiceHtml(data: InvoiceData): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
    <div>
      <h1 style="font-size: 28px; font-weight: 700; color: #F06B18; margin: 0;">INVOICE</h1>
      <p style="font-size: 13px; color: #666; margin: 4px 0 0;">#${data.invoice_number}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 16px; font-weight: 600; margin: 0;">${data.restaurant_name}</p>
      <p style="font-size: 12px; color: #666; margin: 4px 0 0;">${data.restaurant_address}</p>
      <p style="font-size: 12px; color: #666; margin: 2px 0 0;">${data.restaurant_phone}</p>
      <p style="font-size: 12px; color: #666; margin: 2px 0 0;">${data.restaurant_email}</p>
    </div>
  </div>

  <!-- Bill To / Event -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
    <div>
      <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 8px;">Bill To</h3>
      <p style="font-size: 14px; font-weight: 600; margin: 0;">${data.contact_name}</p>
      <p style="font-size: 12px; color: #666; margin: 4px 0 0;">${data.contact_email}</p>
      ${data.contact_address ? `<p style="font-size: 12px; color: #666; margin: 2px 0 0;">${data.contact_address}</p>` : ''}
    </div>
    <div>
      <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 8px;">Event Details</h3>
      <p style="font-size: 14px; font-weight: 600; margin: 0;">${data.event_name}</p>
      <p style="font-size: 12px; color: #666; margin: 4px 0 0;">Date: ${data.event_date}</p>
      <p style="font-size: 12px; color: #666; margin: 2px 0 0;">Guests: ${data.guest_count}</p>
    </div>
  </div>

  <!-- Line Items -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background: #F5F5F4;">
        <th style="text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666;">Description</th>
        <th style="text-align: center; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Qty</th>
        <th style="text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Unit Price</th>
        <th style="text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${data.line_items.map((item) => `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 10px 12px; font-size: 13px;">${item.description}</td>
          <td style="text-align: center; padding: 10px 12px; font-size: 13px;">${item.quantity}</td>
          <td style="text-align: right; padding: 10px 12px; font-size: 13px;">$${item.unit_price.toFixed(2)}</td>
          <td style="text-align: right; padding: 10px 12px; font-size: 13px; font-weight: 500;">$${item.total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="display: flex; justify-content: flex-end;">
    <table style="width: 280px; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #666;">Subtotal</td><td style="text-align: right;">$${data.subtotal.toFixed(2)}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Tax (${data.tax_rate}%)</td><td style="text-align: right;">$${data.tax_amount.toFixed(2)}</td></tr>
      <tr style="border-top: 2px solid #333;">
        <td style="padding: 8px 0; font-weight: 700;">Total</td>
        <td style="text-align: right; font-weight: 700;">$${data.total.toFixed(2)}</td>
      </tr>
      <tr><td style="padding: 6px 0; color: #22C55E;">Deposit Paid</td><td style="text-align: right; color: #22C55E;">-$${data.deposit_paid.toFixed(2)}</td></tr>
      <tr style="border-top: 2px solid #F06B18;">
        <td style="padding: 8px 0; font-weight: 700; color: #F06B18;">Balance Due</td>
        <td style="text-align: right; font-weight: 700; font-size: 18px; color: #F06B18;">$${data.balance_due.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  <!-- Payment Info -->
  <div style="margin-top: 32px; padding: 16px; background: #FFF7ED; border-radius: 8px; border-left: 4px solid #F06B18;">
    <p style="font-size: 12px; font-weight: 600; margin: 0;">Payment Terms: ${data.payment_terms}</p>
    <p style="font-size: 12px; color: #666; margin: 4px 0 0;">Due Date: ${data.due_date}</p>
  </div>

  <div style="text-align: center; margin-top: 48px; padding-top: 16px; border-top: 2px solid #F06B18;">
    <p style="font-size: 11px; color: #888;">Thank you for your business!</p>
    <p style="font-size: 11px; color: #888;">${data.restaurant_name} | Generated by Sear POS</p>
  </div>
</body>
</html>`
}
