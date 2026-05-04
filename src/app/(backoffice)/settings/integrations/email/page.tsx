'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Send, FileText, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Email } from '@/components/ui-v2/inputs/Email'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { ConnectionStatus } from '@/components/integrations/ConnectionStatus'
import { ApiKeyInput } from '@/components/integrations/ApiKeyInput'
import { useIntegrationsStore } from '@/stores/integrations-store'

export default function EmailConfigPage() {
  const { setStatus } = useIntegrationsStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [notifications, setNotifications] = useState({
    receipts: true,
    daily_reports: true,
    marketing: false,
    password_reset: true,
  })

  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'error' | 'loading'
  >('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/email/config?location_id=${locationId}`)
      const json = await res.json()
      if (json.data) {
        setApiKey(json.data.api_key ?? '')
        setSenderEmail(json.data.sender_email ?? '')
        setSenderName(json.data.sender_name ?? '')
        setReplyTo(json.data.reply_to ?? '')
        setIsActive(json.data.is_active ?? true)
        setNotifications(json.data.notifications ?? notifications)

        const hasKey = json.data.api_key && json.data.api_key.length > 4
        setConnectionStatus(hasKey && json.data.is_active ? 'connected' : 'disconnected')
        setStatus('sendgrid', hasKey && json.data.is_active ? 'connected' : 'disconnected')
      }
    } catch {
      setConnectionStatus('error')
      setErrorMessage('Failed to load configuration')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, setStatus])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/email/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          api_key: apiKey,
          sender_email: senderEmail,
          sender_name: senderName,
          reply_to: replyTo,
          is_active: isActive,
          notifications,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Email configuration saved')
      setConnectionStatus(isActive && apiKey ? 'connected' : 'disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!senderEmail) {
      toast.error('Enter a sender email first')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/integrations/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          sender_email: senderEmail,
          sender_name: senderName || 'Sear POS',
          test_to: senderEmail,
        }),
      })
      const json = await res.json()
      if (json.error) {
        setConnectionStatus('error')
        setErrorMessage(json.error)
        toast.error(`Test failed: ${json.error}`)
      } else {
        setConnectionStatus('connected')
        setErrorMessage(undefined)
        toast.success(`Test email sent to ${senderEmail}`)
      }
    } catch {
      setConnectionStatus('error')
      toast.error('Connection test failed')
    } finally {
      setTesting(false)
    }
  }

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--space-6)] max-w-2xl">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex max-w-2xl flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings/integrations"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
          aria-label="Back to integrations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Email Configuration
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure SendGrid for email notifications
          </p>
        </div>
        <ConnectionStatus status={connectionStatus} errorMessage={errorMessage} />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-[var(--space-2)]">
        <Link href="/settings/integrations/email/templates" className="block">
          <Button variant="secondary" size="md" leadingIcon={<FileText className="h-4 w-4" />}>
            Templates
          </Button>
        </Link>
        <Link href="/settings/integrations/email/log" className="block">
          <Button variant="secondary" size="md" leadingIcon={<ScrollText className="h-4 w-4" />}>
            Delivery Log
          </Button>
        </Link>
      </div>

      {/* Credentials */}
      <Card variant="flat" padding="default">
        <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text)]">
          SendGrid Credentials
        </h3>

        <div className="flex flex-col gap-[var(--space-4)]">
          <ApiKeyInput
            id="api_key"
            label="API Key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="SG.xxxxxxxxxxxxxxxxxx"
            helpText="Create an API key in SendGrid Settings > API Keys with Mail Send permission"
          />

          <Email
            size="lg"
            label="Sender Email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="noreply@yourdomain.com"
            helper="Must be a verified sender in SendGrid"
          />

          <Text
            size="lg"
            label="Sender Name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Sear Grill Downtown"
          />

          <Email
            size="lg"
            label="Reply-To Address (optional)"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="hello@yourdomain.com"
          />

          <div>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleTest}
              disabled={!apiKey || !senderEmail}
              loading={testing}
              leadingIcon={<Send className="h-4 w-4" />}
            >
              Send Test Email
            </Button>
          </div>
        </div>
      </Card>

      {/* Notification Toggles */}
      <Card variant="flat" padding="default">
        <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text)]">
          Email Types
        </h3>

        <div className="flex flex-col gap-[var(--space-4)]">
          {[
            { key: 'receipts' as const, label: 'Receipts', desc: 'Send email receipts after payment' },
            { key: 'daily_reports' as const, label: 'Daily Reports', desc: 'Send daily performance summaries to owners and managers' },
            { key: 'marketing' as const, label: 'Marketing Campaigns', desc: 'Send promotional emails (CAN-SPAM compliant)' },
            { key: 'password_reset' as const, label: 'Password Reset', desc: 'Allow password reset via email' },
          ].map(({ key, label, desc }) => (
            <Toggle
              key={key}
              checked={notifications[key]}
              onChange={() => toggleNotification(key)}
              label={label}
              helper={desc}
            />
          ))}
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label={`Integration ${isActive ? 'Active' : 'Inactive'}`}
        />
        <Button
          onClick={handleSave}
          loading={saving}
          size="lg"
          leadingIcon={<Save className="h-4 w-4" />}
        >
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
