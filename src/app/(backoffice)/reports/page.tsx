'use client'

import { ReportCard } from '@/components/reports/ReportCard'
import { REPORT_DEFINITIONS, REPORT_SECTIONS } from '@/lib/reports/constants'
import { Mail, FileDown } from 'lucide-react'
import { Button } from '@/components/ui-v2/Button'
import { ConfirmDialog } from '@/components/ui-v2/feedback/ConfirmDialog'
import { useState } from 'react'
import { toast } from 'sonner'

export default function ReportsPage() {
  const [emailOpen, setEmailOpen] = useState(false)

  const sendDailyEmail = async () => {
    try {
      const res = await fetch('/api/reports/email-daily', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Daily summary email sent.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    }
  }

  return (
    <div className="p-[var(--space-6)] max-w-7xl mx-auto space-y-[var(--space-8)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Reports
          </h1>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)] mt-[var(--space-1)]">
            All reports pull live data from your POS system
          </p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Button
            variant="secondary"
            size="md"
            onClick={() => setEmailOpen(true)}
            leadingIcon={<Mail className="h-4 w-4" />}
          >
            Email Reports
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => window.open('/api/reports/export?type=daily', '_blank')}
            leadingIcon={<FileDown className="h-4 w-4" />}
          >
            Export All
          </Button>
        </div>
      </div>

      {REPORT_SECTIONS.map(section => {
        const reports = REPORT_DEFINITIONS.filter(r => r.section === section.id)
        if (reports.length === 0) return null

        return (
          <div key={section.id}>
            <h2 className="text-[length:var(--type-caption-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text-muted)] uppercase tracking-wider mb-[var(--space-3)]">
              {section.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[var(--space-3)]">
              {reports.map(report => (
                <ReportCard
                  key={report.id}
                  name={report.name}
                  description={report.description}
                  href={report.href}
                  icon={report.icon}
                />
              ))}
            </div>
          </div>
        )
      })}

      <div className="rounded-[var(--radius-lg)] bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-primary-hover)] p-[var(--space-6)] text-[color:var(--color-primary-fg)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[length:var(--type-title-3-size)] font-[var(--weight-bold)]">Owner Mobile Dashboard</h3>
            <p className="text-[length:var(--type-subhead-size)] opacity-80 mt-[var(--space-1)]">
              Live metrics optimized for your phone. Revenue, labor, alerts, open checks.
            </p>
          </div>
          <a
            href="/reports/dashboard"
            className="btn-press touch-target inline-flex items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] bg-white/20 backdrop-blur-sm px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--type-callout-size)] font-[var(--weight-semibold)] text-[color:var(--color-primary-fg)] hover:bg-white/30 transition-colors"
          >
            Open Dashboard
          </a>
        </div>
      </div>

      <ConfirmDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title="Send daily summary email?"
        description="The daily summary will be emailed to all configured recipients."
        confirmLabel="Send"
        onConfirm={sendDailyEmail}
      />
    </div>
  )
}
