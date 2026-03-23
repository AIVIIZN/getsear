'use client'

import { ReportCard } from '@/components/reports/ReportCard'
import { REPORT_DEFINITIONS, REPORT_SECTIONS } from '@/lib/reports/constants'
import { Mail, FileDown } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            All reports pull live data from your POS system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (confirm('Send daily summary email to all configured recipients?')) {
                fetch('/api/reports/email-daily', { method: 'POST' })
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-medium hover:bg-[var(--secondary)] transition-colors"
            style={{ height: 44 }}
          >
            <Mail className="h-4 w-4" />
            Email Reports
          </button>
          <button
            type="button"
            onClick={() => window.open('/api/reports/export?type=daily', '_blank')}
            className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            style={{ height: 44 }}
          >
            <FileDown className="h-4 w-4" />
            Export All
          </button>
        </div>
      </div>

      {/* Report Sections */}
      {REPORT_SECTIONS.map(section => {
        const reports = REPORT_DEFINITIONS.filter(r => r.section === section.id)
        if (reports.length === 0) return null

        return (
          <div key={section.id}>
            <h2 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              {section.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* Owner Dashboard CTA */}
      <div className="rounded-2xl bg-gradient-to-r from-[#F06B18] to-[#EA580C] p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Owner Mobile Dashboard</h3>
            <p className="text-sm text-white/80 mt-1">
              Live metrics optimized for your phone. Revenue, labor, alerts, open checks.
            </p>
          </div>
          <a
            href="/reports/dashboard"
            className="flex items-center gap-2 rounded-xl bg-white/20 backdrop-blur-sm px-5 text-sm font-semibold text-white hover:bg-white/30 transition-colors"
            style={{ height: 48 }}
          >
            Open Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
