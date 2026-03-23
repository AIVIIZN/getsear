'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Send, FileText, ScrollText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConnectionStatus } from '@/components/integrations/ConnectionStatus'
import { ApiKeyInput } from '@/components/integrations/ApiKeyInput'
import { useIntegrationsStore } from '@/stores/integrations-store'

export default function SmsConfigPage() {
  const { setStatus } = useIntegrationsStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [notifications, setNotifications] = useState({
    order_ready: true,
    reservation_reminder: true,
    waitlist_alert: true,
    marketing: false,
  })

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error' | 'loading'>('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  // TODO: In production, get location_id from session/store
  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/sms/config?location_id=${locationId}`)
      const json = await res.json()
      if (json.data) {
        setAccountSid(json.data.account_sid ?? '')
        setAuthToken(json.data.auth_token ?? '')
        setPhoneNumber(json.data.phone_number ?? '')
        setTestPhone(json.data.test_phone ?? '')
        setIsActive(json.data.is_active ?? true)
        setNotifications(json.data.notifications ?? notifications)

        const hasCredentials = json.data.account_sid && !json.data.account_sid.startsWith('****') || (json.data.account_sid?.length ?? 0) > 4
        setConnectionStatus(hasCredentials && json.data.is_active ? 'connected' : 'disconnected')
        setStatus('twilio', hasCredentials && json.data.is_active ? 'connected' : 'disconnected')
      }
    } catch {
      setConnectionStatus('error')
      setErrorMessage('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }, [locationId, setStatus])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/integrations/sms/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          account_sid: accountSid,
          auth_token: authToken,
          phone_number: phoneNumber,
          test_phone: testPhone,
          is_active: isActive,
          notifications,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('SMS configuration saved')
      setConnectionStatus(isActive && accountSid && authToken ? 'connected' : 'disconnected')
      setStatus('twilio', isActive && accountSid && authToken ? 'connected' : 'disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testPhone) {
      toast.error('Enter a test phone number first')
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/integrations/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_sid: accountSid,
          auth_token: authToken,
          phone_number: phoneNumber,
          test_to: testPhone,
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
        toast.success('Test SMS sent successfully!')
      }
    } catch (err) {
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
          <h2 className="text-xl font-semibold text-foreground">SMS Configuration</h2>
          <p className="text-sm text-muted-foreground">Configure Twilio for SMS notifications</p>
        </div>
        <ConnectionStatus status={connectionStatus} errorMessage={errorMessage} />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2">
        <Link
          href="/settings/integrations/sms/templates"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <FileText className="h-4 w-4" />
          Templates
        </Link>
        <Link
          href="/settings/integrations/sms/log"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ScrollText className="h-4 w-4" />
          Delivery Log
        </Link>
      </div>

      {/* Credentials */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Twilio Credentials</h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="sid" className="text-sm font-medium text-foreground">Account SID</label>
            <input
              id="sid"
              type="text"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
            />
          </div>

          <ApiKeyInput
            id="auth_token"
            label="Auth Token"
            value={authToken}
            onChange={setAuthToken}
            placeholder="Enter your Twilio auth token"
            helpText="Found in your Twilio Console under Account Info"
          />

          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">Sending Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+15551234567"
              className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
            />
            <p className="text-xs text-muted-foreground">E.164 format with country code</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="test_phone" className="text-sm font-medium text-foreground">Test Phone Number</label>
            <div className="flex gap-2">
              <input
                id="test_phone"
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+15559876543"
                className="flex h-11 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
              />
              <button
                onClick={handleTest}
                disabled={testing || !accountSid || !authToken || !phoneNumber}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors touch-target',
                  'bg-[var(--secondary)] text-foreground hover:bg-[var(--muted)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toggles */}
      <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Notification Types</h3>

        <div className="space-y-4">
          {[
            { key: 'order_ready' as const, label: 'Order Ready', desc: 'Notify customers when takeout/delivery orders are ready for pickup' },
            { key: 'reservation_reminder' as const, label: 'Reservation Reminders', desc: 'Send reminders 24 hours and 2 hours before reservations' },
            { key: 'waitlist_alert' as const, label: 'Waitlist Alerts', desc: 'Alert guests when their table is ready' },
            { key: 'marketing' as const, label: 'Marketing Campaigns', desc: 'Send promotional messages (requires opt-out language)' },
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
                  'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2',
                  notifications[key] ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]',
                  'touch-target'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform',
                    notifications[key] ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Active Toggle & Save */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
              isActive ? 'bg-[var(--success)]' : 'bg-[var(--muted)]',
              'touch-target'
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
            'bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)]',
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
