/**
 * Claude Tool Definitions for Sear Ask
 *
 * These define the tools that Claude can call to query restaurant data.
 * Each tool maps to a parameterized Supabase query in tool-handlers.ts.
 */

import type { ClaudeToolDefinition } from './claude-client'

export const AI_TOOLS: ClaudeToolDefinition[] = [
  {
    name: 'query_sales',
    description:
      'Query sales data for the restaurant. Returns revenue, cover count, average check, and breakdowns by category, server, order type, or daypart. Always specify a date range.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'week', 'month', 'category', 'server', 'order_type', 'daypart', 'hour'],
          description: 'How to group the results. Default is summary (no grouping).',
        },
        order_type: {
          type: 'string',
          enum: ['dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'drive_thru'],
          description: 'Filter to a specific order type',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_labor',
    description:
      'Query labor data: hours worked, labor cost, labor cost %, overtime hours. Can filter by employee, role, or date range.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'week', 'employee', 'role', 'hour'],
          description: 'How to group the results',
        },
        role: {
          type: 'string',
          description: 'Filter to a specific role (e.g., server, line_cook, bartender)',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_menu_performance',
    description:
      'Query menu item performance: units sold, revenue, food cost %, margin, modifier attach rate. Ranked by the specified metric.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        sort_by: {
          type: 'string',
          enum: ['units_sold', 'revenue', 'margin_pct', 'food_cost_pct'],
          description: 'Which metric to sort by. Default: revenue',
        },
        sort_dir: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction. Default: desc',
        },
        limit: {
          type: 'number',
          description: 'Number of items to return. Default: 10',
        },
        category_id: {
          type: 'string',
          description: 'Filter to items in a specific category',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_food_cost',
    description:
      'Query food cost data: theoretical vs actual food cost, variance by item or category, waste totals.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'week', 'category', 'item'],
          description: 'How to group the results',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_speed_of_service',
    description:
      'Query speed of service data: average ticket times by station, daypart, or date. Identifies outliers and slow periods.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'station', 'daypart', 'hour'],
          description: 'How to group the results',
        },
        station_id: {
          type: 'string',
          description: 'Filter to a specific KDS station',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_voids_comps',
    description:
      'Query void, comp, and discount data: totals, by employee, by reason code, trends over time.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'employee', 'reason', 'type'],
          description: 'How to group the results. type = void/comp/discount breakdown.',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'query_customer_data',
    description:
      'Query anonymized customer data: visit frequency distribution, average spend tiers, loyalty status breakdown, top customers by spend (anonymized IDs only, no PII).',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        metric: {
          type: 'string',
          enum: ['visit_frequency', 'spend_distribution', 'loyalty_breakdown', 'top_customers', 'new_vs_returning'],
          description: 'Which customer metric to query',
        },
        limit: {
          type: 'number',
          description: 'Number of results for top_customers. Default: 10',
        },
      },
      required: ['start_date', 'end_date', 'metric'],
    },
  },
  {
    name: 'query_inventory',
    description:
      'Query inventory data: current stock levels, items below par level, waste trends, purchase history summaries.',
    input_schema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['below_par', 'waste_trends', 'stock_levels', 'purchase_history'],
          description: 'Type of inventory query',
        },
        start_date: {
          type: 'string',
          description: 'Start date for trends/history queries',
        },
        end_date: {
          type: 'string',
          description: 'End date for trends/history queries',
        },
        category: {
          type: 'string',
          description: 'Filter to a specific inventory category',
        },
      },
      required: ['query_type'],
    },
  },
  {
    name: 'query_tips',
    description:
      'Query tip data: total tips, tip %, by server, by daypart, pool distributions.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'server', 'daypart', 'pool'],
          description: 'How to group tip data',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'compare_periods',
    description:
      'Compare a metric across two date ranges. Returns both periods\' data and the % change. Use this for "How did X compare to Y?" questions.',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['revenue', 'covers', 'avg_check', 'labor_cost', 'labor_pct', 'food_cost_pct', 'ticket_time', 'tips'],
          description: 'Which metric to compare',
        },
        period_a_start: {
          type: 'string',
          description: 'Period A start date (YYYY-MM-DD)',
        },
        period_a_end: {
          type: 'string',
          description: 'Period A end date (YYYY-MM-DD)',
        },
        period_b_start: {
          type: 'string',
          description: 'Period B start date (YYYY-MM-DD)',
        },
        period_b_end: {
          type: 'string',
          description: 'Period B end date (YYYY-MM-DD)',
        },
        group_by: {
          type: 'string',
          enum: ['day', 'daypart', 'hour'],
          description: 'Optional grouping within each period',
        },
      },
      required: ['metric', 'period_a_start', 'period_a_end', 'period_b_start', 'period_b_end'],
    },
  },
]
