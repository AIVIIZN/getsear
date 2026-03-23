'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ScrollText, Loader2, Save, Trash2, Send, Copy, Check,
  ChevronDown, ChevronUp, Code2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/integrations/webhook-dispatcher'
import { VERIFICATION_SAMPLES } from '@/lib/integrations/webhook-signature'

interface WebhookEndpoint {
  id: string
  name: string
  url: string
  secret: string
  events: WebhookEventType[]
  is_active: boolean
  created_at: string
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showDocs, setShowDocs] = useState(false)

  // Create form
  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<WebhookEventType[]>([])
  const [creating, setCreating] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)

  // Test / delete
  const [testing, setTesting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchEndpoints = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/webhooks?location_id=${locationId}`)
      const json = await res.json()
      if (json.data) setEndpoints(json.data)
    } catch {
      toast.error('Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => { fetchEndpoints() }, [fetchEndpoints])

  const handleCreate = async () => {
    if (!newName || !newUrl || newEvents.length === 0) {
      toast.error('Name, URL, and at least one event are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          name: newName,
          url: newUrl,
          events: newEvents,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCreatedSecret(json.data.secret)
      toast.success('Webhook created')
      setNewName('')
      setNewUrl('')
      setNewEvents([])
      fetchEndpoints()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}/test`, { method: 'POST' })
      const json = await res.json()
      if (json.data?.success) {
        toast.success(`Test sent! Response: ${json.data.status_code} (${json.data.response_time_ms}ms)`)
      } else {
        toast.error(`Test failed: ${json.data?.error ?? 'Unknown error'}`)
      }
    } catch {
      toast.error('Test request failed')
    } finally {
      setTesting(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Webhook deleted')
      fetchEndpoints()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/integrations/webhooks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      fetchEndpoints()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const toggleEvent = (event: WebhookEventType) => {
    setNewEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    )
  }

  const copySecret = async () => {
    if (!createdSecret) return
    await navigator.clipboard.writeText(createdSecret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  const groupedEvents = WEBHOOK_EVENTS.reduce<Record<string, typeof WEBHOOK_EVENTS>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = []
    acc[e.category].push(e)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings/integrations"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Webhooks</h2>
            <p className="text-sm text-muted-foreground">{endpoints.length}/10 endpoints configured</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings/integrations/webhooks/log"
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-foreground hover:bg-[var(--secondary)] transition-colors touch-target"
          >
            <ScrollText className="h-4 w-4" />
            Delivery Log
          </Link>
          <button
            onClick={() => setShowCreate(!showCreate)}
            disabled={endpoints.length >= 10}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors touch-target',
              'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus className="h-4 w-4" />
            Add Endpoint
          </button>
        </div>
      </div>

      {/* Secret display (after creation) */}
      {createdSecret && (
        <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success-bg)] p-4 space-y-2">
          <p className="text-sm font-semibold text-[#16a34a]">Webhook secret created</p>
          <p className="text-xs text-muted-foreground">Copy this secret now. It won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-[var(--border)] px-3 py-2 font-mono text-xs text-foreground overflow-x-auto">
              {createdSecret}
            </code>
            <button onClick={copySecret} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] touch-target">
              {secretCopied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button onClick={() => setCreatedSecret(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">New Webhook Endpoint</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Analytics Webhook"
                className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">URL</label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="flex h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 touch-target"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Subscribe to Events</p>
            {Object.entries(groupedEvents).map(([category, events]) => (
              <div key={category}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{category}</p>
                <div className="flex flex-wrap gap-1.5">
                  {events.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => toggleEvent(e.value)}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition-colors touch-target',
                        newEvents.includes(e.value)
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
                      )}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className={cn(
                'flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors touch-target',
                'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Endpoint
            </button>
          </div>
        </div>
      )}

      {/* Endpoints list */}
      <div className="space-y-3">
        {endpoints.length === 0 && !showCreate && (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-foreground">No webhooks configured</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Send real-time event notifications to your systems when orders, payments, and other events occur.
            </p>
          </div>
        )}

        {endpoints.map((ep) => (
          <div key={ep.id} className="rounded-xl border border-[var(--border)] bg-white overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <button
                type="button"
                role="switch"
                aria-checked={ep.is_active}
                onClick={() => handleToggleActive(ep.id, ep.is_active)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors touch-target',
                  ep.is_active ? 'bg-[var(--success)]' : 'bg-[var(--muted)]'
                )}
              >
                <span className={cn('pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform', ep.is_active ? 'translate-x-5' : 'translate-x-0')} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{ep.name}</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{ep.url}</p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{ep.events.length} events</span>
                <button
                  onClick={() => handleTest(ep.id)}
                  disabled={testing === ep.id}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors touch-target"
                  title="Send test"
                >
                  {testing === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--muted)] hover:text-foreground transition-colors touch-target"
                >
                  {expandedId === ep.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => handleDelete(ep.id)}
                  disabled={deleting === ep.id}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--error-bg)] hover:text-[var(--error)] transition-colors touch-target"
                  title="Delete"
                >
                  {deleting === ep.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {expandedId === ep.id && (
              <div className="border-t border-[var(--border)] bg-[var(--secondary)] p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Subscribed Events</p>
                  <div className="flex flex-wrap gap-1">
                    {ep.events.map((e) => (
                      <span key={e} className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Secret</p>
                  <code className="text-xs font-mono text-foreground">{ep.secret}</code>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Created</p>
                  <p className="text-xs text-foreground">
                    {new Date(ep.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Verification docs */}
      <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
        <button
          onClick={() => setShowDocs(!showDocs)}
          className="flex w-full items-center justify-between p-4 text-left hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <div className="flex items-center gap-3">
            <Code2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">Signature Verification</p>
              <p className="text-xs text-muted-foreground">Sample code for verifying webhook signatures</p>
            </div>
          </div>
          {showDocs ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {showDocs && (
          <div className="border-t border-[var(--border)] p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Node.js</p>
              <pre className="rounded-lg bg-[#1C1C1E] p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-72">
                {VERIFICATION_SAMPLES.node}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Python</p>
              <pre className="rounded-lg bg-[#1C1C1E] p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-72">
                {VERIFICATION_SAMPLES.python}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
