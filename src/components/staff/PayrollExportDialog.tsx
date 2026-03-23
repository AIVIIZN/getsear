'use client'

import { useState } from 'react'
import { Download, Loader2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const FORMATS = [
  { value: 'generic', label: 'Generic CSV', description: 'Standard format with all fields' },
  { value: 'adp', label: 'ADP Workforce Now', description: 'ADP WFN import-ready format' },
  { value: 'gusto', label: 'Gusto', description: 'Gusto CSV import format' },
  { value: 'paychex', label: 'Paychex Flex', description: 'Paychex Flex import format' },
] as const

interface PayrollExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodStart: string
  periodEnd: string
}

export function PayrollExportDialog({
  open,
  onOpenChange,
  periodStart,
  periodEnd,
}: PayrollExportDialogProps) {
  const [format, setFormat] = useState<string>('generic')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/staff/payroll/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          period_start: periodStart,
          period_end: periodEnd,
          location_id: 'default',
        }),
      })

      if (res.ok) {
        const json = await res.json()
        const { csv, filename } = json.data

        // Trigger download
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)

        toast.success(`Exported ${json.data.employeeCount} employees in ${format.toUpperCase()} format`)
        onOpenChange(false)
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Export failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Payroll</DialogTitle>
          <DialogDescription>
            Select a format to export payroll data for {periodStart} to {periodEnd}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                format === f.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              )}
            >
              <FileText className={cn('h-5 w-5 mt-0.5', format === f.value ? 'text-primary' : 'text-muted-foreground')} />
              <div>
                <p className="text-sm font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
