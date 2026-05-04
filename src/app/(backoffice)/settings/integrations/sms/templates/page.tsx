'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui-v2/Button'
import { Card } from '@/components/ui-v2/Card'
import { Skeleton } from '@/components/ui-v2/data/Skeleton'
import { Alert } from '@/components/ui-v2/feedback/Alert'
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

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const currentTemplate = templates.find((t) => t.template_type === activeTemplate)

  const handleBodyChange = (body: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.template_type === activeTemplate ? { ...t, body } : t)),
    )
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
    setTemplates((prev) =>
      prev.map((t) => (t.template_type === activeTemplate ? { ...t, body: def.body } : t)),
    )
    toast.success('Reset to default')
  }

  const segments = currentTemplate ? countSmsSegments(currentTemplate.body) : null
  const isMarketing = activeTemplate === 'marketing'
  const missingOptOut = isMarketing && currentTemplate && !hasOptOutText(currentTemplate.body)

  if (loading) {
    return (
      <div className="flex flex-col gap-[var(--space-6)]">
        <Skeleton className="h-9 w-64" />
        <Skeleton variant="card" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center gap-[var(--space-3)]">
        <Link
          href="/settings/integrations/sms"
          className="btn-press touch-target flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]"
          aria-label="Back to SMS integration"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            SMS Templates
          </h2>
          <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Edit notification message templates
          </p>
        </div>
      </div>

      <div className="flex gap-[var(--space-6)]">
        {/* Template list */}
        <div className="flex w-[224px] shrink-0 flex-col gap-[var(--space-1)]">
          {templates.map((t) => (
            <button
              key={t.template_type}
              onClick={() => setActiveTemplate(t.template_type)}
              className={cn(
                'btn-press touch-target flex w-full items-center',
                'rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left',
                'text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]',
                'transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]',
                activeTemplate === t.template_type
                  ? 'bg-[color:var(--color-sidebar-active)] text-[color:var(--color-primary)]'
                  : 'text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-sidebar)] hover:text-[color:var(--color-text)]',
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="min-w-0 flex-1">
          {currentTemplate && activeTemplate && (
            <div className="flex flex-col gap-[var(--space-4)]">
              <Card variant="flat" padding="default">
                <div className="flex items-center justify-between">
                  <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                    {currentTemplate.name}
                  </h3>
                  {segments && (
                    <div className="flex items-center gap-[var(--space-3)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                      <span>{segments.chars} chars</span>
                      <span className="text-[color:var(--color-border)]">|</span>
                      <span>
                        {segments.segments} segment{segments.segments > 1 ? 's' : ''}
                      </span>
                      <span className="text-[color:var(--color-border)]">|</span>
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
                  <Alert variant="warning">
                    Marketing messages must include opt-out text (e.g. &quot;Reply STOP to unsubscribe&quot;)
                  </Alert>
                )}
              </Card>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleReset}
                  leadingIcon={<RotateCw className="h-3.5 w-3.5" />}
                >
                  Reset to Default
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isMarketing && Boolean(missingOptOut)}
                  loading={saving === activeTemplate}
                  size="lg"
                  leadingIcon={<Save className="h-4 w-4" />}
                >
                  Save Template
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
