'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Eye, Edit3, AlertCircle } from 'lucide-react'

interface MergeVariable {
  key: string
  label: string
  sample: string
}

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  variables: MergeVariable[]
  renderPreview: (body: string) => string
  maxChars?: number
  label?: string
  helpText?: string
  className?: string
}

export function TemplateEditor({
  value,
  onChange,
  variables,
  renderPreview,
  maxChars,
  label,
  helpText,
  className,
}: TemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  const preview = useMemo(() => renderPreview(value), [value, renderPreview])
  const charCount = value.length
  const isOverLimit = maxChars ? charCount > maxChars : false

  const insertVariable = (key: string) => {
    onChange(value + `{{${key}}}`)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Variable chips */}
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insertVariable(v.key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              'bg-[var(--accent)] text-[var(--accent-foreground)]',
              'border border-[var(--primary)]/20',
              'hover:bg-[var(--primary)] hover:text-white transition-colors',
              'touch-target'
            )}
            title={`Insert {{${v.key}}} — sample: ${v.sample}`}
          >
            <span className="text-[10px] opacity-70">{'{{'}</span>
            {v.label}
            <span className="text-[10px] opacity-70">{'}}'}</span>
          </button>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-[var(--muted)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors touch-target',
            activeTab === 'edit'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Edit3 className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors touch-target',
            activeTab === 'preview'
              ? 'bg-white text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      {/* Editor / Preview panes */}
      <div className="min-h-[200px]">
        {activeTab === 'edit' ? (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={6}
              className={cn(
                'flex w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3',
                'text-sm text-foreground placeholder:text-muted-foreground font-mono leading-relaxed',
                'transition-colors focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20',
                'resize-y',
                isOverLimit && 'border-[var(--error)] focus:border-[var(--error)] focus:ring-[var(--error)]/20'
              )}
              placeholder="Type your message template..."
            />
            <div className="flex items-center justify-between">
              {helpText && (
                <p className="text-xs text-muted-foreground">{helpText}</p>
              )}
              {maxChars && (
                <div className={cn(
                  'flex items-center gap-1 text-xs font-mono',
                  isOverLimit ? 'text-[var(--error)]' : charCount > (maxChars * 0.9) ? 'text-[var(--warning)]' : 'text-muted-foreground'
                )}>
                  {isOverLimit && <AlertCircle className="h-3 w-3" />}
                  {charCount}/{maxChars}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Preview with sample data</p>
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{preview}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
