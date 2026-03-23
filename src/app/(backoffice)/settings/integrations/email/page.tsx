'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Send, FileText, ScrollText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'loading'>('disconnected')
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
  }, [locationId, setStatus])

  useEffect(() => { fetchConfig() }, [fetchConfig])

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
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">Email Configuration</h2>
          <p className="text-sm text-muted-foreground">Configure SendGrid for email notifications</p>
        </div>
        <ConnectionStatus status={connectionStatus} errorMessage={errorMessage} />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2">
        <Link
          href="/settings/integrations/email/templates"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <FileText className="h-4 w-4" />
          Templates
        </Link>
        <Link
          href="/settings/integrations/email/log"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ScrollText className="h-4 w-4" />
          Delivery Log
        </Link>
      </div>

      {/* Credentials */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">SendGrid Credentials</h3>

        <div className="space-y-4">
          <ApiKeyInput
            id="api_key"
            label="API Key"
            value={apiKey}
            onChange={setApiKey}
            placeholder="SG.xxxxxxxxxxxxxxxxxx"
            helpText="Create an API key in SendGrid Settings > API Keys with Mail Send permission"
          />

          <div className="space-y-1.5">
            <label htmlFor="sender_email" className="text-sm font-medium text-foreground">Sender Email</label>
            <input
              id="sender_email"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="noreply@yourdomain.com"
              className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
            />
            <p className="text-xs text-muted-foreground">Must be a verified sender in SendGrid</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sender_name" className="text-sm font-medium text-foreground">Sender Name</label>
            <input
              id="sender_name"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Sear Grill Downtown"
              className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reply_to" className="text-sm font-medium text-foreground">Reply-To Address (optional)</label>
            <input
              id="reply_to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="hello@yourdomain.com"
              className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={testing || !apiKey || !senderEmail}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors touch-target',
              'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test Email
          </button>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Email Types</h3>

        <div className="space-y-4">
          {[
            { key: 'receipts' as const, label: 'Receipts', desc: 'Send email receipts after payment' },
            { key: 'daily_reports' as const, label: 'Daily Reports', desc: 'Send daily performance summaries to owners and managers' },
            { key: 'marketing' as const, label: 'Marketing Campaigns', desc: 'Send promotional emails (CAN-SPAM compliant)' },
            { key: 'password_reset' as const, label: 'Password Reset', desc: 'Allow password reset via email' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-start justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifications[key]}
                onClick={() => toggleNotification(key)}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors touch-target',
                  notifications[key] ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                )}
              >
                <span className={cn('pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg transition-transform', notifications[key] ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors touch-target',
              isActive ? 'bg-[var(--success)]' : 'bg-[var(--muted)]'
            )}
          >
            <span className={cn('pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg transition-transform', isActive ? 'translate-x-5' : 'translate-x-0')} />
          </button>
          <span className="text-sm font-medium text-foreground">Integration {isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors',
            'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'touch-target shadow-sm'
          )}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Configuration
        </button>
      </div>
    </div>
  )
}
