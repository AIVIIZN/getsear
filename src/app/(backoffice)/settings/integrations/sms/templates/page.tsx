'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, RotateCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TemplateEditor } from '@/components/integrations/TemplateEditor'
import {
  MERGE_VARIABLES,
  DEFAULT_TEMPLATES,
  renderPreview,
  countSmsSegments,
  hasOptOutText,
  type SmsTemplateType,
} from '@/lib/integrations/sms-templates'

interface Template {
  id: string | null
  template_type: SmsTemplateType
  name: string
  body: string
  is_active: boolean
  is_default?: boolean
}

export default function SmsTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<SmsTemplateType | null>(null)

  const locationId = '00000000-0000-0000-0000-000000000001'

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/integrations/sms/templates?location_id=${locationId}`)
      const json = await res.json()
      if (json.data) {
        setTemplates(json.data)
        if (!activeTemplate && json.data.length > 0) {
          setActiveTemplate(json.data[0].template_type)
        }
      }
    } catch {
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [locationId, activeTemplate])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const currentTemplate = templates.find(t => t.template_type === activeTemplate)

  const handleBodyChange = (body: string) => {
    setTemplates(prev => prev.map(t =>
      t.template_type === activeTemplate ? { ...t, body } : t
    ))
  }

  const handleSave = async () => {
    if (!currentTemplate || !activeTemplate) return
    setSaving(activeTemplate)
    try {
      const res = await fetch('/api/integrations/sms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          template_type: activeTemplate,
          name: currentTemplate.name,
          body: currentTemplate.body,
          is_active: currentTemplate.is_active,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Template saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const handleReset = () => {
    if (!activeTemplate) return
    const def = DEFAULT_TEMPLATES[activeTemplate]
    if (!def) return
    setTemplates(prev => prev.map(t =>
      t.template_type === activeTemplate ? { ...t, body: def.body } : t
    ))
    toast.success('Reset to default')
  }

  const segments = currentTemplate ? countSmsSegments(currentTemplate.body) : null
  const isMarketing = activeTemplate === 'marketing'
  const missingOptOut = isMarketing && currentTemplate && !hasOptOutText(currentTemplate.body)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings/integrations/sms"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white hover:bg-[var(--secondary)] transition-colors touch-target"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">SMS Templates</h2>
          <p className="text-sm text-muted-foreground">Edit notification message templates</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Template list */}
        <div className="w-56 shrink-0 space-y-1">
          {templates.map((t) => (
            <button
              key={t.template_type}
              onClick={() => setActiveTemplate(t.template_type)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors touch-target',
                activeTemplate === t.template_type
                  ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                  : 'text-muted-foreground hover:bg-[var(--secondary)] hover:text-foreground'
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {currentTemplate && activeTemplate && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{currentTemplate.name}</h3>
                  {segments && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{segments.chars} chars</span>
                      <span className="text-[var(--border)]">|</span>
                      <span>{segments.segments} segment{segments.segments > 1 ? 's' : ''}</span>
                      <span className="text-[var(--border)]">|</span>
                      <span>{segments.encoding}</span>
                    </div>
                  )}
                </div>

                <TemplateEditor
                  value={currentTemplate.body}
                  onChange={handleBodyChange}
                  variables={MERGE_VARIABLES[activeTemplate]}
                  renderPreview={(body) => renderPreview(body, activeTemplate)}
                  maxChars={1600}
                  helpText="Use {{variable}} syntax for dynamic content. Click chips above to insert."
                />

                {missingOptOut && (
                  <div className="rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]/20 px-4 py-3">
                    <p className="text-xs font-medium text-[#b45309]">
                      Marketing messages must include opt-out text (e.g. &quot;Reply STOP to unsubscribe&quot;)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors touch-target"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Reset to Default
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving === activeTemplate || (isMarketing && missingOptOut)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors',
                    'bg-[var(--primary)] hover:bg-[var(--primary-hover)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'touch-target shadow-sm'
                  )}
                >
                  {saving === activeTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
