/**
 * House account statement PDF template.
 */

export interface StatementData {
  account_name: string
  account_number: string
  contact_name: string
  contact_email: string
  billing_address: string
  statement_period: string
  statement_date: string
  beginning_balance: number
  charges: Array<{
    date: string
    description: string
    server: string
    amount: number
  }>
  payments: Array<{
    date: string
    method: string
    amount: number
  }>
  total_charges: number
  total_payments: number
  ending_balance: number
  credit_limit: number
  available_credit: number
  payment_terms: string
  due_date: string
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
}

export function generateStatementHtml(data: StatementData): string {
  const utilizationPct = data.credit_limit > 0
    ? Math.round((data.ending_balance / data.credit_limit) * 100)
    : 0
  const utilizationColor = utilizationPct >= 100 ? '#EF4444' : utilizationPct >= 80 ? '#F59E0B' : '#22C55E'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #007AFF; padding-bottom: 24px;">
    <div>
      <h1 style="font-size: 24px; font-weight: 700; margin: 0;">ACCOUNT STATEMENT</h1>
      <p style="font-size: 14px; color: #007AFF; margin: 4px 0 0; font-weight: 500;">${data.restaurant_name}</p>
      <p style="font-size: 12px; color: #666; margin: 4px 0 0;">${data.restaurant_address}</p>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 12px; color: #666; margin: 0;">Statement Date: ${data.statement_date}</p>
      <p style="font-size: 12px; color: #666; margin: 2px 0 0;">Period: ${data.statement_period}</p>
      <p style="font-size: 12px; color: #666; margin: 2px 0 0;">Account #: ${data.account_number}</p>
    </div>
  </div>

  <!-- Account Info -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
    <div>
      <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 8px;">Account Holder</h3>
      <p style="font-size: 14px; font-weight: 600; margin: 0;">${data.account_name}</p>
      <p style="font-size: 12px; color: #666; margin: 4px 0;">${data.contact_name}</p>
      <p style="font-size: 12px; color: #666; margin: 0;">${data.billing_address}</p>
    </div>
    <div style="text-align: right;">
      <div style="padding: 16px; background: #1a1a1a; border-radius: 12px; color: #fff; display: inline-block;">
        <p style="font-size: 11px; color: #999; margin: 0;">Balance Due</p>
        <p style="font-size: 28px; font-weight: 700; margin: 4px 0 0; color: #007AFF;">$${data.ending_balance.toFixed(2)}</p>
        <p style="font-size: 11px; margin: 4px 0 0; color: ${utilizationColor};">${utilizationPct}% of $${data.credit_limit.toFixed(2)} limit</p>
      </div>
    </div>
  </div>

  <!-- Summary -->
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px;">
    <div style="padding: 16px; background: #F5F5F4; border-radius: 8px; text-align: center;">
      <p style="font-size: 11px; color: #666; margin: 0;">Beginning Balance</p>
      <p style="font-size: 18px; font-weight: 600; margin: 4px 0 0;">$${data.beginning_balance.toFixed(2)}</p>
    </div>
    <div style="padding: 16px; background: #FEF2F2; border-radius: 8px; text-align: center;">
      <p style="font-size: 11px; color: #666; margin: 0;">Total Charges</p>
      <p style="font-size: 18px; font-weight: 600; margin: 4px 0 0; color: #EF4444;">+$${data.total_charges.toFixed(2)}</p>
    </div>
    <div style="padding: 16px; background: #F0FDF4; border-radius: 8px; text-align: center;">
      <p style="font-size: 11px; color: #666; margin: 0;">Total Payments</p>
      <p style="font-size: 18px; font-weight: 600; margin: 4px 0 0; color: #22C55E;">-$${data.total_payments.toFixed(2)}</p>
    </div>
  </div>

  <!-- Charges -->
  ${data.charges.length > 0 ? `
    <h3 style="font-size: 13px; font-weight: 600; margin: 0 0 8px;">Charges</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #F5F5F4;">
          <th style="text-align: left; padding: 8px; font-size: 11px; color: #666;">Date</th>
          <th style="text-align: left; padding: 8px; font-size: 11px; color: #666;">Description</th>
          <th style="text-align: left; padding: 8px; font-size: 11px; color: #666;">Server</th>
          <th style="text-align: right; padding: 8px; font-size: 11px; color: #666;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.charges.map((c) => `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px; font-size: 12px;">${c.date}</td>
            <td style="padding: 8px; font-size: 12px;">${c.description}</td>
            <td style="padding: 8px; font-size: 12px; color: #666;">${c.server}</td>
            <td style="text-align: right; padding: 8px; font-size: 12px;">$${c.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- Payments -->
  ${data.payments.length > 0 ? `
    <h3 style="font-size: 13px; font-weight: 600; margin: 0 0 8px;">Payments Received</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #F5F5F4;">
          <th style="text-align: left; padding: 8px; font-size: 11px; color: #666;">Date</th>
          <th style="text-align: left; padding: 8px; font-size: 11px; color: #666;">Method</th>
          <th style="text-align: right; padding: 8px; font-size: 11px; color: #666;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.payments.map((p) => `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px; font-size: 12px;">${p.date}</td>
            <td style="padding: 8px; font-size: 12px;">${p.method}</td>
            <td style="text-align: right; padding: 8px; font-size: 12px; color: #22C55E;">$${p.amount.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- Payment Terms -->
  <div style="margin-top: 32px; padding: 16px; background: #FFF7ED; border-radius: 8px; border-left: 4px solid #007AFF;">
    <p style="font-size: 12px; font-weight: 600; margin: 0;">Payment Terms: ${data.payment_terms}</p>
    <p style="font-size: 12px; color: #666; margin: 4px 0 0;">Due Date: ${data.due_date}</p>
  </div>

  <div style="text-align: center; margin-top: 48px; padding-top: 16px; border-top: 2px solid #007AFF;">
    <p style="font-size: 11px; color: #888;">Questions? Contact ${data.restaurant_phone}</p>
    <p style="font-size: 10px; color: #aaa;">Generated by Sear POS | ${data.statement_date}</p>
  </div>
</body>
</html>`
}
