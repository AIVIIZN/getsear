"use client"

import * as React from "react"
import {
  Mail,
  Plus,
  Search,
  Send,
  BarChart3,
  Users,
  Loader2,
  Trash2,
  Eye,
  X,
  MousePointerClick,
  Target,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/EmptyState"

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
// Status color map
// ---------------------------------------------------------------------------
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  sending: "bg-amber-50 text-amber-700 border-amber-200",
  sent: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MarketingPage() {
  const [tab, setTab] = React.useState("campaigns")
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("")

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
      if (statusFilter) params.set("status", statusFilter)
      if (typeFilter) params.set("type", typeFilter)
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
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/campaigns/${campaignToDelete.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteDialogOpen(false)
        setCampaignToDelete(null)
        fetchCampaigns()
      }
    } finally {
      setSaving(false)
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
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="text-sm text-muted-foreground">
            Email, SMS, and push campaigns
          </p>
        </div>
        <Button onClick={openCreate} className="btn-press">
          <Plus className="mr-2 h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="campaigns">
            <Mail className="mr-2 h-4 w-4" />
            Campaigns
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

        {/* ============================================================
            CAMPAIGNS TAB
            ============================================================ */}
        <TabsContent value="campaigns" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No campaigns yet"
              description="Create your first marketing campaign to reach your customers."
              actionLabel="New Campaign"
              onAction={openCreate}
            />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Open Rate</TableHead>
                    <TableHead className="text-right">Click Rate</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[100px]" />
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
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {c.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${STATUS_COLORS[c.status] ?? ""}`}
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {sent.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {openRate}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {clickRate}%
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
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
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(c)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {c.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => handleSend(c)}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    setCampaignToDelete(c)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
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
            </div>
          )}
        </TabsContent>

        {/* ============================================================
            SEGMENTS TAB
            ============================================================ */}
        <TabsContent value="segments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Segment Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Visits</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 3"
                    value={segmentMinVisits}
                    onChange={(e) => setSegmentMinVisits(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    placeholder="e.g. vip, regular"
                    value={segmentTags}
                    onChange={(e) => setSegmentTags(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <Button onClick={handleCountSegment} disabled={countLoading}>
                  {countLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Users className="mr-2 h-4 w-4" />
                  Count Matching Customers
                </Button>
                {segmentCount !== null && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {segmentCount.toLocaleString()}
                    </span>{" "}
                    customers match this segment
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================
            ANALYTICS TAB
            ============================================================ */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2">
                        <Send className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.total_sent.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Sent</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-green-50 p-2">
                        <Eye className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.open_rate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Open Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-purple-50 p-2">
                        <MousePointerClick className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.click_rate.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Click Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-amber-50 p-2">
                        <BarChart3 className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {analytics.total_campaigns}
                        </p>
                        <p className="text-xs text-muted-foreground">Campaigns</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign performance table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Campaign Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Sent</TableHead>
                        <TableHead className="text-right">Opened</TableHead>
                        <TableHead className="text-right">Clicked</TableHead>
                        <TableHead className="text-right">Bounced</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.campaigns.map((c) => {
                        const s = c.stats ?? {}
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="capitalize">{c.type}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(s.sent ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(s.opened ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(s.clicked ?? 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {(s.bounced ?? 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================
          CREATE / EDIT SHEET
          ================================================================ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
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

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Summer Promotion"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="push">Push Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType === "email" && (
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g. Don't miss our summer specials!"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Body / Content</Label>
              <Textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Write your campaign message..."
                rows={8}
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={formScheduledAt}
                onChange={(e) => setFormScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to save as draft
              </p>
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formName}
                className="btn-press"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCampaign ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ================================================================
          DELETE CONFIRMATION DIALOG
          ================================================================ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{campaignToDelete?.name}&rdquo;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="btn-press"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
