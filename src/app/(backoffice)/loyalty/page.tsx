"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Award,
  Plus,
  Search,
  Users,
  TrendingUp,
  Star,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Pencil,
  ChevronRight,
  Hash,
  Activity,
  LayoutDashboard,
  Crown,
  Check,
} from "lucide-react";
import { LoyaltyDashboard } from "@/components/loyalty/LoyaltyDashboard";
import { TierEditor } from "@/components/loyalty/TierEditor";
import { RewardsCatalog } from "@/components/loyalty/RewardsCatalog";
import { MemberLookup } from "@/components/loyalty/MemberLookup";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Text } from "@/components/ui-v2/inputs/Text";
import { NumberInput } from "@/components/ui-v2/inputs/Number";
import { Select } from "@/components/ui-v2/inputs/Select";
import { Toggle } from "@/components/ui-v2/inputs/Toggle";
import { Textarea } from "@/components/ui-v2/inputs/Textarea";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge, type BadgeProps } from "@/components/ui-v2/data/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui-v2/data/Table";
import { Tabs } from "@/components/ui-v2/navigation/Tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
} from "@/components/ui-v2/Sheet";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from "@/components/ui-v2/Modal";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoyaltyProgram {
  id: string;
  org_id: string;
  name: string;
  type: "points" | "visits" | "spend";
  points_per_dollar: number;
  points_per_visit: number;
  redemption_threshold: number;
  reward_value: number;
  is_active: boolean;
  created_at: string;
}

interface LoyaltyAccount {
  id: string;
  org_id: string;
  customer_id: string;
  program_id: string;
  points_balance: number;
  tier: string;
  total_earned: number;
  total_redeemed: number;
  enrolled_at: string;
}

interface LoyaltyAccountDetail extends LoyaltyAccount {
  transactions: LoyaltyTransaction[];
}

interface LoyaltyTransaction {
  id: string;
  loyalty_account_id: string;
  order_id: string | null;
  type: "earn" | "redeem" | "adjust" | "expire";
  points: number;
  description: string;
  created_at: string;
}

type ProgramType = "points" | "visits" | "spend";
type BadgeVariant = NonNullable<BadgeProps["variant"]>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function programTypeLabel(type: string): string {
  switch (type) {
    case "points":
      return "Points per Dollar";
    case "visits":
      return "Points per Visit";
    case "spend":
      return "Spend-based";
    default:
      return type;
  }
}

function tierVariant(tier: string): BadgeVariant {
  switch (tier.toLowerCase()) {
    case "bronze":
      return "warning";
    case "silver":
      return "default";
    case "gold":
      return "warning";
    case "platinum":
      return "primary";
    default:
      return "default";
  }
}

function txTypeIcon(type: string) {
  switch (type) {
    case "earn":
      return <ArrowUpRight className="h-4 w-4 text-[var(--color-success)]" />;
    case "redeem":
      return <ArrowDownRight className="h-4 w-4 text-[var(--color-primary)]" />;
    case "adjust":
      return <Activity className="h-4 w-4 text-[var(--color-warning)]" />;
    case "expire":
      return <ArrowDownRight className="h-4 w-4 text-[var(--color-danger)]" />;
    default:
      return <Hash className="h-4 w-4 text-[var(--color-text-muted)]" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoyaltyPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Programs state
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);

  // Accounts state
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccountDetail | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);

  // Create program
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [creating, setCreating] = useState(false);
  const [programForm, setProgramForm] = useState({
    name: "",
    type: "points" as ProgramType,
    points_per_dollar: 1,
    points_per_visit: 10,
    redemption_threshold: 100,
    reward_value: 5,
    is_active: true,
  });

  // Edit program
  const [editProgram, setEditProgram] = useState<LoyaltyProgram | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "points" as ProgramType,
    points_per_dollar: 1,
    points_per_visit: 10,
    redemption_threshold: 100,
    reward_value: 5,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  // Adjust dialog
  const [adjustAccount, setAdjustAccount] = useState<LoyaltyAccount | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Analytics (computed from accounts)
  const totalMembers = accounts.length;
  const totalPointsOutstanding = accounts.reduce(
    (sum, a) => sum + (a.points_balance ?? 0),
    0,
  );
  const totalEarned = accounts.reduce((sum, a) => sum + (a.total_earned ?? 0), 0);
  const totalRedeemed = accounts.reduce((sum, a) => sum + (a.total_redeemed ?? 0), 0);
  const redemptionRate =
    totalEarned > 0 ? ((totalRedeemed / totalEarned) * 100).toFixed(1) : "0.0";

  // ---------- Fetch Programs ----------
  const fetchPrograms = useCallback(async () => {
    setProgramsLoading(true);
    try {
      const res = await fetch("/api/loyalty/programs");
      if (!res.ok) throw new Error("Failed to fetch programs");
      const json = await res.json();
      setPrograms(json.data ?? []);
    } catch {
      toast.error("Failed to load loyalty programs");
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  // ---------- Fetch Accounts ----------
  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      const res = await fetch(`/api/loyalty/accounts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const json = await res.json();
      setAccounts(json.data ?? []);
    } catch {
      toast.error("Failed to load loyalty accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  // ---------- Fetch Account Detail ----------
  const fetchAccountDetail = useCallback(async (accountId: string) => {
    setAccountDetailLoading(true);
    try {
      const res = await fetch(`/api/loyalty/accounts/${accountId}`);
      if (!res.ok) throw new Error("Failed to fetch account");
      const json = await res.json();
      setSelectedAccount(json.data as LoyaltyAccountDetail);
    } catch {
      toast.error("Failed to load account details");
    } finally {
      setAccountDetailLoading(false);
    }
  }, []);

  // ---------- Initial loads ----------
  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    if (activeTab === "accounts" || activeTab === "analytics") {
      fetchAccounts();
    }
  }, [activeTab, fetchAccounts]);

  // ---------- Create Program ----------
  async function handleCreateProgram() {
    if (!programForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/loyalty/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programForm),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to create");
      }
      toast.success("Loyalty program created");
      setShowCreateProgram(false);
      setProgramForm({
        name: "",
        type: "points",
        points_per_dollar: 1,
        points_per_visit: 10,
        redemption_threshold: 100,
        reward_value: 5,
        is_active: true,
      });
      fetchPrograms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create program");
    } finally {
      setCreating(false);
    }
  }

  // ---------- Edit Program ----------
  function openEditProgram(program: LoyaltyProgram) {
    setEditProgram(program);
    setEditForm({
      name: program.name,
      type: program.type,
      points_per_dollar: program.points_per_dollar,
      points_per_visit: program.points_per_visit,
      redemption_threshold: program.redemption_threshold,
      reward_value: program.reward_value,
      is_active: program.is_active,
    });
  }

  async function handleEditProgram() {
    if (!editProgram) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/loyalty/programs/${editProgram.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to update");
      }
      toast.success("Program updated");
      setEditProgram(null);
      fetchPrograms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update program");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Adjust Points ----------
  async function handleAdjust() {
    if (!adjustAccount || !adjustPoints || !adjustReason.trim()) return;
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) {
      toast.error("Points must be a non-zero number");
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch(`/api/loyalty/accounts/${adjustAccount.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: pts,
          description: adjustReason.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to adjust");
      }
      toast.success(`Points adjusted by ${pts > 0 ? "+" : ""}${pts}`);
      setAdjustAccount(null);
      setAdjustPoints("");
      setAdjustReason("");
      fetchAccounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to adjust points");
    } finally {
      setAdjusting(false);
    }
  }

  // ---------- Filter accounts ----------
  const filteredAccounts = accountSearch.trim()
    ? accounts.filter(
        (a) =>
          a.customer_id.toLowerCase().includes(accountSearch.toLowerCase()) ||
          a.id.toLowerCase().includes(accountSearch.toLowerCase()),
      )
    : accounts;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Loyalty Program</h1>
        <p className="page-subtitle">
          Manage loyalty programs, member accounts, and analytics
        </p>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <Tabs
          variant="line"
          size="md"
          value={activeTab}
          onValueChange={setActiveTab}
          ariaLabel="Loyalty sections"
          items={[
            { value: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
            { value: "programs", label: "Programs", icon: <Award /> },
            { value: "members", label: "Members", icon: <Users /> },
            { value: "rewards", label: "Rewards", icon: <Gift /> },
            { value: "tiers", label: "Tiers", icon: <Crown /> },
            { value: "accounts", label: "Accounts", icon: <Users /> },
            { value: "analytics", label: "Analytics", icon: <TrendingUp /> },
          ]}
        />
      </div>

      {/* ==================== DASHBOARD ==================== */}
      {activeTab === "dashboard" && (
        <div role="tabpanel" aria-label="Dashboard" className="space-y-4">
          <LoyaltyDashboard />
        </div>
      )}

      {/* ==================== MEMBERS ==================== */}
      {activeTab === "members" && (
        <div role="tabpanel" aria-label="Members" className="space-y-4">
          <MemberLookup />
        </div>
      )}

      {/* ==================== REWARDS ==================== */}
      {activeTab === "rewards" && (
        <div role="tabpanel" aria-label="Rewards" className="space-y-4">
          <RewardsCatalog />
        </div>
      )}

      {/* ==================== TIERS ==================== */}
      {activeTab === "tiers" && (
        <div role="tabpanel" aria-label="Tiers" className="space-y-4">
          <TierEditor />
        </div>
      )}

      {/* ==================== PROGRAMS ==================== */}
      {activeTab === "programs" && (
        <div role="tabpanel" aria-label="Programs" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
              {programs.length} program{programs.length !== 1 ? "s" : ""}
            </p>
            <Button size="md" leadingIcon={<Plus />} onClick={() => setShowCreateProgram(true)}>
              New Program
            </Button>
          </div>

          {programsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : programs.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No loyalty programs"
              description="Create a loyalty program to start rewarding customers."
              action={{ label: "New Program", onClick: () => setShowCreateProgram(true) }}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map((program) => (
                <Card key={program.id} variant="elevated" padding="compact">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[length:var(--type-headline-size)] flex items-center gap-[var(--space-2)]">
                        <Star className="h-4 w-4 text-[var(--color-primary)]" />
                        {program.name}
                      </CardTitle>
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Badge variant={program.is_active ? "success" : "default"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Edit program"
                          onClick={() => openEditProgram(program)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <div className="grid grid-cols-2 gap-[var(--space-3)] text-[length:var(--type-subhead-size)]">
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Type
                        </p>
                        <p className="font-[var(--weight-medium)]">
                          {programTypeLabel(program.type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Earn Rate
                        </p>
                        <p className="font-[var(--weight-medium)] tabular-nums">
                          {program.type === "visits"
                            ? `${program.points_per_visit} pts/visit`
                            : `${program.points_per_dollar} pts/$`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Redeem At
                        </p>
                        <p className="font-[var(--weight-medium)] tabular-nums">
                          {program.redemption_threshold} pts
                        </p>
                      </div>
                      <div>
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Reward Value
                        </p>
                        <p className="font-[var(--weight-medium)] tabular-nums">
                          ${program.reward_value.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== ACCOUNTS ==================== */}
      {activeTab === "accounts" && (
        <div role="tabpanel" aria-label="Accounts" className="space-y-4">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="flex-1 max-w-sm">
              <Text
                aria-label="Search accounts"
                placeholder="Search by customer or account ID..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                leadingIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              aria-label="Refresh"
              onClick={fetchAccounts}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="ml-auto text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)]">
              {filteredAccounts.length} account{filteredAccounts.length !== 1 ? "s" : ""}
            </div>
          </div>

          {accountsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="table-row" />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No loyalty accounts"
              description={
                accountSearch
                  ? "No accounts match your search."
                  : "Customers will appear here when enrolled."
              }
            />
          ) : (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Customer</TableCell>
                    <TableCell header>Tier</TableCell>
                    <TableCell header align="right">
                      Balance
                    </TableCell>
                    <TableCell header align="right">
                      Total Earned
                    </TableCell>
                    <TableCell header align="right">
                      Redeemed
                    </TableCell>
                    <TableCell header>Enrolled</TableCell>
                    <TableCell header className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-[var(--weight-medium)]">
                        {account.customer_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={tierVariant(account.tier)}>{account.tier}</Badge>
                      </TableCell>
                      <TableCell align="right" className="tabular-nums font-[var(--weight-semibold)]">
                        {(account.points_balance ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {(account.total_earned ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" className="tabular-nums">
                        {(account.total_redeemed ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[var(--color-text-muted)]">
                        {formatDate(account.enrolled_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-[var(--space-1)] justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="View account"
                            onClick={() => fetchAccountDetail(account.id)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Adjust points"
                            onClick={() => {
                              setAdjustAccount(account);
                              setAdjustPoints("");
                              setAdjustReason("");
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Account Detail Sheet */}
          <Sheet
            open={!!selectedAccount}
            onOpenChange={(open) => {
              if (!open) setSelectedAccount(null);
            }}
          >
            <SheetContent width="lg">
              <SheetHeader>
                <SheetTitle>Account Details</SheetTitle>
                <SheetDescription>
                  Customer {selectedAccount?.customer_id.slice(0, 8)}...
                </SheetDescription>
              </SheetHeader>
              <SheetBody>
                {accountDetailLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-12 w-full rounded-[var(--radius-md)]"
                      />
                    ))}
                  </div>
                ) : selectedAccount ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-[var(--space-3)]">
                      <Card variant="elevated" padding="compact">
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Balance
                        </p>
                        <p className="text-[length:var(--type-title-3-size)] font-[var(--weight-semibold)] tabular-nums">
                          {selectedAccount.points_balance.toLocaleString()}
                        </p>
                      </Card>
                      <Card variant="elevated" padding="compact">
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Tier
                        </p>
                        <Badge
                          variant={tierVariant(selectedAccount.tier)}
                          className="mt-[var(--space-1)]"
                        >
                          {selectedAccount.tier}
                        </Badge>
                      </Card>
                      <Card variant="elevated" padding="compact">
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Total Earned
                        </p>
                        <p className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums">
                          {selectedAccount.total_earned.toLocaleString()}
                        </p>
                      </Card>
                      <Card variant="elevated" padding="compact">
                        <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                          Redeemed
                        </p>
                        <p className="text-[length:var(--type-headline-size)] font-[var(--weight-semibold)] tabular-nums">
                          {selectedAccount.total_redeemed.toLocaleString()}
                        </p>
                      </Card>
                    </div>

                    <div className="border-t border-[var(--color-border)]" />

                    {/* Transactions */}
                    <div>
                      <h3 className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] mb-[var(--space-2)]">
                        Recent Transactions
                      </h3>
                      {selectedAccount.transactions.length === 0 ? (
                        <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] py-4 text-center">
                          No transactions yet
                        </p>
                      ) : (
                        <div className="space-y-[var(--space-2)] max-h-[400px] overflow-y-auto">
                          {selectedAccount.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="flex items-center justify-between p-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)]"
                            >
                              <div className="flex items-center gap-[var(--space-2)]">
                                {txTypeIcon(tx.type)}
                                <div>
                                  <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)]">
                                    {tx.description}
                                  </p>
                                  <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                                    {formatDateTime(tx.created_at)}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={
                                  "text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] tabular-nums " +
                                  (tx.points > 0
                                    ? "text-[var(--color-success)]"
                                    : tx.points < 0
                                      ? "text-[var(--color-danger)]"
                                      : "text-[var(--color-text-muted)]")
                                }
                              >
                                {tx.points > 0 ? "+" : ""}
                                {tx.points}
                              </span>
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
        </div>
      )}

      {/* ==================== ANALYTICS ==================== */}
      {activeTab === "analytics" && (
        <div role="tabpanel" aria-label="Analytics" className="space-y-6">
          {accountsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-md)]" />
              ))}
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card variant="elevated" padding="compact">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                    <div className="rounded-full p-[var(--space-2)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]">
                      <Users className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>
                    <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                      Total Members
                    </span>
                  </div>
                  <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                    {totalMembers.toLocaleString()}
                  </p>
                </Card>

                <Card variant="elevated" padding="compact">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                    <div className="rounded-full p-[var(--space-2)] bg-[var(--color-warning-bg)]">
                      <Star className="h-4 w-4 text-[var(--color-warning)]" />
                    </div>
                    <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                      Points Outstanding
                    </span>
                  </div>
                  <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                    {totalPointsOutstanding.toLocaleString()}
                  </p>
                </Card>

                <Card variant="elevated" padding="compact">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                    <div className="rounded-full p-[var(--space-2)] bg-[var(--color-success-bg)]">
                      <TrendingUp className="h-4 w-4 text-[var(--color-success)]" />
                    </div>
                    <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                      Total Earned
                    </span>
                  </div>
                  <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                    {totalEarned.toLocaleString()}
                  </p>
                </Card>

                <Card variant="elevated" padding="compact">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-2)]">
                    <div className="rounded-full p-[var(--space-2)] bg-[color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
                      <Gift className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>
                    <span className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                      Redemption Rate
                    </span>
                  </div>
                  <p className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] tabular-nums">
                    {redemptionRate}%
                  </p>
                </Card>
              </div>

              <div className="border-t border-[var(--color-border)]" />

              {/* Tier Distribution */}
              <Card variant="elevated" padding="default">
                <CardHeader>
                  <CardTitle className="text-[length:var(--type-headline-size)]">
                    Tier Distribution
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  {accounts.length === 0 ? (
                    <p className="text-[length:var(--type-subhead-size)] text-[var(--color-text-muted)] text-center py-8">
                      No members yet to show distribution
                    </p>
                  ) : (
                    <div className="space-y-[var(--space-3)]">
                      {["bronze", "silver", "gold", "platinum"].map((tier) => {
                        const count = accounts.filter(
                          (a) => (a.tier ?? "bronze").toLowerCase() === tier,
                        ).length;
                        const pct =
                          accounts.length > 0
                            ? ((count / accounts.length) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <div key={tier} className="flex items-center gap-[var(--space-3)]">
                            <Badge variant={tierVariant(tier)} className="w-20 justify-center">
                              {tier}
                            </Badge>
                            <div className="flex-1 h-3 rounded-full bg-[var(--color-bg-muted)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                                style={{ width: `${Math.max(parseFloat(pct), 0)}%` }}
                              />
                            </div>
                            <span className="text-[length:var(--type-subhead-size)] tabular-nums w-16 text-right text-[var(--color-text-muted)]">
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Earned vs Redeemed */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card variant="elevated" padding="compact">
                  <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                    Total Points Issued
                  </p>
                  <p className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] tabular-nums mt-[var(--space-1)]">
                    {totalEarned.toLocaleString()}
                  </p>
                </Card>
                <Card variant="elevated" padding="compact">
                  <p className="text-[length:var(--type-caption-1-size)] text-[var(--color-text-muted)]">
                    Total Points Redeemed
                  </p>
                  <p className="text-[length:var(--type-title-1-size)] font-[var(--weight-semibold)] tabular-nums mt-[var(--space-1)]">
                    {totalRedeemed.toLocaleString()}
                  </p>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== CREATE PROGRAM SHEET ==================== */}
      <Sheet open={showCreateProgram} onOpenChange={setShowCreateProgram}>
        <SheetContent width="md">
          <SheetHeader>
            <SheetTitle>New Loyalty Program</SheetTitle>
            <SheetDescription>
              Configure how customers earn and redeem rewards
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-4">
              <Text
                label="Program Name"
                placeholder="e.g. Sear Rewards"
                value={programForm.name}
                onChange={(e) =>
                  setProgramForm((p) => ({ ...p, name: e.target.value }))
                }
              />

              <Select<ProgramType>
                label="Program Type"
                value={programForm.type}
                onChange={(v) => setProgramForm((p) => ({ ...p, type: v }))}
                options={[
                  { value: "points", label: "Points per Dollar" },
                  { value: "visits", label: "Points per Visit" },
                  { value: "spend", label: "Spend-based" },
                ]}
              />

              {programForm.type === "visits" ? (
                <NumberInput
                  label="Points per Visit"
                  min={1}
                  value={programForm.points_per_visit}
                  onChange={(e) =>
                    setProgramForm((p) => ({
                      ...p,
                      points_per_visit: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              ) : (
                <NumberInput
                  label="Points per Dollar"
                  min={0}
                  step={0.1}
                  value={programForm.points_per_dollar}
                  onChange={(e) =>
                    setProgramForm((p) => ({
                      ...p,
                      points_per_dollar: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              )}

              <div className="border-t border-[var(--color-border)]" />

              <NumberInput
                label="Redemption Threshold (points)"
                min={1}
                value={programForm.redemption_threshold}
                onChange={(e) =>
                  setProgramForm((p) => ({
                    ...p,
                    redemption_threshold: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />

              <NumberInput
                label="Reward Value ($)"
                min={0}
                step={0.01}
                value={programForm.reward_value}
                onChange={(e) =>
                  setProgramForm((p) => ({
                    ...p,
                    reward_value: parseFloat(e.target.value) || 0,
                  }))
                }
              />

              <Toggle
                label="Active"
                checked={programForm.is_active}
                onChange={(checked) =>
                  setProgramForm((p) => ({ ...p, is_active: checked }))
                }
              />
            </div>
          </SheetBody>
          <div className="border-t border-[var(--color-border)] px-[var(--space-6)] py-[var(--space-4)] [padding-bottom:max(var(--space-4),env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              className="w-full"
              loading={creating}
              disabled={!programForm.name.trim()}
              leadingIcon={<Plus />}
              onClick={handleCreateProgram}
            >
              Create Program
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ==================== EDIT PROGRAM MODAL ==================== */}
      <Modal
        open={!!editProgram}
        onOpenChange={(open) => {
          if (!open) setEditProgram(null);
        }}
      >
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Edit Program</ModalTitle>
            <ModalDescription>Update {editProgram?.name} settings</ModalDescription>
          </ModalHeader>
          <ModalBody>
            <Text
              label="Name"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
            />

            <Select<ProgramType>
              label="Type"
              value={editForm.type}
              onChange={(v) => setEditForm((p) => ({ ...p, type: v }))}
              options={[
                { value: "points", label: "Points per Dollar" },
                { value: "visits", label: "Points per Visit" },
                { value: "spend", label: "Spend-based" },
              ]}
            />

            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <NumberInput
                label="Redemption Threshold"
                min={1}
                value={editForm.redemption_threshold}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    redemption_threshold: parseInt(e.target.value, 10) || 1,
                  }))
                }
              />
              <NumberInput
                label="Reward Value ($)"
                min={0}
                step={0.01}
                value={editForm.reward_value}
                onChange={(e) =>
                  setEditForm((p) => ({
                    ...p,
                    reward_value: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            <Toggle
              label="Active"
              checked={editForm.is_active}
              onChange={(checked) => setEditForm((p) => ({ ...p, is_active: checked }))}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditProgram(null)}
            >
              Cancel
            </Button>
            <Button
              size="md"
              loading={saving}
              disabled={!editForm.name.trim()}
              leadingIcon={<Check />}
              onClick={handleEditProgram}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ==================== ADJUST POINTS MODAL ==================== */}
      <Modal
        open={!!adjustAccount}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustAccount(null);
            setAdjustPoints("");
            setAdjustReason("");
          }
        }}
      >
        <ModalContent size="md">
          <ModalHeader>
            <ModalTitle>Manual Points Adjustment</ModalTitle>
            <ModalDescription>
              Current balance:{" "}
              {(adjustAccount?.points_balance ?? 0).toLocaleString()} points
            </ModalDescription>
          </ModalHeader>
          <ModalBody>
            <NumberInput
              label="Points (positive to add, negative to deduct)"
              placeholder="e.g. 50 or -25"
              value={adjustPoints}
              onChange={(e) => setAdjustPoints(e.target.value)}
            />
            <Textarea
              label="Reason"
              placeholder="e.g. Goodwill credit, correction..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setAdjustAccount(null);
                setAdjustPoints("");
                setAdjustReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="md"
              loading={adjusting}
              disabled={!adjustPoints || !adjustReason.trim() || adjustPoints === "0"}
              leadingIcon={<Check />}
              onClick={handleAdjust}
            >
              Adjust Points
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
