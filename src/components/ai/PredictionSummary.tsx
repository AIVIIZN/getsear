'use client'

import { useEffect } from 'react'
import { TrendingUp, Users, Clock, AlertCircle } from 'lucide-react'
import { useAIStore } from '@/stores/ai-store'
import { formatMoney } from '@/lib/utils'

/**
 * Today's forecast KPI cards.
 * Shows predicted revenue, covers, and labor hours.
 */
export function PredictionSummary() {
  const predictions = useAIStore((s) => s.predictions)
  const predictionsLoading = useAIStore((s) => s.predictionsLoading)
  const minimumDataMet = useAIStore((s) => s.minimumDataMet)
  const predictionAccuracy = useAIStore((s) => s.predictionAccuracy)
  const loadPredictions = useAIStore((s) => s.actions.loadPredictions)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const weekOut = new Date()
    weekOut.setDate(weekOut.getDate() + 7)
    const endDate = weekOut.toISOString().split('T')[0]
    loadPredictions(today, endDate)
  }, [loadPredictions])

  if (predictionsLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">Today&apos;s Forecast</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl animate-skeleton"
              style={{ border: '0.5px solid var(--border)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!minimumDataMet) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">Sear Predict</h2>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            border: '0.5px solid var(--border)',
          }}
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-[var(--warning)]" />
          <div>
            <p className="text-callout font-medium text-foreground">Need more data</p>
            <p className="text-footnote text-muted-foreground">
              Predictions require at least 4 weeks of sales data. Keep operating and forecasts will activate automatically.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const today = predictions[0]
  if (!today) return null

  const kpis = [
    {
      label: 'Revenue',
      value: formatMoney(today.predictedRevenueCents),
      icon: TrendingUp,
      subtitle: `${Math.round(today.confidence * 100)}% confidence`,
    },
    {
      label: 'Covers',
      value: today.predictedCovers.toLocaleString(),
      icon: Users,
      subtitle: today.dayOfWeek,
    },
    {
      label: 'Labor Hours',
      value: today.predictedLaborHours.toString(),
      icon: Clock,
      subtitle: 'suggested',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">Today&apos;s Forecast</h2>
        </div>
        {predictionAccuracy && predictionAccuracy.days > 0 && (
          <span className="text-caption-1 tabular-nums text-[var(--success)]">
            {predictionAccuracy.revenueAccuracy.toFixed(0)}% accurate
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <div
              key={kpi.label}
              className="rounded-2xl bg-white px-4 py-3"
              style={{
                boxShadow: 'var(--shadow-sm)',
                border: '0.5px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-[var(--primary)]" />
                <span className="text-caption-1 font-medium text-muted-foreground">
                  {kpi.label}
                </span>
              </div>
              <p className="text-title-3 font-semibold text-foreground tabular-nums">
                {kpi.value}
              </p>
              <p className="text-caption-2 text-muted-foreground mt-0.5">
                {kpi.subtitle}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
