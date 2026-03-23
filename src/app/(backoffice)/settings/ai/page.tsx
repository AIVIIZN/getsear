'use client'

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
import { cn } from '@/lib/utils'
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

function ToggleSwitch({
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
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Icon className="h-4 w-4 text-[var(--primary)]" />
        </div>
        <div>
          <p className="text-callout font-medium text-foreground">{label}</p>
          <p className="text-caption-1 text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={cn(
          'relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200',
          enabled ? 'bg-[var(--success)]' : 'bg-[#E5E5EA]'
        )}
        role="switch"
        aria-checked={enabled}
      >
        <div
          className={cn(
            'absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  )
}

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
        // Revert on error
        setSettings(settings)
      } finally {
        setSaving(false)
      }
    },
    [settings]
  )

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="btn-press">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="page-title">AI Intelligence</h1>
            <p className="page-subtitle">Loading...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl animate-skeleton" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings" className="btn-press">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="page-title">AI Intelligence</h1>
          <p className="page-subtitle">
            Configure Sear Ask, Insights, and Predictions
          </p>
        </div>
      </div>

      {/* API key status */}
      {!settings.has_api_key && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-4"
          style={{
            backgroundColor: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
          }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--warning)' }} />
          <div>
            <p className="text-callout font-semibold text-foreground">API Key Not Configured</p>
            <p className="text-footnote text-muted-foreground">
              Set the ANTHROPIC_API_KEY environment variable on your server to enable AI features.
              Get an API key at{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--primary)' }}
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Feature toggles */}
      <div
        className="rounded-2xl bg-white px-5 py-2"
        style={{
          boxShadow: 'var(--shadow-sm)',
          border: '0.5px solid var(--border)',
        }}
      >
        <ToggleSwitch
          enabled={settings.ask_enabled}
          onToggle={(val) => updateSetting('ask_enabled', val)}
          label="Sear Ask"
          description="Natural-language queries about your restaurant data"
          icon={MessageSquare}
        />
        <div style={{ borderTop: '0.5px solid var(--separator)' }} />
        <ToggleSwitch
          enabled={settings.insights_enabled}
          onToggle={(val) => updateSetting('insights_enabled', val)}
          label="Sear Insights"
          description="Daily AI-generated recommendations on your dashboard"
          icon={Sparkles}
        />
        <div style={{ borderTop: '0.5px solid var(--separator)' }} />
        <ToggleSwitch
          enabled={settings.predict_enabled}
          onToggle={(val) => updateSetting('predict_enabled', val)}
          label="Sear Predict"
          description="Demand forecasting for revenue, covers, and labor"
          icon={TrendingUp}
        />
      </div>

      {/* Insight preferences */}
      <div
        className="rounded-2xl bg-white px-5 py-4"
        style={{
          boxShadow: 'var(--shadow-sm)',
          border: '0.5px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Bell className="h-4 w-4 text-[var(--primary)]" />
          <p className="text-callout font-semibold text-foreground">Insight Delivery</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-footnote font-medium text-muted-foreground mb-1 block">
              Delivery Method
            </label>
            <div className="flex gap-2">
              {(['dashboard', 'email', 'both'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => updateSetting('insight_delivery', option)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-footnote font-medium transition-colors',
                    settings.insight_delivery === option
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]'
                  )}
                  style={{
                    border: settings.insight_delivery === option
                      ? 'none'
                      : '0.5px solid var(--border)',
                  }}
                >
                  {option === 'dashboard'
                    ? 'Dashboard Only'
                    : option === 'email'
                      ? 'Email Only'
                      : 'Both'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-footnote font-medium text-muted-foreground mb-1 block">
              Frequency
            </label>
            <div className="flex gap-2">
              {(['daily', 'weekly'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => updateSetting('insight_frequency', option)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-footnote font-medium transition-colors',
                    settings.insight_frequency === option
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]'
                  )}
                  style={{
                    border: settings.insight_frequency === option
                      ? 'none'
                      : '0.5px solid var(--border)',
                  }}
                >
                  {option === 'daily' ? 'Daily' : 'Weekly Summary'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-footnote font-medium text-muted-foreground mb-1 block">
              Daily Query Limit
            </label>
            <input
              type="number"
              value={settings.daily_query_limit}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 10 && val <= 500) {
                  updateSetting('daily_query_limit', val)
                }
              }}
              min={10}
              max={500}
              className="w-24 rounded-xl border px-3 py-2 text-footnote tabular-nums"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--secondary)',
              }}
            />
            <span className="text-caption-1 text-muted-foreground ml-2">queries per user per day</span>
          </div>

          <div>
            <label className="text-footnote font-medium text-muted-foreground mb-1 block">
              Monthly Cost Alert
            </label>
            <div className="flex items-center gap-2">
              <span className="text-footnote text-muted-foreground">$</span>
              <input
                type="number"
                value={settings.cost_alert_threshold_cents / 100}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= 0) {
                    updateSetting('cost_alert_threshold_cents', Math.round(val * 100))
                  }
                }}
                min={0}
                step={5}
                className="w-24 rounded-xl border px-3 py-2 text-footnote tabular-nums"
                style={{
                  borderColor: 'var(--border)',
                  backgroundColor: 'var(--secondary)',
                }}
              />
              <span className="text-caption-1 text-muted-foreground">/ month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div
        className="rounded-2xl bg-white px-5 py-4"
        style={{
          boxShadow: 'var(--shadow-sm)',
          border: '0.5px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[var(--primary)]" />
          <p className="text-callout font-semibold text-foreground">Usage & Cost</p>
        </div>
        <AIUsageMeter />
      </div>

      {/* Privacy notice */}
      <div
        className="rounded-2xl bg-white px-5 py-4"
        style={{
          boxShadow: 'var(--shadow-sm)',
          border: '0.5px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-[var(--primary)]" />
          <p className="text-callout font-semibold text-foreground">Data Privacy</p>
        </div>
        <div className="text-footnote text-muted-foreground space-y-2">
          <p>
            Your business data (sales, labor, menu performance) is sent to Claude AI (Anthropic) for analysis.
            This enables natural-language queries and insight generation.
          </p>
          <p>
            <strong className="text-foreground">No personally identifiable customer data</strong> (names, emails, phone numbers)
            is ever included in AI requests. Customer data is anonymized before processing.
          </p>
          <p>
            Queries are processed in real-time and are not stored or used for model training by Anthropic
            per their API Terms of Service.
          </p>
        </div>
      </div>
    </div>
  )
}
