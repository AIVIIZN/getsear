'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

  useEffect(() => { fetchData() }, [fetchData])

  const getMappingForCategory = (key: SearCategoryKey): MappingRow | undefined => {
    return mappings.find(m => m.sear_category === key)
  }

  const handleMappingChange = (key: SearCategoryKey, accountId: string) => {
    const account = accounts.find(a => a.id === accountId)
    if (!account && accountId !== '') return

    setMappings(prev => {
      const existing = prev.findIndex(m => m.sear_category === key)
      if (accountId === '') {
        // Remove mapping
        return prev.filter(m => m.sear_category !== key)
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
    // Validate required mappings
    const requiredKeys = SEAR_CATEGORIES.filter(c => c.required).map(c => c.key)
    const mappedKeys = new Set(mappings.map(m => m.sear_category))
    const missing = requiredKeys.filter(k => !mappedKeys.has(k))

    if (missing.length > 0) {
      const labels = missing.map(k => SEAR_CATEGORIES.find(c => c.key === k)?.label).join(', ')
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations/quickbooks"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">Chart of Accounts Mapping</h2>
          <p className="text-sm text-muted-foreground">Map Sear revenue categories to QuickBooks accounts</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <AlertCircle className="h-8 w-8 text-[var(--warning)] mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No accounts found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure QuickBooks is connected and your chart of accounts is set up.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--secondary)]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Sear Category
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    QuickBooks Account
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-20">
                    Required
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {SEAR_CATEGORIES.map((cat) => {
                  const mapping = getMappingForCategory(cat.key)
                  return (
                    <tr key={cat.key} className="group">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">{cat.label}</p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={mapping?.qbo_account_id ?? ''}
                          onChange={(e) => handleMappingChange(cat.key, e.target.value)}
                          className={cn(
                            'flex h-10 w-full max-w-md rounded-lg border border-[var(--border)] bg-white px-3',
                            'text-sm text-foreground',
                            'focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20',
                            'touch-target'
                          )}
                        >
                          <option value="">Select account...</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.number ? `${account.number} — ` : ''}{account.name} ({account.type})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        {cat.required && (
                          <span className="inline-flex items-center rounded-full bg-[var(--error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--error)]">
                            Required
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
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
              Save Mapping
            </button>
          </div>
        </>
      )}
    </div>
  )
}
