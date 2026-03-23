/**
 * Catering proposal PDF template.
 */

export interface ProposalData {
  event_name: string
  event_date: string
  guest_count: number
  contact_name: string
  contact_email: string
  packages: Array<{
    name: string
    description: string
    items: Array<{ name: string; price_per_person: number }>
    price_per_person: number
  }>
  selected_package_index: number
  bar_options: Array<{
    name: string
    price_per_person: number
  }>
  selected_bar_index: number | null
  addons: Array<{
    name: string
    price: number
    is_per_person: boolean
  }>
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  deposit_pct: number
  deposit_amount: number
  terms: string[]
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  restaurant_email: string
  valid_until: string
}

export function generateProposalHtml(data: ProposalData): string {
  const selectedPkg = data.packages[data.selected_package_index]
  const selectedBar = data.selected_bar_index !== null ? data.bar_options[data.selected_bar_index] : null

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a;">
  <!-- Cover Header -->
  <div style="text-align: center; margin-bottom: 48px;">
    <div style="width: 80px; height: 4px; background: #F06B18; margin: 0 auto 24px;"></div>
    <h1 style="font-size: 32px; font-weight: 300; margin: 0; color: #333; letter-spacing: 2px;">CATERING PROPOSAL</h1>
    <p style="font-size: 18px; color: #F06B18; margin: 12px 0 0; font-weight: 500;">${data.restaurant_name}</p>
    <p style="font-size: 12px; color: #888; margin: 8px 0 0;">${data.restaurant_address}</p>
  </div>

  <!-- Event Summary -->
  <div style="background: #FAFAF9; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
    <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 16px;">Event Details</h2>
    <table style="width: 100%; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #666; width: 140px;">Event</td><td style="font-weight: 600;">${data.event_name}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Date</td><td>${data.event_date}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Guest Count</td><td>${data.guest_count}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Prepared For</td><td>${data.contact_name}</td></tr>
    </table>
  </div>

  <!-- Selected Package -->
  ${selectedPkg ? `
    <div style="margin-bottom: 32px;">
      <h2 style="font-size: 16px; font-weight: 600; color: #333; margin: 0 0 8px;">Selected Package: ${selectedPkg.name}</h2>
      <p style="font-size: 13px; color: #666; margin: 0 0 16px;">${selectedPkg.description}</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #F06B18;">
            <th style="text-align: left; padding: 8px 0; font-size: 12px; color: #666;">Item</th>
            <th style="text-align: right; padding: 8px 0; font-size: 12px; color: #666;">Per Person</th>
          </tr>
        </thead>
        <tbody>
          ${selectedPkg.items.map((item) => `
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 8px 0; font-size: 13px;">${item.name}</td>
              <td style="text-align: right; padding: 8px 0; font-size: 13px;">$${item.price_per_person.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  ${selectedBar ? `
    <div style="margin-bottom: 16px; padding: 12px 16px; background: #FFF7ED; border-radius: 8px;">
      <strong>${selectedBar.name}</strong> — $${selectedBar.price_per_person.toFixed(2)}/person
    </div>
  ` : ''}

  <!-- Pricing Summary -->
  <div style="margin: 32px 0; padding: 24px; background: #1a1a1a; color: #fff; border-radius: 12px;">
    <table style="width: 100%; font-size: 14px;">
      <tr><td style="padding: 6px 0;">Subtotal</td><td style="text-align: right;">$${data.subtotal.toFixed(2)}</td></tr>
      <tr><td style="padding: 6px 0; color: #999;">Tax (${data.tax_rate}%)</td><td style="text-align: right; color: #999;">$${data.tax_amount.toFixed(2)}</td></tr>
      <tr style="border-top: 1px solid #444;">
        <td style="padding: 12px 0; font-size: 18px; font-weight: 700;">Total</td>
        <td style="text-align: right; font-size: 18px; font-weight: 700; color: #F06B18;">$${data.total.toFixed(2)}</td>
      </tr>
      <tr><td style="padding: 6px 0; color: #ccc;">Deposit (${data.deposit_pct}%)</td><td style="text-align: right; color: #F06B18; font-weight: 600;">$${data.deposit_amount.toFixed(2)}</td></tr>
    </table>
  </div>

  <!-- Terms -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 0 0 12px;">Terms & Conditions</h2>
    <ul style="padding-left: 20px; font-size: 12px; color: #666; line-height: 1.8;">
      ${data.terms.map((t) => `<li>${t}</li>`).join('')}
    </ul>
  </div>

  <!-- Signature -->
  <div style="margin-top: 48px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px;">
    <div>
      <div style="border-bottom: 1px solid #ccc; height: 40px;"></div>
      <p style="font-size: 11px; color: #888; margin: 4px 0 0;">Client Signature / Date</p>
    </div>
    <div>
      <div style="border-bottom: 1px solid #ccc; height: 40px;"></div>
      <p style="font-size: 11px; color: #888; margin: 4px 0 0;">Restaurant Representative / Date</p>
    </div>
  </div>

  <!-- Valid Until -->
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 32px;">
    This proposal is valid until ${data.valid_until}
  </p>

  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 2px solid #F06B18;">
    <p style="font-size: 11px; color: #888;">${data.restaurant_name} | ${data.restaurant_phone} | ${data.restaurant_email}</p>
  </div>
</body>
</html>`
}
