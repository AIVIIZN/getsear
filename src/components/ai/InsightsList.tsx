'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useAIStore } from '@/stores/ai-store'
import { InsightCard } from './InsightCard'

interface InsightsListProps {
  maxItems?: number
  showViewAll?: boolean
}

/**
 * Dashboard widget showing AI-generated insights.
 */
export function InsightsList({ maxItems = 3, showViewAll = true }: InsightsListProps) {
  const insights = useAIStore((s) => s.insights)
  const insightsLoading = useAIStore((s) => s.insightsLoading)
  const loadInsights = useAIStore((s) => s.actions.loadInsights)
  const dismissInsight = useAIStore((s) => s.actions.dismissInsight)
  const feedbackInsight = useAIStore((s) => s.actions.feedbackInsight)

  useEffect(() => {
    loadInsights()
  }, [loadInsights])

  const activeInsights = insights.filter((i) => !i.isDismissed)
  const displayInsights = activeInsights.slice(0, maxItems)

  if (insightsLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">AI Insights</h2>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl animate-skeleton"
            style={{ border: '0.5px solid var(--border)' }}
          />
        ))}
      </div>
    )
  }

  if (activeInsights.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">AI Insights</h2>
        </div>
        <div
          className="flex flex-col items-center justify-center rounded-2xl bg-white py-8 px-4"
          style={{
            boxShadow: 'var(--shadow-sm)',
            border: '0.5px solid var(--border)',
          }}
        >
          <Sparkles className="h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-callout font-medium text-foreground">No new insights</p>
          <p className="text-footnote text-muted-foreground text-center mt-1">
            Insights are generated daily at 5 AM based on your restaurant data.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-headline">AI Insights</h2>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption-2 font-semibold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {activeInsights.length}
          </span>
        </div>

        {showViewAll && activeInsights.length > maxItems && (
          <Link
            href="/ask"
            className="flex items-center gap-1 text-footnote font-medium text-[var(--primary)] transition-colors"
          >
            View All
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {displayInsights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onDismiss={dismissInsight}
            onFeedback={feedbackInsight}
          />
        ))}
      </div>
    </div>
  )
}
