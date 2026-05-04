'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Send, FileText, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
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

  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'error' | 'loading'
  >('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

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

        const hasCredentials =
          (json.data.account_sid && !json.data.account_sid.startsWith('****')) ||
          (json.data.account_sid?.length ?? 0) > 4
        setConnectionStatus(hasCredentials && json.data.is_active ? 'connected' : 'disconnected')
        setStatus('twilio', hasCredentials && json.data.is_active ? 'connected' : 'disconnected')
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
      const wasConnected = isActive && Boolean(accountSid) && Boolean(authToken)
      setConnectionStatus(wasConnected ? 'connected' : 'disconnected')
      setStatus('twilio', wasConnected ? 'connected' : 'disconnected')
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
            SMS Configuration
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Configure Twilio for SMS notifications
          </p>
        </div>
        <ConnectionStatus status={connectionStatus} errorMessage={errorMessage} />
      </div>

      {/* Sub-nav */}
      <div className="flex gap-[var(--space-2)]">
        <Link href="/settings/integrations/sms/templates" className="block">
          <Button variant="secondary" size="md" leadingIcon={<FileText className="h-4 w-4" />}>
            Templates
          </Button>
        </Link>
        <Link href="/settings/integrations/sms/log" className="block">
          <Button variant="secondary" size="md" leadingIcon={<ScrollText className="h-4 w-4" />}>
            Delivery Log
          </Button>
        </Link>
      </div>

      {/* Credentials */}
      <Card variant="flat" padding="default">
        <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text)]">
          Twilio Credentials
        </h3>

        <div className="flex flex-col gap-[var(--space-4)]">
          <Text
            size="lg"
            label="Account SID"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono"
          />

          <ApiKeyInput
            id="auth_token"
            label="Auth Token"
            value={authToken}
            onChange={setAuthToken}
            placeholder="Enter your Twilio auth token"
            helpText="Found in your Twilio Console under Account Info"
          />

          <Text
            size="lg"
            label="Sending Phone Number"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15551234567"
            helper="E.164 format with country code"
          />

          <div className="flex flex-col gap-[var(--space-2)]">
            <label
              htmlFor="test_phone"
              className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]"
            >
              Test Phone Number
            </label>
            <div className="flex gap-[var(--space-2)]">
              <Text
                id="test_phone"
                size="lg"
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+15559876543"
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="lg"
                onClick={handleTest}
                disabled={!accountSid || !authToken || !phoneNumber}
                loading={testing}
                leadingIcon={<Send className="h-4 w-4" />}
              >
                Test
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Notification Toggles */}
      <Card variant="flat" padding="default">
        <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text)]">
          Notification Types
        </h3>

        <div className="flex flex-col gap-[var(--space-4)]">
          {[
            { key: 'order_ready' as const, label: 'Order Ready', desc: 'Notify customers when takeout/delivery orders are ready for pickup' },
            { key: 'reservation_reminder' as const, label: 'Reservation Reminders', desc: 'Send reminders 24 hours and 2 hours before reservations' },
            { key: 'waitlist_alert' as const, label: 'Waitlist Alerts', desc: 'Alert guests when their table is ready' },
            { key: 'marketing' as const, label: 'Marketing Campaigns', desc: 'Send promotional messages (requires opt-out language)' },
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

      {/* Active Toggle & Save */}
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
