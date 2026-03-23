/**
 * Waitlist SMS Templates
 *
 * Provides SMS message templates for waitlist notifications.
 */

export interface WaitlistSmsVariables {
  customerName: string
  restaurantName: string
  partySize: number
  waitMinutes?: number
}

/**
 * Generate the "table ready" SMS for a waitlist guest.
 */
export function getTableReadyMessage(vars: WaitlistSmsVariables): string {
  return `Hi ${vars.customerName}, your table for ${vars.partySize} at ${vars.restaurantName} is ready! Please check in with the host within 15 minutes. Reply STOP to opt out.`
}

/**
 * Generate the "added to waitlist" confirmation SMS.
 */
export function getWaitlistConfirmation(vars: WaitlistSmsVariables): string {
  const waitPart = vars.waitMinutes
    ? ` Estimated wait: ~${vars.waitMinutes} minutes.`
    : ''
  return `Hi ${vars.customerName}, you've been added to the waitlist at ${vars.restaurantName} (party of ${vars.partySize}).${waitPart} We'll text you when your table is ready. Reply STOP to opt out.`
}

/**
 * Generate a "re-notify" SMS when a guest hasn't responded.
 */
export function getReNotifyMessage(vars: WaitlistSmsVariables): string {
  return `Reminder: ${vars.customerName}, your table for ${vars.partySize} at ${vars.restaurantName} is still available! Please check in with the host soon or your spot may be given to the next party. Reply STOP to opt out.`
}

/**
 * Generate the reservation confirmation SMS for widget bookings.
 */
export function getReservationConfirmation(vars: {
  customerName: string
  restaurantName: string
  date: string
  time: string
  partySize: number
}): string {
  return `Confirmed! Table for ${vars.partySize} at ${vars.restaurantName}, ${vars.date} at ${vars.time}. See you then, ${vars.customerName}! Reply STOP to opt out.`
}
