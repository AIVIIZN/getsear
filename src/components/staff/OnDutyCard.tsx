'use client'

import { useState, useEffect } from 'react'
import { Clock, Coffee, AlertTriangle, MoreVertical, LogOut, Pause, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const ROLE_COLORS: Record<string, string> = {
  server: 'bg-blue-100 text-blue-700 border-blue-200',
  bartender: 'bg-purple-100 text-purple-700 border-purple-200',
  host: 'bg-teal-100 text-teal-700 border-teal-200',
  kitchen: 'bg-orange-100 text-orange-700 border-orange-200',
  cashier: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  driver: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  manager: 'bg-amber-100 text-amber-700 border-amber-200',
}

interface OnDutyCardProps {
  userId: string
  firstName: string
  lastName: string
  role: string
  clockIn: string
  isOnBreak: boolean
  breakStartedAt: string | null
  isInOvertime: boolean
  isApproachingOt: boolean
  hoursUntilOt: number
  onStartBreak: (userId: string) => void
  onEndBreak: (userId: string) => void
  onClockOut: (userId: string) => void
}

function formatElapsed(startIso: string): string {
  const start = new Date(startIso).getTime()
  const now = Date.now()
  const totalSeconds = Math.floor((now - start) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function OnDutyCard({
  userId,
  firstName,
  lastName,
  role,
  clockIn,
  isOnBreak,
  breakStartedAt,
  isInOvertime,
  isApproachingOt,
  hoursUntilOt,
  onStartBreak,
  onEndBreak,
  onClockOut,
}: OnDutyCardProps) {
  const [elapsed, setElapsed] = useState(formatElapsed(clockIn))
  const [breakElapsed, setBreakElapsed] = useState(
    breakStartedAt ? formatElapsed(breakStartedAt) : ''
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsed(clockIn))
      if (breakStartedAt) {
        setBreakElapsed(formatElapsed(breakStartedAt))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [clockIn, breakStartedAt])

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  const roleColor = ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <Card
      className={cn(
        'relative transition-shadow hover:shadow-md',
        isInOvertime && 'ring-2 ring-red-400',
        isApproachingOt && !isInOvertime && 'ring-2 ring-amber-400',
        isOnBreak && 'opacity-80'
      )}
    >
      <CardContent className="p-4">
        {/* Header: name + actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {firstName} {lastName}
              </p>
              <Badge variant="outline" className={cn('text-xs mt-0.5', roleColor)}>
                {role}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOnBreak ? (
                <DropdownMenuItem onClick={() => onEndBreak(userId)}>
                  <Play className="h-4 w-4 mr-2" />
                  End Break
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onStartBreak(userId)}>
                  <Pause className="h-4 w-4 mr-2" />
                  Start Break
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onClockOut(userId)}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Clock Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Clocked in at</span>
          <span className="text-xs font-medium text-foreground">
            {new Date(clockIn).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="text-2xl font-mono font-bold text-foreground tabular-nums tracking-tight">
          {elapsed}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {isOnBreak && (
            <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs gap-1">
              <Coffee className="h-3 w-3" />
              Break {breakElapsed}
            </Badge>
          )}
          {isInOvertime && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              Overtime
            </Badge>
          )}
          {isApproachingOt && !isInOvertime && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs gap-1">
              <AlertTriangle className="h-3 w-3" />
              OT in {hoursUntilOt.toFixed(1)}h
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
