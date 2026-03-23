/**
 * Stale Tab Checker Worker
 *
 * BullMQ worker that runs every 30 minutes to find idle bar tabs.
 *
 * Process:
 * 1. Finds open bar tabs with no items added in configurable hours (default 4)
 * 2. Sends alert to manager: "Tab for [Customer] at [Bar Seat] has been idle for 4 hours"
 * 3. After configurable grace period (default 2 more hours): auto-closes tab
 * 4. Auto-close captures at running total + tax + default tip (configurable, default 20%)
 * 5. Logs as auto-close with reason
 *
 * Schedule: Repeatable job, every 30 minutes
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { findStaleTabs, walkoutCapture, type StaleTabInfo } from '@/lib/payments/bar-tab-manager'

export interface StaleTabCheckerJobData {
  org_id?: string           // If set, only check this org
  location_id?: string      // If set, only check this location
}

export interface StaleTabCheckerResult {
  checked_locations: number
  stale_tabs_found: number
  alerts_sent: number
  auto_closed: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Configuration defaults (overridable per location via location_settings)
// ---------------------------------------------------------------------------

const DEFAULT_IDLE_HOURS = 4
const DEFAULT_GRACE_HOURS = 2  // Additional hours after alert before auto-close
const DEFAULT_AUTO_GRATUITY_PERCENT = 20

/**
 * Checks for stale tabs across all locations (or a specific one).
 * Called by the BullMQ repeatable job every 30 minutes.
 */
export async function processStaleTabCheck(
  data: StaleTabCheckerJobData
): Promise<StaleTabCheckerResult> {
  const supabase = createAdminClient()
  const result: StaleTabCheckerResult = {
    checked_locations: 0,
    stale_tabs_found: 0,
    alerts_sent: 0,
    auto_closed: 0,
    errors: [],
  }

  // Get locations to check
  let locationQuery = (supabase.from('locations') as ReturnType<typeof supabase.from>)
    .select('id, org_id, name')
    .eq('is_active', true)

  if (data.org_id) {
    locationQuery = locationQuery.eq('org_id', data.org_id)
  }
  if (data.location_id) {
    locationQuery = locationQuery.eq('id', data.location_id)
  }

  const { data: locations } = await locationQuery

  if (!locations || (locations as unknown[]).length === 0) {
    return result
  }

  for (const loc of locations as Record<string, unknown>[]) {
    result.checked_locations++
    const orgId = loc.org_id as string
    const locationId = loc.id as string

    // Get location-specific settings
    let idleHours = DEFAULT_IDLE_HOURS
    let graceHours = DEFAULT_GRACE_HOURS
    let autoGratuityPercent = DEFAULT_AUTO_GRATUITY_PERCENT

    const { data: locSettings } = await (supabase.from('location_settings') as ReturnType<typeof supabase.from>)
      .select('settings')
      .eq('location_id', locationId)
      .single()

    if (locSettings) {
      const settings = (locSettings as Record<string, unknown>).settings as Record<string, unknown>
      if (typeof settings?.stale_tab_idle_hours === 'number') {
        idleHours = settings.stale_tab_idle_hours as number
      }
      if (typeof settings?.stale_tab_grace_hours === 'number') {
        graceHours = settings.stale_tab_grace_hours as number
      }
      if (typeof settings?.walkout_auto_gratuity_percent === 'number') {
        autoGratuityPercent = settings.walkout_auto_gratuity_percent as number
      }
    }

    try {
      const staleTabs = await findStaleTabs(orgId, locationId, idleHours)

      for (const tab of staleTabs) {
        result.stale_tabs_found++

        const totalIdleHours = tab.idle_hours

        if (totalIdleHours >= idleHours + graceHours) {
          // Grace period exceeded — auto-close the tab
          try {
            const closeResult = await walkoutCapture({
              order_id: tab.order_id,
              org_id: orgId,
              auto_gratuity_percent: autoGratuityPercent,
            })

            if (closeResult.success) {
              result.auto_closed++

              // Log the auto-close
              await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
                .insert({
                  org_id: orgId,
                  location_id: locationId,
                  action: 'bar_tab_auto_closed',
                  entity_type: 'order',
                  entity_id: tab.order_id,
                  details: {
                    idle_hours: totalIdleHours,
                    captured_amount_cents: closeResult.captured_amount_cents,
                    auto_gratuity_cents: closeResult.auto_gratuity_cents,
                    card_last_four: tab.card_last_four,
                    card_brand: tab.card_brand,
                    customer_name: tab.customer_name,
                    table_name: tab.table_name,
                  },
                })
            } else {
              result.errors.push(
                `Failed to auto-close tab ${tab.order_id} at ${loc.name}`
              )
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            result.errors.push(`Auto-close error for tab ${tab.order_id}: ${msg}`)
          }
        } else {
          // Within grace period — send alert to manager
          result.alerts_sent++
          await sendStaleTabAlert(supabase, orgId, locationId, loc.name as string, tab)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.errors.push(`Error checking location ${loc.name}: ${msg}`)
    }
  }

  return result
}

/**
 * Creates an in-app notification for managers about a stale tab.
 */
async function sendStaleTabAlert(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  locationId: string,
  locationName: string,
  tab: StaleTabInfo
): Promise<void> {
  const customerDisplay = tab.customer_name ?? `Card ending ${tab.card_last_four}`
  const seatDisplay = tab.table_name ?? 'Bar'
  const idleDisplay = Math.round(tab.idle_hours * 10) / 10

  // Create audit log entry as alert (notifications table may not exist yet)
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: orgId,
      location_id: locationId,
      action: 'stale_tab_alert',
      entity_type: 'order',
      entity_id: tab.order_id,
      details: {
        alert_type: 'stale_bar_tab',
        message: `Tab for ${customerDisplay} at ${seatDisplay} has been idle for ${idleDisplay} hours`,
        customer_name: tab.customer_name,
        table_name: tab.table_name,
        idle_hours: idleDisplay,
        running_total_cents: tab.running_total_cents,
        auth_amount_cents: tab.auth_amount_cents,
        card_last_four: tab.card_last_four,
        card_brand: tab.card_brand,
        location_name: locationName,
      },
    })
}
