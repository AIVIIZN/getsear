'use client'

import { useEffect, useState } from 'react'
import { Activity, DollarSign, MessageSquare, Zap } from 'lucide-react'

interface UsageData {
  today: { queries: number; tokens_in: number; tokens_out: number; estimated_cost: string }
  this_month: { queries: number; tokens_in: number; tokens_out: number; estimated_cost: string }
  by_type: Array<{ type: string; queries: number; estimated_cost: string }>
  projected_monthly_cost: string
}

/**
 * Token usage and estimated cost display for AI settings page.
 */
export function AIUsageMeter() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const resp = await fetch('/api/ai/usage')
        if (resp.ok) {
          const data = await resp.json()
          setUsage(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl animate-skeleton" />
        ))}
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="text-center py-6">
        <p className="text-callout text-muted-foreground">Usage data not available</p>
      </div>
    )
  }

  const stats = [
    {
      icon: MessageSquare,
      label: 'Queries Today',
      value: usage.today.queries.toString(),
      detail: `${usage.today.tokens_in.toLocaleString()} tokens in, ${usage.today.tokens_out.toLocaleString()} out`,
    },
    {
      icon: Activity,
      label: 'This Month',
      value: usage.this_month.queries.toString(),
      detail: `${usage.this_month.tokens_in.toLocaleString()} tokens total`,
    },
    {
      icon: DollarSign,
      label: 'Monthly Cost',
      value: usage.this_month.estimated_cost,
      detail: `Projected: ${usage.projected_monthly_cost}`,
    },
  ]

  return (
    <div className="space-y-3">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              backgroundColor: 'var(--secondary)',
              border: '0.5px solid var(--border)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Icon className="h-4 w-4 text-[var(--primary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-footnote text-muted-foreground">{stat.label}</p>
              <p className="text-callout font-semibold text-foreground tabular-nums">
                {stat.value}
              </p>
            </div>
            <p className="text-caption-1 text-muted-foreground tabular-nums">
              {stat.detail}
            </p>
          </div>
        )
      })}

      {/* Usage by type */}
      {usage.by_type.length > 0 && (
        <div className="mt-4">
          <p className="text-footnote font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            By Type
          </p>
          <div className="space-y-1">
            {usage.by_type.map((t) => (
              <div key={t.type} className="flex items-center justify-between px-1 py-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-footnote text-foreground capitalize">
                    {t.type === 'ask' ? 'Sear Ask' : t.type === 'insights' ? 'Insights' : 'Predictions'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-footnote text-muted-foreground tabular-nums">
                    {t.queries} queries
                  </span>
                  <span className="text-footnote font-medium text-foreground tabular-nums">
                    {t.estimated_cost}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
