'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Send,
  MessageSquare,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  Users,
  Clock,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MARKETING_TEMPLATES, AVAILABLE_MERGE_FIELDS, resolveMergeFields } from '@/lib/marketing/merge-fields'

const STEPS = ['Channel', 'Audience', 'Content', 'Preview', 'Send']

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'All Customers' },
  { value: 'loyalty', label: 'Loyalty Members' },
  { value: 'lapsed_30d', label: 'Lapsed 30+ Days' },
  { value: 'lapsed_60d', label: 'Lapsed 60+ Days' },
  { value: 'new_customers', label: 'New (Last 30 Days)' },
  { value: 'high_spenders', label: 'High Spenders' },
]

interface CampaignBuilderProps {
  onComplete?: () => void
}

export function CampaignBuilder({ onComplete }: CampaignBuilderProps) {
  const [step, setStep] = useState(0)
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms')
  const [segment, setSegment] = useState('all')
  const [segmentCount, setSegmentCount] = useState<number | null>(null)
  const [template, setTemplate] = useState('')
  const [smsBody, setSmsBody] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [sending, setSending] = useState(false)
  const [previewSms, setPreviewSms] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now')

  // Fetch segment count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/marketing/segments/count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: segment,
            has_phone: channel === 'sms' || channel === 'both' ? true : undefined,
            has_email: channel === 'email' || channel === 'both' ? true : undefined,
          }),
        })
        const json = await res.json()
        setSegmentCount(json.count ?? json.data?.count ?? 0)
      } catch {
        setSegmentCount(null)
      }
    }
    fetchCount()
  }, [segment, channel])

  // Apply template
  useEffect(() => {
    if (!template) return
    const tmpl = MARKETING_TEMPLATES.find((t) => t.id === template)
    if (tmpl) {
      setSmsBody(tmpl.sms_body)
      setEmailSubject(tmpl.email_subject)
      setEmailBody(tmpl.email_body.replace(/<[^>]+>/g, ''))
      setCampaignName(tmpl.name)
    }
  }, [template])

  // Generate preview
  useEffect(() => {
    if (step === 3) {
      const sampleData = {
        first_name: 'Sarah',
        last_name: 'Johnson',
        full_name: 'Sarah Johnson',
        points_balance: 1250,
        tier: 'Gold',
        last_visit: 'March 15',
        total_visits: 24,
        total_spent: '$1,842.50',
        restaurant_name: 'Your Restaurant',
        location_name: 'Downtown',
      }
      setPreviewSms(resolveMergeFields(smsBody, sampleData))
      setPreviewSubject(resolveMergeFields(emailSubject, sampleData))
      setPreviewBody(resolveMergeFields(emailBody, sampleData))
    }
  }, [step, smsBody, emailSubject, emailBody])

  const handleSend = async () => {
    setSending(true)
    try {
      // Create campaign
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName || 'Untitled Campaign',
          channel,
          segment_type: segment,
          sms_body: channel !== 'email' ? smsBody : undefined,
          email_subject: channel !== 'sms' ? emailSubject : undefined,
          email_body: channel !== 'sms' ? emailBody : undefined,
          status: scheduleType === 'now' ? 'sending' : 'scheduled',
        }),
      })

      if (res.ok) {
        const json = await res.json()
        // If sending now, trigger send
        if (scheduleType === 'now') {
          await fetch(`/api/marketing/campaigns/${json.data.id}/send`, {
            method: 'POST',
          })
        }
        toast.success(scheduleType === 'now' ? 'Campaign sent!' : 'Campaign scheduled!')
        onComplete?.()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'Failed to create campaign')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-orange-500 text-white'
                  : i < step
                    ? 'bg-green-100 text-green-700 cursor-pointer'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              {s}
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 0: Channel */}
      {step === 0 && (
        <Card className="border-warm shadow-warm">
          <CardHeader>
            <CardTitle className="text-base">Select Channel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['sms', 'email', 'both'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  channel === ch
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {ch === 'sms' ? (
                  <MessageSquare className="h-5 w-5 text-green-600" />
                ) : ch === 'email' ? (
                  <Mail className="h-5 w-5 text-blue-600" />
                ) : (
                  <Send className="h-5 w-5 text-purple-600" />
                )}
                <div className="text-left">
                  <p className="font-medium text-sm capitalize">
                    {ch === 'both' ? 'SMS + Email' : ch.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {ch === 'sms'
                      ? 'Text message via Twilio'
                      : ch === 'email'
                        ? 'Email via SendGrid'
                        : 'Send both channels'}
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Audience */}
      {step === 1 && (
        <Card className="border-warm shadow-warm">
          <CardHeader>
            <CardTitle className="text-base">Select Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {SEGMENT_OPTIONS.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => setSegment(seg.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    segment === seg.value
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-medium">{seg.label}</span>
                  {segment === seg.value && segmentCount !== null && (
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">
                      <Users className="h-3 w-3 mr-1" />
                      {segmentCount.toLocaleString()}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Content */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="border-warm shadow-warm">
            <CardHeader>
              <CardTitle className="text-base">Campaign Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Campaign Name</Label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="My Campaign"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Start from Template</Label>
                <Select value={template} onValueChange={(v) => v && setTemplate(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETING_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(channel === 'sms' || channel === 'both') && (
                <div className="space-y-1.5">
                  <Label>SMS Message</Label>
                  <Textarea
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    placeholder="Hey {first_name}..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">{smsBody.length}/160 characters</p>
                </div>
              )}

              {(channel === 'email' || channel === 'both') && (
                <>
                  <div className="space-y-1.5">
                    <Label>Email Subject</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject line..."
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email Body</Label>
                    <Textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Email content..."
                      className="min-h-[200px]"
                    />
                  </div>
                </>
              )}

              {/* Merge Fields */}
              <div>
                <Label className="text-xs">Available Merge Fields</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {AVAILABLE_MERGE_FIELDS.map((field) => (
                    <Badge
                      key={field.key}
                      variant="outline"
                      className="cursor-pointer hover:bg-orange-50 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(field.key)
                        toast.success(`Copied ${field.key}`)
                      }}
                    >
                      {field.key}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <Card className="border-warm shadow-warm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Showing preview with sample customer data (Sarah Johnson, Gold tier)
              </p>

              {(channel === 'sms' || channel === 'both') && (
                <div>
                  <Label className="text-xs">SMS Preview</Label>
                  <div className="mt-1.5 p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm">{previewSms}</p>
                  </div>
                </div>
              )}

              {(channel === 'email' || channel === 'both') && (
                <div>
                  <Label className="text-xs">Email Preview</Label>
                  <div className="mt-1.5 p-4 rounded-lg bg-white border">
                    <p className="font-semibold text-sm mb-2">{previewSubject}</p>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">{previewBody}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Send */}
      {step === 4 && (
        <Card className="border-warm shadow-warm">
          <CardHeader>
            <CardTitle className="text-base">Ready to Send</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Campaign</span><span className="font-medium">{campaignName || 'Untitled'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Channel</span><span className="font-medium capitalize">{channel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Audience</span><span className="font-medium">{segmentCount?.toLocaleString() ?? '?'} recipients</span></div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setScheduleType('now')}
                className={`flex-1 p-3 rounded-lg border text-center text-sm font-medium ${
                  scheduleType === 'now' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200'
                }`}
              >
                <Send className="h-4 w-4 mx-auto mb-1" />
                Send Now
              </button>
              <button
                onClick={() => setScheduleType('scheduled')}
                className={`flex-1 p-3 rounded-lg border text-center text-sm font-medium ${
                  scheduleType === 'scheduled' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200'
                }`}
              >
                <Clock className="h-4 w-4 mx-auto mb-1" />
                Schedule
              </button>
            </div>

            <Button
              onClick={handleSend}
              disabled={sending}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {scheduleType === 'now' ? 'Send Campaign' : 'Schedule Campaign'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        {step < 4 && (
          <Button onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
