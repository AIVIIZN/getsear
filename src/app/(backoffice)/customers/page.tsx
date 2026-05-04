"use client"

import * as React from "react"
import {
  Search,
  Plus,
  Users,
  Star,
  AlertTriangle,
  X,
  Loader2,
  Merge,
  Trash2,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui-v2/Button"
import { Card } from "@/components/ui-v2/Card"
import { Text } from "@/components/ui-v2/inputs/Text"
import { Email } from "@/components/ui-v2/inputs/Email"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import { Toggle } from "@/components/ui-v2/inputs/Toggle"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Avatar } from "@/components/ui-v2/data/Avatar"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { ConfirmDialog } from "@/components/ui-v2/feedback/ConfirmDialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  type SortDirection,
} from "@/components/ui-v2/data/Table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui-v2/Sheet"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
} from "@/components/ui-v2/Modal"
import { cn } from "@/lib/utils"

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

const TAG_VARIANTS: Record<string, "primary" | "warning" | "danger" | "success" | "info" | "default"> = {
  vip: "warning",
  regular: "info",
  "food-allergy": "danger",
  "birthday-month": "primary",
  "gluten-free": "success",
  vegetarian: "success",
  vegan: "success",
}

function getTagVariant(tag: string) {
  return TAG_VARIANTS[tag] ?? "default"
}

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

export default function CustomersPage() {
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

  const [selectedCustomer, setSelectedCustomer] = React.useState<CustomerDetail | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [orders, setOrders] = React.useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = React.useState(false)

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createForm, setCreateForm] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  })
  const [createError, setCreateError] = React.useState<string | null>(null)

  const [mergeOpen, setMergeOpen] = React.useState(false)
  const [mergeLoading, setMergeLoading] = React.useState(false)
  const [mergeSecondaryId, setMergeSecondaryId] = React.useState("")
  const [mergeSearch, setMergeSearch] = React.useState("")
  const [mergeResults, setMergeResults] = React.useState<Customer[]>([])

  const [editNotes, setEditNotes] = React.useState("")
  const [editTags, setEditTags] = React.useState<string[]>([])
  const [newTag, setNewTag] = React.useState("")
  const [editVip, setEditVip] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

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
    [search, sortBy, sortDir],
  )

  React.useEffect(() => {
    fetchCustomers(1)
  }, [fetchCustomers])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(field)
      setSortDir("asc")
    }
  }

  function getSortDirection(field: SortField): SortDirection {
    if (sortBy !== field) return null
    return sortDir
  }

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
          setCreateError(
            `Duplicate found: ${json.duplicates?.[0]?.first_name ?? ""} ${json.duplicates?.[0]?.last_name ?? ""}`,
          )
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

  async function handleDelete() {
    if (!selectedCustomer) return
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
      openCustomerDetail(selectedCustomer.id)
      fetchCustomers(pagination.page)
    } catch {
      // silent
    } finally {
      setMergeLoading(false)
    }
  }

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

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
            Customers
          </h1>
          <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
            Manage guest profiles, preferences, and order history.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="lg"
          leadingIcon={<Plus className="h-4 w-4" />}
        >
          Add Customer
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Text
          size="lg"
          placeholder="Search by name, email, or phone..."
          leadingIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-[var(--space-2)]">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          illustration="no-customers"
          title="No customers yet"
          description="They'll appear here after their first order."
          action={{ label: "Add Customer", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <>
          <Card variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell
                    header
                    sortable
                    sortDirection={getSortDirection("last_name")}
                    onSort={() => handleSort("last_name")}
                  >
                    Name
                  </TableCell>
                  <TableCell header>Email</TableCell>
                  <TableCell header>Phone</TableCell>
                  <TableCell
                    header
                    align="right"
                    sortable
                    sortDirection={getSortDirection("total_visits")}
                    onSort={() => handleSort("total_visits")}
                  >
                    Visits
                  </TableCell>
                  <TableCell
                    header
                    align="right"
                    sortable
                    sortDirection={getSortDirection("total_spend")}
                    onSort={() => handleSort("total_spend")}
                  >
                    Total Spend
                  </TableCell>
                  <TableCell
                    header
                    sortable
                    sortDirection={getSortDirection("last_visit_at")}
                    onSort={() => handleSort("last_visit_at")}
                  >
                    Last Visit
                  </TableCell>
                  <TableCell header>Tags</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    interactive
                    onClick={() => openCustomerDetail(c.id)}
                    className={cn(c.is_vip && "bg-[color:var(--color-warning-bg)]/30")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-[var(--space-3)]">
                        <Avatar
                          name={`${c.first_name} ${c.last_name}`}
                          className={cn(
                            c.is_vip
                              ? "bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)]"
                              : undefined,
                          )}
                        />
                        <div className="flex items-center gap-[var(--space-1)]">
                          <span className="font-[var(--weight-medium)] text-[color:var(--color-text)]">
                            {c.first_name} {c.last_name}
                          </span>
                          {c.is_vip && (
                            <Star className="h-3.5 w-3.5 fill-[color:var(--color-warning-strong)] text-[color:var(--color-warning-strong)]" />
                          )}
                          {c.allergies && c.allergies.length > 0 && (
                            <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--color-danger)]" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[color:var(--color-text-muted)]">
                      {c.email ?? "--"}
                    </TableCell>
                    <TableCell className="text-[color:var(--color-text-muted)]">
                      {c.phone ?? "--"}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {c.total_visits}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatCurrency(c.total_spend)}
                    </TableCell>
                    <TableCell className="text-[color:var(--color-text-muted)]">
                      {formatDate(c.last_visit_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-[var(--space-1)]">
                        {(c.tags ?? []).slice(0, 3).map((tag) => (
                          <Badge key={tag} size="sm" variant={getTagVariant(tag)}>
                            {tag}
                          </Badge>
                        ))}
                        {(c.tags ?? []).length > 3 && (
                          <Badge size="sm">+{c.tags.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
              <span>
                Showing {(pagination.page - 1) * pagination.limit + 1}--
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} customers
              </span>
              <div className="flex gap-[var(--space-2)]">
                <Button
                  variant="secondary"
                  size="md"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchCustomers(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="md"
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

      {/* Customer Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" width="lg">
          {detailLoading || !selectedCustomer ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--color-text-muted)]" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start gap-[var(--space-4)]">
                  <Avatar
                    size="lg"
                    name={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                    className={cn(
                      selectedCustomer.is_vip
                        ? "bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)] ring-2 ring-[color:var(--color-warning-strong)]"
                        : undefined,
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <SheetTitle>
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </SheetTitle>
                    <SheetDescription className="mt-[2px]">
                      {selectedCustomer.email ?? "No email"} ·{" "}
                      {selectedCustomer.phone ?? "No phone"}
                    </SheetDescription>
                    <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-3)]">
                      <Toggle
                        size="md"
                        checked={editVip}
                        onChange={setEditVip}
                        label="VIP"
                      />
                      {selectedCustomer.allergies.length > 0 && (
                        <div className="flex items-center gap-[var(--space-1)] text-[length:var(--type-footnote-size)] text-[color:var(--color-danger)]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Allergies: {selectedCustomer.allergies.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="flex flex-col gap-[var(--space-6)]">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-[var(--space-3)]">
                  <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-[var(--space-3)] text-center">
                    <div className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums">
                      {selectedCustomer.total_visits}
                    </div>
                    <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                      Visits
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-[var(--space-3)] text-center">
                    <div className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums">
                      {formatCurrency(selectedCustomer.total_spend)}
                    </div>
                    <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                      Total Spent
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg-subtle)] p-[var(--space-3)] text-center">
                    <div className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums">
                      {formatDate(selectedCustomer.last_visit_at)}
                    </div>
                    <div className="text-[length:var(--type-caption-1-size)] text-[color:var(--color-text-muted)]">
                      Last Visit
                    </div>
                  </div>
                </div>

                <div className="border-t border-[color:var(--color-border)]" />

                {/* Tags */}
                <div className="flex flex-col gap-[var(--space-2)]">
                  <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    Tags
                  </label>
                  <div className="flex flex-wrap items-center gap-[var(--space-1)]">
                    {editTags.map((tag) => (
                      <Badge key={tag} variant={getTagVariant(tag)} className="pr-[var(--space-1)]">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="btn-press ml-[var(--space-1)] inline-flex items-center justify-center rounded-full p-[2px] hover:bg-black/10"
                          type="button"
                          aria-label={`Remove ${tag}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-[var(--space-1)]">
                      <Text
                        size="md"
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        className="h-7 w-28 text-[length:var(--type-footnote-size)]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={addTag}
                        type="button"
                        aria-label="Add tag"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-[var(--space-2)]">
                  <Textarea
                    label="Notes"
                    size="md"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Preferences, dietary restrictions, special requests..."
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {selectedCustomer.birthday && (
                  <div className="flex flex-col gap-[var(--space-1)]">
                    <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      Birthday
                    </label>
                    <p className="text-[length:var(--type-subhead-size)]">
                      {formatDate(selectedCustomer.birthday)}
                    </p>
                  </div>
                )}

                <Button
                  onClick={saveCustomerEdits}
                  loading={saving}
                  size="lg"
                  className="w-full"
                >
                  Save Changes
                </Button>

                <div className="border-t border-[color:var(--color-border)]" />

                {/* Order History */}
                <div className="flex flex-col gap-[var(--space-2)]">
                  <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    Recent Orders ({selectedCustomer.order_count})
                  </label>
                  {ordersLoading ? (
                    <div className="flex justify-center py-[var(--space-4)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-text-muted)]" />
                    </div>
                  ) : orders.length === 0 ? (
                    <p className="py-[var(--space-2)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                      No orders yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-[var(--space-1)]">
                      {orders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-subhead-size)]"
                        >
                          <div className="flex items-center gap-[var(--space-2)]">
                            <span className="font-[var(--weight-medium)]">#{o.order_number}</span>
                            <span className="text-[color:var(--color-text-muted)]">
                              {formatDate(o.created_at)}
                            </span>
                            <Badge size="sm">{o.status}</Badge>
                          </div>
                          <div className="font-[var(--weight-medium)] tabular-nums">
                            {formatCurrency(o.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[color:var(--color-border)]" />

                {/* Addresses */}
                <div className="flex flex-col gap-[var(--space-2)]">
                  <label className="text-[length:var(--type-footnote-size)] font-[var(--weight-medium)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    Addresses
                  </label>
                  {selectedCustomer.addresses.length === 0 ? (
                    <p className="py-[var(--space-2)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                      No saved addresses.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-[var(--space-2)]">
                      {selectedCustomer.addresses.map((addr) => (
                        <div
                          key={addr.id}
                          className="flex items-start gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--type-subhead-size)]"
                        >
                          <MapPin className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[color:var(--color-text-muted)]" />
                          <div>
                            <div className="flex items-center gap-[var(--space-1)]">
                              <span className="font-[var(--weight-medium)] capitalize">
                                {addr.type}
                              </span>
                              {addr.is_default && <Badge size="sm">Default</Badge>}
                            </div>
                            <p className="text-[color:var(--color-text-muted)]">
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

                <div className="border-t border-[color:var(--color-border)]" />

                {/* Actions */}
                <div className="flex gap-[var(--space-2)]">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => {
                      setMergeOpen(true)
                      setMergeSearch("")
                      setMergeResults([])
                      setMergeSecondaryId("")
                    }}
                    leadingIcon={<Merge className="h-4 w-4" />}
                  >
                    Merge Duplicate
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={() => setDeleteOpen(true)}
                    leadingIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Customer Modal */}
      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Add Customer</ModalTitle>
            <ModalDescription>
              Create a new customer profile. Duplicate phone or email will be flagged.
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <Text
                size="lg"
                label="First Name"
                required
                value={createForm.first_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, first_name: e.target.value }))}
              />
              <Text
                size="lg"
                label="Last Name"
                value={createForm.last_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </div>
            <Email
              size="lg"
              label="Email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Text
              size="lg"
              label="Phone"
              type="tel"
              value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
            />
            {createError && (
              <p className="text-[length:var(--type-subhead-size)] text-[color:var(--color-danger)]">
                {createError}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <ModalClose
              render={
                <Button variant="secondary" size="lg">
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={handleCreate}
              loading={createLoading}
              disabled={!createForm.first_name.trim()}
              size="lg"
            >
              Create Customer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Merge Modal */}
      <Modal open={mergeOpen} onOpenChange={setMergeOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Merge Customer</ModalTitle>
            <ModalDescription>
              Search for the duplicate record to merge into{" "}
              <strong>
                {selectedCustomer?.first_name} {selectedCustomer?.last_name}
              </strong>
              . All orders and data from the duplicate will be transferred.
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <div className="flex gap-[var(--space-2)]">
              <Text
                size="lg"
                placeholder="Search duplicate by name, email, phone..."
                value={mergeSearch}
                onChange={(e) => setMergeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleMergeSearch()
                }}
                className="flex-1"
              />
              <Button variant="secondary" size="lg" onClick={handleMergeSearch} aria-label="Search">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {mergeResults.length > 0 && (
              <div className="flex max-h-48 flex-col gap-[var(--space-1)] overflow-y-auto">
                {mergeResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setMergeSecondaryId(c.id)}
                    className={cn(
                      "btn-press touch-target flex w-full items-center justify-between rounded-[var(--radius-sm)] border px-[var(--space-3)] py-[var(--space-2)] text-left",
                      "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                      mergeSecondaryId === c.id
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-sidebar-active)]"
                        : "border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-hover)]",
                    )}
                  >
                    <div>
                      <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">
                        {c.first_name} {c.last_name}
                      </span>
                      <span className="ml-[var(--space-2)] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                        {c.email ?? c.phone ?? ""}
                      </span>
                    </div>
                    <span className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                      {c.total_visits} visits
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <ModalClose
              render={
                <Button variant="secondary" size="lg">
                  Cancel
                </Button>
              }
            />
            <Button
              onClick={handleMerge}
              loading={mergeLoading}
              disabled={!mergeSecondaryId}
              size="lg"
            >
              Merge Records
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete customer?"
        description={`This will permanently remove ${selectedCustomer?.first_name ?? ""} ${selectedCustomer?.last_name ?? ""}. Their order history will be preserved but unlinked.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
