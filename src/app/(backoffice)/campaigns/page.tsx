"use client"

import * as React from "react"
import { CalendarClock, CheckCircle2, Mail, MessageSquare, ReceiptText, Save, Send, Smartphone, Sparkles, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { Button } from "@/components/ui-v2/Button"
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui-v2/Card"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Text } from "@/components/ui-v2/inputs/Text"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { cn } from "@/lib/utils"

type Segment = {
  id: string
  name: string
  preview_count: number
}

type Campaign = {
  id: string
  name: string
  campaign_type: CampaignType
  status: string
  goal: string
  primary_channel: Channel
  audience_count: number
  updated_at: string
  crm_segments?: { name?: string | null } | null
  latest_revenue_attribution?: {
    attributed_revenue: number
    attributed_profit_estimate: number
    roi_ratio: number | null
    excluded_revenue: number
    excluded_guest_count: number
  } | null
}

type CampaignType = "email" | "sms" | "push" | "guest_portal" | "receipt" | "qr" | "reservation_follow_up" | "review_request" | "win_back" | "birthday" | "anniversary" | "event_invite" | "menu_announcement" | "vip_invite" | "recovery"
type Channel = "email" | "sms" | "push" | "guest_portal" | "receipt" | "qr"
type PreviewChannel = "email" | "sms" | "push" | "receipt"

type CampaignPreview = {
  channels: Partial<Record<PreviewChannel, {
    label: string
    subject?: string | null
    preheader?: string | null
    body: string
    estimated_reachable_count: number
    estimated_cost_cents: number
  }>>
  compliance: {
    can_schedule: boolean
    warnings: string[]
    required_next_steps: string[]
  }
}

type PreviewResponse = {
  preview: CampaignPreview
  audience_count: number
}

const campaignTypes: Array<{ value: CampaignType; label: string }> = [
  { value: "win_back", label: "Win-back" },
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "event_invite", label: "Event invite" },
  { value: "menu_announcement", label: "Menu announcement" },
  { value: "vip_invite", label: "VIP invite" },
  { value: "recovery", label: "Recovery" },
  { value: "review_request", label: "Review request" },
  { value: "reservation_follow_up", label: "Reservation follow-up" },
  { value: "email", label: "General email" },
  { value: "sms", label: "General SMS" },
  { value: "push", label: "Mobile push" },
  { value: "receipt", label: "Receipt" },
  { value: "qr", label: "QR" },
  { value: "guest_portal", label: "Guest portal" },
]

const channelCards: Array<{ key: Channel; label: string; previewKey: PreviewChannel; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "email", label: "Email", previewKey: "email", icon: Mail },
  { key: "sms", label: "SMS", previewKey: "sms", icon: MessageSquare },
  { key: "push", label: "Mobile", previewKey: "push", icon: Smartphone },
  { key: "receipt", label: "Receipt", previewKey: "receipt", icon: ReceiptText },
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function formatCost(cents: number | undefined) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`
}

function formatMoney(value: number | undefined | null) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value ?? 0)
}

export default function CampaignsPage() {
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [saving, setSaving] = React.useState(false)
  const [previewing, setPreviewing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null)
  const [segmentId, setSegmentId] = React.useState("")
  const [name, setName] = React.useState("Lapsed regulars win-back")
  const [campaignType, setCampaignType] = React.useState<CampaignType>("win_back")
  const [goal, setGoal] = React.useState("Bring back regular guests who have not visited recently.")
  const [offer, setOffer] = React.useState("A personal invite with a limited-time chef feature.")
  const [tone, setTone] = React.useState("warm")
  const [brandVoice, setBrandVoice] = React.useState("polished neighborhood hospitality")
  const [primaryChannel, setPrimaryChannel] = React.useState<Channel>("email")
  const [subject, setSubject] = React.useState("We saved you a seat this week")
  const [preheader, setPreheader] = React.useState("A quick note from the team with something new to try.")
  const [messageBody, setMessageBody] = React.useState("Hi {{guest.first_name}}, we have missed seeing you. This week, our team is featuring a seasonal dish regulars have been asking for. Come in before Sunday and we will make the visit feel easy.")
  const [smsBody, setSmsBody] = React.useState("We have missed you at Sear. Come in this week for a seasonal feature. Reply STOP to opt out.")
  const [mobileBody, setMobileBody] = React.useState("We have missed you. A seasonal feature is waiting this week.")
  const [receiptBody, setReceiptBody] = React.useState("Thanks for dining with us. Ask your server about joining the next guest list.")
  const [scheduledFor, setScheduledFor] = React.useState("")

  const selectedSegment = segments.find((segment) => segment.id === segmentId) ?? null

  const payload = React.useMemo(() => ({
    segment_id: segmentId,
    name,
    campaign_type: campaignType,
    goal,
    offer,
    tone,
    brand_voice: brandVoice,
    primary_channel: primaryChannel,
    secondary_channels: channelCards.map((channel) => channel.key).filter((channel) => channel !== primaryChannel),
    subject,
    preheader,
    message_body: messageBody,
    sms_body: smsBody,
    mobile_body: mobileBody,
    receipt_body: receiptBody,
    scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
  }), [brandVoice, campaignType, goal, messageBody, mobileBody, name, offer, preheader, primaryChannel, receiptBody, scheduledFor, segmentId, smsBody, subject, tone])

  const load = React.useCallback(async () => {
    setState("loading")
    try {
      const [segmentsJson, campaignsJson] = await Promise.all([
        fetchJson<{ data: Segment[] }>("/api/crm/segments?status=active&limit=50"),
        fetchJson<{ data: Campaign[] }>("/api/crm/campaigns?limit=25"),
      ])
      setSegments(segmentsJson.data)
      setCampaigns(campaignsJson.data)
      setSegmentId((current) => current || segmentsJson.data[0]?.id || "")
      setState("ready")
    } catch {
      setState("error")
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function runPreview() {
    setPreviewing(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: PreviewResponse }>("/api/crm/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setPreview(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign preview failed")
    } finally {
      setPreviewing(false)
    }
  }

  async function saveCampaign() {
    setSaving(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: Campaign }>("/api/crm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setCampaigns((current) => [json.data, ...current])
      await runPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign save failed")
    } finally {
      setSaving(false)
    }
  }

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-[var(--space-6)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-[var(--space-4)]">
          <Skeleton className="h-[96px] rounded-[var(--radius-md)]" />
          <div className="grid gap-[var(--space-4)] lg:grid-cols-[360px_1fr]">
            <Skeleton className="h-[540px] rounded-[var(--radius-md)]" />
            <Skeleton className="h-[540px] rounded-[var(--radius-md)]" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-[var(--space-6)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-[var(--space-5)]">
        <section className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] text-[var(--color-text-muted)]">
              <Sparkles className="size-[18px]" />
              <span className="text-[var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-[0.04em]">CRM campaigns</span>
            </div>
            <h1 className="text-[var(--type-title-1-size)] font-[var(--weight-bold)] text-[var(--color-text)]">Campaign wizard</h1>
            <p className="mt-[var(--space-2)] max-w-[720px] text-[var(--type-body-size)] text-[var(--color-text-secondary)]">
              Build the audience, message, channel previews, and readiness contract before the send pipeline takes over.
            </p>
          </div>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button type="button" variant="secondary" loading={previewing} onClick={runPreview} disabled={!segmentId || !messageBody.trim()} leadingIcon={<Send />}>Preview</Button>
            <Button type="button" loading={saving} onClick={saveCampaign} disabled={!segmentId || !name.trim() || !messageBody.trim()} leadingIcon={<Save />}>Save draft</Button>
          </div>
        </section>

        {state === "error" || error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-[var(--space-4)] text-[var(--color-danger)]">
            {error ?? "Campaign data could not be loaded."}
          </div>
        ) : null}

        <div className="grid gap-[var(--space-4)] xl:grid-cols-[360px_1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-[var(--space-2)]"><UsersRound className="size-[18px]" /> Audience</CardTitle>
              <CardDescription>Pick a CRM segment and define the restaurant outcome.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-[var(--space-4)]">
              {segments.length ? (
                <Select
                  label="Segment"
                  value={segmentId}
                  onChange={setSegmentId}
                  options={segments.map((segment) => ({ value: segment.id, label: `${segment.name} (${segment.preview_count ?? 0})` }))}
                />
              ) : (
                <EmptyState title="No active segments" description="Create and activate a segment before building a campaign." action={{ label: "Open segments", onClick: () => window.location.assign("/segments") }} />
              )}
              <Select value={campaignType} onChange={setCampaignType} label="Campaign type" options={campaignTypes} searchable />
              <Textarea label="Goal" value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} />
              <Text label="Offer" value={offer} onChange={(event) => setOffer(event.target.value)} />
              <Text label="Schedule" type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} leadingIcon={<CalendarClock className="size-[16px]" />} />
              {selectedSegment ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
                  <div className="text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">Selected audience</div>
                  <div className="mt-[var(--space-1)] font-[var(--weight-semibold)] text-[var(--color-text)]">{selectedSegment.name}</div>
                  <div className="text-[var(--type-footnote-size)] text-[var(--color-text-secondary)]">{selectedSegment.preview_count ?? 0} guests in last preview</div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message studio</CardTitle>
              <CardDescription>Tone, brand voice, and channel-specific copy feed the live previews.</CardDescription>
            </CardHeader>
            <CardBody className="grid gap-[var(--space-4)] lg:grid-cols-2">
              <Text label="Campaign name" value={name} onChange={(event) => setName(event.target.value)} />
              <Select
                label="Tone"
                value={tone}
                onChange={setTone}
                options={[
                  { value: "warm", label: "Warm" },
                  { value: "polished", label: "Polished" },
                  { value: "playful", label: "Playful" },
                  { value: "urgent", label: "Urgent" },
                  { value: "grateful", label: "Grateful" },
                  { value: "concise", label: "Concise" },
                ]}
              />
              <Text label="Brand voice" value={brandVoice} onChange={(event) => setBrandVoice(event.target.value)} />
              <Select label="Primary channel" value={primaryChannel} onChange={setPrimaryChannel} options={channelCards.map((channel) => ({ value: channel.key, label: channel.label }))} />
              <Text label="Email subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
              <Text label="Email preheader" value={preheader} onChange={(event) => setPreheader(event.target.value)} />
              <Textarea fieldClassName="lg:col-span-2" label="Email body" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={7} />
              <Textarea label="SMS body" value={smsBody} onChange={(event) => setSmsBody(event.target.value)} rows={4} />
              <Textarea label="Mobile body" value={mobileBody} onChange={(event) => setMobileBody(event.target.value)} rows={4} />
              <Textarea fieldClassName="lg:col-span-2" label="Receipt body" value={receiptBody} onChange={(event) => setReceiptBody(event.target.value)} rows={4} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved drafts</CardTitle>
              <CardDescription>Recent CRM-native campaigns.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-[var(--space-3)]">
              {campaigns.length ? campaigns.slice(0, 8).map((campaign) => (
                <div key={campaign.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
                  <div className="flex items-start justify-between gap-[var(--space-2)]">
                    <div>
                      <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">{campaign.name}</div>
                      <div className="text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{campaign.crm_segments?.name ?? "CRM segment"} · {formatDate(campaign.updated_at)}</div>
                    </div>
                    <Badge>{campaign.status}</Badge>
                  </div>
                  <div className="mt-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-secondary)]">{campaign.audience_count ?? 0} guests · {campaign.primary_channel}</div>
                  <div className="mt-[var(--space-2)] grid grid-cols-2 gap-[var(--space-2)] text-[var(--type-footnote-size)]">
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] p-[var(--space-2)]">
                      <div className="text-[var(--color-text-muted)]">7-day revenue</div>
                      <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">{formatMoney(campaign.latest_revenue_attribution?.attributed_revenue)}</div>
                    </div>
                    <div className="rounded-[var(--radius-sm)] bg-[var(--color-bg-subtle)] p-[var(--space-2)]">
                      <div className="text-[var(--color-text-muted)]">Excluded</div>
                      <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">{formatMoney(campaign.latest_revenue_attribution?.excluded_revenue)}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <EmptyState
                  title="No campaign drafts"
                  description="Save this wizard to create the first CRM campaign draft."
                  action={segmentId ? { label: "Save draft", onClick: saveCampaign } : undefined}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <section className="grid gap-[var(--space-4)] lg:grid-cols-4">
          {channelCards.map((channel) => {
            const Icon = channel.icon
            const item = preview?.preview.channels[channel.previewKey]
            const active = Boolean(item)
            return (
              <Card key={channel.key} className={cn(!active && "opacity-70")}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-[var(--space-2)]"><Icon className="size-[18px]" /> {channel.label}</CardTitle>
                  <CardDescription>{active ? `${item?.estimated_reachable_count ?? 0} reachable · ${formatCost(item?.estimated_cost_cents)}` : "Preview after audience check"}</CardDescription>
                </CardHeader>
                <CardBody>
                  {item ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-[var(--space-4)]">
                      {item.subject ? <div className="mb-[var(--space-2)] font-[var(--weight-semibold)] text-[var(--color-text)]">{item.subject}</div> : null}
                      {item.preheader ? <div className="mb-[var(--space-3)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{item.preheader}</div> : null}
                      <p className="whitespace-pre-wrap text-[var(--type-subhead-size)] leading-[var(--type-line-height-relaxed)] text-[var(--color-text-secondary)]">{item.body}</p>
                    </div>
                  ) : (
                    <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-center text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">
                      Run preview to render {channel.label.toLowerCase()}.
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </section>

        {preview ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-[var(--space-2)]"><CheckCircle2 className="size-[18px]" /> Compliance handoff</CardTitle>
              <CardDescription>{preview.audience_count} guests evaluated before V7.2 send controls.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-[var(--space-2)]">
              <Badge variant={preview.preview.compliance.can_schedule ? "success" : "warning"}>{preview.preview.compliance.can_schedule ? "Ready to schedule" : "Needs review"}</Badge>
              {[...preview.preview.compliance.warnings, ...preview.preview.compliance.required_next_steps].map((item) => <Badge key={item} variant="warning">{item}</Badge>)}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </main>
  )
}
