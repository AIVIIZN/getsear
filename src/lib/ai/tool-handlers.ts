/**
 * Tool Handlers for Claude AI
 *
 * Each handler maps a Claude tool_use call to a Supabase query.
 * Returns structured data that Claude can interpret and present.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  querySalesData,
  queryLaborData,
  queryMenuPerformance,
  queryFoodCostData,
  querySpeedOfService,
  queryVoidsComps,
  queryCustomerData,
  queryInventoryData,
  queryTipsData,
  comparePeriods,
} from './query-builders'

interface ToolContext {
  orgId: string
  locationId: string
}

/**
 * Execute a tool call and return the result as a string for Claude.
 */
export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<string> {
  const supabase = createAdminClient()
  const scope = { orgId: context.orgId, locationId: context.locationId }

  try {
    switch (toolName) {
      case 'query_sales': {
        const result = await querySalesData(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
          orderType: input.order_type as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query sales data', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_labor': {
        const result = await queryLaborData(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
          role: input.role as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query labor data', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_menu_performance': {
        const result = await queryMenuPerformance(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          sortBy: input.sort_by as string | undefined,
          sortDir: input.sort_dir as string | undefined,
          limit: input.limit as number | undefined,
          categoryId: input.category_id as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query menu performance', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_food_cost': {
        const result = await queryFoodCostData(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query food cost data', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_speed_of_service': {
        const result = await querySpeedOfService(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
          stationId: input.station_id as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query speed of service', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_voids_comps': {
        const result = await queryVoidsComps(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query voids/comps', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_customer_data': {
        const result = await queryCustomerData(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          metric: input.metric as string,
          limit: input.limit as number | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query customer data', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_inventory': {
        const result = await queryInventoryData(supabase, scope, {
          queryType: input.query_type as string,
          startDate: input.start_date as string | undefined,
          endDate: input.end_date as string | undefined,
          category: input.category as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query inventory', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'query_tips': {
        const result = await queryTipsData(supabase, scope, {
          startDate: input.start_date as string,
          endDate: input.end_date as string,
        }, {
          groupBy: input.group_by as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to query tips', details: result.error.message })
        return JSON.stringify(result.data)
      }

      case 'compare_periods': {
        const result = await comparePeriods(supabase, scope, {
          metric: input.metric as string,
          periodA: {
            startDate: input.period_a_start as string,
            endDate: input.period_a_end as string,
          },
          periodB: {
            startDate: input.period_b_start as string,
            endDate: input.period_b_end as string,
          },
          groupBy: input.group_by as string | undefined,
        })
        if (result.error) return JSON.stringify({ error: 'Failed to compare periods', details: result.error.message })
        return JSON.stringify(result.data)
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[tool-handler] Error executing ${toolName}:`, message)
    return JSON.stringify({ error: `Tool execution failed: ${message}` })
  }
}
