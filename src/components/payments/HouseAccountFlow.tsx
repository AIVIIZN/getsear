'use client'

import { useState, useCallback, useEffect } from 'react'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { cn } from '@/lib/utils'
import { Building2, Search, Check, AlertTriangle } from 'lucide-react'

type HouseAccountState = 'search' | 'loading' | 'account_shown' | 'processing' | 'complete' | 'error'

interface HouseAccount {
  id: string
  account_name: string
  contact_name: string
  credit_limit: string
  current_balance: string
  status: string
}

interface HouseAccountFlowProps {
  totalCents: number
  orderId: string
  locationId: string
  onComplete: (result: { accountId: string; accountName: string }) => void
  onCancel: () => void
}

export function HouseAccountFlow({ totalCents, orderId, locationId, onComplete, onCancel }: HouseAccountFlowProps) {
  const [state, setState] = useState<HouseAccountState>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [accounts, setAccounts] = useState<HouseAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<HouseAccount | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Search accounts as user types
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setState('loading')
    try {
      const res = await fetch(`/api/house-accounts?search=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const json = await res.json()
        setAccounts(json.data ?? [])
        setState('search')
      } else {
        setState('search')
      }
    } catch {
      setState('search')
    }
  }, [searchQuery])

  // Load accounts on mount
  useEffect(() => {
    async function loadAccounts() {
      setState('loading')
      try {
        const res = await fetch('/api/house-accounts?limit=20')
        if (res.ok) {
          const json = await res.json()
          setAccounts(json.data ?? [])
        }
      } catch {
        // silent
      } finally {
        setState('search')
      }
    }
    loadAccounts()
  }, [])

  const handleSelectAccount = useCallback((account: HouseAccount) => {
    setSelectedAccount(account)
    setState('account_shown')
  }, [])

  const handleCharge = useCallback(async () => {
    if (!selectedAccount) return
    setState('processing')
    setError(null)

    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          location_id: locationId,
          payment_method: 'house_account',
          amount_cents: totalCents,
          house_account_id: selectedAccount.id,
        }),
      })

      if (res.ok) {
        setState('complete')
        onComplete({
          accountId: selectedAccount.id,
          accountName: selectedAccount.account_name,
        })
      } else {
        const json = await res.json().catch(() => ({ error: 'Charge failed' }))
        setError(json.error ?? 'Failed to charge account')
        setState('error')
      }
    } catch {
      setError('Network error')
      setState('error')
    }
  }, [selectedAccount, totalCents, orderId, locationId, onComplete])

  const creditLimitCents = selectedAccount ? Math.round(parseFloat(selectedAccount.credit_limit || '0') * 100) : 0
  const currentBalanceCents = selectedAccount ? Math.round(parseFloat(selectedAccount.current_balance || '0') * 100) : 0
  const availableCreditCents = creditLimitCents - currentBalanceCents
  const exceedsCredit = totalCents > availableCreditCents

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <Building2 className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">House Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Charge: <MoneyDisplay cents={totalCents} className="font-semibold text-foreground" />
        </p>
      </div>

      {/* Search / Select */}
      {(state === 'search' || state === 'loading') && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="h-12 w-full rounded-xl border border-border bg-[var(--secondary)] pl-10 pr-4 text-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20"
              />
            </div>
            <button
              onClick={handleSearch}
              className="btn-press h-12 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white"
            >
              Search
            </button>
          </div>

          {state === 'loading' ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-200 border-t-amber-600" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No accounts found
            </p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleSelectAccount(account)}
                  className="btn-press w-full flex items-center justify-between rounded-xl border border-border bg-white p-3.5 text-left transition-all hover:bg-[var(--secondary)] hover:shadow-warm-sm"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{account.account_name}</p>
                    <p className="text-xs text-muted-foreground">{account.contact_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Credit Limit</p>
                    <MoneyDisplay
                      cents={Math.round(parseFloat(account.credit_limit || '0') * 100)}
                      className="text-sm font-semibold"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={onCancel}
            className="btn-press touch-target-lg w-full rounded-xl bg-[var(--secondary)] py-3.5 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
        </>
      )}

      {/* Account details + charge */}
      {(state === 'account_shown' || state === 'error') && selectedAccount && (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-base font-bold text-amber-800">{selectedAccount.account_name}</h3>
            <p className="text-sm text-amber-600">{selectedAccount.contact_name}</p>

            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">Credit Limit</span>
                <MoneyDisplay cents={creditLimitCents} className="font-medium text-amber-800" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-700">Current Balance</span>
                <MoneyDisplay cents={currentBalanceCents} className="font-medium text-amber-800" />
              </div>
              <div className="flex justify-between text-sm border-t border-amber-200 pt-1.5">
                <span className="text-amber-700 font-semibold">Available Credit</span>
                <MoneyDisplay
                  cents={availableCreditCents}
                  className={cn('font-bold', exceedsCredit ? 'text-[var(--error)]' : 'text-amber-800')}
                />
              </div>
            </div>
          </div>

          {exceedsCredit && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Charge exceeds available credit limit
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--error-bg)] p-3 text-sm text-[var(--error)]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setSelectedAccount(null); setState('search') }}
              className="btn-press touch-target-lg flex-1 rounded-xl bg-[var(--secondary)] py-3.5 text-sm font-semibold text-muted-foreground"
            >
              Back
            </button>
            <button
              onClick={handleCharge}
              disabled={exceedsCredit}
              className="btn-press touch-target-lg flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Charge Account
            </button>
          </div>
        </>
      )}

      {/* Processing */}
      {state === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-200 border-t-amber-600" />
          <p className="text-sm text-muted-foreground">Charging account...</p>
        </div>
      )}
    </div>
  )
}
