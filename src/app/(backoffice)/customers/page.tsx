"use client"

import * as React from "react"
import {
  Search,
  Plus,
  Users,
  Star,
  AlertTriangle,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  Merge,
  Trash2,
  MapPin,
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Customer {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  notes: string | null
  tags: string[]
  is_vip: boolean
  total_visits: number
  total_spend: string
  last_visit_at: string | null
  birthday: string | null
  allergies: string[]
  dietary_preferences: string[]
  created_at: string
  updated_at: string
}

interface CustomerDetail extends Customer {
  addresses: Address[]
  order_count: number
}

interface Address {
  id: string
  customer_id: string
  type: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
  is_default: boolean
}

interface OrderRecord {
  id: string
  order_number: string
  status: string
  order_type: string
  subtotal: string
  tax_total: string
  total: string
  item_count: number
  created_at: string
  closed_at: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

type SortField = "last_name" | "total_visits" | "total_spend" | "last_visit_at"

// ---------------------------------------------------------------------------
// Tag colors
// ---------------------------------------------------------------------------
const TAG_COLORS: Record<string, string> = {
  vip: "bg-amber-100 text-amber-800 border-amber-200",
  regular: "bg-blue-100 text-blue-800 border-blue-200",
  "food-allergy": "bg-red-100 text-red-800 border-red-200",
  "birthday-month": "bg-pink-100 text-pink-800 border-pink-200",
  "gluten-free": "bg-emerald-100 text-emerald-800 border-emerald-200",
  vegetarian: "bg-green-100 text-green-800 border-green-200",
  vegan: "bg-lime-100 text-lime-800 border-lime-200",
}

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return "--"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getInitials(first: string, last: string): string {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).toUpperCase() || "?"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CustomersPage() {
  // ---- list state ----
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [pagination, setPagination] = React.useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 0,
  })
  const [search, setSearch] = React.useState("")
  const [sortBy, setSortBy] = React.useState<SortField>("last_name")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [loading, setLoading] = React.useState(true)

  // ---- detail state ----
  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerDetail | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [orders, setOrders] = React.useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = React.useState(false)

  // ---- create state ----
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  })
  const [createError, setCreateError] = React.useState<string | null>(null)

  // ---- merge state ----
  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [mergeLoading, setMergeLoading] = React.useState(false)
  const [mergeSecondaryId, setMergeSecondaryId] = React.useState("")
  const [mergeSearch, setMergeSearch] = React.useState("")
  const [mergeResults, setMergeResults] = React.useState<Customer[]>([])

  // ---- edit state (inline in sheet) ----
  const [editNotes, setEditNotes] = React.useState("")
  const [editTags, setEditTags] = React.useState<string[]>([])
  const [newTag, setNewTag] = React.useState("")
  const [editVip, setEditVip] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // debounced search
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- fetch list ----
  const fetchCustomers = React.useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "25",
          sort_by: sortBy,
          sort_dir: sortDir,
        })
        if (search.trim()) params.set("search", search.trim())

        const res = await fetch(`/api/customers?${params}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        setCustomers(json.data)
        setPagination(json.pagination)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    },
    [search, sortBy, sortDir]
  )

  React.useEffect(() => {
    fetchCustomers(1)
  }, [fetchCustomers])

  // ---- search debounce ----
  function handleSearchChange(val: string) {
    setSearch(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      // fetchCustomers triggers via effect
    }, 300)
  }

  // ---- sorting ----
  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("asc")
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return null
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-0.5" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-0.5" />
    )
  }

  // ---- open detail ----
  async function openCustomerDetail(id: string) {
    setSheetOpen(true)
    setDetailLoading(true)
    setOrders([])
    try {
      const res = await fetch(`/api/customers/${id}`)
      if (!res.ok) throw new Error("Not found")
      const json = await res.json()
      const c = json.data as CustomerDetail
      setSelectedCustomer(c)
      setEditNotes(c.notes ?? "")
      setEditTags(c.tags ?? [])
      setEditVip(c.is_vip)
      // load orders
      fetchOrders(id)
    } catch {
      setSheetOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  async function fetchOrders(customerId: string) {
    setOrdersLoading(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/orders?limit=10`)
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setOrders(json.data)
    } catch {
      // silent
    } finally {
      setOrdersLoading(false)
    }
  }

  // ---- save detail edits ----
  async function saveCustomerEdits() {
    if (!selectedCustomer) return
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes || null,
          tags: editTags,
          is_vip: editVip,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const json = await res.json()
      setSelectedCustomer((prev) => (prev ? { ...prev, ...json.data } : prev))
      fetchCustomers(pagination.page)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // ---- create customer ----
  async function handleCreate() {
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: createForm.first_name,
          last_name: createForm.last_name,
          email: createForm.email || null,
          phone: createForm.phone || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setCreateError(`Duplicate found: ${json.duplicates?.[0]?.first_name ?? ""} ${json.duplicates?.[0]?.last_name ?? ""}`)
        } else {
          setCreateError(json.error ?? "Failed to create customer")
        }
        return
      }
      setCreateOpen(false)
      setCreateForm({ first_name: "", last_name: "", email: "", phone: "" })
      fetchCustomers(1)
    } catch {
      setCreateError("Network error")
    } finally {
      setCreateLoading(false)
    }
  }

  // ---- delete customer ----
  async function handleDelete() {
    if (!selectedCustomer) return
    if (!window.confirm(`Delete ${selectedCustomer.first_name} ${selectedCustomer.last_name}?`)) return
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      setSheetOpen(false)
      setSelectedCustomer(null)
      fetchCustomers(pagination.page)
    } catch {
      // silent
    }
  }

  // ---- merge ----
  async function handleMergeSearch() {
    if (!mergeSearch.trim() || !selectedCustomer) return
    try {
      const params = new URLSearchParams({ search: mergeSearch.trim(), limit: "10" })
      const res = await fetch(`/api/customers?${params}`)
      if (!res.ok) return
      const json = await res.json()
      setMergeResults((json.data as Customer[]).filter((c) => c.id !== selectedCustomer.id))
    } catch {
      // silent
    }
  }

  async function handleMerge() {
    if (!selectedCustomer || !mergeSecondaryId) return
    setMergeLoading(true)
    try {
      const res = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_id: selectedCustomer.id,
          secondary_id: mergeSecondaryId,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      setMergeOpen(false)
      setMergeSecondaryId("")
      setMergeSearch("")
      setMergeResults([])
      // Reload detail
      openCustomerDetail(selectedCustomer.id)
      fetchCustomers(pagination.page)
    } catch {
      // silent
    } finally {
      setMergeLoading(false)
    }
  }

  // ---- tag management ----
  function addTag() {
    const tag = newTag.trim().toLowerCase()
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag])
      setNewTag("")
    }
  }

  function removeTag(tag: string) {
    setEditTags((prev) => prev.filter((t) => t !== tag))
  }

  // ---- render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            Manage guest profiles, preferences, and order history.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="btn-press">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-12 pl-10 text-base"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="They'll appear here after their first order."
          actionLabel="Add Customer"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card shadow-warm-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("last_name")}
                  >
                    Name <SortIcon field="last_name" />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("total_visits")}
                  >
                    Visits <SortIcon field="total_visits" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort("total_spend")}
                  >
                    Total Spend <SortIcon field="total_spend" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("last_visit_at")}
                  >
                    Last Visit <SortIcon field="last_visit_at" />
                  </TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c, idx) => (
                  <TableRow
                    key={c.id}
                    className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                      idx % 2 === 1 ? "bg-muted/30" : ""
                    } ${c.is_vip ? "bg-amber-50/50 hover:bg-amber-50/80" : ""}`}
                    onClick={() => openCustomerDetail(c.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback
                            className={`text-xs font-medium ${
                              c.is_vip
                                ? "bg-amber-100 text-amber-800"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {getInitials(c.first_name, c.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">
                            {c.first_name} {c.last_name}
                          </span>
                          {c.is_vip && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          )}
                          {c.allergies && c.allergies.length > 0 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "--"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "--"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.total_visits}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.total_spend)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(c.last_visit_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.tags ?? []).slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={`text-[11px] ${getTagColor(tag)}`}
                          >
                            {tag}
                          </Badge>
                        ))}
                        {(c.tags ?? []).length > 3 && (
                          <Badge variant="outline" className="text-[11px]">
                            +{c.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(pagination.page - 1) * pagination.limit + 1}--
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} customers
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchCustomers(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => fetchCustomers(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* Customer Detail Sheet                                            */}
      {/* ================================================================ */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          {detailLoading || !selectedCustomer ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                {/* Header */}
                <SheetHeader className="p-0">
                  <div className="flex items-start gap-4">
                    <Avatar
                      className={`h-16 w-16 ${
                        selectedCustomer.is_vip ? "ring-2 ring-amber-400" : ""
                      }`}
                    >
                      <AvatarFallback
                        className={`text-lg font-semibold ${
                          selectedCustomer.is_vip
                            ? "bg-amber-100 text-amber-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {getInitials(
                          selectedCustomer.first_name,
                          selectedCustomer.last_name
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <SheetTitle className="text-xl">
                        {selectedCustomer.first_name} {selectedCustomer.last_name}
                      </SheetTitle>
                      <SheetDescription className="mt-0.5">
                        {selectedCustomer.email ?? "No email"} &middot;{" "}
                        {selectedCustomer.phone ?? "No phone"}
                      </SheetDescription>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5">
                          <Label htmlFor="vip-toggle" className="text-xs text-muted-foreground">
                            VIP
                          </Label>
                          <Switch
                            id="vip-toggle"
                            checked={editVip}
                            onCheckedChange={(val: boolean) => setEditVip(val)}
                            size="sm"
                          />
                        </div>
                        {selectedCustomer.allergies.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Allergies: {selectedCustomer.allergies.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </SheetHeader>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="text-lg font-semibold tabular-nums">
                      {selectedCustomer.total_visits}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Visits</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="text-lg font-semibold tabular-nums">
                      {formatCurrency(selectedCustomer.total_spend)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Total Spent</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <div className="text-lg font-semibold tabular-nums">
                      {formatDate(selectedCustomer.last_visit_at)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Last Visit</div>
                  </div>
                </div>

                <Separator />

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {editTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={`text-xs pr-1 ${getTagColor(tag)}`}
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 rounded-full hover:bg-black/10 p-0.5"
                          type="button"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        className="h-6 w-24 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={addTag}
                        type="button"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Notes
                  </Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Preferences, dietary restrictions, special requests..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Birthday */}
                {selectedCustomer.birthday && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Birthday
                    </Label>
                    <p className="text-sm">{formatDate(selectedCustomer.birthday)}</p>
                  </div>
                )}

                {/* Save button */}
                <Button
                  onClick={saveCustomerEdits}
                  disabled={saving}
                  className="w-full btn-press"
                >
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>

                <Separator />

                {/* Order History */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Recent Orders ({selectedCustomer.order_count})
                  </Label>
                  {ordersLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No orders yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {orders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">#{o.order_number}</span>
                            <span className="mx-2 text-muted-foreground">
                              {formatDate(o.created_at)}
                            </span>
                            <Badge variant="outline" className="text-[10px] ml-1">
                              {o.status}
                            </Badge>
                          </div>
                          <div className="tabular-nums font-medium">
                            {formatCurrency(o.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Addresses */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Addresses
                  </Label>
                  {selectedCustomer.addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No saved addresses.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedCustomer.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium capitalize">{addr.type}</span>
                              {addr.is_default && (
                                <Badge variant="outline" className="text-[10px]">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              {addr.address_line1}
                              {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                              <br />
                              {addr.city}, {addr.state} {addr.zip}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setMergeOpen(true)
                      setMergeSearch("")
                      setMergeResults([])
                      setMergeSecondaryId("")
                    }}
                  >
                    <Merge className="mr-1.5 h-4 w-4" />
                    Merge Duplicate
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={handleDelete}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* ================================================================ */}
      {/* Create Customer Dialog                                           */}
      {/* ================================================================ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create a new customer profile. Duplicate phone or email will be flagged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-first">First Name *</Label>
                <Input
                  id="create-first"
                  value={createForm.first_name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, first_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-last">Last Name</Label>
                <Input
                  id="create-last"
                  value={createForm.last_name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, last_name: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-phone">Phone</Label>
              <Input
                id="create-phone"
                type="tel"
                value={createForm.phone}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createLoading || !createForm.first_name.trim()}
              className="btn-press"
            >
              {createLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Merge Dialog                                                     */}
      {/* ================================================================ */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Customer</DialogTitle>
            <DialogDescription>
              Search for the duplicate record to merge into{" "}
              <strong>
                {selectedCustomer?.first_name} {selectedCustomer?.last_name}
              </strong>
              . All orders and data from the duplicate will be transferred.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="Search duplicate by name, email, phone..."
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMergeSearch()
                }}
              />
              <Button variant="outline" onClick={handleMergeSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {mergeResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {mergeResults.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors ${
                      mergeSecondaryId === c.id
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setMergeSecondaryId(c.id)}
                  >
                    <div>
                      <span className="font-medium text-sm">
                        {c.first_name} {c.last_name}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.email ?? c.phone ?? ""}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {c.total_visits} visits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={mergeLoading || !mergeSecondaryId}
              className="btn-press"
            >
              {mergeLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Merge Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
