"use client"

import * as React from "react"
import { BadgeCheck, DatabaseZap, Filter, Play, Plus, Save, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { Button } from "@/components/ui-v2/Button"
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui-v2/Card"
import { Text } from "@/components/ui-v2/inputs/Text"
import { NumberInput } from "@/components/ui-v2/inputs/Number"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { cn } from "@/lib/utils"

type SegmentRule = {
  field: string
  operator: string
  value?: string | number | boolean | Array<string | number>
}
type SegmentRuleGroup = { match: "all" | "any"; rules: SegmentRule[] }
type Segment = {
  id: string
  name: string
  description?: string | null
  segment_type: "dynamic" | "static"
  status: "draft" | "active" | "archived"
  preview_count: number
  rule_tree: SegmentRuleGroup
  materialized_at?: string | null
  updated_at: string
}
type PreviewGuest = {
  id: string
  display_name: string
  lifecycle_stage: string
  total_spend: number
  total_visits: number
  matched_rules: string[]
}
type Preview = { total_count: number; sample_guests: PreviewGuest[]; runtime_ms: number }

const fields = [
  { value: "lifecycle_stage", label: "Lifecycle stage", kind: "text" },
  { value: "total_spend", label: "Lifetime spend", kind: "number" },
  { value: "total_visits", label: "Visit count", kind: "number" },
  { value: "average_check", label: "Average check", kind: "number" },
  { value: "days_since_last_visit", label: "Days since last visit", kind: "number" },
  { value: "birthday_month", label: "Birthday month", kind: "text" },
  { value: "is_vip", label: "VIP flag", kind: "boolean" },
  { value: "tag_slug", label: "Smart tag", kind: "text" },
  { value: "tag_category", label: "Tag category", kind: "text" },
  { value: "email_marketing_consent", label: "Email consent", kind: "boolean" },
  { value: "sms_marketing_consent", label: "SMS consent", kind: "boolean" },
  { value: "loyalty_points_balance", label: "Loyalty points", kind: "number" },
  { value: "loyalty_tier", label: "Loyalty tier", kind: "text" },
  { value: "favorite_item_contains", label: "Menu item affinity", kind: "text" },
  { value: "order_channel", label: "Order channel", kind: "text" },
] as const

const operators = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "between", label: "Between" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Does not exist" },
  { value: "days_since", label: "At least days since" },
  { value: "count_at_least", label: "Count at least" },
] as const

function defaultRule(): SegmentRule {
  return { field: "lifecycle_stage", operator: "equals", value: "regular" }
}

function fieldKind(field: string) {
  return fields.find((item) => item.value === field)?.kind ?? "text"
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not materialized"
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export default function SegmentsPage() {
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading")
  const [saving, setSaving] = React.useState(false)
  const [previewing, setPreviewing] = React.useState(false)
  const [materializing, setMaterializing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [name, setName] = React.useState("Weekend regulars")
  const [description, setDescription] = React.useState("Guests with repeat behavior who are reachable for targeted hospitality.")
  const [segmentType, setSegmentType] = React.useState<"dynamic" | "static">("dynamic")
  const [match, setMatch] = React.useState<"all" | "any">("all")
  const [rules, setRules] = React.useState<SegmentRule[]>([
    { field: "total_visits", operator: "greater_than", value: 4 },
    { field: "email_marketing_consent", operator: "equals", value: true },
  ])

  const selectedSegment = segments.find((segment) => segment.id === selectedId) ?? null

  const loadSegments = React.useCallback(async () => {
    setState("loading")
    try {
      const json = await fetchJson<{ data: Segment[] }>("/api/crm/segments?limit=50")
      setSegments(json.data)
      setSelectedId((current) => current ?? json.data[0]?.id ?? null)
      setState("ready")
    } catch {
      setState("error")
    }
  }, [])

  React.useEffect(() => {
    loadSegments()
  }, [loadSegments])

  React.useEffect(() => {
    if (!selectedSegment) return
    setName(selectedSegment.name)
    setDescription(selectedSegment.description ?? "")
    setSegmentType(selectedSegment.segment_type)
    setMatch(selectedSegment.rule_tree.match)
    setRules(selectedSegment.rule_tree.rules.length ? selectedSegment.rule_tree.rules : [defaultRule()])
    setPreview(null)
  }, [selectedSegment])

  function updateRule(index: number, patch: Partial<SegmentRule>) {
    setRules((current) => current.map((rule, ruleIndex) => {
      if (ruleIndex !== index) return rule
      const next = { ...rule, ...patch }
      if (patch.field && fieldKind(patch.field) === "boolean") next.value = true
      if (patch.field && fieldKind(patch.field) === "number") next.value = 1
      return next
    }))
  }

  async function saveSegment() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        name,
        description,
        segment_type: segmentType,
        status: "draft",
        match_mode: match,
        rule_tree: { match, rules },
      }
      const json = await fetchJson<{ data: Segment & { sample_guests: PreviewGuest[] } }>("/api/crm/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      setSegments((current) => [json.data, ...current])
      setSelectedId(json.data.id)
      setPreview({ total_count: json.data.preview_count, sample_guests: json.data.sample_guests ?? [], runtime_ms: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save segment")
    } finally {
      setSaving(false)
    }
  }

  async function runPreview() {
    if (!selectedId) {
      await saveSegment()
      return
    }
    setPreviewing(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: Preview }>(`/api/crm/segments/${selectedId}/preview`, { method: "POST" })
      setPreview(json.data)
      await loadSegments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed")
    } finally {
      setPreviewing(false)
    }
  }

  async function materialize() {
    if (!selectedId) return
    setMaterializing(true)
    setError(null)
    try {
      const json = await fetchJson<{ data: { membership_count: number; sample_guests: PreviewGuest[] } }>(`/api/crm/segments/${selectedId}/materialize`, { method: "POST" })
      setPreview({ total_count: json.data.membership_count, sample_guests: json.data.sample_guests, runtime_ms: 0 })
      await loadSegments()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Materialize failed")
    } finally {
      setMaterializing(false)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-[var(--space-6)] py-[var(--space-6)] text-[var(--color-text)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-[var(--space-5)]">
        <header className="flex flex-wrap items-end justify-between gap-[var(--space-4)]">
          <div>
            <p className="text-[var(--type-caption-size)] font-[var(--weight-semibold)] uppercase text-[var(--color-text-muted)]">GuestBrain CRM</p>
            <h1 className="text-[var(--type-title-1-size)] font-[var(--weight-bold)] leading-[var(--type-line-height-tight)]">Segments</h1>
          </div>
          <Button size="md" leadingIcon={<Plus />} onClick={() => {
            setSelectedId(null)
            setName("")
            setDescription("")
            setSegmentType("dynamic")
            setMatch("all")
            setRules([defaultRule()])
            setPreview(null)
          }}>New segment</Button>
        </header>

        {error ? <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger)]/10 p-[var(--space-3)] text-[var(--color-danger)]">{error}</div> : null}

        <div className="grid gap-[var(--space-5)] lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <Card className="min-h-[520px]">
            <CardHeader>
              <CardTitle>Saved audiences</CardTitle>
              <CardDescription>Dynamic and static guest groups for campaigns, recovery, and service.</CardDescription>
            </CardHeader>
            <CardBody>
              {state === "loading" ? <><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></> : null}
              {state === "error" ? <EmptyState illustration="no-customers" title="Segments unavailable" description="The segment list could not load." /> : null}
              {state === "ready" && segments.length === 0 ? <EmptyState illustration="no-customers" title="No segments yet" description="Build an audience from guest behavior, loyalty, tags, consent, and visit signals." /> : null}
              {segments.map((segment) => (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => setSelectedId(segment.id)}
                  className={cn(
                    "w-full rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition-colors",
                    selectedId === segment.id ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <span className="font-[var(--weight-semibold)]">{segment.name}</span>
                    <Badge variant={segment.status === "active" ? "success" : "default"}>{segment.status}</Badge>
                  </div>
                  <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">
                    <UsersRound className="h-4 w-4" />
                    {segment.preview_count} guests
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visual rule builder</CardTitle>
              <CardDescription>Combine hospitality signals without writing SQL.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="grid gap-[var(--space-3)] md:grid-cols-[1fr_180px_160px]">
                <Text label="Segment name" value={name} onChange={(event) => setName(event.target.value)} placeholder="VIP brunch regulars" />
                <Select label="Type" value={segmentType} onChange={(value) => setSegmentType(value as "dynamic" | "static")} options={[{ value: "dynamic", label: "Dynamic" }, { value: "static", label: "Static" }]} />
                <Select label="Match" value={match} onChange={(value) => setMatch(value as "all" | "any")} options={[{ value: "all", label: "All rules" }, { value: "any", label: "Any rule" }]} />
              </div>
              <Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              <div className="flex flex-col gap-[var(--space-3)]">
                {rules.map((rule, index) => (
                  <div key={index} className="grid items-end gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-[var(--space-3)] md:grid-cols-[minmax(0,1.2fr)_180px_minmax(120px,0.8fr)_40px]">
                    <Select label={index === 0 ? "Signal" : undefined} value={rule.field} onChange={(value) => updateRule(index, { field: value })} options={fields.map((field) => ({ value: field.value, label: field.label }))} searchable />
                    <Select label={index === 0 ? "Operator" : undefined} value={rule.operator} onChange={(value) => updateRule(index, { operator: value })} options={operators.map((operator) => ({ value: operator.value, label: operator.label }))} />
                    {fieldKind(rule.field) === "boolean" ? (
                      <Select label={index === 0 ? "Value" : undefined} value={String(rule.value ?? true)} onChange={(value) => updateRule(index, { value: value === "true" })} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
                    ) : fieldKind(rule.field) === "number" ? (
                      <NumberInput label={index === 0 ? "Value" : undefined} value={String(rule.value ?? "")} onChange={(event) => updateRule(index, { value: Number(event.target.value) })} />
                    ) : (
                      <Text label={index === 0 ? "Value" : undefined} value={String(rule.value ?? "")} onChange={(event) => updateRule(index, { value: event.target.value })} placeholder="regular" />
                    )}
                    <Button type="button" variant="ghost" size="md" onClick={() => setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))} disabled={rules.length === 1}>x</Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                <Button type="button" variant="secondary" size="md" leadingIcon={<Filter />} onClick={() => setRules((current) => [...current, defaultRule()])}>Add rule</Button>
                <Button type="button" size="md" leadingIcon={<Save />} loading={saving} onClick={saveSegment} disabled={!name.trim()}>Save</Button>
                <Button type="button" variant="secondary" size="md" leadingIcon={<Play />} loading={previewing} onClick={runPreview} disabled={saving}>Preview</Button>
                <Button type="button" variant="secondary" size="md" leadingIcon={<DatabaseZap />} loading={materializing} onClick={materialize} disabled={!selectedId}>Materialize</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audience preview</CardTitle>
              <CardDescription>{selectedSegment ? `Last materialized ${formatDate(selectedSegment.materialized_at)}` : "Save or preview to evaluate the audience."}</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 p-[var(--space-4)]">
                <div className="flex items-center gap-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">
                  <BadgeCheck className="h-4 w-4 text-[var(--color-primary)]" />
                  Matched guests
                </div>
                <div className="mt-[var(--space-2)] text-[var(--type-title-1-size)] font-[var(--weight-bold)]">{preview?.total_count ?? selectedSegment?.preview_count ?? 0}</div>
              </div>
              {(preview?.sample_guests ?? []).length === 0 ? (
                <EmptyState illustration="no-customers" title="No sample guests" description="Run a preview to see matching guests and rule evidence." />
              ) : (
                preview!.sample_guests.map((guest) => (
                  <div key={guest.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-3)]">
                    <div className="flex items-start justify-between gap-[var(--space-2)]">
                      <div>
                        <div className="font-[var(--weight-semibold)]">{guest.display_name}</div>
                        <div className="text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{guest.total_visits} visits · ${guest.total_spend.toFixed(2)} spend</div>
                      </div>
                      <Badge>{guest.lifecycle_stage}</Badge>
                    </div>
                    <div className="mt-[var(--space-2)] flex flex-wrap gap-[var(--space-1)]">
                      {guest.matched_rules.slice(0, 3).map((rule) => <Badge key={rule} variant="primary">{rule}</Badge>)}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  )
}
