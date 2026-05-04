'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Select } from '@/components/ui-v2/inputs/Select'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Badge } from '@/components/ui-v2/data/Badge'
import { EmptyState } from '@/components/ui-v2/feedback/EmptyState'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui-v2/data/Table'
import { SEAR_CATEGORIES, type SearCategoryKey } from '@/lib/integrations/quickbooks-journal'

interface QboAccount {
  id: string
  name: string
  type: string
  number?: string
}

interface MappingRow {
  sear_category: SearCategoryKey
  qbo_account_id: string
  qbo_account_name: string
}

export default function AccountMappingPage() {
  const [accounts, setAccounts] = useState<QboAccount[]>([])
  const [mappings, setMappings] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [accountsRes, mappingsRes] = await Promise.all([
        fetch(`/api/integrations/quickbooks/accounts?location_id=${locationId}`),
        fetch(`/api/integrations/quickbooks/mapping?location_id=${locationId}`),
      ])

      const accountsJson = await accountsRes.json()
      const mappingsJson = await mappingsRes.json()

      if (accountsJson.data) setAccounts(accountsJson.data)
      if (mappingsJson.data) setMappings(mappingsJson.data)
    } catch {
      toast.error('Failed to load account data')
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getMappingForCategory = (key: SearCategoryKey): MappingRow | undefined => {
    return mappings.find((m) => m.sear_category === key)
  }

  const handleMappingChange = (key: SearCategoryKey, accountId: string) => {
    const account = accounts.find((a) => a.id === accountId)
    if (!account && accountId !== '') return

    setMappings((prev) => {
      const existing = prev.findIndex((m) => m.sear_category === key)
      if (accountId === '') {
        return prev.filter((m) => m.sear_category !== key)
      }
      const newMapping: MappingRow = {
        sear_category: key,
        qbo_account_id: accountId,
        qbo_account_name: account!.name,
      }
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = newMapping
        return updated
      }
      return [...prev, newMapping]
    })
  }

  const handleSave = async () => {
    const requiredKeys = SEAR_CATEGORIES.filter((c) => c.required).map((c) => c.key)
    const mappedKeys = new Set(mappings.map((m) => m.sear_category))
    const missing = requiredKeys.filter((k) => !mappedKeys.has(k))

    if (missing.length > 0) {
      const labels = missing.map((k) => SEAR_CATEGORIES.find((c) => c.key === k)?.label).join(', ')
      toast.error(`Required mappings missing: ${labels}`)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/integrations/quickbooks/mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          mappings,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Account mappings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--space-6)]">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
      </div>
    )
  }

  const accountOptions = [
    { value: '', label: 'Select account...' },
    ...accounts.map((a) => ({
      value: a.id,
      label: `${a.number ? `${a.number} — ` : ''}${a.name} (${a.type})`,
    })),
  ]

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings/integrations/quickbooks"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
          aria-label="Back to QuickBooks"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Chart of Accounts Mapping
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Map Sear revenue categories to QuickBooks accounts
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="No accounts found"
          description="Make sure QuickBooks is connected and your chart of accounts is set up."
        />
      ) : (
        <>
          <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Sear Category</TableCell>
                  <TableCell header>QuickBooks Account</TableCell>
                  <TableCell header>Required</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SEAR_CATEGORIES.map((cat) => {
                  const mapping = getMappingForCategory(cat.key)
                  return (
                    <TableRow key={cat.key}>
                      <TableCell className="font-[var(--weight-medium)]">{cat.label}</TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <Select
                            size="md"
                            options={accountOptions}
                            value={mapping?.qbo_account_id ?? ''}
                            onChange={(v) => handleMappingChange(cat.key, v)}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat.required && <Badge variant="danger">Required</Badge>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              loading={saving}
              size="lg"
              leadingIcon={<Save className="h-4 w-4" />}
            >
              Save Mapping
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
