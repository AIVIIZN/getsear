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
  BookOpenText,
  History,
  Save,
} from 'lucide-react'
import { Card } from '@/components/ui-v2/Card'
import { Button } from '@/components/ui-v2/Button'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { NumberInput } from '@/components/ui-v2/inputs/Number'
import { Segmented } from '@/components/ui-v2/inputs/Segmented'
import { Textarea } from '@/components/ui-v2/inputs/Textarea'
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

interface RestaurantMemoryRule {
  id?: string
  rule_key: string
  category: 'brand_voice' | 'discount_policy' | 'vip_hospitality' | 'birthday' | 'wine' | 'recovery' | 'campaign' | 'next_best_action' | 'other'
  title: string
  rule_text: string
  applies_to: Array<'campaign' | 'next_best_action' | 'guest_summary' | 'server_brief' | 'recovery_message' | 'segment_draft' | 'report_builder' | 'data_cleanup'>
  priority: number
  active: boolean
}

interface RestaurantMemoryAuditEntry {
  id: string
  action: string
  user_role: string | null
  description: string | null
  created_at: string
}

const defaultMemoryRules: RestaurantMemoryRule[] = [
  {
    rule_key: 'no-aggressive-discounts',
    category: 'discount_policy',
    title: 'No aggressive discounts',
    rule_text: 'Do not lead with aggressive discounts. Prefer hospitality, recognition, and curated invitations before price cuts.',
    applies_to: ['campaign', 'next_best_action', 'recovery_message'],
    priority: 10,
    active: true,
  },
  {
    rule_key: 'vip-invites-not-coupons',
    category: 'vip_hospitality',
    title: 'VIP invites are not coupons',
    rule_text: 'VIP guests should receive personal invitations, manager greetings, priority reservations, or event access instead of coupon language.',
    applies_to: ['campaign', 'next_best_action', 'server_brief'],
    priority: 20,
    active: true,
  },
  {
    rule_key: 'birthday-dessert',
    category: 'birthday',
    title: 'Birthdays get dessert',
    rule_text: 'Birthday recommendations should offer a complimentary dessert or hospitality moment, not a percent discount.',
    applies_to: ['campaign', 'next_best_action'],
    priority: 30,
    active: true,
  },
  {
    rule_key: 'wine-guests-event-invites',
    category: 'wine',
    title: 'Wine guests get event invites',
    rule_text: 'Guests with wine preferences should be invited to tastings, pairing dinners, and cellar events.',
    applies_to: ['campaign', 'next_best_action'],
    priority: 40,
    active: true,
  },
]

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
  const [memoryRules, setMemoryRules] = useState<RestaurantMemoryRule[]>(defaultMemoryRules)
  const [memoryAudit, setMemoryAudit] = useState<RestaurantMemoryAuditEntry[]>([])
  const [canEditMemory, setCanEditMemory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [memorySaved, setMemorySaved] = useState(false)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsResp, memoryResp] = await Promise.all([
          fetch('/api/ai/settings'),
          fetch('/api/crm/restaurant-memory'),
        ])
        if (settingsResp.ok) {
          const { data } = await settingsResp.json()
          setSettings(data)
        }
        if (memoryResp.ok) {
          const { data } = await memoryResp.json()
          setMemoryRules(data.rules.length ? data.rules : defaultMemoryRules)
          setMemoryAudit(data.audit_history ?? [])
          setCanEditMemory(Boolean(data.can_edit))
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

  const updateMemoryRule = useCallback((index: number, patch: Partial<RestaurantMemoryRule>) => {
    setMemorySaved(false)
    setMemoryRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule))
  }, [])

  const saveRestaurantMemory = useCallback(async () => {
    setSaving(true)
    setMemorySaved(false)
    try {
      const resp = await fetch('/api/crm/restaurant-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: memoryRules }),
      })
      if (resp.ok) {
        const { data } = await resp.json()
        setMemoryRules(data.rules)
        setMemorySaved(true)
      }
    } finally {
      setSaving(false)
    }
  }, [memoryRules])

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

      {/* Restaurant Memory */}
      <Card variant="flat" padding="default">
        <div className="flex flex-col gap-[var(--space-4)]">
          <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <BookOpenText className="h-4 w-4 text-[color:var(--color-primary)]" />
              <div>
                <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  Restaurant Memory
                </p>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  Brand voice and hospitality rules used by GuestBrain, campaigns, and next best actions
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="md"
              variant="secondary"
              disabled={!canEditMemory}
              loading={saving}
              leadingIcon={<Save />}
              onClick={saveRestaurantMemory}
            >
              Save rules
            </Button>
          </div>

          {!canEditMemory && (
            <Alert variant="warning" icon={<Shield className="h-5 w-5" />}>
              <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                Owner or admin access is required to edit Restaurant Memory.
              </p>
            </Alert>
          )}

          {memorySaved && (
            <Alert variant="success">
              <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                Restaurant Memory saved. New AI recommendations will use these rules.
              </p>
            </Alert>
          )}

          <div className="grid gap-[var(--space-3)] lg:grid-cols-2">
            {memoryRules.map((rule, index) => (
              <div
                key={rule.rule_key}
                className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-[var(--space-4)]"
              >
                <div className="mb-[var(--space-3)] flex items-start justify-between gap-[var(--space-3)]">
                  <div>
                    <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                      {rule.title}
                    </p>
                    <p className="text-[length:var(--type-caption-1-size)] uppercase text-[color:var(--color-text-muted)]">
                      {rule.category.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Toggle
                    checked={rule.active}
                    onChange={(active) => updateMemoryRule(index, { active })}
                    disabled={!canEditMemory}
                  />
                </div>
                <Textarea
                  value={rule.rule_text}
                  onChange={(event) => updateMemoryRule(index, { rule_text: event.target.value })}
                  readOnly={!canEditMemory}
                  size="md"
                  helper={rule.applies_to.map((item) => item.replaceAll('_', ' ')).join(', ')}
                />
              </div>
            ))}
          </div>

          <div className="border-t border-[color:var(--color-border)] pt-[var(--space-4)]">
            <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
              <History className="h-4 w-4 text-[color:var(--color-primary)]" />
              <p className="text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                Audit History
              </p>
            </div>
            {memoryAudit.length === 0 ? (
              <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                No Restaurant Memory edits have been recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-[var(--space-2)]">
                {memoryAudit.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-[var(--space-3)] text-[length:var(--type-footnote-size)]">
                    <span className="text-[color:var(--color-text)]">{entry.description ?? entry.action}</span>
                    <span className="shrink-0 text-[color:var(--color-text-muted)]">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
