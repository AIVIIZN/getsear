/**
 * SendGrid email template builder for daily report summaries.
 * Generates branded HTML emails with key metrics.
 */

interface DailyEmailData {
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

function formatCurrency(val: number): string {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Build branded HTML email for daily summary.
 */
export function buildDailyEmailHTML(data: DailyEmailData): string {
  const isRevenueUp = data.revenueChangePct >= 0
  const revenueArrow = isRevenueUp ? '&#9650;' : '&#9660;'
  const revenueColor = isRevenueUp ? '#16A34A' : '#DC2626'
  const laborColor = data.laborPct <= 30 ? '#16A34A' : data.laborPct <= 35 ? '#D97706' : '#DC2626'
  const foodCostColor = data.foodCostPct <= 28 ? '#16A34A' : data.foodCostPct <= 35 ? '#D97706' : '#DC2626'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sear POS - Daily Summary</title>
</head>
<body style="margin:0;padding:0;background-color:#F2F2F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2F7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#F06B18;padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Sear POS</h1>
                    <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Daily Performance Summary</p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);">${data.businessDate}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${data.locationName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Revenue Hero -->
          <tr>
            <td style="padding:32px 32px 16px;">
              <p style="margin:0;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Total Revenue</p>
              <p style="margin:8px 0 0;font-size:42px;font-weight:800;color:#1A1A2E;letter-spacing:-1px;">${formatCurrency(data.totalRevenue)}</p>
              <p style="margin:8px 0 0;font-size:15px;">
                <span style="color:${revenueColor};font-weight:600;">${revenueArrow} ${Math.abs(data.revenueChangePct).toFixed(1)}%</span>
                <span style="color:#6B7280;"> vs same day last week (${formatCurrency(data.prevWeekRevenue)})</span>
              </p>
            </td>
          </tr>

          <!-- Metrics Grid -->
          <tr>
            <td style="padding:16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="padding:12px;background-color:#F9FAFB;border-radius:12px;">
                    <p style="margin:0;font-size:12px;color:#6B7280;font-weight:500;">Orders</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:#1A1A2E;">${data.orderCount.toLocaleString()}</p>
                  </td>
                  <td width="4"></td>
                  <td width="33%" style="padding:12px;background-color:#F9FAFB;border-radius:12px;">
                    <p style="margin:0;font-size:12px;color:#6B7280;font-weight:500;">Avg Check</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:#1A1A2E;">${formatCurrency(data.averageCheck)}</p>
                  </td>
                  <td width="4"></td>
                  <td width="33%" style="padding:12px;background-color:#F9FAFB;border-radius:12px;">
                    <p style="margin:0;font-size:12px;color:#6B7280;font-weight:500;">Labor %</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:700;color:${laborColor};">${data.laborPct.toFixed(1)}%</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Food Cost -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:12px;background-color:#F9FAFB;border-radius:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:12px;color:#6B7280;font-weight:500;">Food Cost %</p>
                          <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${foodCostColor};">${data.foodCostPct.toFixed(1)}%</p>
                        </td>
                        <td align="right">
                          <p style="margin:0;font-size:12px;color:#6B7280;">Target: 28-35%</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${data.appUrl}/reports/sales" style="display:block;text-align:center;padding:14px 24px;background-color:#F06B18;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                View Full Report
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Generated by Sear POS &middot; <a href="${data.appUrl}/reports" style="color:#F06B18;text-decoration:none;">View all reports</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;text-align:center;">
                To stop receiving daily emails, update your notification preferences in Settings.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}

/**
 * Build plain text version for email.
 */
export function buildDailyEmailText(data: DailyEmailData): string {
  const arrow = data.revenueChangePct >= 0 ? '+' : '-'
  return [
    `Sear POS - Daily Performance Summary`,
    `${data.locationName} | ${data.businessDate}`,
    ``,
    `TOTAL REVENUE: ${formatCurrency(data.totalRevenue)}`,
    `${arrow}${Math.abs(data.revenueChangePct).toFixed(1)}% vs same day last week`,
    ``,
    `Orders: ${data.orderCount}`,
    `Avg Check: ${formatCurrency(data.averageCheck)}`,
    `Labor: ${data.laborPct.toFixed(1)}%`,
    `Food Cost: ${data.foodCostPct.toFixed(1)}%`,
    ``,
    `View full report: ${data.appUrl}/reports/sales`,
    ``,
    `Generated by Sear POS`,
  ].join('\n')
}

/**
 * Send daily email via SendGrid.
 * Requires SENDGRID_API_KEY environment variable.
 */
export async function sendDailyEmail(
  recipients: string[],
  data: DailyEmailData
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    return { success: false, error: 'SENDGRID_API_KEY not configured' }
  }

  if (recipients.length === 0) {
    return { success: false, error: 'No recipients configured' }
  }

  const html = buildDailyEmailHTML(data)
  const text = buildDailyEmailText(data)

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: recipients.map(email => ({ email })),
        }],
        from: {
          email: 'reports@getsear.com',
          name: 'Sear POS Reports',
        },
        subject: `Daily Summary - ${data.locationName} - ${data.businessDate}`,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `SendGrid error: ${response.status} ${errorText}` }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}
