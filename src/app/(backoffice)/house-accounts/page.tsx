"use client"

import * as React from "react"
import {
  Building2,
  Plus,
  Search,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  X,
  Receipt,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Mail,
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/shared/EmptyState"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HouseAccount {
  id: string
  org_id: string
  customer_id: string | null
  account_name: string
  credit_limit: string
  current_balance: string
  is_active: boolean
  billing_email: string | null
  billing_address: BillingAddress | null
  auto_pay: boolean
  payment_terms_days: number
  created_at: string
  updated_at: string
}

interface BillingAddress {
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
}

interface HouseAccountDetail extends HouseAccount {
  transactions: Transaction[]
}

interface Transaction {
  id: string
  house_account_id: string
  order_id: string | null
  amount: string
  type: string
  description: string
  created_at: string
}

interface StatementData {
  account: {
    id: string
    account_name: string
    billing_email: string | null
    billing_address: BillingAddress | null
    payment_terms_days: number
  }
  period: {
    date_from: string
    date_to: string
  }
  beginning_balance: number
  charges_total: number
  payments_total: number
  adjustments_total: number
  ending_balance: number
  transactions: Transaction[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getUtilization(balance: string, limit: string): number {
  const b = parseFloat(balance)
  const l = parseFloat(limit)
  if (l <= 0) return 0
  return Math.round((b / l) * 100)
}

function getUtilizationColor(pct: number): string {
  if (pct >= 80) return "text-destructive"
  if (pct >= 50) return "text-warning"
  return "text-success"
}

function getUtilizationBadge(pct: number): string {
  if (pct >= 80) return "bg-red-100 text-red-800 border-red-200"
  if (pct >= 50) return "bg-amber-100 text-amber-800 border-amber-200"
  return "bg-green-100 text-green-800 border-green-200"
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function firstOfMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

const TX_TYPE_COLORS: Record<string, string> = {
  charge: "bg-red-100 text-red-800 border-red-200",
  payment: "bg-green-100 text-green-800 border-green-200",
  adjustment: "bg-blue-100 text-blue-800 border-blue-200",
  credit: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HouseAccountsPage() {
  // -- List state --
  const [accounts, setAccounts] = React.useState<HouseAccount[]>([])
  const [pagination, setPagination] = React.useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    total_pages: 0,
  })
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [sortBy, setSortBy] = React.useState<"account_name" | "current_balance" | "credit_limit">("account_name")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")

  // -- Detail state --
  const [selectedAccount, setSelectedAccount] = React.useState<HouseAccountDetail | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)

  // -- Create dialog --
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createLoading, setCreateLoading] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [createForm, setCreateForm] = React.useState({
    account_name: "",
    credit_limit: "1000",
    billing_email: "",
    payment_terms_days: "30",
    auto_pay: false,
  })

  // -- Charge dialog --
  const [chargeOpen, setChargeOpen] = React.useState(false)
  const [chargeLoading, setChargeLoading] = React.useState(false)
  const [chargeForm, setChargeForm] = React.useState({
    amount: "",
    description: "",
  })

  // -- Payment dialog --
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentLoading, setPaymentLoading] = React.useState(false)
  const [paymentForm, setPaymentForm] = React.useState({
    amount: "",
    description: "",
  })

  // -- Statement state --
  const [statementOpen, setStatementOpen] = React.useState(false)
  const [statementLoading, setStatementLoading] = React.useState(false)
  const [statementData, setStatementData] = React.useState<StatementData | null>(null)
  const [statementDateFrom, setStatementDateFrom] = React.useState(firstOfMonthISO())
  const [statementDateTo, setStatementDateTo] = React.useState(todayISO())

  // ---- Fetch accounts ----
  const fetchAccounts = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: "25",
        status: "active",
      })
      if (search.trim()) {
        params.set("search", search.trim())
      }
      const res = await fetch(`/api/house-accounts?${params}`)
      if (res.ok) {
        const json = await res.json()
        setAccounts(json.data ?? [])
        setPagination(json.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [search, pagination.page])

  React.useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // ---- Fetch account detail ----
  async function fetchDetail(id: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/house-accounts/${id}`)
      if (res.ok) {
        const json = await res.json()
        setSelectedAccount(json.data as HouseAccountDetail)
      }
    } finally {
      setDetailLoading(false)
    }
  }

  function openDetail(account: HouseAccount) {
    setSheetOpen(true)
    fetchDetail(account.id)
  }

  // ---- Create account ----
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/house-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: createForm.account_name,
          credit_limit: parseFloat(createForm.credit_limit),
          billing_email: createForm.billing_email || null,
          payment_terms_days: parseInt(createForm.payment_terms_days, 10),
          auto_pay: createForm.auto_pay,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setCreateError(json.error ?? "Failed to create account")
        return
      }
      setCreateOpen(false)
      setCreateForm({
        account_name: "",
        credit_limit: "1000",
        billing_email: "",
        payment_terms_days: "30",
        auto_pay: false,
      })
      fetchAccounts()
    } finally {
      setCreateLoading(false)
    }
  }

  // ---- Charge to account ----
  async function handleCharge(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return
    setChargeLoading(true)
    try {
      const res = await fetch(`/api/house-accounts/${selectedAccount.id}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(chargeForm.amount),
          description: chargeForm.description || "Manual charge",
        }),
      })
      if (res.ok) {
        setChargeOpen(false)
        setChargeForm({ amount: "", description: "" })
        fetchDetail(selectedAccount.id)
        fetchAccounts()
      }
    } finally {
      setChargeLoading(false)
    }
  }

  // ---- Record payment ----
  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAccount) return
    setPaymentLoading(true)
    try {
      const res = await fetch(`/api/house-accounts/${selectedAccount.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          description: paymentForm.description || "Payment received",
        }),
      })
      if (res.ok) {
        setPaymentOpen(false)
        setPaymentForm({ amount: "", description: "" })
        fetchDetail(selectedAccount.id)
        fetchAccounts()
      }
    } finally {
      setPaymentLoading(false)
    }
  }

  // ---- Generate statement ----
  async function handleGenerateStatement() {
    if (!selectedAccount) return
    setStatementLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: statementDateFrom,
        date_to: statementDateTo,
      })
      const res = await fetch(
        `/api/house-accounts/${selectedAccount.id}/statement?${params}`
      )
      if (res.ok) {
        const json = await res.json()
        setStatementData(json.data as StatementData)
        setStatementOpen(true)
      }
    } finally {
      setStatementLoading(false)
    }
  }

  // ---- Sort handler ----
  function handleSort(col: typeof sortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortDir("asc")
    }
  }

  // ---- Client-side sort ----
  const sortedAccounts = React.useMemo(() => {
    const sorted = [...accounts]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortBy === "account_name") {
        cmp = a.account_name.localeCompare(b.account_name)
      } else if (sortBy === "current_balance") {
        cmp = parseFloat(a.current_balance) - parseFloat(b.current_balance)
      } else if (sortBy === "credit_limit") {
        cmp = parseFloat(a.credit_limit) - parseFloat(b.credit_limit)
      }
      return sortDir === "desc" ? -cmp : cmp
    })
    return sorted
  }, [accounts, sortBy, sortDir])

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return null
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">House Accounts</h1>
          <p className="page-subtitle">
            Manage charge accounts for corporate clients and trusted guests
          </p>
        </div>
        <Button className="btn-press touch-target" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedAccounts.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No house accounts"
            description="Create a house account for corporate clients or regular guests."
            actionLabel="Add Account"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("account_name")}
                >
                  Account Name
                  <SortIcon col="account_name" />
                </TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead
                  className="w-[140px] cursor-pointer select-none text-right"
                  onClick={() => handleSort("credit_limit")}
                >
                  Credit Limit
                  <SortIcon col="credit_limit" />
                </TableHead>
                <TableHead
                  className="w-[140px] cursor-pointer select-none text-right"
                  onClick={() => handleSort("current_balance")}
                >
                  Balance
                  <SortIcon col="current_balance" />
                </TableHead>
                <TableHead className="w-[120px] text-center">Utilization</TableHead>
                <TableHead className="w-[140px]">Terms</TableHead>
                <TableHead className="w-[120px]">Auto-Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAccounts.map((a) => {
                const util = getUtilization(a.current_balance, a.credit_limit)
                return (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(a)}
                  >
                    <TableCell className="font-medium">{a.account_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          a.is_active
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }
                      >
                        {a.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(a.credit_limit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(a.current_balance)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={getUtilizationBadge(util)}>
                        {util}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Net {a.payment_terms_days}
                    </TableCell>
                    <TableCell>
                      {a.auto_pay ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Auto
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Manual</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}
              &ndash;
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ========================== CREATE ACCOUNT DIALOG ========================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New House Account</DialogTitle>
            <DialogDescription>
              Create a charge account for a corporate client or trusted guest.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="acct-name">Account Name *</Label>
              <Input
                id="acct-name"
                placeholder="Company or individual name"
                value={createForm.account_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, account_name: e.target.value }))}
                className="h-12"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="acct-limit">Credit Limit ($)</Label>
                <Input
                  id="acct-limit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={createForm.credit_limit}
                  onChange={(e) => setCreateForm((f) => ({ ...f, credit_limit: e.target.value }))}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acct-terms">Payment Terms (days)</Label>
                <Input
                  id="acct-terms"
                  type="number"
                  min={0}
                  max={120}
                  value={createForm.payment_terms_days}
                  onChange={(e) => setCreateForm((f) => ({ ...f, payment_terms_days: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="acct-email">Billing Email</Label>
              <Input
                id="acct-email"
                type="email"
                placeholder="billing@company.com"
                value={createForm.billing_email}
                onChange={(e) => setCreateForm((f) => ({ ...f, billing_email: e.target.value }))}
                className="h-12"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="acct-autopay"
                checked={createForm.auto_pay}
                onCheckedChange={(checked) =>
                  setCreateForm((f) => ({ ...f, auto_pay: !!checked }))
                }
              />
              <Label htmlFor="acct-autopay">Enable auto-pay</Label>
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createLoading} className="btn-press">
                {createLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================== DETAIL SHEET ========================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Account Details</SheetTitle>
            <SheetDescription>
              View transactions and manage this house account.
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedAccount ? (
            <ScrollArea className="mt-4 h-[calc(100vh-120px)] pr-4">
              <div className="space-y-6">
                {/* Account header */}
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedAccount.account_name}
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        selectedAccount.is_active
                          ? "bg-green-100 text-green-800 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }
                    >
                      {selectedAccount.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={getUtilizationBadge(
                        getUtilization(selectedAccount.current_balance, selectedAccount.credit_limit)
                      )}
                    >
                      {getUtilization(selectedAccount.current_balance, selectedAccount.credit_limit)}% used
                    </Badge>
                  </div>
                </div>

                {/* Balance summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Current Balance
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {formatCurrency(selectedAccount.current_balance)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Credit Limit
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {formatCurrency(selectedAccount.credit_limit)}
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="btn-press touch-target flex-1"
                    onClick={() => {
                      setChargeForm({ amount: "", description: "" })
                      setChargeOpen(true)
                    }}
                  >
                    <ArrowUpCircle className="mr-1.5 h-4 w-4 text-destructive" />
                    Add Charge
                  </Button>
                  <Button
                    variant="outline"
                    className="btn-press touch-target flex-1"
                    onClick={() => {
                      setPaymentForm({ amount: "", description: "" })
                      setPaymentOpen(true)
                    }}
                  >
                    <ArrowDownCircle className="mr-1.5 h-4 w-4 text-success" />
                    Record Payment
                  </Button>
                </div>

                <Separator />

                {/* Account info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Terms</span>
                    <span>Net {selectedAccount.payment_terms_days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auto-Pay</span>
                    <span>{selectedAccount.auto_pay ? "Enabled" : "Disabled"}</span>
                  </div>
                  {selectedAccount.billing_email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Billing Email</span>
                      <span>{selectedAccount.billing_email}</span>
                    </div>
                  )}
                  {selectedAccount.billing_address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="text-right">
                        {[
                          selectedAccount.billing_address.line1,
                          selectedAccount.billing_address.city,
                          selectedAccount.billing_address.state,
                          selectedAccount.billing_address.zip,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Statement generation */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                    Generate Statement
                  </h4>
                  <div className="flex items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">From</Label>
                      <Input
                        type="date"
                        value={statementDateFrom}
                        onChange={(e) => setStatementDateFrom(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To</Label>
                      <Input
                        type="date"
                        value={statementDateTo}
                        onChange={(e) => setStatementDateTo(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="touch-target"
                      disabled={statementLoading}
                      onClick={handleGenerateStatement}
                    >
                      {statementLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-1 h-4 w-4" />
                      )}
                      Generate
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Transactions */}
                <div>
                  <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                    Recent Transactions
                  </h4>
                  {selectedAccount.transactions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No transactions yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAccount.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            {tx.type === "charge" ? (
                              <ArrowUpCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <ArrowDownCircle className="h-5 w-5 text-success" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(tx.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={TX_TYPE_COLORS[tx.type] ?? ""}
                            >
                              {tx.type}
                            </Badge>
                            <span
                              className={`tabular-nums font-medium ${
                                parseFloat(tx.amount) >= 0
                                  ? "text-destructive"
                                  : "text-success"
                              }`}
                            >
                              {parseFloat(tx.amount) >= 0 ? "+" : ""}
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pb-8" />
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ========================== CHARGE DIALOG ========================== */}
      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Charge</DialogTitle>
            <DialogDescription>
              Charge to {selectedAccount?.account_name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCharge} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="charge-amount">Amount ($) *</Label>
              <Input
                id="charge-amount"
                type="number"
                min={0.01}
                step="0.01"
                placeholder="0.00"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-12 text-lg tabular-nums"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="charge-desc">Description</Label>
              <Input
                id="charge-desc"
                placeholder="Order #, meal, etc."
                value={chargeForm.description}
                onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))}
                className="h-12"
              />
            </div>

            {selectedAccount && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(selectedAccount.current_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="tabular-nums">
                    {formatCurrency(selectedAccount.credit_limit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="tabular-nums font-medium text-success">
                    {formatCurrency(
                      parseFloat(selectedAccount.credit_limit) -
                        parseFloat(selectedAccount.current_balance)
                    )}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChargeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={chargeLoading} className="btn-press">
                {chargeLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Add Charge
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================== PAYMENT DIALOG ========================== */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedAccount?.account_name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount ($) *</Label>
              <Input
                id="payment-amount"
                type="number"
                min={0.01}
                step="0.01"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-12 text-lg tabular-nums"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-desc">Description</Label>
              <Input
                id="payment-desc"
                placeholder="Check #, wire, cash, etc."
                value={paymentForm.description}
                onChange={(e) => setPaymentForm((f) => ({ ...f, description: e.target.value }))}
                className="h-12"
              />
            </div>

            {selectedAccount && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(selectedAccount.current_balance)}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={paymentLoading} className="btn-press">
                {paymentLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================== STATEMENT DIALOG ========================== */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Account Statement</DialogTitle>
            <DialogDescription>
              {statementData
                ? `${statementData.account.account_name} — ${statementData.period.date_from} to ${statementData.period.date_to}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {statementData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Beginning Balance</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(statementData.beginning_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charges</span>
                  <span className="tabular-nums text-destructive">
                    +{formatCurrency(statementData.charges_total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payments</span>
                  <span className="tabular-nums text-success">
                    -{formatCurrency(statementData.payments_total)}
                  </span>
                </div>
                {statementData.adjustments_total !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Adjustments</span>
                    <span className="tabular-nums">
                      {formatCurrency(statementData.adjustments_total)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Ending Balance</span>
                  <span className="tabular-nums">
                    {formatCurrency(statementData.ending_balance)}
                  </span>
                </div>
              </div>

              {/* Transaction list */}
              {statementData.transactions.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                    Transactions
                  </h4>
                  <ScrollArea className="max-h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statementData.transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="text-xs tabular-nums">
                              {formatDate(tx.created_at)}
                            </TableCell>
                            <TableCell className="text-sm">{tx.description}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={TX_TYPE_COLORS[tx.type] ?? ""}
                              >
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {formatCurrency(tx.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setStatementOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
