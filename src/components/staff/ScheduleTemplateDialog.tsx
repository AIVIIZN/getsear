'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

interface Template {
  id: string
  name: string
  shiftCount: number
  createdAt: string
}

interface ScheduleTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  weekStart: string
  onApplyTemplate: (templateId: string) => void
}

export function ScheduleTemplateDialog({
  open,
  onOpenChange,
  weekStart,
  onApplyTemplate,
}: ScheduleTemplateDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [mode, setMode] = useState<'list' | 'save'>('list')

  useEffect(() => {
    if (open) {
      loadTemplates()
    }
  }, [open])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scheduling/templates')
      if (res.ok) {
        const json = await res.json()
        setTemplates(json.data ?? [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!newName.trim()) { toast.error('Enter a name'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/scheduling/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), week_start: weekStart }),
      })
      if (res.ok) {
        toast.success('Template saved')
        setNewName('')
        setMode('list')
        loadTemplates()
      } else {
        toast.error('Failed to save template')
      }
    } catch { toast.error('Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Templates</DialogTitle>
          <DialogDescription>
            Save the current week as a template or apply an existing one.
          </DialogDescription>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="space-y-3 py-2">
            <Button variant="outline" className="w-full gap-2" onClick={() => setMode('save')}>
              <Save className="h-4 w-4" />
              Save Current Week as Template
            </Button>

            {loading ? (
              <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}</div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No templates saved yet.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.shiftCount} shifts</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { onApplyTemplate(t.id); onOpenChange(false) }} className="gap-1">
                      <Copy className="h-3.5 w-3.5" />
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Standard Week" className="h-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode('list')}>Back</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </div>
          </div>
        )}

        {mode === 'list' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
