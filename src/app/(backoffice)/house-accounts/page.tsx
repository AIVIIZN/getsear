"use client"

import * as React from "react"
import { AccountDashboard } from "@/components/house-accounts/AccountDashboard"
import {
  Building2,
  Plus,
  Search,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
} from "lucide-react"
import { Text } from "@/components/ui-v2/inputs/Text"
import { NumberInput } from "@/components/ui-v2/inputs/Number"
import { Email } from "@/components/ui-v2/inputs/Email"
import { Toggle } from "@/components/ui-v2/inputs/Toggle"
import { Field } from "@/components/ui-v2/inputs/Field"
import { Button } from "@/components/ui-v2/Button"
import { Badge } from "@/components/ui-v2/data/Badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
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
} from "@/components/ui-v2/Modal"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"

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

type SortKey = "account_name" | "current_balance" | "credit_limit"

type BadgeVariant = "default" | "primary" | "success" | "warning" | "danger" | "info"

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

function getUtilizationVariant(pct: number): BadgeVariant {
  if (pct >= 80) return "danger"
  if (pct >= 50) return "warning"
  return "success"
}

function txTypeVariant(type: string): BadgeVariant {
  switch (type) {
    case "charge":
      return "danger"
    case "payment":
      return "success"
    case "adjustment":
      return "info"
    case "credit":
      return "success"
    default:
      return "default"
  }
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function firstOfMonthISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
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
  const [sortBy, setSortBy] = React.useState<SortKey>("account_name")
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
  function handleSort(col: SortKey) {
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

  function SortIcon({ col }: { col: SortKey }) {
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
        <Button
          size="md"
          leadingIcon={<Plus />}
          onClick={() => setCreateOpen(true)}
        >
          Add Account
        </Button>
      </div>

      {/* AR Aging Dashboard */}
      <AccountDashboard />

      {/* Search */}
      <div className="max-w-sm">
        <Text
          placeholder="Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leadingIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : sortedAccounts.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No house accounts"
            description="Create a house account for corporate clients or regular guests."
            action={{ label: "Add Account", onClick: () => setCreateOpen(true) }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell
                  header
                  sortable
                  sortDirection={sortBy === "account_name" ? sortDir : null}
                  onSort={() => handleSort("account_name")}
                >
                  Account Name
                  <SortIcon col="account_name" />
                </TableCell>
                <TableCell header className="w-[120px]">
                  Status
                </TableCell>
                <TableCell
                  header
                  align="right"
                  className="w-[140px]"
                  sortable
                  sortDirection={sortBy === "credit_limit" ? sortDir : null}
                  onSort={() => handleSort("credit_limit")}
                >
                  Credit Limit
                  <SortIcon col="credit_limit" />
                </TableCell>
                <TableCell
                  header
                  align="right"
                  className="w-[140px]"
                  sortable
                  sortDirection={sortBy === "current_balance" ? sortDir : null}
                  onSort={() => handleSort("current_balance")}
                >
                  Balance
                  <SortIcon col="current_balance" />
                </TableCell>
                <TableCell header align="center" className="w-[120px]">
                  Utilization
                </TableCell>
                <TableCell header className="w-[140px]">
                  Terms
                </TableCell>
                <TableCell header className="w-[120px]">
                  Auto-Pay
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAccounts.map((a) => {
                const util = getUtilization(a.current_balance, a.credit_limit)
                return (
                  <TableRow
                    key={a.id}
                    interactive
                    onClick={() => openDetail(a)}
                  >
                    <TableCell className="font-[var(--weight-medium)]">{a.account_name}</TableCell>
                    <TableCell>
                      <Badge variant={a.is_active ? "success" : "default"}>
                        {a.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      {formatCurrency(a.credit_limit)}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">
                      {formatCurrency(a.current_balance)}
                    </TableCell>
                    <TableCell align="center">
                      <Badge variant={getUtilizationVariant(util)}>{util}%</Badge>
                    </TableCell>
                    <TableCell className="text-[var(--color-text-muted)]">
                      Net {a.payment_terms_days}
                    </TableCell>
                    <TableCell>
                      {a.auto_pay ? (
                        <Badge variant="info">Auto</Badge>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Manual</span>
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
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
            <p className="text-[length:var(--type-footnote-size)] text-[var(--color-text-muted)]">
              Showing {(pagination.page - 1) * pagination.limit + 1}
              &ndash;
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </p>
            <div className="flex gap-[var(--space-1)]">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="secondary"
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

      {/* ========================== CREATE ACCOUNT MODAL ========================== */}
      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>New House Account</ModalTitle>
            <ModalDescription>
              Create a charge account for a corporate client or trusted guest.
            </ModalDescription>
          </ModalHeader>

          <form onSubmit={handleCreate} className="contents">
            <ModalBody>
              <Text
                label="Account Name"
                placeholder="Company or individual name"
                required
                value={createForm.account_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, account_name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-[var(--space-3)]">
                <NumberInput
                  label="Credit Limit ($)"
                  min={0}
                  step="0.01"
                  value={createForm.credit_limit}
                  onChange={(e) => setCreateForm((f) => ({ ...f, credit_limit: e.target.value }))}
                />
                <NumberInput
                  label="Payment Terms (days)"
                  min={0}
                  max={120}
                  value={createForm.payment_terms_days}
                  onChange={(e) => setCreateForm((f) => ({ ...f, payment_terms_days: e.target.value }))}
                />
              </div>

              <Email
                label="Billing Email"
                placeholder="billing@company.com"
                value={createForm.billing_email}
                onChange={(e) => setCreateForm((f) => ({ ...f, billing_email: e.target.value }))}
              />

              <Toggle
                label="Enable auto-pay"
                checked={createForm.auto_pay}
                onChange={(checked) =>
                  setCreateForm((f) => ({ ...f, auto_pay: checked }))
                }
              />

              {createError && (
                <p className="text-[length:var(--type-footnote-size)] text-[var(--color-danger)]">
                  {createError}
                </p>
              )}
            </ModalBody>

            <ModalFooter>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="md" loading={createLoading}>
                Create Account
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ========================== DETAIL SHEET ========================== */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent width="lg">
          <SheetHeader>
            <SheetTitle>Account Details</SheetTitle>
            <SheetDescription>
              View transactions and manage this house account.
            </SheetDescription>
          </SheetHeader>

          <SheetBody>
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : selectedAccount ? (
              <div className="space-y-6">
                {/* Account header */}
                <div>
                  <h3 className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">
                    {selectedAccount.account_name}
                  </h3>
                  <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
                    <Badge variant={selectedAccount.is_active ? "success" : "default"}>
                      {selectedAccount.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge
                      variant={getUtilizationVariant(
                        getUtilization(selectedAccount.current_balance, selectedAccount.credit_limit)
                      )}
                    >
                      {getUtilization(selectedAccount.current_balance, selectedAccount.credit_limit)}% used
                    </Badge>
                  </div>
                </div>

                {/* Balance summary */}
                <div className="grid grid-cols-2 gap-[var(--space-4)]">
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
                    <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)] uppercase tracking-wider">
                      Current Balance
                    </p>
                    <p className="mt-[var(--space-1)] text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                      {formatCurrency(selectedAccount.current_balance)}
                    </p>
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
                    <p className="text-[length:var(--type-caption-1-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)] uppercase tracking-wider">
                      Credit Limit
                    </p>
                    <p className="mt-[var(--space-1)] text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                      {formatCurrency(selectedAccount.credit_limit)}
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex gap-[var(--space-2)]">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    leadingIcon={<ArrowUpCircle className="text-[var(--color-danger)]" />}
                    onClick={() => {
                      setChargeForm({ amount: "", description: "" })
                      setChargeOpen(true)
                    }}
                  >
                    Add Charge
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    leadingIcon={<ArrowDownCircle className="text-[var(--color-success)]" />}
                    onClick={() => {
                      setPaymentForm({ amount: "", description: "" })
                      setPaymentOpen(true)
                    }}
                  >
                    Record Payment
                  </Button>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Account info */}
                <div className="space-y-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Payment Terms</span>
                    <span>Net {selectedAccount.payment_terms_days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Auto-Pay</span>
                    <span>{selectedAccount.auto_pay ? "Enabled" : "Disabled"}</span>
                  </div>
                  {selectedAccount.billing_email && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Billing Email</span>
                      <span>{selectedAccount.billing_email}</span>
                    </div>
                  )}
                  {selectedAccount.billing_address && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Address</span>
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

                <div className="border-t border-[var(--color-border)]" />

                {/* Statement generation */}
                <div>
                  <h4 className="mb-[var(--space-3)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                    Generate Statement
                  </h4>
                  <div className="flex items-end gap-[var(--space-2)]">
                    <Field id="stmt-from" label="From" className="flex-1">
                      <Text
                        id="stmt-from"
                        type="date"
                        value={statementDateFrom}
                        onChange={(e) => setStatementDateFrom(e.target.value)}
                      />
                    </Field>
                    <Field id="stmt-to" label="To" className="flex-1">
                      <Text
                        id="stmt-to"
                        type="date"
                        value={statementDateTo}
                        onChange={(e) => setStatementDateTo(e.target.value)}
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      size="md"
                      loading={statementLoading}
                      leadingIcon={<FileText />}
                      onClick={handleGenerateStatement}
                    >
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Transactions */}
                <div>
                  <h4 className="mb-[var(--space-3)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                    Recent Transactions
                  </h4>
                  {selectedAccount.transactions.length === 0 ? (
                    <p className="py-[var(--space-4)] text-center text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
                      No transactions yet
                    </p>
                  ) : (
                    <div className="space-y-[var(--space-2)]">
                      {selectedAccount.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-3)]"
                        >
                          <div className="flex items-center gap-[var(--space-3)]">
                            {tx.type === "charge" ? (
                              <ArrowUpCircle className="h-5 w-5 text-[var(--color-danger)]" />
                            ) : (
                              <ArrowDownCircle className="h-5 w-5 text-[var(--color-success)]" />
                            )}
                            <div>
                              <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">
                                {tx.description}
                              </p>
                              <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                                {formatDateTime(tx.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-[var(--space-2)]">
                            <Badge variant={txTypeVariant(tx.type)}>{tx.type}</Badge>
                            <span
                              className={
                                "tabular-nums font-[var(--weight-medium)] " +
                                (parseFloat(tx.amount) >= 0
                                  ? "text-[var(--color-danger)]"
                                  : "text-[var(--color-success)]")
                              }
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
              </div>
            ) : null}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* ========================== CHARGE MODAL ========================== */}
      <Modal open={chargeOpen} onOpenChange={setChargeOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Add Charge</ModalTitle>
            <ModalDescription>
              Charge to {selectedAccount?.account_name}
            </ModalDescription>
          </ModalHeader>

          <form onSubmit={handleCharge} className="contents">
            <ModalBody>
              <NumberInput
                label="Amount ($)"
                required
                min={0.01}
                step="0.01"
                placeholder="0.00"
                size="lg"
                value={chargeForm.amount}
                onChange={(e) => setChargeForm((f) => ({ ...f, amount: e.target.value }))}
                className="text-[length:var(--type-title-3-size)] tabular-nums"
              />

              <Text
                label="Description"
                placeholder="Order #, meal, etc."
                value={chargeForm.description}
                onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))}
              />

              {selectedAccount && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] p-[var(--space-3)] text-[length:var(--type-subhead-size)] space-y-[var(--space-1)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Current Balance</span>
                    <span className="tabular-nums font-[var(--weight-medium)]">
                      {formatCurrency(selectedAccount.current_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Credit Limit</span>
                    <span className="tabular-nums">
                      {formatCurrency(selectedAccount.credit_limit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Available</span>
                    <span className="tabular-nums font-[var(--weight-medium)] text-[var(--color-success)]">
                      {formatCurrency(
                        parseFloat(selectedAccount.credit_limit) -
                          parseFloat(selectedAccount.current_balance)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button type="button" variant="secondary" size="md" onClick={() => setChargeOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="md" loading={chargeLoading}>
                Add Charge
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ========================== PAYMENT MODAL ========================== */}
      <Modal open={paymentOpen} onOpenChange={setPaymentOpen}>
        <ModalContent size="sm">
          <ModalHeader>
            <ModalTitle>Record Payment</ModalTitle>
            <ModalDescription>
              Record a payment for {selectedAccount?.account_name}
            </ModalDescription>
          </ModalHeader>

          <form onSubmit={handlePayment} className="contents">
            <ModalBody>
              <NumberInput
                label="Amount ($)"
                required
                min={0.01}
                step="0.01"
                placeholder="0.00"
                size="lg"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                className="text-[length:var(--type-title-3-size)] tabular-nums"
              />

              <Text
                label="Description"
                placeholder="Check #, wire, cash, etc."
                value={paymentForm.description}
                onChange={(e) => setPaymentForm((f) => ({ ...f, description: e.target.value }))}
              />

              {selectedAccount && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-muted)] p-[var(--space-3)] text-[length:var(--type-subhead-size)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Current Balance</span>
                    <span className="tabular-nums font-[var(--weight-medium)]">
                      {formatCurrency(selectedAccount.current_balance)}
                    </span>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter>
              <Button type="button" variant="secondary" size="md" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="md" loading={paymentLoading}>
                Record Payment
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* ========================== STATEMENT MODAL ========================== */}
      <Modal open={statementOpen} onOpenChange={setStatementOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Account Statement</ModalTitle>
            <ModalDescription>
              {statementData
                ? `${statementData.account.account_name} — ${statementData.period.date_from} to ${statementData.period.date_to}`
                : ""}
            </ModalDescription>
          </ModalHeader>

          {statementData && (
            <>
              <ModalBody>
                {/* Summary */}
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-4)] space-y-[var(--space-2)] text-[length:var(--type-subhead-size)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Beginning Balance</span>
                    <span className="tabular-nums font-[var(--weight-medium)]">
                      {formatCurrency(statementData.beginning_balance)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Charges</span>
                    <span className="tabular-nums text-[var(--color-danger)]">
                      +{formatCurrency(statementData.charges_total)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Payments</span>
                    <span className="tabular-nums text-[var(--color-success)]">
                      -{formatCurrency(statementData.payments_total)}
                    </span>
                  </div>
                  {statementData.adjustments_total !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Adjustments</span>
                      <span className="tabular-nums">
                        {formatCurrency(statementData.adjustments_total)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[var(--color-border)]" />
                  <div className="flex justify-between font-[var(--weight-semibold)]">
                    <span>Ending Balance</span>
                    <span className="tabular-nums">
                      {formatCurrency(statementData.ending_balance)}
                    </span>
                  </div>
                </div>

                {/* Transaction list */}
                {statementData.transactions.length > 0 && (
                  <div>
                    <h4 className="mb-[var(--space-2)] text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text-muted)]">
                      Transactions
                    </h4>
                    <div className="max-h-[300px] overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
                      <Table responsive={false}>
                        <TableHeader>
                          <TableRow>
                            <TableCell header>Date</TableCell>
                            <TableCell header>Description</TableCell>
                            <TableCell header>Type</TableCell>
                            <TableCell header align="right">
                              Amount
                            </TableCell>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {statementData.transactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-[length:var(--type-caption-1-size)] tabular-nums">
                                {formatDate(tx.created_at)}
                              </TableCell>
                              <TableCell>{tx.description}</TableCell>
                              <TableCell>
                                <Badge variant={txTypeVariant(tx.type)}>{tx.type}</Badge>
                              </TableCell>
                              <TableCell align="right" className="tabular-nums font-[var(--weight-medium)]">
                                {formatCurrency(tx.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </ModalBody>

              <ModalFooter>
                <Button variant="secondary" size="md" onClick={() => setStatementOpen(false)}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
