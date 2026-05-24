'use client'

import { Bot, Cpu, Gauge, PiggyBank, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/stores/ai-store'

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value)
}

function formatMoney(value: number): string {
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

/**
 * Compact runtime telemetry for the Ask terminal.
 */
export function AIStatusBar({ compact = false }: { compact?: boolean }) {
  const status = useAIStore((s) => s.runtimeStatus)

  const contextPercent = Math.min(
    100,
    Math.round((status.contextTokens / status.contextLimit) * 100)
  )
  const contextLabel = `${formatCompactNumber(status.contextTokens)} / ${formatCompactNumber(
    status.contextLimit
  )}`

  const items = [
    {
      icon: Gauge,
      label: 'Context',
      value: `${contextLabel} (${contextPercent}%)`,
    },
    {
      icon: Wallet,
      label: 'Spent',
      value: `${formatCompactNumber(status.spentTokens)} tok · ${formatMoney(status.spentCost)}`,
    },
    {
      icon: PiggyBank,
      label: 'Cached',
      value: `${formatCompactNumber(status.cachedTokensSaved)} tok · ${formatMoney(
        status.cachedCostSaved
      )}`,
    },
    {
      icon: Cpu,
      label: 'Model',
      value: status.model,
    },
    {
      icon: Bot,
      label: 'Agents',
      value: status.activeAgents > 0 ? `${status.activeAgents} running` : '0 running',
    },
  ]

  return (
    <div
      role="status"
      aria-label="AI runtime status"
      className={cn(
        'mt-2 grid shrink-0 grid-cols-2 gap-1.5 rounded-lg px-2.5 py-2 text-caption-2',
        compact ? 'max-h-[82px] overflow-hidden' : 'md:grid-cols-5'
      )}
      style={{
        backgroundColor: 'var(--secondary)',
        border: '0.5px solid var(--border)',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--card)]/70 px-1.5 py-1"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="shrink-0 font-medium text-muted-foreground">{item.label}</span>
            <span className="min-w-0 truncate font-semibold tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
