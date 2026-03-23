/**
 * BEO (Banquet Event Order) template for PDF generation.
 * Returns structured data for PDF rendering.
 */

export interface BEOData {
  event_name: string
  event_date: string
  event_time: string
  end_time: string
  guest_count: number
  contact_name: string
  contact_phone: string
  contact_email: string
  room_setup: string
  menu_selections: Array<{
    course: string
    items: Array<{
      name: string
      description: string
      price_per_person: number
    }>
  }>
  bar_package: string | null
  bar_price_per_person: number | null
  av_needs: string[]
  special_instructions: string
  staff_assignments: Array<{
    role: string
    name: string
    start_time: string
    end_time: string
  }>
  timeline: Array<{
    time: string
    activity: string
  }>
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  restaurant_logo_url: string | null
}

/**
 * Generate BEO HTML content for PDF rendering.
 */
export function generateBEOHtml(data: BEOData): string {
  const menuHtml = data.menu_selections
    .map(
      (course) => `
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; font-weight: 600; color: #F06B18; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
          ${course.course}
        </h3>
        ${course.items
          .map(
            (item) => `
          <div style="padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
            <div style="display: flex; justify-content: space-between;">
              <strong style="font-size: 13px;">${item.name}</strong>
              <span style="font-size: 13px; color: #666;">$${item.price_per_person.toFixed(2)}/pp</span>
            </div>
            ${item.description ? `<p style="font-size: 11px; color: #888; margin: 2px 0 0;">${item.description}</p>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `
    )
    .join('')

  const timelineHtml = data.timeline
    .map(
      (entry) => `
      <tr>
        <td style="padding: 4px 12px 4px 0; font-weight: 600; font-size: 12px; white-space: nowrap;">${entry.time}</td>
        <td style="padding: 4px 0; font-size: 12px;">${entry.activity}</td>
      </tr>
    `
    )
    .join('')

  const staffHtml = data.staff_assignments
    .map(
      (staff) => `
      <tr>
        <td style="padding: 4px 12px 4px 0; font-size: 12px;">${staff.role}</td>
        <td style="padding: 4px 12px 4px 0; font-size: 12px; font-weight: 500;">${staff.name}</td>
        <td style="padding: 4px 0; font-size: 12px; color: #666;">${staff.start_time} - ${staff.end_time}</td>
      </tr>
    `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a1a;">
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 32px; border-bottom: 3px solid #F06B18; padding-bottom: 24px;">
    <h1 style="font-size: 28px; font-weight: 700; margin: 0; color: #F06B18;">BANQUET EVENT ORDER</h1>
    <p style="font-size: 14px; color: #666; margin: 8px 0 0;">${data.restaurant_name}</p>
    <p style="font-size: 12px; color: #888; margin: 4px 0 0;">${data.restaurant_address} | ${data.restaurant_phone}</p>
  </div>

  <!-- Event Details -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
    <div>
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; color: #333;">Event Details</h2>
      <table style="font-size: 13px;">
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Event:</td><td style="font-weight: 600;">${data.event_name}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Date:</td><td>${data.event_date}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Time:</td><td>${data.event_time} - ${data.end_time}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Guests:</td><td>${data.guest_count}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Setup:</td><td>${data.room_setup}</td></tr>
      </table>
    </div>
    <div>
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; color: #333;">Contact</h2>
      <table style="font-size: 13px;">
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Name:</td><td style="font-weight: 600;">${data.contact_name}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Phone:</td><td>${data.contact_phone}</td></tr>
        <tr><td style="padding: 3px 12px 3px 0; color: #666;">Email:</td><td>${data.contact_email}</td></tr>
      </table>
    </div>
  </div>

  <!-- Menu -->
  <div style="margin-bottom: 32px;">
    <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 16px; color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">Menu</h2>
    ${menuHtml}
    ${data.bar_package ? `
      <div style="margin-top: 16px; padding: 12px; background: #FFF7ED; border-radius: 8px;">
        <strong style="font-size: 13px;">Bar Package:</strong>
        <span style="font-size: 13px; margin-left: 8px;">${data.bar_package}</span>
        ${data.bar_price_per_person ? `<span style="font-size: 13px; color: #666; margin-left: 8px;">($${data.bar_price_per_person.toFixed(2)}/pp)</span>` : ''}
      </div>
    ` : ''}
  </div>

  <!-- Timeline -->
  ${data.timeline.length > 0 ? `
    <div style="margin-bottom: 32px;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">Event Timeline</h2>
      <table>${timelineHtml}</table>
    </div>
  ` : ''}

  <!-- Staff -->
  ${data.staff_assignments.length > 0 ? `
    <div style="margin-bottom: 32px;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0 0 12px; color: #333; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px;">Staff Assignments</h2>
      <table>${staffHtml}</table>
    </div>
  ` : ''}

  <!-- Special Instructions -->
  ${data.special_instructions ? `
    <div style="margin-bottom: 32px; padding: 16px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px;">
      <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #92400E;">Special Instructions</h2>
      <p style="font-size: 13px; margin: 0; color: #78350F;">${data.special_instructions}</p>
    </div>
  ` : ''}

  <!-- AV Needs -->
  ${data.av_needs.length > 0 ? `
    <div style="margin-bottom: 32px;">
      <h2 style="font-size: 14px; font-weight: 600; margin: 0 0 8px; color: #333;">A/V Requirements</h2>
      <ul style="margin: 0; padding-left: 20px; font-size: 12px;">${data.av_needs.map((n) => `<li>${n}</li>`).join('')}</ul>
    </div>
  ` : ''}

  <!-- Footer -->
  <div style="text-align: center; margin-top: 48px; padding-top: 16px; border-top: 2px solid #F06B18;">
    <p style="font-size: 11px; color: #888;">Generated by Sear POS | ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`
}
