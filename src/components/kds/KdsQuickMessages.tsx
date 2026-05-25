'use client'

import { useState, useCallback } from 'react'
import { Zap, RotateCcw, Clock, CheckCircle, Users, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KdsQuickMessagesProps {
  stationId: string | null
  locationId: string
  onSend: (message: string) => void
}

type QuickMessageMode = null | '86_item' | 'refire' | 'behind' | 'check_ticket'

/**
 * Pre-built quick message buttons for station-to-expo communication.
 * Each quick message has a parameterized template that can be filled in
 * before sending.
 */
export function KdsQuickMessages({ stationId, locationId, onSend }: KdsQuickMessagesProps) {
  const [activeMode, setActiveMode] = useState<QuickMessageMode>(null)
  const [itemName, setItemName] = useState('')
  const [minutes, setMinutes] = useState('5')
  const [ticketNumber, setTicketNumber] = useState('')

  const handleSend86 = useCallback(() => {
    if (!itemName.trim()) return
    onSend(`86 ${itemName.trim()} in ${minutes} minutes`)
    setItemName('')
    setMinutes('5')
    setActiveMode(null)
  }, [itemName, minutes, onSend])

  const handleSendRefire = useCallback(() => {
    if (!ticketNumber.trim()) return
    onSend(`Need re-fire on ticket #${ticketNumber.trim()}`)
    setTicketNumber('')
    setActiveMode(null)
  }, [ticketNumber, onSend])

  const handleSendBehind = useCallback(() => {
    onSend(`Behind - add ${minutes} min to all tickets`)
    setMinutes('5')
    setActiveMode(null)
  }, [minutes, onSend])

  const handleSendCheckTicket = useCallback(() => {
    if (!ticketNumber.trim()) return
    onSend(`Check ticket #${ticketNumber.trim()}`)
    setTicketNumber('')
    setActiveMode(null)
  }, [ticketNumber, onSend])

  const handleReadyForPickup = useCallback(() => {
    onSend('Ready for pickup')
  }, [onSend])

  const handleHandsNeeded = useCallback(() => {
    onSend('Hands needed on expo')
  }, [onSend])

  // If no mode is active, show the quick message buttons
  if (activeMode === null) {
    return (
      <div className="border-t border-[var(--color-kds-border)] px-4 py-2">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-kds-text-subtle)]">
          Quick Messages
        </p>
        <div className="flex flex-wrap gap-1.5">
          <QuickButton
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="86 Item"
            onClick={() => setActiveMode('86_item')}
            color="text-red-400"
          />
          <QuickButton
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Re-fire"
            onClick={() => setActiveMode('refire')}
            color="text-orange-400"
          />
          <QuickButton
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Behind"
            onClick={() => setActiveMode('behind')}
            color="text-yellow-400"
          />
          <QuickButton
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="Ready for pickup"
            onClick={handleReadyForPickup}
            color="text-green-400"
          />
          <QuickButton
            icon={<Users className="h-3.5 w-3.5" />}
            label="Hands on expo"
            onClick={handleHandsNeeded}
            color="text-blue-400"
          />
          <QuickButton
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Check ticket"
            onClick={() => setActiveMode('check_ticket')}
            color="text-purple-400"
          />
        </div>
      </div>
    )
  }

  // Expanded mode — show parameterized input
  return (
    <div className="border-t border-[var(--color-kds-border)] px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-kds-text-muted)]">
          {activeMode === '86_item' && '86 Item'}
          {activeMode === 'refire' && 'Re-fire Ticket'}
          {activeMode === 'behind' && 'Running Behind'}
          {activeMode === 'check_ticket' && 'Check Ticket'}
        </p>
        <button
          onClick={() => setActiveMode(null)}
          className="text-xs text-[var(--color-kds-text-muted)] hover:text-white"
        >
          Cancel
        </button>
      </div>

      {activeMode === '86_item' && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Item name (e.g., Salmon)"
            className="rounded-lg border border-[var(--color-kds-border-strong)] bg-[var(--color-kds-input-bg)] px-3 py-2.5 text-sm text-white placeholder-[var(--color-kds-placeholder)] outline-none focus:border-[var(--color-primary)]"
            autoFocus
            autoComplete="off"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-kds-text-muted)]">in</span>
            <div className="flex gap-1">
              {['5', '10', '15', '30', '60'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                    minutes === m
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-muted)] hover:bg-[var(--color-kds-surface-hover)]'
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSend86}
            disabled={!itemName.trim()}
            className={cn(
              'mt-1 flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-colors',
              itemName.trim()
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-disabled)]'
            )}
          >
            Send: 86 {itemName.trim() || '...'} in {minutes} min
          </button>
        </div>
      )}

      {activeMode === 'refire' && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value.replace(/[^0-9-]/g, ''))}
            placeholder="Ticket # (e.g., 0042)"
            className="rounded-lg border border-[var(--color-kds-border-strong)] bg-[var(--color-kds-input-bg)] px-3 py-2.5 text-sm text-white placeholder-[var(--color-kds-placeholder)] outline-none focus:border-[var(--color-primary)]"
            autoFocus
            autoComplete="off"
            inputMode="numeric"
          />
          <button
            onClick={handleSendRefire}
            disabled={!ticketNumber.trim()}
            className={cn(
              'flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-colors',
              ticketNumber.trim()
                ? 'bg-orange-600 text-white hover:bg-orange-500'
                : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-disabled)]'
            )}
          >
            Send: Need re-fire on ticket #{ticketNumber.trim() || '...'}
          </button>
        </div>
      )}

      {activeMode === 'behind' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-kds-text-muted)]">Add</span>
            <div className="flex gap-1">
              {['2', '5', '10', '15', '20'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-bold transition-colors',
                    minutes === m
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-muted)] hover:bg-[var(--color-kds-surface-hover)]'
                  )}
                >
                  {m}m
                </button>
              ))}
            </div>
            <span className="text-xs text-[var(--color-kds-text-muted)]">to all tickets</span>
          </div>
          <button
            onClick={handleSendBehind}
            className="flex h-12 items-center justify-center rounded-xl bg-yellow-600 text-sm font-bold text-white transition-colors hover:bg-yellow-500"
          >
            Send: Behind - add {minutes} min to all tickets
          </button>
        </div>
      )}

      {activeMode === 'check_ticket' && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value.replace(/[^0-9-]/g, ''))}
            placeholder="Ticket # (e.g., 0042)"
            className="rounded-lg border border-[var(--color-kds-border-strong)] bg-[var(--color-kds-input-bg)] px-3 py-2.5 text-sm text-white placeholder-[var(--color-kds-placeholder)] outline-none focus:border-[var(--color-primary)]"
            autoFocus
            autoComplete="off"
            inputMode="numeric"
          />
          <button
            onClick={handleSendCheckTicket}
            disabled={!ticketNumber.trim()}
            className={cn(
              'flex h-12 items-center justify-center rounded-xl text-sm font-bold transition-colors',
              ticketNumber.trim()
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-[var(--color-kds-surface-active)] text-[var(--color-kds-text-disabled)]'
            )}
          >
            Send: Check ticket #{ticketNumber.trim() || '...'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Small quick message button used in the compact grid */
function QuickButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg bg-[var(--color-kds-surface-active)] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-kds-surface-hover)]',
        color
      )}
      style={{ minHeight: 44 }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
