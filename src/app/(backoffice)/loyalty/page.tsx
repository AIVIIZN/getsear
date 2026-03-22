"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Award,
  Plus,
  Loader2,
  Check,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

function tierColor(tier: string): string {
  switch (tier.toLowerCase()) {
    case "bronze":
      return "bg-amber-600/10 text-amber-700 border-amber-600/20";
    case "silver":
      return "bg-gray-400/10 text-gray-600 border-gray-400/20";
    case "gold":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "platinum":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function txTypeIcon(type: string) {
  switch (type) {
    case "earn":
      return <ArrowUpRight className="h-4 w-4 text-success" />;
    case "redeem":
      return <ArrowDownRight className="h-4 w-4 text-info" />;
    case "adjust":
      return <Activity className="h-4 w-4 text-warning" />;
    case "expire":
      return <ArrowDownRight className="h-4 w-4 text-destructive" />;
    default:
      return <Hash className="h-4 w-4 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LoyaltyPage() {
  const [activeTab, setActiveTab] = useState("programs");

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
    type: "points" as "points" | "visits" | "spend",
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
    type: "points" as "points" | "visits" | "spend",
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
  const totalPointsOutstanding = accounts.reduce((sum, a) => sum + (a.points_balance ?? 0), 0);
  const totalEarned = accounts.reduce((sum, a) => sum + (a.total_earned ?? 0), 0);
  const totalRedeemed = accounts.reduce((sum, a) => sum + (a.total_redeemed ?? 0), 0);
  const redemptionRate = totalEarned > 0 ? ((totalRedeemed / totalEarned) * 100).toFixed(1) : "0.0";

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
          a.id.toLowerCase().includes(accountSearch.toLowerCase())
      )
    : accounts;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Loyalty Program
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage loyalty programs, member accounts, and analytics
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => v && setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="programs" className="touch-target-lg gap-2">
            <Award className="h-4 w-4" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="accounts" className="touch-target-lg gap-2">
            <Users className="h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="analytics" className="touch-target-lg gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ==================== PROGRAMS ==================== */}
        <TabsContent value="programs" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {programs.length} program{programs.length !== 1 ? "s" : ""}
            </p>
            <Button
              className="touch-target-lg btn-press"
              onClick={() => setShowCreateProgram(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Program
            </Button>
          </div>

          {programsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : programs.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No loyalty programs"
              description="Create a loyalty program to start rewarding customers."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map((program) => (
                <Card
                  key={program.id}
                  className="shadow-warm-sm hover:shadow-warm-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Star className="h-4 w-4 text-primary" />
                        {program.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={program.is_active ? "default" : "secondary"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditProgram(program)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="font-medium">{programTypeLabel(program.type)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Earn Rate</p>
                        <p className="font-medium tabular-nums">
                          {program.type === "visits"
                            ? `${program.points_per_visit} pts/visit`
                            : `${program.points_per_dollar} pts/$`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Redeem At</p>
                        <p className="font-medium tabular-nums">
                          {program.redemption_threshold} pts
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Reward Value</p>
                        <p className="font-medium tabular-nums">
                          ${program.reward_value.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== ACCOUNTS ==================== */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer or account ID..."
                className="pl-10 touch-target-lg"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchAccounts}
              className="touch-target-lg"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredAccounts.length} account{filteredAccounts.length !== 1 ? "s" : ""}
            </div>
          </div>

          {accountsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
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
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Total Earned</TableHead>
                    <TableHead className="text-right">Redeemed</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id} className="touch-target-lg">
                      <TableCell className="font-medium">
                        {account.customer_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tierColor(account.tier)}>
                          {account.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {(account.points_balance ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(account.total_earned ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(account.total_redeemed ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(account.enrolled_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => fetchAccountDetail(account.id)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
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
            <SheetContent className="sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>Account Details</SheetTitle>
                <SheetDescription>
                  Customer {selectedAccount?.customer_id.slice(0, 8)}...
                </SheetDescription>
              </SheetHeader>
              {accountDetailLoading ? (
                <div className="space-y-3 mt-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : selectedAccount ? (
                <div className="mt-4 space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="shadow-warm-sm">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="text-xl font-semibold tabular-nums">
                          {selectedAccount.points_balance.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-warm-sm">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Tier</p>
                        <Badge
                          variant="outline"
                          className={`mt-1 ${tierColor(selectedAccount.tier)}`}
                        >
                          {selectedAccount.tier}
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card className="shadow-warm-sm">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Earned</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {selectedAccount.total_earned.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="shadow-warm-sm">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Redeemed</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {selectedAccount.total_redeemed.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Transactions */}
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Recent Transactions
                    </h3>
                    {selectedAccount.transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No transactions yet
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {selectedAccount.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-2 rounded-lg border"
                          >
                            <div className="flex items-center gap-2">
                              {txTypeIcon(tx.type)}
                              <div>
                                <p className="text-sm font-medium">
                                  {tx.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(tx.created_at)}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                tx.points > 0
                                  ? "text-success"
                                  : tx.points < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
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
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* ==================== ANALYTICS ==================== */}
        <TabsContent value="analytics" className="space-y-6">
          {accountsLoading ? (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full p-2 bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Total Members
                      </span>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totalMembers.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full p-2 bg-warning/10">
                        <Star className="h-4 w-4 text-warning" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Points Outstanding
                      </span>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totalPointsOutstanding.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full p-2 bg-success/10">
                        <TrendingUp className="h-4 w-4 text-success" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Total Earned
                      </span>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {totalEarned.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full p-2 bg-info/10">
                        <Gift className="h-4 w-4 text-info" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Redemption Rate
                      </span>
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {redemptionRate}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Tier Distribution */}
              <Card className="shadow-warm-sm">
                <CardHeader>
                  <CardTitle className="text-base">Tier Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No members yet to show distribution
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {["bronze", "silver", "gold", "platinum"].map((tier) => {
                        const count = accounts.filter(
                          (a) => (a.tier ?? "bronze").toLowerCase() === tier
                        ).length;
                        const pct =
                          accounts.length > 0
                            ? ((count / accounts.length) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <div key={tier} className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className={`w-20 justify-center ${tierColor(tier)}`}
                            >
                              {tier}
                            </Badge>
                            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${Math.max(parseFloat(pct), 0)}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm tabular-nums w-16 text-right text-muted-foreground">
                              {count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Earned vs Redeemed */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Total Points Issued
                    </p>
                    <p className="text-3xl font-semibold tabular-nums mt-1">
                      {totalEarned.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-warm-sm">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      Total Points Redeemed
                    </p>
                    <p className="text-3xl font-semibold tabular-nums mt-1">
                      {totalRedeemed.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== CREATE PROGRAM SHEET ==================== */}
      <Sheet open={showCreateProgram} onOpenChange={setShowCreateProgram}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New Loyalty Program</SheetTitle>
            <SheetDescription>
              Configure how customers earn and redeem rewards
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prog-name">Program Name</Label>
              <Input
                id="prog-name"
                placeholder="e.g. Sear Rewards"
                value={programForm.name}
                onChange={(e) =>
                  setProgramForm((p) => ({ ...p, name: e.target.value }))
                }
                className="touch-target-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Program Type</Label>
              <Select
                value={programForm.type}
                onValueChange={(v) =>
                  v &&
                  setProgramForm((p) => ({
                    ...p,
                    type: v as "points" | "visits" | "spend",
                  }))
                }
              >
                <SelectTrigger className="touch-target-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points per Dollar</SelectItem>
                  <SelectItem value="visits">Points per Visit</SelectItem>
                  <SelectItem value="spend">Spend-based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {programForm.type === "visits" ? (
              <div className="space-y-2">
                <Label htmlFor="ppv">Points per Visit</Label>
                <Input
                  id="ppv"
                  type="number"
                  min={1}
                  value={programForm.points_per_visit}
                  onChange={(e) =>
                    setProgramForm((p) => ({
                      ...p,
                      points_per_visit: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="touch-target-lg"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="ppd">Points per Dollar</Label>
                <Input
                  id="ppd"
                  type="number"
                  min={0}
                  step={0.1}
                  value={programForm.points_per_dollar}
                  onChange={(e) =>
                    setProgramForm((p) => ({
                      ...p,
                      points_per_dollar: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="touch-target-lg"
                />
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="threshold">Redemption Threshold (points)</Label>
              <Input
                id="threshold"
                type="number"
                min={1}
                value={programForm.redemption_threshold}
                onChange={(e) =>
                  setProgramForm((p) => ({
                    ...p,
                    redemption_threshold: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="touch-target-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward-val">Reward Value ($)</Label>
              <Input
                id="reward-val"
                type="number"
                min={0}
                step={0.01}
                value={programForm.reward_value}
                onChange={(e) =>
                  setProgramForm((p) => ({
                    ...p,
                    reward_value: parseFloat(e.target.value) || 0,
                  }))
                }
                className="touch-target-lg"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={programForm.is_active}
                onCheckedChange={(checked) =>
                  setProgramForm((p) => ({ ...p, is_active: checked }))
                }
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button
              className="w-full touch-target-lg btn-press"
              onClick={handleCreateProgram}
              disabled={creating || !programForm.name.trim()}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Program
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ==================== EDIT PROGRAM DIALOG ==================== */}
      <Dialog
        open={!!editProgram}
        onOpenChange={(open) => {
          if (!open) setEditProgram(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Program</DialogTitle>
            <DialogDescription>
              Update {editProgram?.name} settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                className="touch-target-lg"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) =>
                  v &&
                  setEditForm((p) => ({
                    ...p,
                    type: v as "points" | "visits" | "spend",
                  }))
                }
              >
                <SelectTrigger className="touch-target-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="points">Points per Dollar</SelectItem>
                  <SelectItem value="visits">Points per Visit</SelectItem>
                  <SelectItem value="spend">Spend-based</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Redemption Threshold</Label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.redemption_threshold}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      redemption_threshold: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="touch-target-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Reward Value ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={editForm.reward_value}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      reward_value: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="touch-target-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) =>
                  setEditForm((p) => ({ ...p, is_active: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditProgram(null)}
              className="touch-target-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProgram}
              disabled={saving || !editForm.name.trim()}
              className="touch-target-lg btn-press"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== ADJUST POINTS DIALOG ==================== */}
      <Dialog
        open={!!adjustAccount}
        onOpenChange={(open) => {
          if (!open) {
            setAdjustAccount(null);
            setAdjustPoints("");
            setAdjustReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Points Adjustment</DialogTitle>
            <DialogDescription>
              Current balance:{" "}
              {(adjustAccount?.points_balance ?? 0).toLocaleString()} points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjust-pts">Points (positive to add, negative to deduct)</Label>
              <Input
                id="adjust-pts"
                type="number"
                placeholder="e.g. 50 or -25"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(e.target.value)}
                className="touch-target-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Textarea
                id="adjust-reason"
                placeholder="e.g. Goodwill credit, correction..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="touch-target-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustAccount(null);
                setAdjustPoints("");
                setAdjustReason("");
              }}
              className="touch-target-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={
                adjusting || !adjustPoints || !adjustReason.trim() || adjustPoints === "0"
              }
              className="touch-target-lg btn-press"
            >
              {adjusting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Adjust Points
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
