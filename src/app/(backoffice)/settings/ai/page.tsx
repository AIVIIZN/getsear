'use client'

import * as React from 'react'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Sparkles,
  MessageSquare,
  TrendingUp,
  Bell,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui-v2/Card'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { NumberInput } from '@/components/ui-v2/inputs/Number'
import { Segmented } from '@/components/ui-v2/inputs/Segmented'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Alert } from '@/components/ui-v2/feedback/Alert'
import { AIUsageMeter } from '@/components/ai/AIUsageMeter'

interface AISettings {
  ask_enabled: boolean
  insights_enabled: boolean
  predict_enabled: boolean
  insight_delivery: 'dashboard' | 'email' | 'both'
  insight_frequency: 'daily' | 'weekly'
  daily_query_limit: number
  cost_alert_threshold_cents: number
  has_api_key: boolean
}

function FeatureToggle({
  enabled,
  onToggle,
  label,
  description,
  icon: Icon,
}: {
  enabled: boolean
  onToggle: (val: boolean) => void
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between gap-[var(--space-4)] py-[var(--space-3)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-sidebar-active)]">
          <Icon className="h-4 w-4 text-[color:var(--color-primary)]" />
        </div>
        <div>
          <p className="text-[length:var(--type-callout-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">
            {label}
          </p>
          <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
            {description}
          </p>
        </div>
      </div>
      <Toggle checked={enabled} onChange={onToggle} />
    </div>
  )
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [, setSaving] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const resp = await fetch('/api/ai/settings')
        if (resp.ok) {
          const { data } = await resp.json()
          setSettings(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const updateSetting = useCallback(
    async (key: string, value: boolean | string | number) => {
      if (!settings) return
      const updated = { ...settings, [key]: value }
      setSettings(updated)
      setSaving(true)

      try {
        await fetch('/api/ai/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        })
      } catch {
        setSettings(settings)
      } finally {
        setSaving(false)
      }
    },
    [settings],
  )

  if (loading || !settings) {
    return (
      <div className="flex flex-col gap-[var(--space-6)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <Link
            href="/settings"
            className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
              AI Intelligence
            </h1>
            <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
              Loading...
            </p>
          </div>
        </div>
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            AI Intelligence
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure Sear Ask, Insights, and Predictions
          </p>
        </div>
      </div>

      {/* API key status */}
      {!settings.has_api_key && (
        <Alert variant="warning" icon={<AlertTriangle className="h-5 w-5" />}>
          <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            API Key Not Configured
          </p>
          <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
            Set the ANTHROPIC_API_KEY environment variable on your server to enable AI features.
            Get an API key at{' '}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-primary)] underline"
            >
              console.anthropic.com
            </a>
          </p>
        </Alert>
      )}

      {/* Feature toggles */}
      <Card variant="flat" padding="default" className="gap-0 px-[var(--space-5)] py-[var(--space-2)]">
        <FeatureToggle
          enabled={settings.ask_enabled}
          onToggle={(val) => updateSetting('ask_enabled', val)}
          label="Sear Ask"
          description="Natural-language queries about your restaurant data"
          icon={MessageSquare}
        />
        <div className="border-t border-[color:var(--color-border)]" />
        <FeatureToggle
          enabled={settings.insights_enabled}
          onToggle={(val) => updateSetting('insights_enabled', val)}
          label="Sear Insights"
          description="Daily AI-generated recommendations on your dashboard"
          icon={Sparkles}
        />
        <div className="border-t border-[color:var(--color-border)]" />
        <FeatureToggle
          enabled={settings.predict_enabled}
          onToggle={(val) => updateSetting('predict_enabled', val)}
          label="Sear Predict"
          description="Demand forecasting for revenue, covers, and labor"
          icon={TrendingUp}
        />
      </Card>

      {/* Insight preferences */}
      <Card variant="flat" padding="default">
        <div className="flex items-center gap-[var(--space-2)]">
          <Bell className="h-4 w-4 text-[color:var(--color-primary)]" />
          <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Insight Delivery
          </p>
        </div>

        <div className="flex flex-col gap-[var(--space-4)]">
          <div className="flex flex-col gap-[var(--space-2)]">
            <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">
              Delivery Method
            </label>
            <Segmented
              value={settings.insight_delivery}
              onChange={(v) => updateSetting('insight_delivery', v)}
              options={[
                { value: 'dashboard', label: 'Dashboard Only' },
                { value: 'email', label: 'Email Only' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">
              Frequency
            </label>
            <Segmented
              value={settings.insight_frequency}
              onChange={(v) => updateSetting('insight_frequency', v)}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly Summary' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <NumberInput
              label="Daily Query Limit"
              size="md"
              value={settings.daily_query_limit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 10 && val <= 500) {
                  updateSetting('daily_query_limit', val)
                }
              }}
              min={10}
              max={500}
              className="w-32 tabular-nums"
              helper="Queries per user per day"
            />
          </div>

          <div className="flex flex-col gap-[var(--space-2)]">
            <NumberInput
              label="Monthly Cost Alert ($)"
              size="md"
              value={settings.cost_alert_threshold_cents / 100}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val) && val >= 0) {
                  updateSetting('cost_alert_threshold_cents', Math.round(val * 100))
                }
              }}
              min={0}
              step={5}
              className="w-32 tabular-nums"
              helper="Alert when monthly AI cost exceeds this"
            />
          </div>
        </div>
      </Card>

      {/* Usage */}
      <Card variant="flat" padding="default">
        <div className="flex items-center gap-[var(--space-2)]">
          <Sparkles className="h-4 w-4 text-[color:var(--color-primary)]" />
          <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Usage & Cost
          </p>
        </div>
        <AIUsageMeter />
      </Card>

      {/* Privacy notice */}
      <Card variant="flat" padding="default">
        <div className="flex items-center gap-[var(--space-2)]">
          <Shield className="h-4 w-4 text-[color:var(--color-primary)]" />
          <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Data Privacy
          </p>
        </div>
        <div className="flex flex-col gap-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
          <p>
            Your business data (sales, labor, menu performance) is sent to Claude AI (Anthropic) for analysis.
            This enables natural-language queries and insight generation.
          </p>
          <p>
            <strong className="text-[color:var(--color-text)]">No personally identifiable customer data</strong> (names, emails, phone numbers)
            is ever included in AI requests. Customer data is anonymized before processing.
          </p>
          <p>
            Queries are processed in real-time and are not stored or used for model training by Anthropic
            per their API Terms of Service.
          </p>
        </div>
      </Card>
    </div>
  )
}
