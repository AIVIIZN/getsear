"use client"

import * as React from "react"
import {
  Mail,
  Plus,
  Search,
  Send,
  BarChart3,
  Users,
  Trash2,
  Eye,
  MousePointerClick,
  Target,
  Wand2,
} from "lucide-react"
import { CampaignBuilder } from "@/components/marketing/CampaignBuilder"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui-v2/Button"
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui-v2/Card"
import { Text } from "@/components/ui-v2/inputs/Text"
import { NumberInput } from "@/components/ui-v2/inputs/Number"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui-v2/Sheet"
import { ConfirmDialog } from "@/components/ui-v2/feedback/ConfirmDialog"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Campaign {
  id: string
  org_id: string
  name: string
  type: string
  status: string
  subject: string | null
  body: string | null
  segment_criteria: Record<string, unknown> | null
  scheduled_at: string | null
  sent_at: string | null
  stats: {
    sent?: number
    delivered?: number
    opened?: number
    clicked?: number
    bounced?: number
  } | null
  created_at: string
  updated_at: string
}

interface Analytics {
  total_campaigns: number
  total_sent: number
  total_delivered: number
  total_opened: number
  total_clicked: number
  total_bounced: number
  open_rate: number
  click_rate: number
  bounce_rate: number
  campaigns: Campaign[]
}

// ---------------------------------------------------------------------------
// Token-based status variants
// ---------------------------------------------------------------------------
function statusBadgeVariant(
  status: string,
): "default" | "primary" | "warning" | "success" | "danger" {
  switch (status) {
    case "draft":
      return "default"
    case "scheduled":
      return "primary"
    case "sending":
      return "warning"
    case "sent":
      return "success"
    case "cancelled":
      return "danger"
    default:
      return "default"
  }
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
]

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
]

const FORM_TYPE_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push Notification" },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MarketingPage() {
  const [tab, setTab] = React.useState("campaigns")
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [typeFilter, setTypeFilter] = React.useState("all")

  // Sheet / dialog
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingCampaign, setEditingCampaign] = React.useState<Campaign | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [campaignToDelete, setCampaignToDelete] = React.useState<Campaign | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Form state
  const [formName, setFormName] = React.useState("")
  const [formType, setFormType] = React.useState("email")
  const [formSubject, setFormSubject] = React.useState("")
  const [formBody, setFormBody] = React.useState("")
  const [formScheduledAt, setFormScheduledAt] = React.useState("")

  // Segment state
  const [segmentMinVisits, setSegmentMinVisits] = React.useState("")
  const [segmentTags, setSegmentTags] = React.useState("")
  const [segmentCount, setSegmentCount] = React.useState<number | null>(null)
  const [countLoading, setCountLoading] = React.useState(false)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------
  const fetchCampaigns = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter)
      const res = await fetch(`/api/marketing/campaigns?${params}`)
      if (res.ok) {
        const json = await res.json()
        setCampaigns(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter])

  const fetchAnalytics = React.useCallback(async () => {
    const res = await fetch("/api/marketing/analytics")
    if (res.ok) {
      const json = await res.json()
      setAnalytics(json.data ?? null)
    }
  }, [])

  React.useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  React.useEffect(() => {
    if (tab === "analytics") fetchAnalytics()
  }, [tab, fetchAnalytics])

  // -----------------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------------
  function openCreate() {
    setEditingCampaign(null)
    setFormName("")
    setFormType("email")
    setFormSubject("")
    setFormBody("")
    setFormScheduledAt("")
    setSheetOpen(true)
  }

  function openEdit(c: Campaign) {
    setEditingCampaign(c)
    setFormName(c.name)
    setFormType(c.type)
    setFormSubject(c.subject ?? "")
    setFormBody(c.body ?? "")
    setFormScheduledAt(c.scheduled_at ?? "")
    setSheetOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        name: formName,
        type: formType,
        subject: formSubject || null,
        body: formBody || null,
        scheduled_at: formScheduledAt || null,
      }

      const url = editingCampaign
        ? `/api/marketing/campaigns/${editingCampaign.id}`
        : "/api/marketing/campaigns"

      const res = await fetch(url, {
        method: editingCampaign ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSheetOpen(false)
        fetchCampaigns()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!campaignToDelete) return
    const res = await fetch(`/api/marketing/campaigns/${campaignToDelete.id}`, {
      method: "DELETE",
    })
    if (res.ok) {
      setCampaignToDelete(null)
      fetchCampaigns()
    }
  }

  async function handleSend(c: Campaign) {
    const res = await fetch(`/api/marketing/campaigns/${c.id}/send`, {
      method: "POST",
    })
    if (res.ok) {
      fetchCampaigns()
    }
  }

  async function handleCountSegment() {
    setCountLoading(true)
    try {
      const criteria: Record<string, unknown> = {}
      if (segmentMinVisits) criteria.min_visits = parseInt(segmentMinVisits, 10)
      if (segmentTags) criteria.tags = segmentTags.split(",").map((t) => t.trim())

      const res = await fetch("/api/marketing/segments/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      })
      if (res.ok) {
        const json = await res.json()
        setSegmentCount(json.count ?? 0)
      }
    } finally {
      setCountLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // Filtered
  // -----------------------------------------------------------------------
  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  )

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Email, SMS, and push campaigns</p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={openCreate}
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          New Campaign
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="campaigns">
              <Mail className="mr-2 h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="builder">
              <Wand2 className="mr-2 h-4 w-4" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="segments">
              <Target className="mr-2 h-4 w-4" />
              Segments
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ==================== CAMPAIGN BUILDER ==================== */}
        <TabsContent value="builder" className="space-y-4">
          <CampaignBuilder onComplete={() => setTab("campaigns")} />
        </TabsContent>

        {/* ============================================================
            CAMPAIGNS TAB
            ============================================================ */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-sm">
              <Text
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leadingIcon={<Search className="h-4 w-4" />}
                aria-label="Search campaigns"
              />
            </div>
            <div className="w-[160px]">
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                ariaLabel="Filter by status"
              />
            </div>
            <div className="w-[140px]">
              <Select
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={(v) => setTypeFilter(v)}
                ariaLabel="Filter by type"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="table-row" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No campaigns yet"
              description="Create your first marketing campaign to reach your customers."
              action={{ label: "New Campaign", onClick: openCreate }}
            />
          ) : (
            <Card padding="compact" className="!p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Name</TableCell>
                    <TableCell header>Type</TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header align="right">
                      Sent
                    </TableCell>
                    <TableCell header align="right">
                      Open Rate
                    </TableCell>
                    <TableCell header align="right">
                      Click Rate
                    </TableCell>
                    <TableCell header>Date</TableCell>
                    <TableCell header className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const stats = c.stats ?? {}
                    const sent = stats.sent ?? 0
                    const delivered = stats.delivered ?? 0
                    const opened = stats.opened ?? 0
                    const clicked = stats.clicked ?? 0
                    const openRate =
                      delivered > 0
                        ? ((opened / delivered) * 100).toFixed(1)
                        : "--"
                    const clickRate =
                      delivered > 0
                        ? ((clicked / delivered) * 100).toFixed(1)
                        : "--"

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-[var(--weight-medium)]">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default" className="capitalize">
                            {c.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusBadgeVariant(c.status)}
                            className="capitalize"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {sent.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {openRate}%
                        </TableCell>
                        <TableCell align="right" className="tabular-nums">
                          {clickRate}%
                        </TableCell>
                        <TableCell className="text-[var(--color-text-muted)]">
                          {c.sent_at
                            ? new Date(c.sent_at).toLocaleDateString()
                            : c.scheduled_at
                              ? `Sched: ${new Date(c.scheduled_at).toLocaleDateString()}`
                              : "--"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="View campaign"
                              onClick={() => openEdit(c)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {c.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Send campaign"
                                  onClick={() => handleSend(c)}
                                >
                                  <Send className="h-4 w-4 text-[var(--color-primary)]" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Delete campaign"
                                  onClick={() => {
                                    setCampaignToDelete(c)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================
            SEGMENTS TAB
            ============================================================ */}
        <TabsContent value="segments" className="space-y-4">
          <Card padding="default">
            <CardHeader>
              <CardTitle>Customer Segment Builder</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Minimum Visits"
                  placeholder="e.g. 3"
                  value={segmentMinVisits}
                  onChange={(e) => setSegmentMinVisits(e.target.value)}
                />
                <Text
                  label="Tags (comma-separated)"
                  placeholder="e.g. vip, regular"
                  value={segmentTags}
                  onChange={(e) => setSegmentTags(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4 border-t border-[var(--color-border)] pt-[var(--space-4)]">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCountSegment}
                  loading={countLoading}
                  leadingIcon={<Users className="h-4 w-4" />}
                >
                  Count Matching Customers
                </Button>
                {segmentCount !== null && (
                  <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                    <span className="font-[var(--weight-semibold)] text-[var(--color-text)]">
                      {segmentCount.toLocaleString()}
                    </span>{" "}
                    customers match this segment
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        {/* ============================================================
            ANALYTICS TAB
            ============================================================ */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card padding="default">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <div className="rounded-[var(--radius-circle)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)] p-[var(--space-2)]">
                        <Send className="h-5 w-5 text-[var(--color-primary)]" />
                      </div>
                      <div>
                        <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
                          {analytics.total_sent.toLocaleString()}
                        </p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Total Sent
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card padding="default">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <div className="rounded-[var(--radius-circle)] bg-[var(--color-success-bg)] p-[var(--space-2)]">
                        <Eye className="h-5 w-5 text-[var(--color-success)]" />
                      </div>
                      <div>
                        <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
                          {analytics.open_rate.toFixed(1)}%
                        </p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Open Rate
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card padding="default">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <div className="rounded-[var(--radius-circle)] bg-[color-mix(in_srgb,var(--color-primary)_14%,transparent)] p-[var(--space-2)]">
                        <MousePointerClick className="h-5 w-5 text-[var(--color-primary)]" />
                      </div>
                      <div>
                        <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
                          {analytics.click_rate.toFixed(1)}%
                        </p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Click Rate
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
                <Card padding="default">
                  <CardBody>
                    <div className="flex items-center gap-3">
                      <div className="rounded-[var(--radius-circle)] bg-[var(--color-warning-bg)] p-[var(--space-2)]">
                        <BarChart3 className="h-5 w-5 text-[var(--color-warning)]" />
                      </div>
                      <div>
                        <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-bold)] tabular-nums text-[var(--color-text)]">
                          {analytics.total_campaigns}
                        </p>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Campaigns
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Campaign performance table */}
              <Card padding="default">
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                </CardHeader>
                <CardBody>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableCell header>Campaign</TableCell>
                        <TableCell header>Type</TableCell>
                        <TableCell header align="right">
                          Sent
                        </TableCell>
                        <TableCell header align="right">
                          Opened
                        </TableCell>
                        <TableCell header align="right">
                          Clicked
                        </TableCell>
                        <TableCell header align="right">
                          Bounced
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.campaigns.map((c) => {
                        const s = c.stats ?? {}
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-[var(--weight-medium)]">
                              {c.name}
                            </TableCell>
                            <TableCell className="capitalize">
                              {c.type}
                            </TableCell>
                            <TableCell align="right" className="tabular-nums">
                              {(s.sent ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" className="tabular-nums">
                              {(s.opened ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" className="tabular-nums">
                              {(s.clicked ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell align="right" className="tabular-nums">
                              {(s.bounced ?? 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="card" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================
          CREATE / EDIT SHEET
          ================================================================ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>
              {editingCampaign ? "Edit Campaign" : "New Campaign"}
            </SheetTitle>
            <SheetDescription>
              {editingCampaign
                ? "Update campaign details and content."
                : "Create a new marketing campaign."}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <Text
              label="Campaign Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Summer Promotion"
            />
            <Select
              label="Type"
              options={FORM_TYPE_OPTIONS}
              value={formType}
              onChange={(v) => setFormType(v)}
            />
            {formType === "email" && (
              <Text
                label="Subject Line"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Don't miss our summer specials!"
              />
            )}
            <Textarea
              label="Body / Content"
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="Write your campaign message..."
              rows={8}
            />
            <Text
              label="Schedule (optional)"
              type="datetime-local"
              value={formScheduledAt}
              onChange={(e) => setFormScheduledAt(e.target.value)}
              helper="Leave blank to save as draft"
            />
          </SheetBody>
          <SheetFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={!formName}
              loading={saving}
            >
              {editingCampaign ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          DELETE CONFIRMATION
          ================================================================ */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(o) => {
          setDeleteDialogOpen(o)
          if (!o) setCampaignToDelete(null)
        }}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${campaignToDelete?.name ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
