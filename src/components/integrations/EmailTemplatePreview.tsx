'use client'

import { cn } from '@/lib/utils'

interface EmailTemplatePreviewProps {
  html: string
  subject?: string
  className?: string
}

export function EmailTemplatePreview({
  html,
  subject,
  className,
}: EmailTemplatePreviewProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {subject && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Subject</p>
          <p className="text-sm font-medium text-foreground">{subject}</p>
        </div>
      )}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF605C]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD44]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#00CA4E]" />
          </div>
          <span className="text-xs text-muted-foreground">Email Preview</span>
        </div>
        <div className="p-4">
          <iframe
            srcDoc={html}
            title="Email preview"
            className="w-full border-0 rounded-lg bg-white"
            style={{ minHeight: 400, maxHeight: 600 }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  )
}
