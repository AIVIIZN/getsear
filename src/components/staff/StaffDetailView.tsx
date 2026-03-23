'use client'

import { useEffect, useState } from 'react'
import { X, Clock, DollarSign, Calendar, Mail, Phone, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { StaffMember } from '@/stores/staff-store'

interface StaffDetailViewProps {
  employee: StaffMember
  onClose: () => void
}

interface RecentEntry {
  id: string
  clock_in: string
  clock_out: string | null
  regular_hours: number | null
  overtime_hours: number | null
  total_pay: string | null
}

export function StaffDetailView({ employee, onClose }: StaffDetailViewProps) {
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/staff/${employee.id}/time-entries?limit=10`)
        const json = await res.json()
        if (json.data) setRecentEntries(json.data)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [employee.id])

  const initials = `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase()
  const hireDate = employee.hire_date
    ? new Date(employee.hire_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not set'

  const daysEmployed = employee.hire_date
    ? Math.floor(
        (Date.now() - new Date(employee.hire_date).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0

  const totalHours = recentEntries.reduce(
    (s, e) => s + (e.regular_hours ?? 0) + (e.overtime_hours ?? 0),
    0
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-lg bg-background shadow-xl overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Employee Detail</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Profile Card */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {initials}
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {employee.first_name} {employee.last_name}
              </h3>
              <Badge variant="outline" className="capitalize mt-1">
                {employee.role}
              </Badge>
              <Badge
                variant="outline"
                className={`ml-2 mt-1 ${employee.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
              >
                {employee.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {employee.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.email}</span>
                </div>
              )}
              {employee.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Hired {hireDate}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{daysEmployed} days employed</span>
              </div>
              {employee.hourly_rate && (
                <div className="flex items-center gap-3 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>${parseFloat(employee.hourly_rate).toFixed(2)}/hr</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employment Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent Activity (Last 10 Shifts)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : recentEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent time entries</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Hours</p>
                      <p className="text-lg font-semibold font-mono">
                        {totalHours.toFixed(1)}h
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Shifts</p>
                      <p className="text-lg font-semibold font-mono">
                        {recentEntries.length}
                      </p>
                    </div>
                  </div>

                  <Separator className="mb-3" />

                  <div className="space-y-2">
                    {recentEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {new Date(entry.clock_in).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span className="font-mono">
                            {((entry.regular_hours ?? 0) + (entry.overtime_hours ?? 0)).toFixed(1)}h
                          </span>
                          {entry.total_pay && (
                            <span className="font-mono">
                              ${parseFloat(entry.total_pay).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
