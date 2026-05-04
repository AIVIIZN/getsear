'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  ScrollText,
  Save,
  Trash2,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Text } from '@/components/ui-v2/inputs/Text'
import { Toggle } from '@/components/ui-v2/inputs/Toggle'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Badge } from '@/components/ui-v2/data/Badge'
import { Alert } from '@/components/ui-v2/feedback/Alert'
import { ConfirmDialog } from '@/components/ui-v2/feedback/ConfirmDialog'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
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

  const [newName, setNewName] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newEvents, setNewEvents] = useState<WebhookEventType[]>([])
  const [creating, setCreating] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)

  const [testing, setTesting] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

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

  useEffect(() => {
    fetchEndpoints()
  }, [fetchEndpoints])

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
        toast.success(
          `Test sent! Response: ${json.data.status_code} (${json.data.response_time_ms}ms)`,
        )
      } else {
        toast.error(`Test failed: ${json.data?.error ?? 'Unknown error'}`)
      }
    } catch {
      toast.error('Test request failed')
    } finally {
      setTesting(null)
    }
  }

  const requestDelete = (id: string) => {
    setPendingDeleteId(id)
    setDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (!pendingDeleteId) return
    setDeletingId(pendingDeleteId)
    try {
      const res = await fetch(`/api/integrations/webhooks/${pendingDeleteId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Webhook deleted')
      fetchEndpoints()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
      setPendingDeleteId(null)
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
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
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
      <div className="flex flex-col gap-[var(--space-6)]">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-3)]">
          <Link
            href="/settings/integrations"
            className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
            aria-label="Back to integrations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
              Webhooks
            </h2>
            <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
              {endpoints.length}/10 endpoints configured
            </p>
          </div>
        </div>
        <div className="flex gap-[var(--space-2)]">
          <Link href="/settings/integrations/webhooks/log" className="block">
            <Button variant="secondary" size="md" leadingIcon={<ScrollText className="h-4 w-4" />}>
              Delivery Log
            </Button>
          </Link>
          <Button
            onClick={() => setShowCreate(!showCreate)}
            disabled={endpoints.length >= 10}
            size="md"
            leadingIcon={<Plus className="h-4 w-4" />}
          >
            Add Endpoint
          </Button>
        </div>
      </div>

      {/* Secret display (after creation) */}
      {createdSecret && (
        <Alert variant="success" title="Webhook secret created">
          <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
            Copy this secret now. It won&apos;t be shown again.
          </p>
          <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
            <code className="flex-1 overflow-x-auto rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-text)]">
              {createdSecret}
            </code>
            <Button
              variant="secondary"
              size="md"
              onClick={copySecret}
              aria-label="Copy secret"
            >
              {secretCopied ? (
                <Check className="h-4 w-4 text-[color:var(--color-success)]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            Dismiss
          </button>
        </Alert>
      )}

      {/* Create form */}
      {showCreate && (
        <Card variant="flat" padding="default">
          <h3 className="text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text)]">
            New Webhook Endpoint
          </h3>

          <div className="grid grid-cols-2 gap-[var(--space-4)]">
            <Text
              size="lg"
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Analytics Webhook"
            />
            <Text
              size="lg"
              type="url"
              label="URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-[var(--space-3)]">
            <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)]">
              Subscribe to Events
            </p>
            {Object.entries(groupedEvents).map(([category, events]) => (
              <div key={category}>
                <p className="mb-[var(--space-2)] text-[length:var(--type-footnote-size)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  {category}
                </p>
                <div className="flex flex-wrap gap-[var(--space-1)]">
                  {events.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => toggleEvent(e.value)}
                      className={cn(
                        'btn-press touch-target rounded-[var(--radius-pill)] px-[var(--space-3)] py-[var(--space-1)]',
                        'text-[length:var(--type-footnote-size)] font-[var(--weight-medium)]',
                        'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
                        newEvents.includes(e.value)
                          ? 'bg-[color:var(--color-primary)] text-[color:var(--color-text-on-primary)]'
                          : 'bg-[color:var(--color-bg-muted)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]',
                      )}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-[var(--space-2)]">
            <Button variant="ghost" size="md" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={creating}
              size="lg"
              leadingIcon={<Save className="h-4 w-4" />}
            >
              Create Endpoint
            </Button>
          </div>
        </Card>
      )}

      {/* Endpoints list */}
      <div className="flex flex-col gap-[var(--space-3)]">
        {endpoints.length === 0 && !showCreate && (
          <EmptyState
            icon={Code2}
            title="No webhooks configured"
            description="Send real-time event notifications to your systems when orders, payments, and other events occur."
          />
        )}

        {endpoints.map((ep) => (
          <Card key={ep.id} variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
            <div className="flex items-center gap-[var(--space-4)] p-[var(--space-4)]">
              <Toggle
                checked={ep.is_active}
                onChange={() => handleToggleActive(ep.id, ep.is_active)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                  {ep.name}
                </p>
                <p className="truncate font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  {ep.url}
                </p>
              </div>
              <div className="flex items-center gap-[var(--space-1)]">
                <span className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  {ep.events.length} events
                </span>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => handleTest(ep.id)}
                  loading={testing === ep.id}
                  aria-label="Send test"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
                  aria-label={expandedId === ep.id ? 'Collapse' : 'Expand'}
                >
                  {expandedId === ep.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => requestDelete(ep.id)}
                  loading={deletingId === ep.id}
                  aria-label="Delete"
                  className="text-[color:var(--color-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {expandedId === ep.id && (
              <div className="flex flex-col gap-[var(--space-3)] border-t border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-[var(--space-4)]">
                <div>
                  <p className="mb-[var(--space-1)] text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">
                    Subscribed Events
                  </p>
                  <div className="flex flex-wrap gap-[var(--space-1)]">
                    {ep.events.map((e) => (
                      <Badge key={e} variant="default" shape="pill" className="font-mono">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-[var(--space-1)] text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">
                    Secret
                  </p>
                  <code className="font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-text)]">
                    {ep.secret}
                  </code>
                </div>
                <div>
                  <p className="mb-[var(--space-1)] text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] text-[color:var(--color-text-muted)]">
                    Created
                  </p>
                  <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text)]">
                    {new Date(ep.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Verification docs */}
      <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
        <button
          onClick={() => setShowDocs(!showDocs)}
          className={cn(
            'btn-press touch-target flex w-full items-center justify-between p-[var(--space-4)] text-left',
            'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
            'hover:bg-[color:var(--color-surface-hover)]',
          )}
        >
          <div className="flex items-center gap-[var(--space-3)]">
            <Code2 className="h-5 w-5 text-[color:var(--color-text-muted)]" />
            <div>
              <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                Signature Verification
              </p>
              <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                Sample code for verifying webhook signatures
              </p>
            </div>
          </div>
          {showDocs ? (
            <ChevronUp className="h-4 w-4 text-[color:var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[color:var(--color-text-muted)]" />
          )}
        </button>
        {showDocs && (
          <div className="flex flex-col gap-[var(--space-4)] border-t border-[color:var(--color-border)] p-[var(--space-4)]">
            <div>
              <p className="mb-[var(--space-2)] text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Node.js
              </p>
              <pre className="max-h-72 overflow-x-auto rounded-[var(--radius-md)] bg-[color:var(--gray-900)] p-[var(--space-4)] font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-success-strong)]">
                {VERIFICATION_SAMPLES.node}
              </pre>
            </div>
            <div>
              <p className="mb-[var(--space-2)] text-[length:var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Python
              </p>
              <pre className="max-h-72 overflow-x-auto rounded-[var(--radius-md)] bg-[color:var(--gray-900)] p-[var(--space-4)] font-mono text-[length:var(--type-footnote-size)] text-[color:var(--color-success-strong)]">
                {VERIFICATION_SAMPLES.python}
              </pre>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this webhook endpoint?"
        description="This action cannot be undone. The endpoint will stop receiving event notifications immediately."
        confirmLabel="Delete"
        variant="destructive"
        loading={Boolean(deletingId)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
