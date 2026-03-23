'use client'

import { useState, useCallback } from 'react'
import { X, Clock, Coffee, LogOut, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PinPad } from './PinPad'

interface ClockInOverlayProps {
  open: boolean
  onClose: () => void
  locationId?: string
}

type Phase = 'pin' | 'confirm' | 'manager-pin' | 'cash-tips'

interface IdentifiedEmployee {
  id: string
  firstName: string
  lastName: string
  role: string
  isClockedIn: boolean
  isOnBreak: boolean
  timeEntryId?: string
}

export function ClockInOverlay({ open, onClose, locationId = 'default' }: ClockInOverlayProps) {
  const [phase, setPhase] = useState<Phase>('pin')
  const [employee, setEmployee] = useState<IdentifiedEmployee | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [cashTips, setCashTips] = useState('')

  const reset = useCallback(() => {
    setPhase('pin')
    setEmployee(null)
    setPinError(null)
    setLoading(false)
    setCashTips('')
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handlePinSubmit = async (pin: string) => {
    setPinError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, location_id: locationId }),
      })

      if (!res.ok) {
        setPinError('Invalid PIN. Try again.')
        setLoading(false)
        return
      }

      const json = await res.json()
      const user = json.data

      setEmployee({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isClockedIn: user.is_clocked_in ?? false,
        isOnBreak: user.is_on_break ?? false,
        timeEntryId: user.time_entry_id,
      })
      setPhase('confirm')
    } catch {
      setPinError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${employee.id}/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId }),
      })

      if (res.ok) {
        toast.success(`${employee.firstName} clocked in`)
        handleClose()
      } else {
        const json = await res.json()
        if (json.error?.includes('early')) {
          setPhase('manager-pin')
        } else {
          toast.error(json.error ?? 'Clock-in failed')
        }
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!employee) return
    setPhase('cash-tips')
  }

  const handleClockOutWithTips = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${employee.id}/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_tips: cashTips || '0' }),
      })

      if (res.ok) {
        toast.success(`${employee.firstName} clocked out`)
        handleClose()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Clock-out failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleStartBreak = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${employee.id}/break-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ break_type: 'meal' }),
      })
      if (res.ok) {
        toast.success('Break started')
        handleClose()
      }
    } catch { toast.error('Network error') }
    setLoading(false)
  }

  const handleEndBreak = async () => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${employee.id}/break-end`, { method: 'POST' })
      if (res.ok) {
        toast.success('Break ended')
        handleClose()
      }
    } catch { toast.error('Network error') }
    setLoading(false)
  }

  const handleManagerPinSubmit = async (managerPin: string) => {
    if (!employee) return
    setLoading(true)
    try {
      const res = await fetch(`/api/staff/${employee.id}/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, manager_pin: managerPin }),
      })
      if (res.ok) {
        toast.success(`${employee.firstName} clocked in (manager approved)`)
        handleClose()
      } else {
        setPinError('Invalid manager PIN')
      }
    } catch { toast.error('Network error') }
    setLoading(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        className="absolute top-4 right-4 h-10 w-10 p-0"
      >
        <X className="h-6 w-6" />
      </Button>

      <div className="w-full max-w-sm px-4">
        {/* PIN Entry */}
        {phase === 'pin' && (
          <PinPad
            onSubmit={handlePinSubmit}
            title="Clock In / Out"
            subtitle="Enter your PIN"
            isLoading={loading}
            error={pinError}
          />
        )}

        {/* Confirm Action */}
        {phase === 'confirm' && employee && (
          <div className="text-center space-y-6">
            <div>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary mx-auto mb-3">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {employee.firstName} {employee.lastName}
              </h2>
              <Badge variant="outline" className="capitalize mt-1">{employee.role}</Badge>
            </div>

            <div className="space-y-3">
              {!employee.isClockedIn ? (
                <Button onClick={handleClockIn} disabled={loading} className="w-full h-14 text-lg gap-2">
                  {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                  <Clock className="h-5 w-5" />
                  Clock In
                </Button>
              ) : (
                <>
                  {employee.isOnBreak ? (
                    <Button onClick={handleEndBreak} disabled={loading} variant="outline" className="w-full h-14 text-lg gap-2">
                      <Coffee className="h-5 w-5" />
                      End Break
                    </Button>
                  ) : (
                    <Button onClick={handleStartBreak} disabled={loading} variant="outline" className="w-full h-14 text-lg gap-2">
                      <Coffee className="h-5 w-5" />
                      Start Break
                    </Button>
                  )}
                  <Button onClick={handleClockOut} disabled={loading} variant="destructive" className="w-full h-14 text-lg gap-2">
                    <LogOut className="h-5 w-5" />
                    Clock Out
                  </Button>
                </>
              )}
            </div>

            <Button variant="ghost" onClick={reset} className="text-sm text-muted-foreground">
              Not you? Enter a different PIN
            </Button>
          </div>
        )}

        {/* Manager PIN (early clock-in) */}
        {phase === 'manager-pin' && (
          <div className="space-y-4">
            <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
              <p className="text-sm text-amber-800 font-medium">
                Early clock-in requires manager approval
              </p>
            </div>
            <PinPad
              onSubmit={handleManagerPinSubmit}
              title="Manager PIN Required"
              subtitle="Enter a manager PIN to approve"
              isLoading={loading}
              error={pinError}
            />
          </div>
        )}

        {/* Cash tip declaration */}
        {phase === 'cash-tips' && employee && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Declare Cash Tips</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {employee.firstName}, enter your cash tips for this shift
              </p>
            </div>

            <div className="space-y-2 text-left">
              <Label>Cash Tips ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
                placeholder="0.00"
                className="h-14 text-2xl font-mono text-center"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Button onClick={handleClockOutWithTips} disabled={loading} className="w-full h-14 text-lg">
                {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
                Clock Out {cashTips ? `($${parseFloat(cashTips).toFixed(2)} tips)` : ''}
              </Button>
              <Button variant="ghost" onClick={handleClockOutWithTips} className="w-full text-sm text-muted-foreground">
                Skip — $0 cash tips
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
