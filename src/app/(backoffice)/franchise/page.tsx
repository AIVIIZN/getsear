"use client"

import * as React from "react"
import {
  Building2,
  Plus,
  Loader2,
  DollarSign,
  MapPin,
  BarChart3,
  Calculator,
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Royalty {
  id: string
  org_id: string
  location_id: string
  period_start: string
  period_end: string
  gross_sales: string
  royalty_rate: string
  royalty_amount: string
  marketing_fee: string
  total_due: string
  status: string
  calculated_at: string
}

interface LocationWithMetrics {
  id: string
  name: string
  address: Record<string, unknown> | null
  phone: string | null
  timezone: string | null
  is_active: boolean
  metrics?: {
    order_count_30d: number
    revenue_30d: string
  }
}

interface ConsolidatedReport {
  period: { date_from: string; date_to: string }
  totals: {
    revenue: string
    order_count: number
    avg_check: string
    location_count: number
  }
  locations: Array<{
    location_id: string
    location_name: string
    revenue: string
    order_count: number
    avg_check: string
  }>
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------
const ROYALTY_STATUS_COLORS: Record<string, string> = {
  calculated: "bg-blue-50 text-blue-700 border-blue-200",
  invoiced: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-green-50 text-green-700 border-green-200",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FranchisePage() {
  const [tab, setTab] = React.useState("royalties")

  // Royalties
  const [royalties, setRoyalties] = React.useState<Royalty[]>([])
  const [royaltiesLoading, setRoyaltiesLoading] = React.useState(true)
  const [royaltyStatus, setRoyaltyStatus] = React.useState("")

  // Calculate sheet
  const [calcSheetOpen, setCalcSheetOpen] = React.useState(false)
  const [calcStart, setCalcStart] = React.useState("")
  const [calcEnd, setCalcEnd] = React.useState("")
  const [calcRate, setCalcRate] = React.useState("0.05")
  const [calcFee, setCalcFee] = React.useState("0.02")
  const [calculating, setCalculating] = React.useState(false)

  // Locations
  const [locations, setLocations] = React.useState<LocationWithMetrics[]>([])
  const [locationsLoading, setLocationsLoading] = React.useState(true)

  // Reports
  const [report, setReport] = React.useState<ConsolidatedReport | null>(null)
  const [reportLoading, setReportLoading] = React.useState(false)
  const [reportDateFrom, setReportDateFrom] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [reportDateTo, setReportDateTo] = React.useState(
    () => new Date().toISOString().split("T")[0],
  )

  // Saving
  const [saving, setSaving] = React.useState(false)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------
  const fetchRoyalties = React.useCallback(async () => {
    setRoyaltiesLoading(true)
    try {
      const params = new URLSearchParams()
      if (royaltyStatus) params.set("status", royaltyStatus)
      const res = await fetch(`/api/franchise/royalties?${params}`)
      if (res.ok) {
        const json = await res.json()
        setRoyalties(json.data ?? [])
      }
    } finally {
      setRoyaltiesLoading(false)
    }
  }, [royaltyStatus])

  const fetchLocations = React.useCallback(async () => {
    setLocationsLoading(true)
    try {
      const res = await fetch("/api/franchise/locations?include_metrics=true")
      if (res.ok) {
        const json = await res.json()
        setLocations(json.data ?? [])
      }
    } finally {
      setLocationsLoading(false)
    }
  }, [])

  const fetchReport = React.useCallback(async () => {
    setReportLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: reportDateFrom,
        date_to: reportDateTo,
      })
      const res = await fetch(`/api/franchise/reports?${params}`)
      if (res.ok) {
        const json = await res.json()
        setReport(json.data ?? null)
      }
    } finally {
      setReportLoading(false)
    }
  }, [reportDateFrom, reportDateTo])

  React.useEffect(() => {
    fetchRoyalties()
  }, [fetchRoyalties])

  React.useEffect(() => {
    if (tab === "locations") fetchLocations()
  }, [tab, fetchLocations])

  React.useEffect(() => {
    if (tab === "reports") fetchReport()
  }, [tab, fetchReport])

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  async function handleCalculate() {
    setCalculating(true)
    try {
      const res = await fetch("/api/franchise/royalties/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: calcStart,
          period_end: calcEnd,
          royalty_rate: calcRate,
          marketing_fee: calcFee,
        }),
      })
      if (res.ok) {
        setCalcSheetOpen(false)
        fetchRoyalties()
      }
    } finally {
      setCalculating(false)
    }
  }

  async function markAsPaid(royaltyId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/franchise/royalties/${royaltyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      })
      if (res.ok) {
        fetchRoyalties()
      }
    } finally {
      setSaving(false)
    }
  }

  async function markAsInvoiced(royaltyId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/franchise/royalties/${royaltyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invoiced" }),
      })
      if (res.ok) {
        fetchRoyalties()
      }
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Totals
  // -----------------------------------------------------------------------
  const totalDue = royalties.reduce(
    (sum, r) => sum + parseFloat(r.total_due || "0"),
    0,
  )
  const totalPaid = royalties
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + parseFloat(r.total_due || "0"), 0)
  const totalOutstanding = royalties
    .filter((r) => r.status !== "paid")
    .reduce((sum, r) => sum + parseFloat(r.total_due || "0"), 0)

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Franchise</h1>
        <p className="text-sm text-muted-foreground">
          Multi-location royalties, comparison, and consolidated reports
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v)}>
        <TabsList>
          <TabsTrigger value="royalties">
            <DollarSign className="mr-2 h-4 w-4" />
            Royalties
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="mr-2 h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="mr-2 h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* ============================================================
            ROYALTIES TAB
            ============================================================ */}
        <TabsContent value="royalties" className="space-y-4">
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-50 p-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Due</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-50 p-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-50 p-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">
                      ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters + actions */}
          <div className="flex items-center justify-between">
            <Select value={royaltyStatus} onValueChange={(v) => v && setRoyaltyStatus(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="calculated">Calculated</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCalcSheetOpen(true)} className="btn-press">
              <Calculator className="mr-2 h-4 w-4" />
              Calculate Royalties
            </Button>
          </div>

          {/* Table */}
          {royaltiesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : royalties.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No royalty records"
              description="Calculate royalties for a period to see data here."
              actionLabel="Calculate Royalties"
              onAction={() => setCalcSheetOpen(true)}
            />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Gross Sales</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Royalty</TableHead>
                    <TableHead className="text-right">Marketing</TableHead>
                    <TableHead className="text-right">Total Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {royalties.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {new Date(r.period_start + "T00:00:00").toLocaleDateString()} &ndash;{" "}
                        {new Date(r.period_end + "T00:00:00").toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">{r.location_id.slice(0, 8)}...</TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${parseFloat(r.gross_sales).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(parseFloat(r.royalty_rate) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${parseFloat(r.royalty_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${parseFloat(r.marketing_fee).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ${parseFloat(r.total_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${ROYALTY_STATUS_COLORS[r.status] ?? ""}`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {r.status === "calculated" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => markAsInvoiced(r.id)}
                              disabled={saving}
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              Invoice
                            </Button>
                          )}
                          {r.status === "invoiced" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-green-600"
                              onClick={() => markAsPaid(r.id)}
                              disabled={saving}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ============================================================
            LOCATIONS TAB
            ============================================================ */}
        <TabsContent value="locations" className="space-y-4">
          {locationsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No locations"
              description="Add locations to your organization to see them here."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {locations.map((loc) => (
                  <Card key={loc.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{loc.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className={`text-xs ${loc.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}`}
                        >
                          {loc.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {loc.phone && (
                        <p className="text-sm text-muted-foreground">{loc.phone}</p>
                      )}
                      {loc.timezone && (
                        <p className="text-xs text-muted-foreground">{loc.timezone}</p>
                      )}
                      {loc.metrics && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">30d Revenue</p>
                              <p className="font-semibold tabular-nums">
                                ${parseFloat(loc.metrics.revenue_30d).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">30d Orders</p>
                              <p className="font-semibold tabular-nums">
                                {loc.metrics.order_count_30d.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ============================================================
            REPORTS TAB
            ============================================================ */}
        <TabsContent value="reports" className="space-y-4">
          {/* Date selectors */}
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="pt-5">
              <Button variant="outline" onClick={fetchReport} disabled={reportLoading}>
                {reportLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !report ? (
            <EmptyState
              icon={BarChart3}
              title="No report data"
              description="Select a date range and click Refresh to generate a consolidated report."
            />
          ) : (
            <>
              {/* Totals */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          ${parseFloat(report.totals.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {report.totals.order_count.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Orders</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-green-50 p-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          ${parseFloat(report.totals.avg_check).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Check</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-purple-50 p-2">
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums">
                          {report.totals.location_count}
                        </p>
                        <p className="text-xs text-muted-foreground">Locations</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-location table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Avg Check</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.locations.map((loc) => (
                        <TableRow key={loc.location_id}>
                          <TableCell className="font-medium">
                            {loc.location_name}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${parseFloat(loc.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {loc.order_count.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ${parseFloat(loc.avg_check).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ================================================================
          CALCULATE ROYALTIES SHEET
          ================================================================ */}
      <Sheet open={calcSheetOpen} onOpenChange={setCalcSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Calculate Royalties</SheetTitle>
            <SheetDescription>
              Calculate royalties for all locations in a given period.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={calcStart}
                  onChange={(e) => setCalcStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={calcEnd}
                  onChange={(e) => setCalcEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Royalty Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={calcRate}
                  onChange={(e) => setCalcRate(e.target.value)}
                  placeholder="0.05"
                />
                <p className="text-xs text-muted-foreground">
                  e.g. 0.05 = 5%
                </p>
              </div>
              <div className="space-y-2">
                <Label>Marketing Fee Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={calcFee}
                  onChange={(e) => setCalcFee(e.target.value)}
                  placeholder="0.02"
                />
                <p className="text-xs text-muted-foreground">
                  e.g. 0.02 = 2%
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCalcSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCalculate}
                disabled={calculating || !calcStart || !calcEnd}
                className="btn-press"
              >
                {calculating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Calculator className="mr-2 h-4 w-4" />
                Calculate
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
