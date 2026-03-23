'use client'

import { useState } from 'react'
import {
  TrendingUp,
  Users,
  Trash2,
  Zap,
  AlertTriangle,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Insight } from '@/stores/ai-store'

interface InsightCardProps {
  insight: Insight
  onDismiss: (id: string) => void
  onFeedback: (id: string, feedback: 'helpful' | 'not_helpful') => void
}

const CATEGORY_CONFIG: Record<
  string,
  { color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  menu_profitability: { color: 'var(--success)', icon: TrendingUp },
  labor_optimization: { color: 'var(--warning)', icon: Users },
  waste_reduction: { color: 'var(--error)', icon: Trash2 },
  sales_trends: { color: 'var(--info)', icon: BarChart3 },
  speed_issues: { color: 'var(--warning)', icon: Zap },
  void_comp_alerts: { color: 'var(--error)', icon: AlertTriangle },
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Action Needed',
  medium: 'Review',
  low: 'FYI',
}

export function InsightCard({ insight, onDismiss, onFeedback }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)

  const config = CATEGORY_CONFIG[insight.category] ?? {
    color: 'var(--info)',
    icon: BarChart3,
  }
  const Icon = config.icon

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white animate-fade-in"
      style={{
        boxShadow: 'var(--shadow-sm)',
        border: '0.5px solid var(--border)',
      }}
    >
      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: config.color }}
      />

      <div className="pl-4 pr-3 py-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <span style={{ color: config.color }}><Icon className="h-4 w-4" /></span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-caption-2 font-semibold uppercase tracking-wide"
                style={{ color: config.color as string }}
              >
                {PRIORITY_LABELS[insight.priority] ?? 'Info'}
              </span>
              {insight.metricValue && (
                <span className="text-caption-1 font-semibold text-foreground tabular-nums">
                  {insight.metricValue}
                </span>
              )}
              {insight.comparisonText && (
                <span className="text-caption-2 text-muted-foreground">
                  {insight.comparisonText}
                </span>
              )}
            </div>
            <p className="text-callout font-semibold text-foreground leading-snug">
              {insight.title}
            </p>
            <p className="text-footnote text-muted-foreground mt-0.5 leading-snug">
              {insight.summary}
            </p>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => onDismiss(insight.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-black/[0.04] transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Expanded details */}
        {expanded && insight.details && (
          <div className="mt-3 ml-11 animate-fade-in">
            <p className="text-footnote text-foreground leading-relaxed">
              {insight.details}
            </p>
          </div>
        )}

        {/* Actions row */}
        <div className="mt-2 ml-11 flex items-center gap-2">
          {insight.details && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-caption-1 font-medium transition-colors"
              style={{ color: 'var(--primary)' as string }}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Details
                </>
              )}
            </button>
          )}

          <div className="flex-1" />

          {/* Feedback */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFeedback(insight.id, 'helpful')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                insight.feedback === 'helpful'
                  ? 'bg-[var(--success-bg)]'
                  : 'hover:bg-black/[0.04]'
              )}
              aria-label="Helpful"
            >
              <ThumbsUp
                className="h-3.5 w-3.5"
                style={{
                  color:
                    insight.feedback === 'helpful'
                      ? 'var(--success)'
                      : 'var(--muted-foreground)',
                }}
              />
            </button>
            <button
              onClick={() => onFeedback(insight.id, 'not_helpful')}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                insight.feedback === 'not_helpful'
                  ? 'bg-[var(--error-bg)]'
                  : 'hover:bg-black/[0.04]'
              )}
              aria-label="Not helpful"
            >
              <ThumbsDown
                className="h-3.5 w-3.5"
                style={{
                  color:
                    insight.feedback === 'not_helpful'
                      ? 'var(--error)'
                      : 'var(--muted-foreground)',
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
