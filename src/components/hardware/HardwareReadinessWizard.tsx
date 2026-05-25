'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Printer,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Vault,
  Wifi,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import type { HardwareReadinessData, HardwareReadinessItem } from '@/lib/hardware/readiness'

const itemIcons = {
  receipt_printer: Receipt,
  kitchen_printer: Printer,
  cash_drawer: Vault,
  payment_terminal: CreditCard,
} as const

type ActionState = Partial<Record<HardwareReadinessItem['id'], boolean>>
type VerifiedState = Partial<Record<HardwareReadinessItem['id'], string>>

function statusClass(status: HardwareReadinessItem['status']): string {
  if (status === 'ready') return 'border-[color:var(--color-success)] bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]'
  if (status === 'attention') return 'border-[color:var(--color-warning)] bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]'
  return 'border-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)]'
}

function statusLabel(status: HardwareReadinessItem['status']): string {
  if (status === 'ready') return 'Ready'
  if (status === 'attention') return 'Needs test'
  return 'Missing'
}

function readinessCopy(data: HardwareReadinessData): string {
  if (data.service_ready) return 'All required hardware checks are complete.'
  return `${data.ready_count} of ${data.total_count} readiness checks are complete.`
}

function configureHref(id: HardwareReadinessItem['id']): string {
  return id === 'payment_terminal' ? '/settings/terminals' : '/settings/printers'
}

export function HardwareReadinessWizard() {
  const activeLocationId = useAuthStore((state) => state.activeLocationId)
  const terminalId = useAuthStore((state) => state.terminalId)
  const [data, setData] = useState<HardwareReadinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<ActionState>({})
  const [verified, setVerified] = useState<VerifiedState>({})

  const fetchReadiness = useCallback(async () => {
    setError(null)
    const query = activeLocationId ? `?location_id=${encodeURIComponent(activeLocationId)}` : ''
    try {
      const response = await fetch(`/api/hardware/readiness${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Hardware readiness is unavailable')
      const json = await response.json()
      setData(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hardware readiness is unavailable')
    } finally {
      setLoading(false)
    }
  }, [activeLocationId])

  useEffect(() => {
    fetchReadiness()
  }, [fetchReadiness])

  const serviceReady = useMemo(() => {
    if (!data) return false
    const testedIds = new Set(Object.keys(verified))
    return data.checklist.every((entry) => entry.status === 'ready' && testedIds.has(entry.id))
  }, [data, verified])

  async function runItemAction(entry: HardwareReadinessItem) {
    if (!entry.deviceId) return
    setRunning((current) => ({ ...current, [entry.id]: true }))
    try {
      if (entry.id === 'payment_terminal') {
        const response = await fetch('/api/hardware/readiness/payment-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terminalId: entry.deviceId }),
        })
        if (!response.ok) throw new Error('Payment test failed')
      } else if (entry.id === 'cash_drawer') {
        const response = await fetch('/api/printing/cash-drawer/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printerId: entry.deviceId,
            staffId: 'hardware-readiness',
            terminalId: terminalId ?? null,
            reason: 'Hardware readiness drawer kick test',
            eventType: 'no_sale',
          }),
        })
        if (!response.ok) throw new Error('Drawer kick failed')
      } else {
        const response = await fetch(`/api/printing/printers/${entry.deviceId}/test`, {
          method: 'POST',
        })
        if (!response.ok) throw new Error('Test print failed')
      }

      setVerified((current) => ({
        ...current,
        [entry.id]: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      }))
      toast.success(`${entry.label} verified`)
      fetchReadiness()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${entry.label} failed`)
    } finally {
      setRunning((current) => ({ ...current, [entry.id]: false }))
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-[var(--space-4)]">
        <Skeleton variant="card" className="h-[180px]" />
        <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <Skeleton key={index} variant="card" className="h-[168px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-[var(--space-6)]">
      <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-[var(--space-6)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-[var(--space-5)] lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] uppercase tracking-wide text-[color:var(--color-text-muted)]">
              Service launch checklist
            </p>
            <h1 className="mt-[var(--space-1)] text-[length:var(--type-title-1-size)] font-[var(--weight-bold)] tracking-tight text-[color:var(--color-text)]">
              Hardware Readiness
            </h1>
            <p className="mt-[var(--space-2)] text-[length:var(--type-body-size)] text-[color:var(--color-text-muted)]">
              Verify receipt printing, kitchen tickets, drawer kick, and Valor terminal readiness before the doors open.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            <span
              className={cn(
                'rounded-full border px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]',
                serviceReady ? statusClass('ready') : statusClass(data?.service_ready ? 'attention' : 'missing')
              )}
            >
              {serviceReady ? 'Certified for service' : data ? readinessCopy(data) : 'Checking hardware'}
            </span>
            <Button
              variant="secondary"
              size="md"
              onClick={fetchReadiness}
              loading={loading}
              leadingIcon={<RefreshCw className="h-5 w-5" />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <Card padding="default" className="border-[color:var(--color-danger)] bg-[color:var(--color-danger-bg)]">
          <p className="font-[var(--weight-semibold)] text-[color:var(--color-danger)]">{error}</p>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-[var(--space-4)] md:grid-cols-3">
            <Card padding="default">
              <Wifi className="h-6 w-6 text-[color:var(--color-primary)]" />
              <div>
                <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">
                  {data.printers.online}/{data.printers.total}
                </p>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  printers online
                </p>
              </div>
            </Card>
            <Card padding="default">
              <CreditCard className="h-6 w-6 text-[color:var(--color-primary)]" />
              <div>
                <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">
                  {data.payment_terminals.ready}/{data.payment_terminals.total}
                </p>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  payment terminals ready
                </p>
              </div>
            </Card>
            <Card padding="default">
              <ShieldCheck className="h-6 w-6 text-[color:var(--color-primary)]" />
              <div>
                <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">
                  {data.ready_count}/{data.total_count}
                </p>
                <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                  checklist items configured
                </p>
              </div>
            </Card>
          </div>

          <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
            {data.checklist.map((entry) => {
              const Icon = itemIcons[entry.id]
              const isRunning = running[entry.id] === true
              const verifiedAt = verified[entry.id]
              const missing = entry.status === 'missing'
              return (
                <Card key={entry.id} padding="default" className="min-h-[184px]">
                  <div className="flex h-full flex-col justify-between gap-[var(--space-4)]">
                    <div className="flex items-start justify-between gap-[var(--space-3)]">
                      <div className="flex items-start gap-[var(--space-3)]">
                        <div className={cn('flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border', statusClass(entry.status))}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                            {entry.label}
                          </h2>
                          <p className="mt-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                            {entry.detail}
                          </p>
                        </div>
                      </div>
                      <span className={cn('rounded-full border px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)]', statusClass(entry.status))}>
                        {verifiedAt ? 'Verified' : statusLabel(entry.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
                      <p className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                        {verifiedAt ? `Passed at ${verifiedAt}` : missing ? 'Configure this device to unlock the test.' : 'Run the live check from this terminal.'}
                      </p>
                      {missing ? (
                        <Link
                          href={configureHref(entry.id)}
                          className="btn-press inline-flex h-[40px] items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[var(--space-4)] text-[var(--type-subhead-size)] font-[var(--weight-medium)] text-[color:var(--color-text)] transition-[background-color,color,border-color,box-shadow,opacity] duration-[var(--duration-quick)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] focus-visible:outline-offset-2 active:bg-[var(--color-surface-active)]"
                        >
                          <span>{entry.action}</span>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <Button
                          variant={verifiedAt ? 'secondary' : 'primary'}
                          size="md"
                          onClick={() => runItemAction(entry)}
                          loading={isRunning}
                          leadingIcon={verifiedAt ? <Check className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                        >
                          {verifiedAt ? 'Run again' : entry.action}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          <Card padding="spacious" className={cn(serviceReady ? 'border-[color:var(--color-success)] bg-[color:var(--color-success-bg)]' : '')}>
            <div className="flex flex-col gap-[var(--space-5)] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-[var(--space-4)]">
                <div className={cn('flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border', serviceReady ? statusClass('ready') : statusClass('attention'))}>
                  <BadgeCheck className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] text-[color:var(--color-text)]">
                    {serviceReady ? 'Service-ready certificate' : data.certificate.title}
                  </h2>
                  <p className="mt-[var(--space-1)] text-[length:var(--type-body-size)] text-[color:var(--color-text-muted)]">
                    {serviceReady ? 'All live checks passed from this terminal. This station is ready for service.' : data.certificate.summary}
                  </p>
                  {serviceReady && (
                    <p className="mt-[var(--space-2)] text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-success)]">
                      Issued {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant={serviceReady ? 'primary' : 'secondary'}
                size="lg"
                disabled={!serviceReady}
                leadingIcon={<Download className="h-5 w-5" />}
                onClick={() => window.print()}
              >
                Print certificate
              </Button>
            </div>
          </Card>

          <div className="flex flex-wrap gap-[var(--space-3)]">
            <Link href="/settings/printers" className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-primary)]">
              Manage printers
            </Link>
            <Link href="/settings/terminals" className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-primary)]">
              Manage payment terminals
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
