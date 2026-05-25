/**
 * Email Templates
 *
 * Production HTML email templates for all email types.
 * All templates are responsive, branded with Sear orange,
 * and CAN-SPAM compliant for marketing emails.
 */

export type EmailTemplateType = 'receipt' | 'daily_report' | 'marketing' | 'password_reset' | 'welcome'

export interface EmailTemplate {
  id: string
  location_id: string
  template_type: EmailTemplateType
  name: string
  subject: string
  html_body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReceiptData {
  locationName: string
  locationAddress: string
  orderNumber: string
  orderDate: string
  items: Array<{
    name: string
    quantity: number
    modifiers?: string[]
    price: number // cents
  }>
  subtotal: number // cents
  tax: number // cents
  tip: number // cents
  total: number // cents
  paymentMethod: string
  lastFour?: string
  customerName?: string
  serverName?: string
  feedbackUrl?: string
  loyaltySignupUrl?: string
  loyaltyQrUrl?: string
  rewardProgressLabel?: string
  personalizedThankYou?: string
}

export interface DailyReportData {
  locationName: string
  businessDate: string
  totalRevenue: number
  orderCount: number
  averageCheck: number
  laborPct: number
  foodCostPct: number
  prevWeekRevenue: number
  revenueChangePct: number
  appUrl: string
}

export interface MarketingData {
  locationName: string
  locationAddress: string
  headerImageUrl?: string
  bodyHtml: string
  ctaText?: string
  ctaUrl?: string
  unsubscribeUrl: string
}

export interface PasswordResetData {
  resetUrl: string
  expiresIn: string
}

export interface WelcomeData {
  customerName: string
  locationName: string
  locationAddress: string
  loyaltyEnabled: boolean
  orderUrl: string
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const BRAND_COLOR = '#007AFF'
const TEXT_COLOR = '#1C1C1E'
const MUTED_COLOR = '#78756D'
const BG_COLOR = '#F2F2F7'

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sear POS</title>
</head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    ${content}
  </div>
</body>
</html>`
}

function header(): string {
  return `<div style="background:${BRAND_COLOR};padding:20px 24px;border-radius:12px 12px 0 0;text-align:center;">
  <h1 style="color:white;margin:0;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Sear POS</h1>
</div>`
}

function footer(locationAddress?: string, unsubscribeUrl?: string): string {
  const parts = []
  if (locationAddress) {
    parts.push(`<p style="color:${MUTED_COLOR};font-size:12px;margin:4px 0;">${locationAddress}</p>`)
  }
  if (unsubscribeUrl) {
    parts.push(`<p style="margin:8px 0;"><a href="${unsubscribeUrl}" style="color:${MUTED_COLOR};font-size:12px;text-decoration:underline;">Unsubscribe</a></p>`)
  }
  parts.push(`<p style="color:${MUTED_COLOR};font-size:11px;margin:8px 0;">Powered by <a href="https://getsear.com" style="color:${BRAND_COLOR};text-decoration:none;">Sear POS</a></p>`)
  return `<div style="text-align:center;padding:24px 16px;border-top:1px solid #E5E5E5;">${parts.join('')}</div>`
}

function card(content: string): string {
  return `<div style="background:white;padding:28px 24px;border:1px solid #E5E5E5;border-top:none;">${content}</div>`
}

/**
 * Render a receipt email.
 */
export function renderReceiptEmail(data: ReceiptData): { subject: string; html: string } {
  const subject = `Receipt from ${data.locationName} — Order #${data.orderNumber}`

  const itemRows = data.items.map(item => {
    const mods = item.modifiers?.length
      ? `<div style="color:${MUTED_COLOR};font-size:13px;padding-left:16px;">${item.modifiers.join(', ')}</div>`
      : ''
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #F0EDE8;vertical-align:top;">
        <div style="color:${TEXT_COLOR};font-size:14px;">${item.quantity}x ${item.name}</div>
        ${mods}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #F0EDE8;text-align:right;vertical-align:top;color:${TEXT_COLOR};font-size:14px;white-space:nowrap;">
        ${formatMoney(item.price * item.quantity)}
      </td>
    </tr>`
  }).join('')

  const paymentLabel = data.lastFour
    ? `${data.paymentMethod} ending ${data.lastFour}`
    : data.paymentMethod

  const content = `
    ${header()}
    ${card(`
      <h2 style="margin:0 0 4px;color:${TEXT_COLOR};font-size:18px;font-weight:600;">Order #${data.orderNumber}</h2>
      ${data.personalizedThankYou ? `<p style="color:${TEXT_COLOR};font-size:15px;margin:0 0 12px;">${data.personalizedThankYou}</p>` : ''}
      <p style="color:${MUTED_COLOR};font-size:13px;margin:0 0 20px;">${data.orderDate}${data.serverName ? ` &middot; Server: ${data.serverName}` : ''}</p>

      <table style="width:100%;border-collapse:collapse;">
        ${itemRows}
      </table>

      <div style="margin-top:16px;padding-top:12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:${MUTED_COLOR};font-size:14px;padding:4px 0;">Subtotal</td><td style="text-align:right;font-size:14px;color:${TEXT_COLOR};">${formatMoney(data.subtotal)}</td></tr>
          <tr><td style="color:${MUTED_COLOR};font-size:14px;padding:4px 0;">Tax</td><td style="text-align:right;font-size:14px;color:${TEXT_COLOR};">${formatMoney(data.tax)}</td></tr>
          ${data.tip > 0 ? `<tr><td style="color:${MUTED_COLOR};font-size:14px;padding:4px 0;">Tip</td><td style="text-align:right;font-size:14px;color:${TEXT_COLOR};">${formatMoney(data.tip)}</td></tr>` : ''}
          <tr><td style="color:${TEXT_COLOR};font-size:16px;font-weight:600;padding:12px 0 4px;border-top:2px solid ${BRAND_COLOR};">Total</td><td style="text-align:right;font-size:16px;font-weight:600;color:${TEXT_COLOR};padding:12px 0 4px;border-top:2px solid ${BRAND_COLOR};">${formatMoney(data.total)}</td></tr>
        </table>
      </div>

      <div style="margin-top:16px;padding:12px 16px;background:#F5F3F0;border-radius:8px;">
        <p style="margin:0;color:${MUTED_COLOR};font-size:13px;">Paid with ${paymentLabel}</p>
      </div>

      ${data.feedbackUrl ? `
        <div style="text-align:center;margin-top:24px;">
          <a href="${data.feedbackUrl}" style="display:inline-block;padding:12px 32px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">How was your experience?</a>
        </div>
      ` : ''}

      ${data.loyaltySignupUrl ? `
        <div style="margin-top:20px;padding:16px;background:#F5F3F0;border-radius:10px;text-align:center;">
          <p style="margin:0 0 8px;color:${TEXT_COLOR};font-size:15px;font-weight:600;">Join rewards</p>
          ${data.rewardProgressLabel ? `<p style="margin:0 0 10px;color:${MUTED_COLOR};font-size:13px;">${data.rewardProgressLabel}</p>` : ''}
          ${data.loyaltyQrUrl ? `<img src="${data.loyaltyQrUrl}" alt="Loyalty signup QR code" width="96" height="96" style="display:block;margin:0 auto 10px;border:0;">` : ''}
          <a href="${data.loyaltySignupUrl}" style="color:${BRAND_COLOR};font-size:14px;font-weight:600;text-decoration:none;">Sign up for rewards</a>
        </div>
      ` : ''}
    `)}
    <div style="border-radius:0 0 12px 12px;overflow:hidden;">
      ${footer(data.locationAddress)}
    </div>
  `

  return { subject, html: baseLayout(content) }
}

/**
 * Render a daily summary report email.
 */
export function renderDailyReportEmail(data: DailyReportData): { subject: string; html: string } {
  const subject = `Daily Summary — ${data.locationName} — ${data.businessDate}`
  const changeColor = data.revenueChangePct >= 0 ? '#34C759' : '#FF3B30'
  const changeIcon = data.revenueChangePct >= 0 ? '&#x25B2;' : '&#x25BC;'

  const content = `
    ${header()}
    ${card(`
      <h2 style="margin:0 0 4px;color:${TEXT_COLOR};font-size:18px;font-weight:600;">Daily Performance Summary</h2>
      <p style="color:${MUTED_COLOR};font-size:13px;margin:0 0 24px;">${data.locationName} &middot; ${data.businessDate}</p>

      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;min-width:120px;padding:16px;background:#F5F3F0;border-radius:10px;">
          <p style="margin:0 0 4px;color:${MUTED_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Revenue</p>
          <p style="margin:0;color:${TEXT_COLOR};font-size:22px;font-weight:700;">$${data.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p style="margin:4px 0 0;color:${changeColor};font-size:13px;font-weight:500;">${changeIcon} ${Math.abs(data.revenueChangePct)}% vs last week</p>
        </div>
        <div style="flex:1;min-width:120px;padding:16px;background:#F5F3F0;border-radius:10px;">
          <p style="margin:0 0 4px;color:${MUTED_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Orders</p>
          <p style="margin:0;color:${TEXT_COLOR};font-size:22px;font-weight:700;">${data.orderCount}</p>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;">
        <div style="flex:1;min-width:120px;padding:16px;background:#F5F3F0;border-radius:10px;">
          <p style="margin:0 0 4px;color:${MUTED_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Avg Check</p>
          <p style="margin:0;color:${TEXT_COLOR};font-size:22px;font-weight:700;">$${data.averageCheck.toFixed(2)}</p>
        </div>
        <div style="flex:1;min-width:120px;padding:16px;background:#F5F3F0;border-radius:10px;">
          <p style="margin:0 0 4px;color:${MUTED_COLOR};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Labor %</p>
          <p style="margin:0;color:${TEXT_COLOR};font-size:22px;font-weight:700;">${data.laborPct.toFixed(1)}%</p>
        </div>
      </div>

      <div style="text-align:center;margin-top:28px;">
        <a href="${data.appUrl}/reports" style="display:inline-block;padding:12px 32px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Full Report</a>
      </div>
    `)}
    <div style="border-radius:0 0 12px 12px;overflow:hidden;">
      ${footer()}
    </div>
  `

  return { subject, html: baseLayout(content) }
}

/**
 * Render a marketing campaign email.
 */
export function renderMarketingEmail(data: MarketingData): { html: string } {
  const content = `
    ${data.headerImageUrl
      ? `<div style="border-radius:12px 12px 0 0;overflow:hidden;"><img src="${data.headerImageUrl}" alt="" style="width:100%;display:block;"></div>`
      : header()
    }
    ${card(`
      <div style="color:${TEXT_COLOR};font-size:15px;line-height:1.6;">${data.bodyHtml}</div>
      ${data.ctaText && data.ctaUrl ? `
        <div style="text-align:center;margin-top:28px;">
          <a href="${data.ctaUrl}" style="display:inline-block;padding:14px 36px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${data.ctaText}</a>
        </div>
      ` : ''}
    `)}
    <div style="border-radius:0 0 12px 12px;overflow:hidden;">
      ${footer(data.locationAddress, data.unsubscribeUrl)}
    </div>
  `
  return { html: baseLayout(content) }
}

/**
 * Render a password reset email.
 */
export function renderPasswordResetEmail(data: PasswordResetData): { subject: string; html: string } {
  const subject = 'Reset Your Sear POS Password'

  const content = `
    ${header()}
    ${card(`
      <h2 style="margin:0 0 12px;color:${TEXT_COLOR};font-size:18px;font-weight:600;">Reset Your Password</h2>
      <p style="color:${MUTED_COLOR};font-size:14px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to create a new password.
        This link expires in ${data.expiresIn}.
      </p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${data.resetUrl}" style="display:inline-block;padding:14px 36px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Reset Password</a>
      </div>

      <div style="padding:16px;background:#FEF2F2;border-radius:8px;margin-top:24px;">
        <p style="margin:0;color:#FF3B30;font-size:13px;line-height:1.5;">
          <strong>Didn't request this?</strong> If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
        </p>
      </div>
    `)}
    <div style="border-radius:0 0 12px 12px;overflow:hidden;">
      ${footer()}
    </div>
  `

  return { subject, html: baseLayout(content) }
}

/**
 * Render a welcome email for new online ordering customers.
 */
export function renderWelcomeEmail(data: WelcomeData): { subject: string; html: string } {
  const subject = `Welcome to ${data.locationName}!`

  const content = `
    ${header()}
    ${card(`
      <h2 style="margin:0 0 12px;color:${TEXT_COLOR};font-size:18px;font-weight:600;">Welcome, ${data.customerName}!</h2>
      <p style="color:${MUTED_COLOR};font-size:14px;line-height:1.6;margin:0 0 20px;">
        Thank you for creating an account with ${data.locationName}. You can now order online, track your orders, and ${data.loyaltyEnabled ? 'earn rewards with every visit' : 'save your favorite orders'}.
      </p>

      ${data.loyaltyEnabled ? `
        <div style="padding:16px;background:#FFF4EC;border-radius:8px;margin-bottom:20px;">
          <p style="margin:0;color:#9A4A12;font-size:14px;font-weight:600;">Loyalty Rewards</p>
          <p style="margin:4px 0 0;color:${MUTED_COLOR};font-size:13px;">Earn points on every order and unlock exclusive rewards.</p>
        </div>
      ` : ''}

      <div style="text-align:center;margin:28px 0;">
        <a href="${data.orderUrl}" style="display:inline-block;padding:14px 36px;background:${BRAND_COLOR};color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">Order Now</a>
      </div>

      <p style="color:${MUTED_COLOR};font-size:13px;text-align:center;">${data.locationAddress}</p>
    `)}
    <div style="border-radius:0 0 12px 12px;overflow:hidden;">
      ${footer(data.locationAddress)}
    </div>
  `

  return { subject, html: baseLayout(content) }
}

export const EMAIL_TEMPLATE_DEFAULTS: Record<EmailTemplateType, { name: string; subject: string }> = {
  receipt: { name: 'Receipt', subject: 'Receipt from {{location_name}} — Order #{{order_number}}' },
  daily_report: { name: 'Daily Summary Report', subject: 'Daily Summary — {{location_name}} — {{date}}' },
  marketing: { name: 'Marketing Campaign', subject: '{{subject}}' },
  password_reset: { name: 'Password Reset', subject: 'Reset Your Sear POS Password' },
  welcome: { name: 'Welcome Email', subject: 'Welcome to {{location_name}}!' },
}
